import { describe, expect, it } from 'vitest';

import type { DocumentManifest } from '@mote/protocol';

import { render } from './index.js';

const DOCUMENT_ID = '7Vk3mQ9x2NFaP4Ls';

const manifest = {
  version: 1,
  id: DOCUMENT_ID,
  createdAt: '2026-09-03T06:00:00.000Z',
  source: { name: 'README.md', size: 48231, sha256: 'a'.repeat(64) },
  assets: [
    {
      id: 'Aq8K3pLm92Xq',
      references: ['./images/architecture.png'],
      contentType: 'image/png',
      size: 328291,
      sha256: 'b'.repeat(64),
    },
  ],
} satisfies DocumentManifest;

const markdown = [
  '# Mote 设计文档',
  '',
  '## 背景',
  '',
  '一些 **加粗** 文字与 `code`，见 https://example.com 。',
  '',
  '![Architecture](./images/architecture.png)',
  '',
  '| 列A | 列B |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '```ts',
  'const x = 1;',
  '```',
  '',
  '## 小结',
  '',
  '> 完。',
  '',
].join('\n');

describe('render (§42)', () => {
  it('hides recognized metadata without overriding the body title or TOC', () => {
    const html = render(
      '---\ntitle: Metadata title\ndescription: "![hidden](missing.png)"\n---\n# Body title\n\n~~~ts\nconst n = 1;\n~~~',
      manifest,
      DOCUMENT_ID,
    );
    expect(html).toContain('<title>Body title</title>');
    expect(html).toContain('<h1 id="body-title">Body title</h1>');
    expect(html).not.toContain('Metadata title');
    expect(html).not.toContain('missing.png');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    const withoutHeading = render(
      '---\ntitle: Metadata title\n---\nBody only',
      manifest,
      DOCUMENT_ID,
    );
    expect(withoutHeading).toContain('<title>README.md</title>');
  });

  it('renders a complete page (snapshot)', () => {
    expect(render(markdown, manifest, DOCUMENT_ID)).toMatchSnapshot();
  });

  it('is deterministic: identical input renders identical output', () => {
    const first = render(markdown, manifest, DOCUMENT_ID);
    const second = render(markdown, manifest, DOCUMENT_ID);
    expect(second).toBe(first);
  });

  it('uses the first h1 as the page title', () => {
    const html = render(markdown, manifest, DOCUMENT_ID);
    expect(html).toContain('<title>Mote 设计文档</title>');
  });

  it('falls back to the source name when there is no h1', () => {
    const html = render('no heading here', manifest, DOCUMENT_ID);
    expect(html).toContain('<title>README.md</title>');
  });

  it('renders a TOC drawer linking to heading anchors', () => {
    const html = render(markdown, manifest, DOCUMENT_ID);
    expect(html).toContain(
      '<aside class="toc-drawer" id="mote-toc" aria-label="Table of contents" tabindex="-1">',
    );
    expect(html).toContain('<nav class="toc-nav" aria-label="Table of contents">');
    expect(html).toContain('<a href="#背景">背景</a>');
    expect(html).toContain('<h2 id="背景">背景</h2>');
  });

  it('rejects an invalid document ID', () => {
    expect(() => render(markdown, manifest, 'not-an-id')).toThrow(/Invalid document ID/);
  });
});
