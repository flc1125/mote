import MarkdownIt from 'markdown-it';

import { isLocalReference, isRemoteUrl } from '@mote/core';

import { resolveAssetUrl } from './assets.js';
import { slugify, type Heading } from './headings.js';

export interface MarkdownRenderResult {
  html: string;
  headings: Heading[];
}

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Links may point to http(s), mailto, fragments, or relative references.
 * Everything with another scheme (javascript:, data:, vbscript:, file:, ...),
 * protocol-relative URLs, and absolute paths are stripped (baseline §57).
 * markdown-it already neutralizes bad protocols at parse time; this is a
 * second layer of defense.
 */
function isSafeLinkUrl(url: string): boolean {
  if (url.startsWith('#')) return true;
  if (isRemoteUrl(url)) return true;
  if (/^mailto:/i.test(url)) return true;
  if (SCHEME_RE.test(url)) return false;
  if (url.startsWith('/')) return false;
  return isLocalReference(url);
}

/**
 * Images may point to http(s) (remote assets, baseline §32), to public
 * asset URLs (root-absolute, produced by the asset rewrite), or keep an
 * unresolved relative reference. Anything with another scheme (notably
 * javascript: and data:) is stripped.
 */
function isSafeImageUrl(url: string): boolean {
  if (url.startsWith('/')) return true;
  if (isRemoteUrl(url)) return true;
  if (SCHEME_RE.test(url)) return false;
  return isLocalReference(url);
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
 * Security configuration (baseline §26): raw HTML is disabled, so no
 * Markdown input can become an HTML element.
 */
export function renderMarkdown(
  markdown: string,
  assetUrls: Map<string, string>,
): MarkdownRenderResult {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: false,
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
