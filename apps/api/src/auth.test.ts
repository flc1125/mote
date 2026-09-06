import { env } from 'cloudflare:workers';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import viewer from '../../viewer/src/index.js';

import { createAuthenticator, type AuthConfig } from './auth.js';
import { createApiWorker, type Env } from './index.js';
import { TEST_PUBLISH_TOKEN } from './test-token.js';

const ISSUER = 'https://test-team.cloudflareaccess.com';
const HOST = 'publish.example.com';
const config: AuthConfig = {
  MOTE_AUTH_MODE: 'cloudflare-access',
  MOTE_ACCESS_ISSUER: ISSUER,
  MOTE_ACCESS_AUD: 'test-audience',
  MOTE_ACCESS_HOSTNAME: HOST,
  MOTE_TOKEN: TEST_PUBLISH_TOKEN,
};
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let other: Awaited<ReturnType<typeof generateKeyPair>>;
let keys: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  pair = await generateKeyPair('RS256', { extractable: true });
  other = await generateKeyPair('RS256', { extractable: true });
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'first', alg: 'RS256' }],
  });
});
afterEach(() => vi.restoreAllMocks());

async function sign(overrides: JWTPayload = {}, keyPair = pair, kid = 'first') {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: ISSUER,
    aud: ['test-audience'],
    sub: 'user-id',
    type: 'app',
    email: 'signed@example.invalid',
    iat: now,
    exp: now + 3600,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .sign(keyPair.privateKey);
}
const verify = createAuthenticator(() => keys);
const worker = createApiWorker(verify);
function noStorage(overrides: AuthConfig = {}): Env {
  return {
    ...config,
    ...overrides,
    VIEWER_BASE_URL: 'https://read.example.com',
    get DOCUMENTS(): R2Bucket {
      throw new Error('R2 must not be accessed');
    },
  };
}
function request(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Cf-Access-Jwt-Assertion', token);
  return new Request(`https://${HOST}${path}`, { ...init, headers });
}

describe('common authentication boundary', () => {
  it.each(['/api/v1/publish', '/api/mcp', '/api/auth/session'])(
    'rejects forged headers at %s before consuming body or touching storage',
    async (path) => {
      const req = request(path, undefined, {
        method: 'POST',
        body: 'secret-body',
        headers: {
          Authorization: `Bearer ${TEST_PUBLISH_TOKEN}`,
          'Cf-Access-Authenticated-User-Email': 'forged@example.invalid',
          'CF-Access-Client-Id': 'abc123.access',
          'CF-Access-Client-Secret': 'fake-secret',
          Cookie: 'CF_Authorization=forged',
        },
      });
      const response = await worker.fetch(req, noStorage());
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(req.bodyUsed).toBe(false);
    },
  );

  it.each([
    { exp: 1 },
    { nbf: 9_999_999_999 },
    { iat: 9_999_999_999 },
    { iss: 'https://evil.example' },
    { aud: 'other-audience' },
    { exp: undefined },
    { iat: undefined },
    { sub: undefined },
    { sub: '' },
    { sub: ' ' },
    { email: 42 },
    { type: 'org' },
    { type: undefined },
    { common_name: 'abc123.access' },
    { iat: 100, exp: 99 },
  ])('rejects invalid signed user claims %j', async (claims) => {
    const req = request('/api/v1/publish', await sign(claims), { method: 'POST', body: 'unread' });
    expect((await worker.fetch(req, noStorage())).status).toBe(401);
    expect(req.bodyUsed).toBe(false);
  });

  it.each([
    { MOTE_AUTH_MODE: 'invalid' },
    { MOTE_AUTH_MODE: '' },
    { MOTE_ACCESS_ISSUER: undefined },
    { MOTE_ACCESS_ISSUER: 'http://test-team.cloudflareaccess.com' },
    { MOTE_ACCESS_ISSUER: 'https://evil.example' },
    { MOTE_ACCESS_ISSUER: 'https://test-team.cloudflareaccess.com/extra' },
    { MOTE_ACCESS_ISSUER: 'https://test-team.cloudflareaccess.com?jku=evil' },
    { MOTE_ACCESS_AUD: undefined },
    { MOTE_ACCESS_AUD: '' },
    { MOTE_ACCESS_HOSTNAME: undefined },
    { MOTE_ACCESS_HOSTNAME: '*.example.com' },
    { MOTE_ACCESS_HOSTNAME: 'worker.account.workers.dev' },
  ])('fails closed on configuration %j without loading keys', async (overrides) => {
    const getKeys = vi.fn(() => keys);
    expect(
      await createAuthenticator(getKeys)(request('/api/auth/session', await sign()), {
        ...config,
        ...overrides,
      }),
    ).toBeNull();
    expect(getKeys).not.toHaveBeenCalled();
  });

  it.each([
    'https://worker.account.workers.dev',
    'https://version-worker.account.workers.dev',
    'https://other.example.com',
    `http://${HOST}`,
    `https://${HOST}:8443`,
  ])(
    'rejects alternate origin %s even with a valid assertion and forged forwarding headers',
    async (origin) => {
      const req = new Request(`${origin}/api/mcp`, {
        method: 'POST',
        body: '{}',
        headers: {
          'Cf-Access-Jwt-Assertion': await sign(),
          'X-Forwarded-Host': HOST,
          Host: HOST,
        },
      });
      expect((await worker.fetch(req, noStorage())).status).toBe(401);
      expect(req.bodyUsed).toBe(false);
    },
  );

  it('rejects forged signatures, malformed assertions and unsupported algorithms', async () => {
    const hmac = await new SignJWT({ sub: 'user-id' })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new Uint8Array(32));
    for (const token of [await sign({}, other), 'opaque-access-token', hmac, 'x'.repeat(16_385)]) {
      expect(await verify(request('/api/auth/session', token), config)).toBeNull();
    }
    expect(
      await verify(
        request('/api/auth/session', undefined, {
          headers: { Authorization: `Bearer ${await sign()}` },
        }),
        config,
      ),
    ).toBeNull();
  });

  it('exposes only signed user identity, without raw claims or fake email headers', async () => {
    const response = await worker.fetch(
      request('/api/auth/session', await sign({ secret: 'private-claim' }), {
        headers: { 'Cf-Access-Authenticated-User-Email': 'forged@example.invalid' },
      }),
      noStorage(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      authenticated: true,
      publisher: { kind: 'user', subject: 'user-id', email: 'signed@example.invalid' },
    });
  });

  it('exposes signed machine identity without inventing a user or session expiry', async () => {
    const response = await worker.fetch(
      request(
        '/api/auth/session',
        await sign({
          sub: '',
          email: undefined,
          common_name: 'abc123.access',
        }),
        { headers: { 'CF-Access-Client-Id': 'forged.access' } },
      ),
      noStorage(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      publisher: { kind: 'service', subject: 'abc123.access' },
    });
  });

  it.each([
    { common_name: undefined },
    { common_name: '' },
    { common_name: 'mtls.example.com' },
    { email: 'ambiguous@example.invalid' },
    { sub: 'user' },
    { type: 'org' },
  ])('rejects ambiguous machine claims %j', async (claims) => {
    expect(
      await verify(
        request(
          '/api/auth/session',
          await sign({
            sub: '',
            email: undefined,
            common_name: 'abc123.access',
            ...claims,
          }),
        ),
        config,
      ),
    ).toBeNull();
  });

  it('keeps token mode explicit or default, with no Access-only fallback', async () => {
    for (const mode of [undefined, 'token']) {
      const legacy = noStorage({ MOTE_AUTH_MODE: mode });
      const req = request('/api/auth/session', undefined, {
        headers: { Authorization: `Bearer ${TEST_PUBLISH_TOKEN}` },
      });
      const response = await worker.fetch(req, legacy);
      expect(await response.json()).toEqual({ authenticated: true, publisher: { kind: 'token' } });
      expect(await verify(request('/api/auth/session', await sign()), legacy)).toBeNull();
      expect(await verify(req, { MOTE_TOKEN: '' })).toBeNull();
      expect(await verify(req, {})).toBeNull();
    }
  });

  it('keeps health public without storage/config and session GET-only', async () => {
    expect(
      (await worker.fetch(request('/api/health'), noStorage({ MOTE_AUTH_MODE: 'broken' }))).status,
    ).toBe(200);
    const response = await worker.fetch(
      request('/api/auth/session', await sign(), { method: 'POST' }),
      noStorage(),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('production JWKS cache and failures', () => {
  it('uses only the configured issuer URL, caches keys, rotates after cooldown and fails closed when stale', async () => {
    const first = { ...(await exportJWK(pair.publicKey)), kid: 'first', alg: 'RS256' };
    const second = { ...(await exportJWK(other.publicKey)), kid: 'second', alg: 'RS256' };
    const fetchKeys = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => Response.json({ keys: [first] }));
    const auth = createAuthenticator();
    const token = await sign();
    expect(await auth(request('/api/auth/session', token), config)).toMatchObject({ kind: 'user' });
    expect(await auth(request('/api/auth/session', token), config)).toMatchObject({ kind: 'user' });
    expect(fetchKeys).toHaveBeenCalledTimes(1);
    expect(fetchKeys.mock.calls[0]?.[0]).toBe(`${ISSUER}/cdn-cgi/access/certs`);
    expect(fetchKeys.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
    const rotated = await sign({}, other, 'second');
    expect(await auth(request('/api/auth/session', rotated), config)).toBeNull();
    expect(fetchKeys).toHaveBeenCalledTimes(1);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 31_000);
    fetchKeys.mockImplementation(async () => Response.json({ keys: [second] }));
    expect(await auth(request('/api/auth/session', rotated), config)).toMatchObject({
      kind: 'user',
    });
    expect(fetchKeys).toHaveBeenCalledTimes(2);
    fetchKeys.mockRejectedValue(new Error('network unavailable'));
    expect(await auth(request('/api/auth/session', rotated), config)).toMatchObject({
      kind: 'user',
    });
    vi.spyOn(Date, 'now').mockReturnValue(now + 632_000);
    expect(await auth(request('/api/auth/session', rotated), config)).toBeNull();
  });

  it.each(['network', 'redirect', 'invalid-json', 'empty-keys'])(
    'rejects %s JWKS without body/storage or credential logs',
    async (failure) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        if (failure === 'network') throw new Error('SECRET from library');
        if (failure === 'redirect')
          return new Response(null, { status: 302, headers: { Location: 'https://evil.example' } });
        if (failure === 'invalid-json') return new Response('not-json');
        return Response.json({ keys: [] });
      });
      const log = vi.spyOn(console, 'log');
      const error = vi.spyOn(console, 'error');
      const req = request('/api/v1/publish', await sign(), { method: 'POST', body: 'secret-body' });
      const response = await createApiWorker(createAuthenticator()).fetch(req, noStorage());
      expect(response.status).toBe(401);
      expect(req.bodyUsed).toBe(false);
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain('SECRET');
    },
  );
});

describe('Access publishing uses the existing pipeline', () => {
  it.each(['user', 'service'])(
    '%s can publish through REST and MCP, with public reading and no identity in manifests/logs',
    async (kind) => {
      const token = await sign(
        kind === 'service' ? { sub: '', email: undefined, common_name: 'abc123.access' } : {},
      );
      const bindings = {
        ...config,
        DOCUMENTS: env.DOCUMENTS,
        VIEWER_BASE_URL: 'https://read.example.com',
      };
      const log = vi.spyOn(console, 'log');
      const form = new FormData();
      form.append('document', new File(['# Access publication'], 'note.md'));
      form.append('manifest', JSON.stringify({ version: 1, entry: 'note.md', assets: [] }));
      const rest = await worker.fetch(
        request('/api/v1/publish', token, { method: 'POST', body: form }),
        bindings,
      );
      expect(rest.status).toBe(201);
      const published = (await rest.json()) as { id: string; url: string };
      const mcp = await worker.fetch(
        request('/api/mcp', token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'publish_markdown', arguments: { markdown: '# Access publication' } },
          }),
        }),
        bindings,
      );
      expect(mcp.status).toBe(200);
      const result = (await mcp.json()) as {
        result: { structuredContent: { id: string; url: string } };
      };
      for (const doc of [published, result.result.structuredContent]) {
        expect(doc.url).toBe(`https://read.example.com/${doc.id}`);
        const manifest = await env.DOCUMENTS.get(`documents/${doc.id}/manifest.json`);
        const text = await manifest!.text();
        for (const secret of [
          token,
          'publisher',
          'signed@example.invalid',
          'user-id',
          'abc123.access',
        ])
          expect(text).not.toContain(secret);
        const page = await viewer.fetch(new Request(doc.url), env);
        expect(page.status).toBe(200);
        expect(await page.text()).toContain('Access publication');
      }
      const logs = JSON.stringify(log.mock.calls);
      for (const secret of [
        token,
        'signed@example.invalid',
        'user-id',
        'abc123.access',
        '# Access publication',
      ])
        expect(logs).not.toContain(secret);
    },
  );
});
