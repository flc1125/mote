import { Parser } from 'htmlparser2';
import MarkdownIt from 'markdown-it';

import { isLocalReference, mathSyntax, stripFrontMatter } from '@mote/core';

interface TokenLike {
  type: string;
  content: string;
  children: TokenLike[] | null;
  attrGet(name: string): string | null;
}

// html: true so raw HTML surfaces as html_block / html_inline tokens
// (with html: false it degrades to inert text and could not be scanned).
const md = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false });
md.use(mathSyntax);

function collect(url: string, into: string[], seen: Set<string>): void {
  if (url !== '' && isLocalReference(url) && !seen.has(url)) {
    seen.add(url);
    into.push(url);
  }
}

/**
 * Collects local image references from one raw-HTML fragment
 * (html_block / html_inline token content) with a real HTML tokenizer —
 * never regex. Covers <img src>, <img srcset>, and <source srcset>, the
 * shapes README-style badges and <picture> blocks actually use.
 */
function collectHtmlImages(html: string, into: string[], seen: Set<string>): void {
  const parser = new Parser({
    onopentag(name, attribs) {
      const tag = name.toLowerCase();
      if (tag !== 'img' && tag !== 'source') return;
      if (tag === 'img' && attribs.src !== undefined) {
        collect(attribs.src, into, seen);
      }
      if (attribs.srcset !== undefined) {
        for (const candidate of attribs.srcset.split(',')) {
          const url = candidate.trim().split(/\s+/)[0];
          if (url !== undefined) collect(url, into, seen);
        }
      }
    },
  });
  parser.write(html);
  parser.end();
}

function collectImages(tokens: TokenLike[], into: string[], seen: Set<string>): void {
  for (const token of tokens) {
    if (token.type === 'image') {
      const src = token.attrGet('src');
      if (src !== null) collect(src, into, seen);
    }
    if (token.type === 'html_block' || token.type === 'html_inline') {
      collectHtmlImages(token.content, into, seen);
    }
    if (token.children !== null) collectImages(token.children, into, seen);
  }
}

/**
 * Extracts local image references from Markdown using the markdown-it AST
 * (baseline §22 — never regex). Covers inline images, reference-style
 * images, images nested inside links, and images in raw HTML (<img>,
 * <picture>/<source>). Remote URLs and non-file schemes are skipped. Each
 * distinct spelling is returned once, in order of first appearance.
 */
export function extractLocalImageReferences(markdown: string): string[] {
  const tokens = md.parse(stripFrontMatter(markdown), {}) as unknown as TokenLike[];
  const references: string[] = [];
  collectImages(tokens, references, new Set());
  return references;
}
