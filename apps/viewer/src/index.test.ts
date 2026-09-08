import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';

import type { DocumentManifest } from '@mote/protocol';
import { HOME_HTML } from './home.js';
import { FAVICON_BASE64, ICON_SVG } from './brand.generated.js';
import viewer from './index.js';

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
    expect((await workerFetch('http://localhost/unknown-route')).status).toBe(404);
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

describe('public homepage and branding', () => {
  it('serves a static homepage without published document information or JS', async () => {
    const response = await workerFetch('http://localhost/');
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toBe(HOME_HTML);
    expect(html).toContain('Markdown in.');
    expect(html).toContain('URL out.');
    expect(html).toContain(
      '$</span> npm install -g mote-cli\n' +
        '<span class="prompt">$</span> mote login\n' +
        '<span class="prompt">$</span> mote README.md',
    );
    expect(html).not.toContain('export MOTE_TOKEN');
    expect(html).toContain('<span class="method-num">01</span><h3>CLI</h3>');
    expect(html).toContain('<span class="method-num">02</span><h3>MCP</h3>');
    expect(html).toContain('<span class="method-num">03</span><h3>Skill</h3>');
    expect(html).toContain(
      'href="https://github.com/flc1125/mote/blob/main/docs/mcp.md">MCP guide</a>',
    );
    expect(html).toContain(
      'href="https://github.com/flc1125/mote/blob/main/docs/skill.md">Skill guide</a>',
    );
    expect(html).toContain('The skill uses your configured CLI or MCP tools');
    expect(html).toMatch(
      /<a href="https:\/\/mote\.flc\.io\/[^" ]+" target="_blank" rel="noopener noreferrer" aria-label="see a live demo \(opens in a new tab\)">see a live demo<\/a>/,
    );
    const setupNoteIndex = html.indexOf('You need a Mote instance and permission to publish.');
    expect(setupNoteIndex).toBeGreaterThanOrEqual(0);
    expect(setupNoteIndex).toBeLessThan(html.indexOf('aria-label="CLI quick start commands"'));

    expect(html).toContain('href="https://github.com/flc1125/mote/blob/main/docs/cli.md">Docs</a>');
    expect(html).toContain('codex mcp add mote --url https://mote.flc.io/api/mcp');
    expect(html).toContain('codex mcp login mote');
    expect(html).toContain('npx skills add flc1125/mote --skill mote');
    expect(html).toContain('#ef5552');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).not.toMatch(/<script|<form/i);
    expect(html.match(/<input\b/g)).toBeNull();
    expect(html).not.toContain(ID);
    expect(html).not.toContain(ASSET_ID);
    expect(html).not.toContain('Hello Mote');
    expect(html).toMatchSnapshot();
    const document = await workerFetch(`http://localhost/${ID}`, { method: 'HEAD' });
    expect([...response.headers]).toEqual([...document.headers]);
  });

  it.each(['/', '/favicon.ico', '/favicon.svg'])('%s never accesses R2', async (path) => {
    // A throwing binding catches every attempted R2 operation, including list().
    const isolatedEnv = {
      get DOCUMENTS(): R2Bucket {
        throw new Error('Static routes must not access R2');
      },
    };
    const response = await viewer.fetch(new Request(`http://localhost${path}`), isolatedEnv);
    expect(response.status).toBe(200);
  });

  it.each(['/', '/favicon.ico', '/favicon.svg'])(
    '%s supports HEAD and rejects writes',
    async (path) => {
      const get = await workerFetch(`http://localhost${path}`);
      const head = await workerFetch(`http://localhost${path}`, { method: 'HEAD' });
      expect(head.status).toBe(200);
      expect([...head.headers]).toEqual([...get.headers]);
      expect(await head.text()).toBe('');
      for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
        const response = await workerFetch(`http://localhost${path}`, { method });
        expect(response.status).toBe(404);
        expect(await response.text()).toBe('404 Not Found');
      }
    },
  );

  it('serves the exact SVG and ICO with safe cache and content headers', async () => {
    const svg = await workerFetch('http://localhost/favicon.svg');
    expect(svg.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(await svg.text()).toBe(ICON_SVG);
    const ico = await workerFetch('http://localhost/favicon.ico');
    expect(ico.headers.get('Content-Type')).toBe('image/x-icon');
    expect(new Uint8Array(await ico.arrayBuffer())).toEqual(
      Uint8Array.from(atob(FAVICON_BASE64), (char) => char.charCodeAt(0)),
    );
    for (const response of [svg, ico]) {
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
      expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=31536000');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    }
  });

  it.each(['/favicon.png', '/favicon.svg/extra', '/index.html'])(
    'keeps %s a uniform 404',
    async (path) => {
      const response = await workerFetch(`http://localhost${path}`);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('404 Not Found');
    },
  );
});
