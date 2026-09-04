import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';

import type { DocumentManifest } from '@mote/protocol';

const workerFetch = (input: string, init?: RequestInit): Promise<Response> =>
  exports.default.fetch(input, init);

const ID = '7Vk3mQ9x2NFaP4Ls';
const ASSET_ID = 'Aq8K3pLm92Xq';
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const MANIFEST: DocumentManifest = {
  version: 1,
  id: ID,
  createdAt: '2026-09-03T06:00:00.000Z',
  source: { name: 'README.md', size: 64, sha256: 'a'.repeat(64) },
  assets: [
    {
      id: ASSET_ID,
      references: ['./images/demo.png'],
      contentType: 'image/png',
      size: PNG_BYTES.length,
      sha256: 'b'.repeat(64),
    },
  ],
};

const MARKDOWN = '# Hello Mote\n\n![demo](./images/demo.png)\n';

async function seedBundle(): Promise<void> {
  await env.DOCUMENTS.put(`documents/${ID}/assets/${ASSET_ID}`, PNG_BYTES, {
    httpMetadata: { contentType: 'image/png' },
  });
  await env.DOCUMENTS.put(`documents/${ID}/document.md`, MARKDOWN);
  await env.DOCUMENTS.put(`documents/${ID}/manifest.json`, JSON.stringify(MANIFEST));
}

beforeAll(seedBundle);

describe('GET /{document-id}', () => {
  it('renders the document with security and cache headers (§33, §35)', async () => {
    const response = await workerFetch(`http://localhost/${ID}`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('<h1 id="hello-mote">Hello Mote</h1>');
    // Local image reference rewritten to the opaque asset URL (§31)
    expect(html).toContain(`src="/${ID}/a/${ASSET_ID}"`);

    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'none'");
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=31536000');
  });

  it('answers HEAD with the same headers and no body', async () => {
    const response = await workerFetch(`http://localhost/${ID}`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toBe('');
  });
});

describe('GET /{document-id}/a/{asset-id}', () => {
  it('serves the asset with manifest content type and immutable cache (§35)', async () => {
    const response = await workerFetch(`http://localhost/${ID}/a/${ASSET_ID}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');

    const body = new Uint8Array(await response.arrayBuffer());
    expect(body).toEqual(PNG_BYTES);
  });

  it('answers HEAD without a body', async () => {
    const response = await workerFetch(`http://localhost/${ID}/a/${ASSET_ID}`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(await response.text()).toBe('');
  });

  it('returns 404 for an unknown asset ID', async () => {
    const response = await workerFetch(`http://localhost/${ID}/a/X92LmNa81Pq2`);
    expect(response.status).toBe(404);
  });
});

describe('uniform 404 (§24)', () => {
  it('returns the identical response for malformed and nonexistent IDs', async () => {
    const malformed = await workerFetch('http://localhost/not-a-valid-id');
    const nonexistent = await workerFetch('http://localhost/P8wQr4TmK2aX9NsV');

    expect(malformed.status).toBe(404);
    expect(nonexistent.status).toBe(404);
    expect(await malformed.text()).toBe(await nonexistent.text());
    expect(malformed.headers.get('Content-Type')).toBe(nonexistent.headers.get('Content-Type'));
  });

  it('returns 404 when the manifest is absent even if document.md exists (§54)', async () => {
    const orphan = 'H3kR9mQ2xN7FaP4L';
    await env.DOCUMENTS.put(`documents/${orphan}/document.md`, '# orphan');
    // no manifest.json written

    const response = await workerFetch(`http://localhost/${orphan}`);
    expect(response.status).toBe(404);
  });

  it('returns 404 for unknown routes and unsupported methods', async () => {
    expect((await workerFetch('http://localhost/')).status).toBe(404);
    expect((await workerFetch(`http://localhost/${ID}/extra/path`)).status).toBe(404);
    expect((await workerFetch(`http://localhost/${ID}`, { method: 'POST' })).status).toBe(404);
  });
});

describe('utility routes', () => {
  it('GET /robots.txt disallows everything (§34)', async () => {
    const response = await workerFetch('http://localhost/robots.txt');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('GET /health returns ok without touching R2 (§47)', async () => {
    const response = await workerFetch('http://localhost/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
