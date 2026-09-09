import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown.js';

const render = (source: string) => renderMarkdown(source, new Map());

describe('GitHub-style alerts', () => {
  it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])(
    'renders %s with a static title',
    (kind) => {
      const { html, headings } = render(`> [!${kind}]\n> **说明：**正文`);
      expect(html).toContain(`<div class="markdown-alert markdown-alert-${kind.toLowerCase()}">`);
      expect(html).toContain('class="markdown-alert-title"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('<p><strong>说明：</strong>正文</p>');
      expect(html).not.toContain('[!');
      expect(html).not.toContain('<blockquote>');
      expect(html).toMatch(/<\/div>\n$/);
      expect(headings).toEqual([]);
    },
  );

  it('keeps lists, tables, code, footnotes and nested quotes inside the alert', () => {
    const { html } = render(
      '> [!TIP]\n>\n> - [x] Done\n>\n> ```sh\n> echo "<hello>"\n> ```\n>\n> | a |\n> |---|\n> | b |\n>\n> > A quote\n>\n> Last[^1]\n\nOutside\n\n[^1]: Footnote',
    );
    expect(html).toContain('disabled');
    expect(html).toContain('<code class="language-sh">echo &quot;&lt;hello&gt;&quot;');
    expect(html).toContain('<table>');
    expect(html).toContain('<blockquote>\n<p>A quote</p>\n</blockquote>');
    expect(html).toContain('</div>\n<p>Outside</p>');
    expect(html).toContain('footnote-ref');
    expect(html).not.toContain('<p></p>');
  });

  it('handles marker-only, CRLF, lowercase and separate alerts', () => {
    const { html } = render('> [!note]  \r\n\r\n> [!WARNING]\r\n> Second');
    expect(html.match(/class="markdown-alert markdown-alert-/g)).toHaveLength(2);
    expect(html).not.toContain('<p></p>');
    expect(html).toContain('<p>Second</p>');
  });

  it.each([
    '> [!UNKNOWN]\n> text',
    '> [!NOTE] same line',
    '> Intro\n> [!TIP]\n> text',
    '> \\[!NOTE]\n> text',
    '> `[!NOTE]`\n> text',
    '```md\n> [!NOTE]\n> text\n```',
    '    > [!NOTE]\n    > text',
    '- Item\n\n  > [!TIP]\n  > text',
    '> > [!TIP]\n> > text',
  ])('leaves non-alert or nested syntax unchanged: %s', (source) => {
    expect(render(source).html).not.toContain('markdown-alert');
  });

  it('keeps inline sanitization, image rewriting and heading anchors inside details', () => {
    const { html, headings } = renderMarkdown(
      '<details><summary>More</summary>\n\n> [!IMPORTANT]\n> ## Heading\n>\n> ![local](image.png) <img src="javascript:alert(1)" onerror="bad()">\n\n</details>',
      new Map([['image.png', '/doc/a/image']]),
    );
    expect(html).toMatch(/<details>[\s\S]*markdown-alert-important[\s\S]*<\/div>\n<\/details>/);
    expect(html).toContain('src="/doc/a/image"');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(headings).toEqual([{ level: 2, text: 'Heading', slug: 'heading' }]);
  });

  it('does not trust raw HTML alert classes or SVG icons', () => {
    const { html } = render(
      '<div class="markdown-alert markdown-alert-note"><svg><script>bad()</script></svg>Text</div>',
    );
    expect(html).toBe('<div>Text</div>');
  });
});
