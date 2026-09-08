import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown.js';

const NO_ASSETS = new Map<string, string>();

function render(markdown: string, assets = NO_ASSETS): string {
  return renderMarkdown(markdown, assets).html;
}

describe('allowlisted raw HTML (§26)', () => {
  it('renders aligned paragraphs with a vetted align value', () => {
    expect(render('<p align="center">hi</p>')).toContain('<p align="center">hi</p>');
    // Unknown align values drop the attribute, not the tag.
    expect(render('<p align="middle">hi</p>')).toContain('<p>hi</p>');
  });

  it('renders <picture> badges with source media and srcset', () => {
    const html = render(
      '<p align="center">\n' +
        '  <picture>\n' +
        '    <source media="(prefers-color-scheme: dark)" srcset="https://x.dev/dark.png">\n' +
        '    <img src="https://x.dev/logo.png" alt="Mote" width="240">\n' +
        '  </picture>\n' +
        '</p>',
    );
    expect(html).toContain('<picture>');
    expect(html).toContain(
      '<source media="(prefers-color-scheme: dark)" srcset="https://x.dev/dark.png">',
    );
    expect(html).toContain('<img src="https://x.dev/logo.png" alt="Mote" width="240">');
  });

  it('renders linked badge images', () => {
    const html = render(
      '<a href="https://example.com/ci"><img src="https://x.dev/ci.svg" alt="CI"></a>',
    );
    expect(html).toContain('<a href="https://example.com/ci">');
    expect(html).toContain('<img src="https://x.dev/ci.svg" alt="CI">');
  });

  it('renders details/summary, preserving open', () => {
    const html = render('<details open><summary>More</summary>\n\nbody\n\n</details>');
    expect(html).toContain('<details open>');
    expect(html).toContain('<summary>More</summary>');
  });

  it('renders sub/sup/kbd inline HTML', () => {
    const html = render('H<sub>2</sub>O and x<sup>2</sup>, press <kbd>Ctrl</kbd>');
    expect(html).toContain('<sub>2</sub>');
    expect(html).toContain('<sup>2</sup>');
    expect(html).toContain('<kbd>Ctrl</kbd>');
  });

  it('drops unknown formatting tags but keeps their text', () => {
    expect(render('<font color="red">hi</font>')).toContain('hi');
    expect(render('<font color="red">hi</font>')).not.toContain('<font');
  });

  it('keeps <details> open across Markdown blocks (GitHub-style)', () => {
    const html = render('<details><summary>More</summary>\n\n```sh\nls\n```\n\n</details>');
    expect(html).toMatch(
      /<details><summary>More<\/summary>[\s\S]*<pre>[\s\S]*<\/pre>[\s\S]*<\/details>/,
    );
  });

  it('closes unclosed allowlisted tags', () => {
    expect(render('<p align="center">hi')).toContain('<p align="center">hi</p>');
  });

  it('repairs misnested tags', () => {
    const html = render('<p><sub>hi</p>');
    expect(html).toContain('<p><sub>hi</sub></p>');
  });
});

describe('raw HTML asset rewriting (§31)', () => {
  const assets = new Map([
    ['docs/assets/logo.png', '/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq'],
    ['docs/assets/logo-dark.png', '/7Vk3mQ9x2NFaP4Ls/a/Zx9QwEr82Ty1'],
  ]);

  it('rewrites raw <img src> local references to opaque asset URLs', () => {
    const html = render('<img src="docs/assets/logo.png" alt="Mote" width="240">', assets);
    expect(html).toContain('<img src="/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq" alt="Mote" width="240">');
  });

  it('rewrites <source srcset> candidates to opaque asset URLs', () => {
    const html = render(
      '<picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">' +
        '<img src="docs/assets/logo.png" alt="Mote"></picture>',
      assets,
    );
    expect(html).toContain('srcset="/7Vk3mQ9x2NFaP4Ls/a/Zx9QwEr82Ty1"');
    expect(html).toContain('src="/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq"');
  });

  it('keeps unpublished relative references as-is', () => {
    const html = render('<img src="docs/assets/missing.png">', assets);
    expect(html).toContain('src="docs/assets/missing.png"');
  });
});

describe('GFM extensions (§27)', () => {
  it('renders task lists as static disabled checkboxes', () => {
    const html = render('- [ ] todo\n- [x] done');
    expect(html).toContain('task-list-item');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
  });

  it('renders footnotes with references and a backlink section', () => {
    const html = render('text with a note[^1]\n\n[^1]: the note');
    expect(html).toContain('footnote-ref');
    expect(html).toContain('<section class="footnotes"');
    expect(html).toContain('the note');
  });

  it('renders table column alignment from the delimiter row', () => {
    const html = render('| a | b |\n|:--|--:|\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('style="text-align:left"');
  });
});
