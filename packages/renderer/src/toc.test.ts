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
  it('nests headings by level and drops levels deeper than h3', () => {
    const tree = buildTocTree(headings);
    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root?.heading.text).toBe('Guide');
    expect(root?.children.map((node) => node.heading.text)).toEqual(['Install', 'Usage']);
    expect(root?.children[0]?.children.map((node) => node.heading.text)).toEqual(['macOS']);
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
  it('renders a nested nav with anchor links', () => {
    const html = renderToc(headings);
    expect(html).toContain('<nav class="toc"');
    expect(html).toContain('<a href="#guide">Guide</a>');
    expect(html).toContain('<ul><li><a href="#install">Install</a><ul>');
    expect(html).not.toContain('too-deep');
  });

  it('escapes heading text', () => {
    const html = renderToc([{ level: 2, text: 'a <b> & "c"', slug: 'a-b-c' }]);
    expect(html).toContain('a &lt;b&gt; &amp; &quot;c&quot;');
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(renderToc([])).toBe('');
    expect(renderToc([{ level: 5, text: 'deep', slug: 'deep' }])).toBe('');
  });
});
