import { TAB_CASES } from '../../../packages/core/src/fixtures/tabs.js';
import { describe, expect, it } from 'vitest';

import { ADMONITION_CASES } from '../../../packages/core/src/fixtures/admonitions.js';
import { FOOTNOTE_CASES } from '../../../packages/core/src/fixtures/footnotes.js';

import { extractLocalImageReferences } from '../src/scanner.js';

describe('extractLocalImageReferences (§22)', () => {
  it('does not upload image-looking TeX or Mermaid source', () => {
    const source =
      '$\\text{![hidden](missing.png)}$\n\n\\[\n\\text{![hidden](also-missing.png)}\n\\]\n\n~~~mermaid\nflowchart LR\n A[![hidden](diagram.png)]\n~~~\n\n![visible](body.png)';
    expect(extractLocalImageReferences(source)).toEqual(['body.png']);
  });
  it('scans only the body after recognized front matter', () => {
    const source =
      '---\ntitle: Test\ndescription: \'![hidden](missing.png) <img src="also-missing.png">\'\n---\n![visible](body.png)';
    expect(extractLocalImageReferences(source)).toEqual(['body.png']);
  });

  it('still scans images in ambiguous blocks that the viewer will display', () => {
    const source = "---\nstatus: '![visible](body.png)'\n---";
    expect(extractLocalImageReferences(source)).toEqual(['body.png']);
  });

  it('finds inline images', () => {
    expect(extractLocalImageReferences('![foo](./foo.png)\n\n![bar](images/bar.png)')).toEqual([
      './foo.png',
      'images/bar.png',
    ]);
  });

  it('finds reference-style images', () => {
    const markdown = '![foo][image]\n\n[image]: ./images/foo.png';
    expect(extractLocalImageReferences(markdown)).toEqual(['./images/foo.png']);
  });

  it('finds shortcut reference images', () => {
    const markdown = '![image]\n\n[image]: ./images/foo.png';
    expect(extractLocalImageReferences(markdown)).toEqual(['./images/foo.png']);
  });

  it('finds images nested inside links', () => {
    const markdown = '[![alt](./click.png)](https://example.com)';
    expect(extractLocalImageReferences(markdown)).toEqual(['./click.png']);
  });

  it('finds parent-directory references', () => {
    expect(extractLocalImageReferences('![up](../shared/logo.png)')).toEqual([
      '../shared/logo.png',
    ]);
  });

  it('skips remote URLs', () => {
    const markdown = '![a](https://example.com/a.png)\n\n![b](http://example.com/b.png)';
    expect(extractLocalImageReferences(markdown)).toEqual([]);
  });

  it('skips non-file schemes and protocol-relative URLs', () => {
    const markdown = [
      '![a](data:image/png;base64,xxxx)',
      '![b](javascript:alert(1))',
      '![c](//cdn.example.com/c.png)',
    ].join('\n\n');
    expect(extractLocalImageReferences(markdown)).toEqual([]);
  });

  it('returns each distinct spelling once, in order of appearance', () => {
    const markdown = '![a](./a.png)\n\n![a2](./a.png)\n\n![b](images/../a.png)';
    expect(extractLocalImageReferences(markdown)).toEqual(['./a.png', 'images/../a.png']);
  });

  it('ignores links that are not images', () => {
    expect(extractLocalImageReferences('[doc](./doc.md)')).toEqual([]);
  });

  it('finds raw HTML <img> and <picture>/<source> references', () => {
    const markdown = [
      '<p align="center">',
      '  <picture>',
      '    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">',
      '    <img src="docs/assets/logo.png" alt="Mote" width="240">',
      '  </picture>',
      '</p>',
    ].join('\n');
    expect(extractLocalImageReferences(markdown)).toEqual([
      'docs/assets/logo-dark.png',
      'docs/assets/logo.png',
    ]);
  });

  it('finds inline raw HTML images mixed with Markdown images', () => {
    const markdown = '![a](./a.png)\n\nBadge: <img src="images/badge.png" alt="b">';
    expect(extractLocalImageReferences(markdown)).toEqual(['./a.png', 'images/badge.png']);
  });

  it('skips remote URLs in raw HTML', () => {
    const markdown = '<img src="https://x.dev/a.png"> <source srcset="https://x.dev/b.png 2x">';
    expect(extractLocalImageReferences(markdown)).toEqual([]);
  });

  it('reads srcset candidates with descriptors', () => {
    const markdown = '<img srcset="a/1x.png 1x, a/2x.png 2x" src="a/fallback.png">';
    expect(extractLocalImageReferences(markdown)).toEqual([
      'a/fallback.png',
      'a/1x.png',
      'a/2x.png',
    ]);
  });
});

describe('shared footnote structures (DEF-01)', () => {
  it.each(FOOTNOTE_CASES)('$name', ({ source, images }) => {
    expect(extractLocalImageReferences(source)).toEqual(images);
  });

  it('does not retain footnotes between documents', () => {
    extractLocalImageReferences(FOOTNOTE_CASES[0].source);
    expect(extractLocalImageReferences('A[^note]')).toEqual([]);
  });
});

describe('shared admonition structures', () => {
  it.each(ADMONITION_CASES)('$name', ({ source, images }) => {
    expect(extractLocalImageReferences(source)).toEqual(images);
  });

  it('shares source, component and nesting fallbacks with the renderer', () => {
    const oversized =
      '!!! note\n\n    ' + 'x'.repeat(128 * 1024) + '\n\n    ![hidden](missing.png)';
    expect(extractLocalImageReferences(oversized)).toEqual([]);
    const source = Array.from(
      { length: 257 },
      (_, i) => `!!! note\n\n    ![image](image-${i}.png)\n\n`,
    ).join('');
    const images = extractLocalImageReferences(source);
    expect(images).toHaveLength(256);
    expect(images).not.toContain('image-256.png');
    let nested = '![hidden](missing.png)';
    for (let i = 0; i < 9; i++)
      nested =
        '!!! note\n\n' +
        nested
          .split('\n')
          .map((line) => '    ' + line)
          .join('\n');
    expect(extractLocalImageReferences(nested)).toEqual([]);
  });
});

describe('shared tab structures', () => {
  it.each(TAB_CASES)('$name', ({ source, images }) => {
    expect(extractLocalImageReferences(source)).toEqual(images);
  });
});

describe('image enhancement scanning', () => {
  it('scans real caption images but never treats width or code examples as paths', () => {
    expect(
      extractLocalImageReferences(
        '![a](encoded%20name.png){ width="640" }\n/// caption\n**Caption** ![inline](caption.png) and `![fake](missing.png)`\n///\n\n```md\n![fake](code.png){ width="20" }\n/// caption\n![fake](code-caption.png)\n///\n```',
      ),
    ).toEqual(['encoded%20name.png', 'caption.png']);
  });
  it('scans captions inside hidden tabs and disclosures using the shared parser', () => {
    const source =
      '??? note "Images"\n\n    === "One"\n\n        Text.\n\n    === "Two"\n\n        ![alt](hidden.png){ width="50%" }\n        /// caption\n        Caption.\n        ///';
    expect(extractLocalImageReferences(source)).toEqual(['hidden.png']);
  });
});

describe('typography scanning', () => {
  it('treats abbreviation explanations as plain text and scans real footnote images', () => {
    const source =
      'API ![real](real.png)[^n]\n\n*[API]: ![not an asset](explanation.png)\n\n[^n]: API ![footnote](note.png)\n\n    ```md\n    ![literal](code.png)\n    ```';
    expect(extractLocalImageReferences(source)).toEqual(['real.png', 'note.png']);
  });
  it('scans definition images and captions while protecting fenced, indented and math examples', () => {
    const source =
      'Term\n: ==![marked](marked.png)==\n\n    ![body](body.png)\n    /// caption\n    Caption ![caption](caption.png)\n    ///\n\n    ```md\n    ![fake](fenced.png)\n    ```\n\n        ![fake](indented.png)\n\n    $![fake](inline-math.png)$\n\n    $$\n    ![fake](block-math.png)\n    $$';
    expect(extractLocalImageReferences(source)).toEqual(['marked.png', 'body.png', 'caption.png']);
  });
  it('scans definitions in hidden tabs and footnotes in parser order', () => {
    const source =
      '=== "One"\n\n    First.\n\n=== "Two"\n\n    Term\n    : ![hidden](hidden.png)\n\nReference[^n]\n\n[^n]: Term\n    : ![footnote](footnote.png)';
    expect(extractLocalImageReferences(source)).toEqual(['hidden.png', 'footnote.png']);
  });
});
