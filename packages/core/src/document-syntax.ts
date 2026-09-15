import type { MarkdownIt } from 'markdown-it';
// @ts-expect-error -- the locked plugin has no type declarations
import footnotePlugin from 'markdown-it-footnote';

import { containerSyntax } from './container-syntax.js';
import { mathSyntax } from './math-syntax.js';

const footnote = footnotePlugin as (md: MarkdownIt) => void;

export interface DocumentSyntaxOptions {
  /** Internal opt-in until the phase-2 renderer and publishing UX are ready. */
  containers?: boolean;
}

/** Install shared structure before renderer-only presentation rules. */
export function documentSyntax(md: MarkdownIt, options: DocumentSyntaxOptions = {}): void {
  md.use(mathSyntax);
  md.use(footnote);
  if (options.containers) md.use(containerSyntax);
}
