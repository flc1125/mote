import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown.js';

const NO_ASSETS = new Map<string, string>();

function render(markdown: string, assets = NO_ASSETS): string {
  return renderMarkdown(markdown, assets).html;
}

describe('renderMarkdown — CommonMark & extensions (§27)', () => {
  it('renders headings, lists, quotes, rules, and inline code', () => {
    const html = render('# Title\n\n- a\n- b\n\n> quote\n\n---\n\nuse `npm i`');
    expect(html).toContain('<h1 id="title">Title</h1>');
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

  it('renders fenced code with language class, without server-side highlighting (§28)', () => {
    const html = render('```go\nfunc main() {}\n```');
    expect(html).toContain('<pre><code class="language-go">');
  });

  it('linkifies bare URLs', () => {
    const html = render('see https://example.com/docs');
    expect(html).toContain('<a href="https://example.com/docs">https://example.com/docs</a>');
  });
});

describe('renderMarkdown — heading anchors', () => {
  it('assigns GitHub-style slug ids', () => {
    const html = render('## Hello World!\n\n### 多个 标题');
    expect(html).toContain('<h2 id="hello-world">Hello World!</h2>');
    expect(html).toContain('<h3 id="多个-标题">多个 标题</h3>');
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
    expect(html).toContain('<img src="/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq" alt="Architecture">');
  });

  it('keeps remote images untouched', () => {
    const html = render('![OpenAI](https://example.com/image.png)', assets);
    expect(html).toContain('<img src="https://example.com/image.png" alt="OpenAI">');
  });

  it('keeps unresolved local references as-is', () => {
    const html = render('![x](./images/missing.png)', assets);
    expect(html).toContain('src="./images/missing.png"');
  });
});

describe('renderMarkdown — raw HTML disabled (§26)', () => {
  it('escapes raw HTML instead of emitting elements', () => {
    const html = render('<div class="x">hello</div>');
    expect(html).not.toContain('<div');
    expect(html).toContain('&lt;div class=&quot;x&quot;&gt;');
  });
});
