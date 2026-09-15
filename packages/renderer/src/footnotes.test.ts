import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';

import { FOOTNOTE_CASES } from '../../core/src/fixtures/footnotes.js';
import { renderMarkdown } from './markdown.js';

describe('shared footnote structures (DEF-01)', () => {
  it.each(FOOTNOTE_CASES)('$name', ({ source, images }) => {
    const urls = new Map(images.map((src, i) => [src, `/doc/a/${i}.png`]));
    const { html } = renderMarkdown(source, urls);
    const rendered = new Set<string>();
    new Parser({
      onopentag(tag, attrs) {
        if (tag !== 'img' && tag !== 'source') return;
        if (attrs.src) rendered.add(attrs.src);
        for (const candidate of (attrs.srcset ?? '').split(',')) {
          const url = candidate.trim().split(/\s+/)[0];
          if (url) rendered.add(url);
        }
      },
    }).end(html);
    expect([...rendered]).toEqual([...urls.values()]);
  });

  it('still renders math, sanitizes HTML and enhances code inside footnotes', () => {
    const source =
      'A[^n]\n\n[^n]: $x^2$ <img src="foot.png" onerror="alert(1)">\n\n    ```ts title="note.ts"\n    const n = 1;\n    ```\n';
    const { html, codeCopy } = renderMarkdown(source, new Map([['foot.png', '/doc/a/foot.png']]));
    expect(html).toContain('<math');
    expect(html).toContain('src="/doc/a/foot.png"');
    expect(html).not.toContain('onerror');
    expect(html).toContain('note.ts');
    expect(codeCopy).toBe(true);
  });
});
