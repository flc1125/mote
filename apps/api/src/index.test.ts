import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { isAssetId, isDocumentId, MAX_MARKDOWN_BYTES } from '@mote/core';
import { isDocumentManifest, type ErrorResponse, type PublishResponse } from '@mote/protocol';

import { TEST_PUBLISH_TOKEN } from './test-token.js';

const PUBLISH_URL = 'http://localhost/api/v1/publish';
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const SVG_BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function authorized(): HeadersInit {
  return { Authorization: `Bearer ${TEST_PUBLISH_TOKEN}` };
}

function buildForm(options?: {
  markdown?: string | Uint8Array;
  manifest?: unknown;
  assets?: { field: string; bytes: Uint8Array }[];
}): FormData {
  const markdown = options?.markdown ?? '# Hello\n\n![a](./a.png)\n';
  const manifest = options?.manifest ?? {
    version: 1,
    entry: 'README.md',
    assets: [{ field: 'asset_0', references: ['./a.png'] }],
  };
  const assets = options?.assets ?? [{ field: 'asset_0', bytes: PNG_BYTES }];

  const form = new FormData();
  form.append('document', new File([markdown], 'README.md', { type: 'text/markdown' }));
  form.append('manifest', JSON.stringify(manifest));
  for (const asset of assets) {
    form.append(asset.field, new File([asset.bytes], 'a.png', { type: 'image/png' }));
  }
  return form;
}

async function publish(form: FormData, headers?: HeadersInit): Promise<Response> {
  return exports.default.fetch(PUBLISH_URL, { method: 'POST', headers, body: form });
}

describe('GET /api/health', () => {
  it('returns ok without auth', async () => {
    const response = await exports.default.fetch('http://localhost/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('authentication (§38)', () => {
  it('rejects a missing token with 401 UNAUTHORIZED', async () => {
    const response = await publish(buildForm());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: expect.any(String) },
    });
  });

  it('rejects a wrong token', async () => {
    const response = await publish(buildForm(), { Authorization: 'Bearer wrong' });
    expect(response.status).toBe(401);
  });
});

describe('request validation (§18)', () => {
  it('rejects a non-multipart Content-Type with 415', async () => {
    const response = await exports.default.fetch(PUBLISH_URL, {
      method: 'POST',
      headers: { ...authorized(), 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(415);
    expect(((await response.json()) as ErrorResponse).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a missing document field with 400', async () => {
    const form = new FormData();
    form.append('manifest', JSON.stringify({ version: 1, entry: 'a.md', assets: [] }));
    const response = await publish(form, authorized());
    expect(response.status).toBe(400);
    expect(((await response.json()) as ErrorResponse).error.code).toBe('MALFORMED_REQUEST');
  });

  it('rejects invalid manifest JSON with 400', async () => {
    const form = new FormData();
    form.append('document', new File(['# hi'], 'a.md'));
    form.append('manifest', '{nope');
    const response = await publish(form, authorized());
    expect(response.status).toBe(400);
  });

  it('rejects a manifest failing validation with 422', async () => {
    const response = await publish(
      buildForm({ manifest: { version: 2, entry: 'a.md', assets: [] } }),
      authorized(),
    );
    expect(response.status).toBe(422);
    expect(((await response.json()) as ErrorResponse).error.code).toBe('INVALID_DOCUMENT');
  });

  it('rejects a manifest asset without its multipart file with 422', async () => {
    const response = await publish(
      buildForm({
        manifest: {
          version: 1,
          entry: 'a.md',
          assets: [{ field: 'asset_0', references: ['./a.png'] }],
        },
        assets: [], // asset_0 declared but not uploaded
      }),
      authorized(),
    );
    expect(response.status).toBe(422);
  });

  it('rejects an SVG asset with 415 (§13)', async () => {
    const response = await publish(
      buildForm({ assets: [{ field: 'asset_0', bytes: SVG_BYTES }] }),
      authorized(),
    );
    expect(response.status).toBe(415);
    expect(((await response.json()) as ErrorResponse).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects an oversized Markdown with 413 (§14)', async () => {
    const big = 'x'.repeat(MAX_MARKDOWN_BYTES + 1);
    const response = await publish(
      buildForm({
        markdown: big,
        manifest: { version: 1, entry: 'big.md', assets: [] },
        assets: [],
      }),
      authorized(),
    );
    expect(response.status).toBe(413);
    expect(((await response.json()) as ErrorResponse).error.code).toBe('BUNDLE_TOO_LARGE');
  });
});

describe('successful publish (§17)', () => {
  it('returns 201 with id and url, and writes the bundle to R2', async () => {
    const response = await publish(buildForm(), authorized());
    expect(response.status).toBe(201);

    const body = (await response.json()) as PublishResponse;
    expect(isDocumentId(body.id)).toBe(true);
    expect(body.url).toBe(`https://mote.flc.io/${body.id}`);

    // R2 bundle: manifest (commit marker) + document + asset
    const manifestObject = await env.DOCUMENTS.get(`documents/${body.id}/manifest.json`);
    expect(manifestObject).not.toBeNull();
    const manifest: unknown = await manifestObject!.json();
    expect(isDocumentManifest(manifest)).toBe(true);
    if (isDocumentManifest(manifest)) {
      expect(manifest.id).toBe(body.id);
      expect(manifest.source.name).toBe('README.md');
      expect(manifest.assets).toHaveLength(1);
      expect(isAssetId(manifest.assets[0]?.id)).toBe(true);
      expect(manifest.assets[0]?.contentType).toBe('image/png');
      expect(manifest.assets[0]?.references).toEqual(['./a.png']);
      // The public asset URL must not leak the original file name (§11).
      expect(manifest.assets[0]?.id).not.toContain('.png');
    }

    const documentObject = await env.DOCUMENTS.get(`documents/${body.id}/document.md`);
    expect(await documentObject!.text()).toBe('# Hello\n\n![a](./a.png)\n');

    if (isDocumentManifest(manifest)) {
      const assetId = manifest.assets[0]!.id;
      const assetObject = await env.DOCUMENTS.get(`documents/${body.id}/assets/${assetId}`);
      expect(assetObject).not.toBeNull();
      expect(new Uint8Array(await assetObject!.arrayBuffer())).toEqual(PNG_BYTES);
      expect(assetObject!.httpMetadata?.contentType).toBe('image/png');
    }
  });

  it('publishes twice and gets two different immutable URLs (§3)', async () => {
    const first = (await (await publish(buildForm(), authorized())).json()) as PublishResponse;
    const second = (await (await publish(buildForm(), authorized())).json()) as PublishResponse;
    expect(first.id).not.toBe(second.id);
    expect(first.url).not.toBe(second.url);
  });
});
