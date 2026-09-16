import type { MarkdownIt } from 'markdown-it';
// @ts-expect-error -- the locked plugin has no type declarations
import footnotePlugin from 'markdown-it-footnote';
// @ts-expect-error -- the locked plugin has no type declarations
import markPlugin from 'markdown-it-mark';
// @ts-expect-error -- the locked plugin has no type declarations
import deflistPlugin from 'markdown-it-deflist';

import { containerSyntax } from './container-syntax.js';
import { imageSyntax } from './image-syntax.js';
import { mathSyntax } from './math-syntax.js';
import { abbreviations } from './abbreviations.js';

const footnote = footnotePlugin as (md: MarkdownIt) => void;
const mark = markPlugin as (md: MarkdownIt) => void;
const deflist = deflistPlugin as (md: MarkdownIt) => void;

export interface DocumentSyntaxOptions {
  /** Disable container syntax only for baseline comparisons and isolated parsing. */
  containers?: boolean;
}

/** Install shared structure before renderer-only presentation rules. */
export function documentSyntax(md: MarkdownIt, options: DocumentSyntaxOptions = {}): void {
  md.use(mathSyntax);
  md.use(mark);
  md.use(deflist);
  md.use(imageSyntax);
  md.use(footnote);
  if (options.containers !== false) md.use(containerSyntax);
  md.use(abbreviations);
}
