import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.js';
import { renderHtmlPage } from './template.js';
import { FOOTNOTE_SCRIPT } from './footnote-script.js';

describe('abbreviations and footnote reading', () => {
  it('keeps visible heading anchors and escapes abbreviation explanations', () => {
    const { html, headings } = renderMarkdown(
      '# API\n\nAPI\n\n*[API]: "</abbr><script>attack()</script>',
      new Map(),
    );
    expect(headings[0]?.slug).toBe('api');
    expect(headings[0]?.text).toBe('API');
    expect(html).toContain('&quot;&lt;/abbr&gt;&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('enhances footnotes without a heading and preserves static navigation', () => {
    const { html } = renderMarkdown('Text[^n]\n\n[^n]: A note.', new Map());
    const page = renderHtmlPage({ title: 'Notes', tocHtml: '', contentHtml: html });
    expect([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])).toEqual([
      FOOTNOTE_SCRIPT,
    ]);
    expect(html).toContain('href="#fn1"');
    expect(html).toContain('href="#fnref1"');
    expect(html).not.toContain('hidden');
    expect(
      renderHtmlPage({ title: 'Plain', tocHtml: '', contentHtml: '<p>No notes</p>' }),
    ).not.toContain('<script>');
  });
  it('renders the mixed specimen with one real asset and protected code', () => {
    const source = readFileSync(
      new URL('../../../docs/examples/markdown-reading.md', import.meta.url),
      'utf8',
    );
    const { html } = renderMarkdown(source, new Map([['../assets/icon.png', '/asset/icon']]));
    expect(html).toContain('<abbr title="Application Programming Interface">API</abbr>');
    expect(html).toContain('src="/asset/icon"');
    expect(html).not.toContain('src="not-an-asset.png"');
    expect(html).toContain('href="#fnref1:1"');
    expect(html).toContain('class="footnote-item"');
  });
});
