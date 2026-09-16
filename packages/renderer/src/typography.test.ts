import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.js';
import { renderHtmlPage } from './template.js';

const render = (source: string) => renderMarkdown(source, new Map([['photo.png', '/asset/photo']]));

describe('typography rendering', () => {
  it('renders static semantic markup without requiring scripts', () => {
    const { html } = render('==Important==\n\nTerm\n: Definition');
    expect(html).toContain('<mark>Important</mark>');
    expect(html).toContain('<dl>\n<dt>Term</dt>\n<dd>Definition</dd>');
    expect(renderHtmlPage({ title: 'Typography', tocHtml: '', contentHtml: html })).not.toContain(
      '<script>',
    );
  });
  it('sanitizes HTML within marks and definitions while rewriting real images', () => {
    const { html } = render(
      '==<img src="photo.png" onerror="attack()">==\n\nTerm\n: <script>attack()</script>\n\n    ![Real](photo.png)\n\n    ```md\n    ![Fake](missing.png)\n    ```',
    );
    expect(html).not.toMatch(/<script|onerror=/);
    expect(html).toContain('src="/asset/photo"');
    expect(html).not.toContain('src="missing.png"');
  });
  it('keeps heading anchors based on visible text', () => {
    const plain = render('# Important');
    const marked = render('# ==Important==');
    expect(marked.headings).toEqual(plain.headings);
  });
  it('renders the public specimen with protected literals and captioned images', () => {
    const source = readFileSync(
      new URL('../../../docs/examples/markdown-typography.md', import.meta.url),
      'utf8',
    );
    const { html } = render(source);
    expect(html).toContain('<mark>important conclusion</mark>');
    expect(html).toContain('<dt>Capability URL</dt>');
    expect(html).toContain('<figcaption>');
    expect(html).not.toMatch(/src="(?:code-example|math-example)\.png"/);
  });
});
