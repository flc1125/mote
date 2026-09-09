import { readFileSync } from 'node:fs';
import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';

import { render } from './index.js';
import { renderMarkdown } from './markdown.js';

const specimen = (name: string) =>
  readFileSync(new URL(`../../../docs/examples/${name}.md`, import.meta.url), 'utf8');

describe('committed compatibility specimens', () => {
  it('combines all four batches without dropping images, math or diagram edges', () => {
    const source = specimen('markdown-compatibility');
    const id = '7Vk3mQ9x2NFaP4Ls';
    const html = render(
      source,
      {
        version: 1,
        id,
        createdAt: '2026-09-09T00:00:00.000Z',
        source: { name: 'specimen.md', size: Buffer.byteLength(source), sha256: 'a'.repeat(64) },
        assets: [
          {
            id: 'Aq8K3pLm92Xq',
            references: ['../assets/%6cogo.png', '../assets/logo.png'],
            contentType: 'image/png',
            size: 100,
            sha256: 'b'.repeat(64),
          },
        ],
      },
      id,
    );
    const ids: string[] = [],
      fragments: string[] = [],
      images: string[] = [];
    const diagramEdges: number[] = [];
    let diagram = -1;
    let inDiagram = false;
    new Parser({
      onopentag(tag, attrs) {
        if (attrs.id) ids.push(attrs.id);
        if (attrs.href?.startsWith('#') && attrs.href !== '#!') fragments.push(attrs.href.slice(1));
        if (tag === 'img') images.push(attrs.src!);
        if (tag === 'svg' && attrs['aria-label'] === 'Mermaid diagram') {
          inDiagram = true;
          diagram++;
          diagramEdges.push(0);
        }
        if (inDiagram && (attrs['marker-end'] || attrs['marker-start'])) diagramEdges[diagram]!++;
      },
      onclosetag(tag) {
        if (tag === 'svg') inDiagram = false;
      },
    }).end(html);
    expect(new Set(ids).size).toBe(ids.length);
    for (const fragment of fragments) expect(ids).toContain(fragment);
    expect(images).toEqual([`/${id}/a/Aq8K3pLm92Xq`, `/${id}/a/Aq8K3pLm92Xq`]);
    expect(diagramEdges).toHaveLength(4);
    expect(diagramEdges[0]).toBe(5);
    expect(diagramEdges[1]).toBe(4);
    expect(html.match(/<math\b/g)).toHaveLength(6);
    expect(html.match(/class="markdown-alert markdown-alert-/g)).toHaveLength(5);
    expect(html).toContain('<strong>说明：</strong>');
    expect(html).toContain('<ol start="3">');
    expect(html).toContain('hljs-keyword');
    expect(html).not.toContain('Metadata does not override');
    expect(html).not.toContain('暂以源码显示');
    expect(html).not.toMatch(/<(?:script|iframe|foreignObject)\b/);
  });
  it('renders supplementary charts with all relationship labels and series', () => {
    const html = renderMarkdown(specimen('markdown-diagrams'), new Map()).html;
    expect(html.match(/aria-label="Mermaid diagram"/g)).toHaveLength(4);
    expect(html).not.toContain('暂以源码显示');
    expect(html).toContain('mote-xychart-bar mote-xychart-color-0');
    expect(html).toContain('mote-xychart-line mote-xychart-color-1');
    expect(html).toContain('>places</text>');
    expect(html).toContain('>contains</text>');
    expect(html).toContain('Input; keep label text');
  });
  it('preserves intentionally unsupported content in the fallback specimen', () => {
    const html = renderMarkdown(specimen('markdown-fallbacks'), new Map()).html;
    expect(html).toContain('title: [unfinished');
    expect(html).toContain('$\\unknowncommand{x}$');
    expect(html).toContain('[!CUSTOM]');
    expect(html).toContain('&lt;script&gt;example()&lt;/script&gt;');
    expect(html.match(/暂以源码显示/g)).toHaveLength(2);
    expect(html).not.toMatch(/<math\b|aria-label="Mermaid diagram"|<script\b/);
  });
});
