import type { MarkdownIt } from 'markdown-it';
import katex from 'katex';

import { mathSyntax } from '@mote/core';

/** Native MathML needs no web fonts, client script or external requests. */
export function math(md: MarkdownIt): void {
  md.use(mathSyntax);
  let remaining = 16_384;
  let remainingOutput = 262_144;
  let count = 0;
  for (const type of ['mote_math_inline', 'mote_math_block']) {
    const fallback = md.renderer.rules[type]!;
    md.renderer.rules[type] = (tokens, index, options, env, self) => {
      const token = tokens[index]!;
      if (token.content.length > 4096 || token.content.length > remaining || count >= 128)
        return fallback(tokens, index, options, env, self);
      remaining -= token.content.length;
      count++;
      try {
        const output = katex.renderToString(token.content, {
          output: 'mathml',
          displayMode: type === 'mote_math_block',
          throwOnError: true,
          trust: false,
          strict: 'error',
          maxExpand: 100,
          maxSize: 10,
          macros: {},
        });
        if (output.length > 65_536 || output.length > remainingOutput)
          return fallback(tokens, index, options, env, self);
        remainingOutput -= output.length;
        return type === 'mote_math_block'
          ? `<div class="math-display" tabindex="0" role="region" aria-label="公式 / Formula">${output}</div>\n`
          : `<span class="math-inline">${output}</span>`;
      } catch {
        return fallback(tokens, index, options, env, self);
      }
    };
  }
}
