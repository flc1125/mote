import type { MarkdownIt } from 'markdown-it';
// @ts-expect-error -- the locked plugin has no type declarations
import footnotePlugin from 'markdown-it-footnote';

import { containerSyntax } from './container-syntax.js';
import { imageSyntax } from './image-syntax.js';
import { mathSyntax } from './math-syntax.js';

const footnote = footnotePlugin as (md: MarkdownIt) => void;

export interface DocumentSyntaxOptions {
  /** Disable container syntax only for baseline comparisons and isolated parsing. */
  containers?: boolean;
}

/** Install shared structure before renderer-only presentation rules. */
export function documentSyntax(md: MarkdownIt, options: DocumentSyntaxOptions = {}): void {
  md.use(mathSyntax);
  md.use(imageSyntax);
  md.use(footnote);
  if (options.containers !== false) md.use(containerSyntax);
}
