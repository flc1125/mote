import MarkdownIt from 'markdown-it';

import { isLocalReference } from '@mote/core';

interface TokenLike {
  type: string;
  children: TokenLike[] | null;
  attrGet(name: string): string | null;
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: false });

function collectImages(tokens: TokenLike[], into: string[], seen: Set<string>): void {
  for (const token of tokens) {
    if (token.type === 'image') {
      const src = token.attrGet('src');
      if (src !== null && src !== '' && isLocalReference(src) && !seen.has(src)) {
        seen.add(src);
        into.push(src);
      }
    }
    if (token.children !== null) collectImages(token.children, into, seen);
  }
}

/**
 * Extracts local image references from Markdown using the markdown-it AST
 * (baseline §22 — never regex). Covers inline images and reference-style
 * images, including images nested inside links. Remote URLs and non-file
 * schemes are skipped. Each distinct spelling is returned once, in order of
 * first appearance.
 */
export function extractLocalImageReferences(markdown: string): string[] {
  const tokens = md.parse(markdown, {}) as unknown as TokenLike[];
  const references: string[] = [];
  collectImages(tokens, references, new Set());
  return references;
}
