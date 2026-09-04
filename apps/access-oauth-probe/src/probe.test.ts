import { env } from 'cloudflare:workers';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createApiProbe } from './api.js';
import { verifyAccessAssertion } from './auth.js';
import { PROBE_AUD, PROBE_ISSUER, PROBE_ORIGIN } from './boundary.js';
import viewer from './viewer.js';

let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
let localKeys: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  keyPair = await generateKeyPair('RS256', { extractable: true });
  const publicKey = await exportJWK(keyPair.publicKey);
  localKeys = createLocalJWKSet({ keys: [{ ...publicKey, kid: 'test-key', alg: 'RS256' }] });
});

async function sign(overrides: JWTPayload = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: PROBE_ISSUER,
    aud: [PROBE_AUD],
    sub: 'phase0-test-subject',
    email: 'publisher@example.invalid',
    iat: now,
    exp: now + 300,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .sign(keyPair.privateKey);
}

function request(path: string, assertion?: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (assertion) headers.set('Cf-Access-Jwt-Assertion', assertion);
  return new Request(PROBE_ORIGIN + path, { ...init, headers });
}

const api = createApiProbe((req, config) => verifyAccessAssertion(req, config, localKeys));

function noStorage(): ProbeEnv {
  return {
    ACCESS_ISSUER: PROBE_ISSUER,
    ACCESS_AUD: PROBE_AUD,
    VIEWER_BASE_URL: PROBE_ORIGIN,
    get DOCUMENTS(): R2Bucket {
      throw new Error('R2 must not be touched');
    },
  };
}

describe('Access assertion verification', () => {
  it('verifies the signature before exposing identity and ignores email headers', async () => {
    const req = request('/api/auth/session', await sign(), {
      headers: { 'Cf-Access-Authenticated-User-Email': 'forged@example.invalid' },
    });
    expect(await verifyAccessAssertion(req, env, localKeys)).toEqual({
      subject: 'phase0-test-subject',
      email: 'publisher@example.invalid',
    });
  });

  it.each([
    ['wrong issuer', { iss: 'https://untrusted.example.invalid' }],
    ['wrong audience', { aud: 'other-application' }],
    ['expired', { exp: 1 }],
    ['missing expiry', { exp: undefined }],
    ['missing subject', { sub: undefined }],
    ['empty subject', { sub: '' }],
    ['missing issued-at', { iat: undefined }],
    ['future issued-at', { iat: 9_999_999_999 }],
    ['not yet valid', { nbf: 9_999_999_999 }],
  ] satisfies [string, JWTPayload][])('rejects %s', async (_name, claims) => {
    expect(
      await verifyAccessAssertion(request('/api/mcp', await sign(claims)), env, localKeys),
    ).toBeNull();
  });

  it('rejects a different signing key even with matching issuer and audience', async () => {
    const otherKeys = await generateKeyPair('RS256', { extractable: true });
    const getKey = createLocalJWKSet({
      keys: [{ ...(await exportJWK(otherKeys.publicKey)), kid: 'test-key', alg: 'RS256' }],
    });
    expect(await verifyAccessAssertion(request('/api/mcp', await sign()), env, getKey)).toBeNull();
  });

  it.each(['not-a-jwt', 'e30.e30.', 'x'.repeat(16_385)])(
    'rejects malformed assertions',
    async (value) => {
      expect(await verifyAccessAssertion(request('/api/mcp', value), env, localKeys)).toBeNull();
    },
  );

  it('does not accept an HMAC token', async () => {
    const token = await new SignJWT({ iss: PROBE_ISSUER, aud: PROBE_AUD })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(crypto.getRandomValues(new Uint8Array(32)));
    expect(await verifyAccessAssertion(request('/api/mcp', token), env, localKeys)).toBeNull();
  });

  it('fails closed when key retrieval fails', async () => {
    const getKey = vi.fn(async () => {
      throw new Error('unavailable');
    });
    expect(await verifyAccessAssertion(request('/api/mcp', await sign()), env, getKey)).toBeNull();
    expect(getKey).toHaveBeenCalledOnce();
  });
});

describe('Phase 0 boundaries and reused pipeline', () => {
  it.each(['/api/mcp', '/api/v1/publish', '/api/auth/session'])(
    'rejects missing assertions before reading body or storage: %s',
    async (path) => {
      const req = request(path, undefined, {
        method: 'POST',
        body: 'invalid body',
        headers: { Authorization: 'Bearer old-static-token' },
      });
      const response = await api.fetch(req, noStorage());
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(req.bodyUsed).toBe(false);
    },
  );

  it('leaves health independent of credentials and R2', async () => {
    const response = await api.fetch(request('/api/health'), noStorage());
    expect(response.status).toBe(200);
  });

  it.each(['http://localhost', 'https://other.workers.dev', 'https://mote.flc.io'])(
    'rejects alternate origin %s regardless of forwarded headers',
    async (origin) => {
      const req = new Request(origin + '/api/mcp', {
        method: 'POST',
        body: '{}',
        headers: { Host: 'mote-oauth-test.flc.io', 'X-Forwarded-Host': 'mote-oauth-test.flc.io' },
      });
      expect((await api.fetch(req, noStorage())).status).toBe(404);
      expect(req.bodyUsed).toBe(false);
      expect((await viewer.fetch(req, noStorage())).status).toBe(404);
    },
  );

  it.each(['ACCESS_ISSUER', 'ACCESS_AUD', 'VIEWER_BASE_URL'] as const)(
    'rejects missing/mistargeted configuration: %s',
    async (field) => {
      const verify = vi.fn();
      const probe = createApiProbe(verify);
      const response = await probe.fetch(request('/api/mcp'), { ...env, [field]: '' });
      expect(response.status).toBe(503);
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it('returns minimal authenticated session information without cache or raw assertions', async () => {
    const token = await sign();
    const response = await api.fetch(request('/api/auth/session', token), noStorage());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.text();
    expect(body).not.toContain(token);
    expect(JSON.parse(body)).toEqual({
      authenticated: true,
      publisher: { subject: 'phase0-test-subject', email: 'publisher@example.invalid' },
    });
  });

  it('does not fabricate OAuth discovery metadata in the Viewer', async () => {
    const response = await viewer.fetch(
      request('/.well-known/oauth-protected-resource'),
      noStorage(),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Mote-Probe')).toBe('phase-0-viewer');
  });

  it('supports initialize and tools/list through the existing MCP implementation', async () => {
    const token = await sign();
    for (const method of ['initialize', 'tools/list']) {
      const response = await api.fetch(
        request('/api/mcp', token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method }),
        }),
        env,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toHaveProperty('result');
    }
  });

  it('publishes via MCP, stores no identity, and serves the URL without authentication', async () => {
    const response = await api.fetch(
      request('/api/mcp', await sign(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'publish_markdown',
            arguments: { markdown: '# Phase 0 local test', name: 'probe.md' },
          },
        }),
      }),
      env,
    );
    expect(response.status).toBe(200);
    const body = await response.json<{
      result: { structuredContent: { id: string; url: string } };
    }>();
    const { id, url } = body.result.structuredContent;
    expect(url).toBe(`${PROBE_ORIGIN}/${id}`);
    const manifest = await env.DOCUMENTS.get(`documents/${id}/manifest.json`);
    expect(manifest).not.toBeNull();
    const manifestText = await manifest!.text();
    expect(manifestText).not.toContain('publisher');
    expect(manifestText).not.toContain('phase0-test-subject');
    for (const method of ['GET', 'HEAD']) {
      const page = await viewer.fetch(new Request(url, { method }), env);
      expect(page.status).toBe(200);
      if (method === 'GET') expect(await page.text()).toContain('Phase 0 local test');
    }
  });

  it('publishes a multipart document with a local image via the existing API', async () => {
    const form = new FormData();
    form.append(
      'document',
      new File(['# Image test\n![pixel](pixel.png)'], 'probe.md', { type: 'text/markdown' }),
    );
    form.append(
      'manifest',
      JSON.stringify({
        version: 1,
        entry: 'probe.md',
          assets: [{ field: 'asset_0', references: ['pixel.png'] }],
      }),
    );
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      ),
      (c) => c.charCodeAt(0),
    );
    form.append('asset_0', new File([png], 'pixel.png', { type: 'image/png' }));
    const response = await api.fetch(
      request('/api/v1/publish', await sign(), { method: 'POST', body: form }),
      env,
    );
    expect(response.status).toBe(201);
    const { id } = await response.json<{ id: string }>();
    const stored = await env.DOCUMENTS.get(`documents/${id}/manifest.json`);
    const manifest = JSON.parse(await stored!.text()) as { assets: { id: string }[] };
    const asset = await viewer.fetch(request(`/${id}/a/${manifest.assets[0]!.id}`), env);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await asset.arrayBuffer())).toEqual(png);
  });
});
