import { describe, expect, it } from 'vitest';

import { buildTocTree, renderToc } from './toc.js';
import type { Heading } from './headings.js';

const headings: Heading[] = [
  { level: 1, text: 'Guide', slug: 'guide' },
  { level: 2, text: 'Install', slug: 'install' },
  { level: 3, text: 'macOS', slug: 'macos' },
  { level: 2, text: 'Usage', slug: 'usage' },
  { level: 4, text: 'Too deep', slug: 'too-deep' },
];

describe('buildTocTree', () => {
  it('nests all six heading levels, including skipped levels', () => {
    const tree = buildTocTree(headings);
    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root?.heading.text).toBe('Guide');
    expect(root?.children.map((node) => node.heading.text)).toEqual(['Install', 'Usage']);
    expect(root?.children[0]?.children.map((node) => node.heading.text)).toEqual(['macOS']);
    expect(root?.children[1]?.children[0]?.heading.text).toBe('Too deep');
  });

  it('handles documents not starting at h1', () => {
    const tree = buildTocTree([
      { level: 2, text: 'A', slug: 'a' },
      { level: 3, text: 'B', slug: 'b' },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.heading.text).toBe('B');
  });
});

describe('renderToc', () => {
  it('renders a nav tree with anchor links for the drawer', () => {
    const html = renderToc(headings);
    expect(html).toContain('<nav class="toc-nav" aria-label="Table of contents">');
    expect(html).toContain('<a href="#guide">Guide</a>');
    expect(html).toContain('<a href="#install">Install</a>');
    expect(html).toContain('class="toc-branch"');
    expect(html).toContain('<a href="#too-deep">Too deep</a>');
  });

  it('escapes heading text', () => {
    const html = renderToc([{ level: 2, text: 'a <b> & "c"', slug: 'a-b-c' }]);
    expect(html).toContain('a &lt;b&gt; &amp; &quot;c&quot;');
    expect(html).toContain('title="a &lt;b&gt; &amp; &quot;c&quot;"');
  });

  it('keeps deep links while capping visual indentation and allocating unique toggle targets', () => {
    const html = renderToc(
      Array.from({ length: 6 }, (_, i) => ({
        level: i + 1,
        text: 'Level ' + i,
        slug: 'level-' + i,
      })),
    );
    expect(html).toContain('<a href="#level-5">Level 5</a>');
    expect(html).toContain('--toc-depth:3');
    expect(html).not.toContain('--toc-depth:4');
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
    const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(5);
    expect(controls).toEqual(ids);
    expect(html.match(/ hidden>/g)).toHaveLength(5);
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(renderToc([])).toBe('');
    expect(renderToc([{ level: 7, text: 'invalid', slug: 'invalid' }])).toBe('');
  });
});
