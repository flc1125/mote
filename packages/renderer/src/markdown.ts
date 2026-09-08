import MarkdownIt from 'markdown-it';

import { resolveAssetUrl } from './assets.js';
import { slugify, type Heading } from './headings.js';
import { footnote, taskLists } from './plugins.js';
import { sanitizeHtml, createHtmlSanitizer } from './sanitize.js';
import { isSafeImageUrl, isSafeLinkUrl } from './urls.js';

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
  });

  md.use(footnote);
  md.use(taskLists, { enabled: false, label: true, labelAfter: true });

  // Sanitize raw HTML: every html_block / html_inline token goes through
  // the allowlist sanitizer before it can reach the output. html_block
  // tokens are self-contained; html_inline fragments share one streaming
  // sanitizer so paired tags split across tokens stay nested.
  //
  // Rule placement matters: the task-lists plugin anchors its checkbox
  // injection right after the 'inline' rule (ruler.after). Registering
  // this sanitizer with ruler.after('inline', ...) LAST places it between
  // 'inline' and the plugin rules, so user HTML is sanitized while
  // plugin-generated tokens (disabled checkboxes, labels, footnote
  // markup) never pass through the sanitizer.
  md.core.ruler.after('inline', 'mote_sanitize_html', (state) => {
    const inline = createHtmlSanitizer();
    let lastInlineToken: { content: string } | null = null;
    for (const token of state.tokens) {
      if (token.type === 'html_block') {
        token.content = sanitizeHtml(token.content);
        continue;
      }
      if (token.type === 'inline' && token.children) {
        for (const child of token.children) {
          if (child.type === 'html_inline') {
            child.content = inline.feed(child.content);
            lastInlineToken = child;
          }
        }
      }
    }
    if (lastInlineToken) {
      lastInlineToken.content += inline.flush();
    } else {
      inline.flush();
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
      const resolved = resolveAssetUrl(src, assetUrls);
      if (resolved !== null) {
        token.attrSet('src', resolved);
      } else if (!isSafeImageUrl(src)) {
        token.attrSet('src', '');
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
      if (href !== '' && !isSafeLinkUrl(href)) token.attrSet('href', '');
    }
    return defaultLinkOpen
      ? defaultLinkOpen(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  const env: { headings?: Heading[] } = {};
  const html = md.render(markdown, env);
  return { html, headings: env.headings ?? [] };
}
