import MarkdownIt from 'markdown-it';
import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';

import cases from './fixtures/emphasis.json';
import { renderMarkdown } from './markdown.js';
import { renderHtmlPage } from './template.js';
import { renderToc } from './toc.js';

const render = (source: string) => renderMarkdown(source, new Map());

describe('CJK strong emphasis compatibility', () => {
  it.each(cases)('$source', ({ source, html }) => {
    expect(render(source).html.trim()).toBe(`<p>${html}</p>`);
  });

  it.each([
    '**plain** and *italic* and ***both***',
    '**English:**Next',
    'foo__bar__baz and __bold__',
    '__解读：__正文',
    '*解读：*正文',
    '** 解读：**正文',
    '**解读： **正文',
    '**未闭合：正文',
    '\\*\\*解读：\\*\\*正文',
    '`**解读：**正文`',
    '```md\n**解读：**正文\n```',
    '    **解读：**正文',
    '[link](https://example.com/**解读：**正文)',
    '<span title="**解读：**正文">text</span>',
    '*foo**bar**baz*',
    '**foo *bar** baz*',
    '**普通加粗**，正文',
    '**重点：**\n正文',
    '**重点：**\u00a0正文',
  ])('preserves standard parsing: %s', (source) => {
    const standard = new MarkdownIt({ html: true, linkify: true }).render(source);
    expect(render(source).html).toBe(standard);
  });

  it('works inside headings, quotes, lists, tables and image alt text', () => {
    const result = render(
      '# **说明：**标题\n\n> **引用：**正文\n\n- **列表：**正文\n\n| 列 |\n|---|\n| **表格：**正文 |\n\n![**图片：**说明](https://example.com/image.png)',
    );
    expect(result.headings).toEqual([{ level: 1, text: '说明：标题', slug: '说明标题' }]);
    for (const label of ['说明', '引用', '列表', '表格']) {
      expect(result.html).toContain(`<strong>${label}：</strong>`);
    }
    expect(result.html).toContain('alt="图片：说明"');
  });

  it('keeps nested formatting and URL/HTML sanitization independent', () => {
    const html = render(
      '**重点：**<img src="javascript:alert(1)" onerror="alert(1)">\n\n**说明：**[x](javascript:alert(1))',
    ).html;
    expect(html).toContain('<strong>重点：</strong>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('src="javascript:');
    expect(html).not.toContain('href="javascript:');
  });

  it('keeps large unpaired delimiter runs as text', () => {
    const stars = '*'.repeat(100_000);
    const html = render(`前文${stars}：后文`).html;
    expect(html).toBe(`<p>前文${stars}：后文</p>\n`);
  });
});

describe('heading ID compatibility', () => {
  it('allocates globally unique suffixes in either order', () => {
    expect(render('# foo\n# foo\n# foo-1\n# foo\n# foo-1').headings.map((h) => h.slug)).toEqual([
      'foo',
      'foo-1',
      'foo-1-1',
      'foo-2',
      'foo-1-2',
    ]);
    expect(render('# foo-1\n# foo\n# foo').headings.map((h) => h.slug)).toEqual([
      'foo-1',
      'foo',
      'foo-2',
    ]);
  });

  it('uses nonempty fallbacks and preserves ordinary heading links', () => {
    const headings = render('# !!!\n# 🎉\n# section\n# Hello World\n# 中文 标题').headings;
    expect(headings.map((h) => h.slug)).toEqual([
      'section',
      'section-1',
      'section-2',
      'hello-world',
      '中文-标题',
    ]);
  });

  it('keeps heading links separate from drawer, footnotes and task labels', () => {
    const result = render(
      '# mote-toc\n# fn1\n# fnref1\n# task-item-123\n\nText[^1] and again[^1].\n\n[^1]: Note.\n\n- [x] Done',
    );
    const page = renderHtmlPage({
      title: 'Compatibility',
      contentHtml: result.html,
      tocHtml: renderToc(result.headings),
    });
    const ids: string[] = [];
    const hrefs: string[] = [];
    new Parser({
      onopentag(name, attrs) {
        if (attrs.id) ids.push(attrs.id);
        if (name === 'a' && attrs.href?.startsWith('#') && attrs.href !== '#!')
          hrefs.push(attrs.href.slice(1));
      },
    }).end(page);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
    for (const href of hrefs) expect(ids).toContain(href);
    expect(result.headings.map((h) => h.slug)).toEqual([
      'mote-toc-1',
      'fn1-1',
      'fnref1-1',
      'task-item-123-1',
    ]);
  });
});

describe('common document combinations', () => {
  it('preserves task-list inline formatting once and renders deterministically', () => {
    const source = '- [x] **检查：**[链接](https://example.com) 和 `code`\n- [ ] 下一项';
    const html = render(source).html;
    expect(html).toBe(render(source).html);
    expect(html.match(/<strong>检查：<\/strong>/g)).toHaveLength(1);
    expect(html).not.toContain('**');
    expect(html).toContain('<a href="https://example.com">链接</a>');
    expect(html).toContain('<code>code</code>');
    expect(html.match(/disabled/g)).toHaveLength(2);
    expect(html.match(/<label>/g)).toHaveLength(2);
  });

  it('keeps soft/hard breaks and CRLF semantics', () => {
    expect(render('A\r\nB\r\n\r\nC  \r\nD\r\n\r\nE\\\r\nF').html).toBe(
      '<p>A\nB</p>\n<p>C<br>\nD</p>\n<p>E<br>\nF</p>\n',
    );
  });

  it('keeps table escapes, alignment and nested inline formatting', () => {
    const html = render(
      '| Name | Value |\n|:---|---:|\n| a\\|b | `x\\|y` |\n| **说明：**值 | ~~old~~ |',
    ).html;
    expect(html).toContain('a|b');
    expect(html).toContain('<code>x|y</code>');
    expect(html).toContain('style="text-align:right"');
    expect(html).toContain('<s>old</s>');
  });

  it('keeps ordered list starts and nested block content', () => {
    const html = render(
      '3. **说明：**步骤\n\n   > 引用\n\n   - 子项\n\n     ```js\n     const x = 1;\n     ```',
    ).html;
    expect(html).toContain('<ol start="3">');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<code class="language-js">');
  });

  it('resolves mixed Markdown/HTML image paths containing Unicode and spaces', () => {
    const result = renderMarkdown(
      '<details><summary>More</summary>\n\n**说明：**图片\n\n[![图][img]](https://example.com)\n\n[img]: <图片/a (1).png>\n\n<img src="图片/a (1).png" alt="raw">\n\n</details>',
      new Map([['图片/a (1).png', '/doc/a/image']]),
    );
    expect(result.html.match(/src="\/doc\/a\/image"/g)).toHaveLength(2);
    expect(result.html).toContain('<strong>说明：</strong>');
    expect(result.html).toMatch(/<details>[\s\S]*<strong>[\s\S]*<\/details>/);
  });
});
