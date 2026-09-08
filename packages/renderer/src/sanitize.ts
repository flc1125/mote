import { Parser } from 'htmlparser2';

import { escapeHtml } from './escape.js';
import { isSafeImageUrl, isSafeLinkUrl } from './urls.js';

/**
 * Allowlist sanitizer for raw HTML in Markdown documents (baseline §26).
 *
 * Real-world Markdown (READMEs especially) uses a small set of
 * presentational HTML: aligned paragraphs, <picture> badges, <details>
 * collapsibles, <sub>/<sup>. Those are allowed through with a strict
 * per-tag attribute allowlist; everything else is neutralized.
 *
 * Parsing uses htmlparser2 — a real HTML tokenizer — never regex.
 * Never allowed, regardless of context: script/style/iframe/svg/math,
 * form and media elements, event handlers (on*), style, class, id.
 */

/** Tags removed together with their entire subtree. */
const DROP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'video',
  'audio',
  'canvas',
  'template',
  'noscript',
  'frame',
  'frameset',
  'meta',
  'link',
  'base',
  'title',
  'applet',
]);

const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'span',
  'br',
  'hr',
  'wbr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'details',
  'summary',
  'picture',
  'source',
  'img',
  'sub',
  'sup',
  'kbd',
  'abbr',
  'mark',
  'center',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'del',
  'ins',
  'small',
  'code',
  'pre',
  'blockquote',
  'q',
  'cite',
  'a',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'figure',
  'figcaption',
]);

const VOID_TAGS = new Set(['br', 'hr', 'wbr', 'img', 'source', 'col']);

/** Attributes allowed on any allowed tag. */
const GLOBAL_ATTRS = new Set(['title']);

/** Per-tag attribute allowlist (beyond the global set). */
const TAG_ATTRS: Record<string, ReadonlySet<string>> = {
  a: new Set(['href']),
  img: new Set(['src', 'srcset', 'alt', 'width', 'height']),
  source: new Set(['srcset', 'media', 'type', 'width', 'height']),
  details: new Set(['open']),
  ol: new Set(['start', 'type', 'reversed']),
  li: new Set(['value']),
  td: new Set(['align', 'colspan', 'rowspan']),
  th: new Set(['align', 'colspan', 'rowspan']),
  col: new Set(['span', 'align']),
};

const ALIGN_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'table',
  'caption',
]);

const BOOLEAN_ATTRS = new Set(['open', 'reversed']);
const NUMERIC_ATTRS = new Set(['start', 'value', 'span', 'colspan', 'rowspan']);
const DIMENSION_ATTRS = new Set(['width', 'height']);

const ALIGN_RE = /^(left|center|right)$/;
const OL_TYPE_RE = /^[1aAiI]$/;
const MIME_RE = /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$/;
const MEDIA_QUERY_RE = /^[a-zA-Z0-9:(),.\s<>=-]{1,300}$/;

/** Keeps only srcset candidates whose URL passes the image-URL policy. */
function sanitizeSrcset(value: string): string | null {
  const kept: string[] = [];
  for (const candidate of value.split(',')) {
    const parts = candidate.trim().split(/\s+/).filter(Boolean);
    const url = parts[0];
    if (url && isSafeImageUrl(url)) kept.push(parts.join(' '));
  }
  return kept.length > 0 ? kept.join(', ') : null;
}

function isAllowedAttr(tag: string, name: string): boolean {
  if (GLOBAL_ATTRS.has(name)) return true;
  if (name === 'align') return ALIGN_TAGS.has(tag) || (TAG_ATTRS[tag]?.has(name) ?? false);
  return TAG_ATTRS[tag]?.has(name) ?? false;
}

function sanitizeAttrValue(tag: string, name: string, value: string): string | null {
  if (name === 'href') return isSafeLinkUrl(value) ? value : null;
  if (name === 'src') return isSafeImageUrl(value) ? value : null;
  if (name === 'srcset') return sanitizeSrcset(value);
  if (name === 'align') return ALIGN_RE.test(value.toLowerCase()) ? value.toLowerCase() : null;
  if (NUMERIC_ATTRS.has(name)) return /^\d{1,4}$/.test(value) ? value : null;
  if (DIMENSION_ATTRS.has(name)) return /^\d{1,4}%?$/.test(value) ? value : null;
  if (name === 'type' && tag === 'ol') return OL_TYPE_RE.test(value) ? value : null;
  if (name === 'type' && tag === 'source') return MIME_RE.test(value) ? value : null;
  if (name === 'media') return MEDIA_QUERY_RE.test(value) ? value : null;
  // Textual attributes (title, alt): escaped at emit time.
  return value.length <= 1024 ? value : null;
}

function sanitizeAttrs(tag: string, attribs: Record<string, string>): string {
  let out = '';
  for (const [rawName, rawValue] of Object.entries(attribs)) {
    const name = rawName.toLowerCase();
    if (name.startsWith('on') || name === 'style' || name === 'class' || name === 'id') {
      continue;
    }
    if (!isAllowedAttr(tag, name)) continue;
    if (BOOLEAN_ATTRS.has(name)) {
      out += ` ${name}`;
      continue;
    }
    const value = sanitizeAttrValue(tag, name, rawValue);
    if (value === null) continue;
    out += ` ${name}="${escapeHtml(value)}"`;
  }
  return out;
}

/**
 * A streaming HTML sanitizer. markdown-it splits inline HTML into separate
 * html_inline tokens (`<sub>`, text, `</sub>`), so paired tags must be
 * tracked across fragments: feed() sanitizes one fragment while keeping
 * the open-tag stack, and flush() closes whatever is still open.
 *
 * Limitation: markdown text interleaved *between* html_inline tokens is
 * outside the sanitizer's reach, so a drop-content tag split across
 * tokens (e.g. inline `<script>`) loses its elements but its inner text
 * survives as inert escaped text. Block-level dangerous HTML is removed
 * entirely (see sanitizeHtml).
 */
export function createHtmlSanitizer(): { feed: (html: string) => string; flush: () => string } {
  const openTags: string[] = [];
  const droppedTags: string[] = [];
  let dropDepth = 0;
  let out = '';

  // One parser for the whole stream: parser.end() auto-closes open tags,
  // so it must only run in flush(), never between fragments.
  const parser = new Parser({
    onopentag(name, attribs) {
      const tag = name.toLowerCase();
      if (dropDepth > 0) {
        if (DROP_CONTENT_TAGS.has(tag)) dropDepth++;
        return;
      }
      if (DROP_CONTENT_TAGS.has(tag)) {
        dropDepth = 1;
        return;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        droppedTags.push(tag);
        return;
      }
      out += `<${tag}${sanitizeAttrs(tag, attribs)}>`;
      if (!VOID_TAGS.has(tag)) openTags.push(tag);
    },
    ontext(text) {
      if (dropDepth === 0) out += escapeHtml(text);
    },
    onclosetag(name) {
      const tag = name.toLowerCase();
      if (dropDepth > 0) {
        if (DROP_CONTENT_TAGS.has(tag)) dropDepth--;
        return;
      }
      const droppedIndex = droppedTags.lastIndexOf(tag);
      if (droppedIndex !== -1) {
        droppedTags.splice(droppedIndex, 1);
        return;
      }
      const openIndex = openTags.lastIndexOf(tag);
      if (openIndex === -1) return;
      // Repair misnesting: close everything still open above this tag.
      while (openTags.length > openIndex) {
        out += `</${openTags.pop()}>`;
      }
    },
    oncomment() {},
  });

  function feed(html: string): string {
    out = '';
    parser.write(html);
    return out;
  }

  function flush(): string {
    out = '';
    // parser.end() emits onclosetag for anything still open, which the
    // handler above turns into closing tags.
    parser.end();
    droppedTags.length = 0;
    dropDepth = 0;
    return out;
  }

  return { feed, flush };
}

/**
 * Sanitizes one self-contained HTML fragment (an html_block token's raw
 * content). Disallowed formatting tags are dropped but their text is
 * kept; DROP_CONTENT_TAGS vanish entirely; the result is always
 * well-nested (unclosed tags are closed, misnesting is repaired).
 */
export function sanitizeHtml(html: string): string {
  const sanitizer = createHtmlSanitizer();
  return sanitizer.feed(html) + sanitizer.flush();
}
