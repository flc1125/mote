import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown.js';

const NO_ASSETS = new Map<string, string>();

function render(markdown: string, assets = NO_ASSETS): string {
  return renderMarkdown(markdown, assets).html;
}

describe('renderMarkdown — CommonMark & extensions (§27)', () => {
  it('renders headings, lists, quotes, rules, and inline code', () => {
    const html = render('# Title\n\n- a\n- b\n\n> quote\n\n---\n\nuse `npm i`');
    expect(html).toContain('<h1 id="title">Title<a class="heading-anchor" href="#title"');
    expect(html).toContain('<ul>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<code>npm i</code>');
  });

  it('renders GFM tables and strikethrough', () => {
    const html = render('| a | b |\n|---|---|\n| 1 | 2 |\n\n~~gone~~');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<s>gone</s>');
  });

  it('keeps table semantics and column alignment inside a keyboard-scrollable region', () => {
    const html = render('| 参数 | 数值 |\n|:---|---:|\n| 上下文窗口 | 1,050,000 |\n\nAfter table.');
    expect(html).toContain(
      '<div class="table-scroll" role="region" aria-label="表格 / Table" tabindex="0">\n<table>',
    );
    expect(html).toContain('<th style="text-align:right">数值</th>');
    expect(html).toContain('<td style="text-align:right">1,050,000</td>');
    expect(html).toContain('</table>\n</div>\n<p>After table.</p>');
  });

  it('renders fenced code with language class and static highlighting', () => {
    const html = render('```go\nfunc main() {}\n```');
    expect(html).toContain('<pre tabindex="0" aria-label="Code"><code class="language-go">');
    expect(html).toContain('<span class="hljs-keyword">func</span>');
  });

  it('linkifies bare URLs', () => {
    const html = render('see https://example.com/docs');
    expect(html).toContain(
      '<a href="https://example.com/docs" target="_blank" rel="noopener noreferrer">https://example.com/docs</a>',
    );
  });

  it('opens only absolute http(s) links in a new tab', () => {
    const html = render(
      '[ext](https://example.com) [secure](#x) [rel](./local.md) [mail](mailto:a@b.c)',
    );
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">ext</a>',
    );
    expect(html).toContain('<a href="#x">secure</a>');
    expect(html).toContain('<a href="./local.md">rel</a>');
    expect(html).toContain('<a href="mailto:a@b.c">mail</a>');
  });
});

describe('renderMarkdown — heading anchors', () => {
  it('assigns GitHub-style slug ids', () => {
    const html = render('## Hello World!\n\n### 多个 标题');
    expect(html).toContain(
      '<h2 id="hello-world">Hello World!<a class="heading-anchor" href="#hello-world"',
    );
    expect(html).toContain('<h3 id="多个-标题">多个 标题<a class="heading-anchor"');
  });

  it('deduplicates repeated slugs', () => {
    const html = render('# Intro\n\n# Intro\n\n# Intro');
    expect(html).toContain('id="intro"');
    expect(html).toContain('id="intro-1"');
    expect(html).toContain('id="intro-2"');
  });

  it('collects headings for the TOC', () => {
    const { headings } = renderMarkdown('# A\n\n## B **bold** `code`', NO_ASSETS);
    expect(headings).toEqual([
      { level: 1, text: 'A', slug: 'a' },
      { level: 2, text: 'B bold code', slug: 'b-bold-code' },
    ]);
  });
});

describe('renderMarkdown — asset URLs (§31, §32)', () => {
  const assets = new Map([['images/architecture.png', '/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq']]);

  it('rewrites local image references to asset URLs', () => {
    const html = render('![Architecture](./images/architecture.png)', assets);
    expect(html).toContain(
      '<img src="/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq" alt="Architecture" decoding="async">',
    );
  });

  it('keeps remote images untouched', () => {
    const html = render('![OpenAI](https://example.com/image.png)', assets);
    expect(html).toContain(
      '<img src="https://example.com/image.png" alt="OpenAI" decoding="async">',
    );
  });

  it('keeps unresolved local references as-is', () => {
    const html = render('![x](./images/missing.png)', assets);
    expect(html).toContain('src="./images/missing.png"');
  });
});

describe('renderMarkdown — raw HTML sanitized (§26)', () => {
  it('keeps allowlisted presentational HTML instead of escaping it', () => {
    const html = render('<p align="center">hello</p>');
    expect(html).toContain('<p align="center">hello</p>');
  });
});
