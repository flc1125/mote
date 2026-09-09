import MarkdownIt from 'markdown-it';

import { stripFrontMatter } from '@mote/core';

import { alerts } from './alerts.js';
import { resolveAssetUrl } from './assets.js';
import { cjkEmphasis } from './cjk-emphasis.js';
import { slugify, type Heading } from './headings.js';
import { createCodeHighlighter } from './highlight.js';
import { footnote, taskLists } from './plugins.js';
import { createHtmlSanitizer } from './sanitize.js';
import { safeImageUrl, safeLinkUrl } from './urls.js';

export interface MarkdownRenderResult {
  html: string;
  headings: Heading[];
}

interface InlineTokenLike {
  type: string;
  content: string;
  children: InlineTokenLike[] | null;
}

/** Plain text of a heading's inline token, used for slugs and the TOC. */
function inlineTextContent(token: InlineTokenLike): string {
  if (token.type === 'text' || token.type === 'code_inline') return token.content;
  return (token.children ?? []).map((child) => inlineTextContent(child)).join('');
}

/**
 * Renders Markdown to an HTML fragment and collects headings.
 *
 * Security configuration (baseline §26): raw HTML is allowed but every
 * html_block / html_inline token passes through the allowlist sanitizer
 * (see sanitize.ts) — only presentational tags with vetted attributes
 * survive; scriptable vectors are stripped. GFM extensions come from
 * markdown-it core (tables, strikethrough, linkify) plus the footnote
 * and task-lists plugins (task lists render as disabled checkboxes,
 * keeping pages JavaScript-free).
 */
export function renderMarkdown(
  markdown: string,
  assetUrls: Map<string, string>,
): MarkdownRenderResult {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    typographer: false,
    highlight: createCodeHighlighter(),
  });

  md.use(cjkEmphasis);
  md.use(alerts);
  md.use(footnote);
  // Wrap the parsed inline tokens instead of labelAfter, which reinserts raw
  // Markdown as label text and assigns random IDs to otherwise static output.
  md.use(taskLists, { enabled: false, label: true, labelAfter: false });

  // The focusable wrapper lets keyboard users scroll wide Markdown tables
  // without compressing columns or widening the whole document.
  md.renderer.rules.table_open = () =>
    '<div class="table-scroll" role="region" aria-label="表格 / Table" tabindex="0">\n<table>\n';
  md.renderer.rules.table_close = () => '</table>\n</div>\n';

  // Sanitize raw HTML: every html_block / html_inline token goes through
  // one document-level streaming sanitizer before it can reach the
  // output. markdown-it splits HTML at blank lines (blocks) and around
  // text (inline), so a single stream keeps paired tags nested across
  // fragments — this is what lets <details> wrap Markdown blocks the way
  // GitHub renders them.
  //
  // Rule placement matters: the task-lists plugin anchors its checkbox
  // injection right after the 'inline' rule (ruler.after). Registering
  // this sanitizer with ruler.after('inline', ...) LAST places it between
  // 'inline' and the plugin rules, so user HTML is sanitized while
  // plugin-generated tokens (disabled checkboxes, labels, footnote
  // markup) never pass through the sanitizer.
  md.core.ruler.after('inline', 'mote_sanitize_html', (state) => {
    const stream = createHtmlSanitizer({
      resolveAsset: (url) => resolveAssetUrl(url, assetUrls),
    });
    let lastHtmlToken: { content: string } | null = null;
    for (const token of state.tokens) {
      if (token.type === 'html_block') {
        token.content = stream.feed(token.content);
        lastHtmlToken = token;
        continue;
      }
      if (token.type === 'inline' && token.children) {
        for (const child of token.children) {
          if (child.type === 'html_inline') {
            child.content = stream.feed(child.content);
            lastHtmlToken = child;
          }
        }
      }
    }
    const tail = stream.flush();
    if (lastHtmlToken && tail !== '') {
      lastHtmlToken.content += tail;
    }
  });

  // Heading anchors: slugify every heading, set its id, collect for the TOC.
  md.core.ruler.push('mote_headings', (state) => {
    const used = new Map<string, number>();
    const headings: Heading[] = [];

    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token?.type !== 'heading_open') continue;
      const inline = state.tokens[i + 1];
      if (inline?.type !== 'inline') continue;

      const text = inlineTextContent(inline);
      const slug = slugify(text, used);
      token.attrSet('id', slug);
      headings.push({ level: Number(token.tag.slice(1)), text, slug });
    }

    (state.env as { headings?: Heading[] }).headings = headings;
  });

  // Local asset rewrite (§31) + dangerous image src stripping (§57).
  // Delegates to the default rule afterwards so alt text is still rendered.
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token) {
      const src = String(token.attrGet('src') ?? '');
      const resolved = resolveAssetUrl(src, assetUrls) ?? safeImageUrl(src);
      if (resolved === null) {
        token.attrSet('src', '');
      } else {
        token.attrSet('src', resolved);
      }
    }
    return defaultImage
      ? defaultImage(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  // Dangerous link href stripping (§57), defense in depth. Note that
  // markdown-it already refuses to parse invalid-protocol destinations
  // (javascript:, data:, ...) as links — they remain inert literal text.
  const defaultLinkOpen = md.renderer.rules.link_open;
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token) {
      const href = String(token.attrGet('href') ?? '');
      if (href !== '') {
        const safe = safeLinkUrl(href);
        token.attrSet('href', safe ?? '');
      }
    }
    return defaultLinkOpen
      ? defaultLinkOpen(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  const env: { headings?: Heading[] } = {};
  const html = md.render(stripFrontMatter(markdown), env);
  return { html, headings: env.headings ?? [] };
}
