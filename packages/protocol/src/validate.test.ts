import { describe, expect, it } from 'vitest';

import { validateDocumentManifest, validatePublishManifest } from './validate.js';

const validPublishManifest = {
  version: 1,
  entry: 'README.md',
  assets: [
    { field: 'asset_0', references: ['./images/architecture.png'] },
    { field: 'asset_1', references: ['./screenshots/demo.webp', 'images/demo.webp'] },
  ],
};

const validDocumentManifest = {
  version: 1,
  id: '7Vk3mQ9x2NFaP4Ls',
  createdAt: '2026-09-03T06:00:00.000Z',
  source: {
    name: 'README.md',
    size: 48231,
    sha256: 'a'.repeat(64),
  },
  assets: [
    {
      id: 'Aq8K3pLm92Xq',
      references: ['./images/architecture.png'],
      contentType: 'image/png',
      size: 328291,
      sha256: 'b'.repeat(64),
    },
  ],
};

function issuesOf(result: ReturnType<typeof validatePublishManifest>): string {
  return result.ok ? '' : result.issues.join('\n');
}

describe('validatePublishManifest (§16)', () => {
  it('accepts a valid manifest', () => {
    expect(validatePublishManifest(validPublishManifest)).toEqual({ ok: true });
    expect(validatePublishManifest({ version: 1, entry: 'a.md', assets: [] })).toEqual({
      ok: true,
    });
  });

  it('rejects non-objects and wrong version', () => {
    expect(validatePublishManifest(null).ok).toBe(false);
    expect(validatePublishManifest([]).ok).toBe(false);
    expect(validatePublishManifest({ ...validPublishManifest, version: 2 }).ok).toBe(false);
  });

  it('rejects a missing entry', () => {
    expect(validatePublishManifest({ ...validPublishManifest, entry: '' }).ok).toBe(false);
    expect(issuesOf(validatePublishManifest({ ...validPublishManifest, entry: '' }))).toMatch(
      /entry/,
    );
  });

  it('rejects malformed and duplicated asset fields', () => {
    const malformed = {
      ...validPublishManifest,
      assets: [{ field: 'file_0', references: ['./a.png'] }],
    };
    expect(issuesOf(validatePublishManifest(malformed))).toMatch(/asset_N/);

    const duplicated = {
      ...validPublishManifest,
      assets: [
        { field: 'asset_0', references: ['./a.png'] },
        { field: 'asset_0', references: ['./b.png'] },
      ],
    };
    expect(issuesOf(validatePublishManifest(duplicated))).toMatch(/duplicated/);
  });

  it('rejects empty references', () => {
    const manifest = {
      ...validPublishManifest,
      assets: [{ field: 'asset_0', references: [] }],
    };
    expect(issuesOf(validatePublishManifest(manifest))).toMatch(/references/);
  });

  it('rejects more than 50 assets', () => {
    const manifest = {
      ...validPublishManifest,
      assets: Array.from({ length: 51 }, (_, i) => ({
        field: `asset_${i}`,
        references: ['./a.png'],
      })),
    };
    expect(issuesOf(validatePublishManifest(manifest))).toMatch(/limit is 50/);
  });
});

describe('validateDocumentManifest (§10)', () => {
  it('accepts a valid manifest', () => {
    expect(validateDocumentManifest(validDocumentManifest)).toEqual({ ok: true });
  });

  it('rejects an invalid document id', () => {
    expect(
      issuesOf(validateDocumentManifest({ ...validDocumentManifest, id: 'too-short' })),
    ).toMatch(/document ID/);
    expect(
      issuesOf(validateDocumentManifest({ ...validDocumentManifest, id: '0Vk3mQ9x2NFaP4Ls' })),
    ).toMatch(/document ID/);
  });

  it('rejects an unparseable createdAt', () => {
    expect(
      issuesOf(validateDocumentManifest({ ...validDocumentManifest, createdAt: 'not-a-date' })),
    ).toMatch(/createdAt/);
  });

  it('rejects a bad source object', () => {
    expect(
      issuesOf(validateDocumentManifest({ ...validDocumentManifest, source: { name: '' } })),
    ).toMatch(/source/);
    expect(
      issuesOf(
        validateDocumentManifest({
          ...validDocumentManifest,
          source: { name: 'a.md', size: -1, sha256: 'xyz' },
        }),
      ),
    ).toMatch(/sha256/);
  });

  it('rejects unsupported asset content types (SVG)', () => {
    const manifest = {
      ...validDocumentManifest,
      assets: [{ ...validDocumentManifest.assets[0], contentType: 'image/svg+xml' }],
    };
    expect(issuesOf(validateDocumentManifest(manifest))).toMatch(/contentType/);
  });

  it('rejects an invalid asset id', () => {
    const manifest = {
      ...validDocumentManifest,
      assets: [{ ...validDocumentManifest.assets[0], id: 'Aq8K3pLm920q' }], // contains 0
    };
    expect(issuesOf(validateDocumentManifest(manifest))).toMatch(/asset ID/);
  });
});
