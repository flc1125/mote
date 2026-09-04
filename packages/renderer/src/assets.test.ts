import { describe, expect, it } from 'vitest';

import type { DocumentManifest } from '@mote/protocol';

import { buildAssetUrlMap, resolveAssetUrl } from './assets.js';

const DOCUMENT_ID = '7Vk3mQ9x2NFaP4Ls';

const manifest = {
  version: 1,
  id: DOCUMENT_ID,
  createdAt: '2026-09-03T06:00:00.000Z',
  source: { name: 'README.md', size: 100, sha256: 'a'.repeat(64) },
  assets: [
    {
      id: 'Aq8K3pLm92Xq',
      references: ['./images/architecture.png', 'images/../images/architecture.png'],
      contentType: 'image/png',
      size: 1000,
      sha256: 'b'.repeat(64),
    },
    {
      id: 'X92LmNa81Pq2',
      references: ['./shots/demo.webp', 'https://example.com/not-local.png'],
      contentType: 'image/webp',
      size: 1000,
      sha256: 'c'.repeat(64),
    },
  ],
} satisfies DocumentManifest;

describe('buildAssetUrlMap (§31)', () => {
  const map = buildAssetUrlMap(manifest, DOCUMENT_ID);

  it('maps every local reference to the opaque asset URL', () => {
    expect(map.get('images/architecture.png')).toBe(`/${DOCUMENT_ID}/a/Aq8K3pLm92Xq`);
    expect(map.get('shots/demo.webp')).toBe(`/${DOCUMENT_ID}/a/X92LmNa81Pq2`);
  });

  it('normalizes references so different spellings hit the same entry', () => {
    expect(map.size).toBe(2);
  });

  it('never exposes the original file name in the public URL', () => {
    for (const url of map.values()) {
      expect(url).not.toContain('architecture');
      expect(url).not.toContain('.png');
    }
  });
});

describe('resolveAssetUrl', () => {
  const map = buildAssetUrlMap(manifest, DOCUMENT_ID);

  it('resolves local references in any equivalent spelling', () => {
    expect(resolveAssetUrl('./images/architecture.png', map)).toBe(
      `/${DOCUMENT_ID}/a/Aq8K3pLm92Xq`,
    );
    expect(resolveAssetUrl('images/architecture.png', map)).toBe(`/${DOCUMENT_ID}/a/Aq8K3pLm92Xq`);
  });

  it('returns null for unknown, remote, or non-normalizable references', () => {
    expect(resolveAssetUrl('./images/missing.png', map)).toBe(null);
    expect(resolveAssetUrl('https://example.com/a.png', map)).toBe(null);
    expect(resolveAssetUrl('javascript:alert(1)', map)).toBe(null);
    expect(resolveAssetUrl('./', map)).toBe(null);
  });
});
