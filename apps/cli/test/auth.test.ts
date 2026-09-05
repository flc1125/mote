import { createHash } from 'node:crypto';
import { chmod, lstat, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authMode, authStatus, prepareAuth } from '../src/auth/manager.js';
import { callbackListener, discover, login } from '../src/auth/oauth.js';
import { CredentialStore, type KeyringEntry } from '../src/auth/store.js';
import type { OAuthCredential } from '../src/auth/types.js';
import { apiOrigin, trustedIssuer } from '../src/auth/urls.js';
import { resolveConfig } from '../src/config.js';
import { run } from '../src/run.js';

const api = 'https://mote.example.com';
const issuer = 'https://team.cloudflareaccess.com';
const resource = api + '/api/mcp';
const server = {
  issuer,
  authorization_endpoint: issuer + '/authorize',
  token_endpoint: issuer + '/token',
  registration_endpoint: issuer + '/register',
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
};
const credential = (): OAuthCredential => ({
  version: 1,
  apiUrl: api,
  issuer,
  resource,
  server,
  clientId: 'public',
  accessToken: 'access-secret',
  refreshToken: 'refresh-secret',
  expiresAt: Date.now() + 3600000,
  identity: { kind: 'user', subject: 'user-1', email: 'test@example.com' },
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
let dir: string;
let store: CredentialStore;
let secrets: Map<string, string>;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mote-auth-test-'));
  secrets = new Map();
  store = new CredentialStore({
    directory: join(dir, 'auth'),
    entry: async (key): Promise<KeyringEntry> => ({
      getPassword: () => secrets.get(key) ?? null,
      setPassword: (value) => {
        secrets.set(key, value);
      },
      deletePassword: () => secrets.delete(key),
    }),
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe('credential isolation and locking', () => {
  it('stores tokens only in keyring and leaves metadata private', async () => {
    await store.locked(api, () => store.save(credential()));
    expect((await store.load(api))?.accessToken).toBe('access-secret');
    for (const file of await readdir(store.directory)) {
      expect(await readFile(join(store.directory, file), 'utf8')).not.toContain('access-secret');
      expect((await lstat(join(store.directory, file))).mode & 0o777).toBe(0o600);
    }
    expect(await store.load('https://other.example.com')).toBeUndefined();
  });
  it('uses private atomic files only when explicitly requested', async () => {
    await store.locked(api, () => store.save(credential(), 'file'));
    expect(secrets.size).toBe(0);
    expect((await store.load(api))?.refreshToken).toBe('refresh-secret');
    expect((await readdir(store.directory)).some((x) => x.endsWith('.tmp'))).toBe(false);
  });
  it('does not fall back when an existing keyring is locked', async () => {
    await store.locked(api, () => store.save(credential()));
    const locked = new CredentialStore({
      directory: store.directory,
      entry: async () => {
        throw new Error('sensitive native error');
      },
    });
    await expect(locked.load(api)).rejects.toThrow(/no fallback/);
    expect((await readdir(store.directory)).some((x) => x.endsWith('.credential'))).toBe(false);
  });
  it('rejects broad permissions and symlink credential files', async () => {
    await store.locked(api, () => store.save(credential(), 'file'));
    const file = (await readdir(store.directory)).find((x) => x.endsWith('.credential'))!;
    await chmod(join(store.directory, file), 0o644);
    await expect(store.load(api)).rejects.toThrow(/safely/);
    await rm(join(store.directory, file));
    await writeFile(join(dir, 'other'), '{}');
    await symlink(join(dir, 'other'), join(store.directory, file));
    await expect(store.load(api)).rejects.toThrow(/safely/);
  });
  it('keeps OAuth selection after logout, without resurrecting an old environment token', async () => {
    await store.locked(api, () => store.save(credential()));
    await store.locked(api, () => store.remove(api));
    expect(secrets.size).toBe(0);
    expect(await authMode({ apiUrl: api, token: 'old' }, store)).toBe('oauth');
    await expect(prepareAuth({ apiUrl: api, token: 'old' }, store)).rejects.toThrow(
      /mote auth login/,
    );
    expect(
      (await prepareAuth({ apiUrl: api, authMode: 'token', token: 'explicit' }, store)).headers
        .Authorization,
    ).toBe('Bearer explicit');
  });
  it('serializes concurrent refresh and writes new credentials once', async () => {
    await store.locked(api, () => store.save({ ...credential(), expiresAt: 0 }));
    const request = vi.fn(async () =>
      json({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );
    const result = await Promise.all(
      Array.from({ length: 6 }, () => prepareAuth({ apiUrl: api }, store, request)),
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.every((x) => x.headers.Authorization === 'Bearer new-access')).toBe(true);
    expect((await store.load(api))?.refreshToken).toBe('new-refresh');
  });
  it('does not replay a refresh after an unknown exchange result', async () => {
    await store.locked(api, () => store.save({ ...credential(), expiresAt: 0 }));
    const request = vi.fn(async () => {
      throw new Error('SECRET');
    });
    await expect(prepareAuth({ apiUrl: api }, store, request)).rejects.toThrow(/outcome unknown/);
    await expect(prepareAuth({ apiUrl: api }, store, request)).rejects.toThrow(/mote auth login/);
    expect(request).toHaveBeenCalledTimes(1);
    expect((await store.load(api))?.refreshPending).toBe(true);
  });
  it('refuses authority changes without logout', async () => {
    await store.locked(api, () => store.save(credential()));
    await expect(
      store.save({ ...credential(), issuer: 'https://other.cloudflareaccess.com' }),
    ).rejects.toThrow(/authority/);
  });
  it('does not steal a live or incomplete lock', async () => {
    const blocked = new CredentialStore({ directory: store.directory, lockTimeoutMs: 5 });
    await store.locked(api, async () => {
      await expect(blocked.locked(api, async () => true)).rejects.toThrow(/locked/);
    });
    const lock = join(
      store.directory,
      createHash('sha256').update(api).digest('hex') + '.json.lock',
    );
    await writeFile(lock, '');
    await expect(blocked.locked(api, async () => true)).rejects.toThrow(/locked/);
  });
});

function mockOAuth() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    expect(init?.redirect).toBe('error');
    if (url === resource)
      return new Response(null, {
        status: 401,
        headers: { 'WWW-Authenticate': `Bearer resource_metadata="${api}/.well-known/resource"` },
      });
    if (url === api + '/.well-known/resource')
      return json({ resource, authorization_servers: [issuer] });
    if (url === issuer + '/.well-known/oauth-authorization-server') return json(server);
    if (url === issuer + '/register') {
      const body = JSON.parse(String(init?.body));
      expect(body.resource).toBe(resource);
      expect(body.token_endpoint_auth_method).toBe('none');
      expect(body.redirect_uris[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback$/);
      return json({ client_id: 'registered', token_endpoint_auth_method: 'none' }, 201);
    }
    if (url === issuer + '/token')
      return json({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    if (url === api + '/api/auth/session')
      return json({ authenticated: true, publisher: credential().identity });
    throw new Error('unexpected destination');
  });
}
describe('OAuth protocol', () => {
  it('validates challenge, resource and trusted issuer', async () => {
    expect((await discover(api, mockOAuth())).issuer).toBe(issuer);
    await expect(
      discover(
        api,
        async () =>
          new Response(null, {
            status: 401,
            headers: {
              'WWW-Authenticate': 'Bearer resource_metadata="https://evil.example/resource"',
            },
          }),
      ),
    ).rejects.toThrow(/origin/);
  });
  it('rejects credential-bearing API URLs and non-Access issuers', () => {
    for (const value of [
      'https://user:secret@example.com',
      'https://example.com/path',
      'https://example.com?secret=x',
      'http://example.com',
    ])
      expect(() => apiOrigin(value)).toThrow();
    expect(() => trustedIssuer('https://team.cloudflareaccess.com.evil.example')).toThrow();
    expect(() => trustedIssuer('https://team.cloudflareaccess.com:8443')).toThrow();
  });
  it('performs public DCR and PKCE login, ignoring bad-state callbacks', async () => {
    const request = mockOAuth();
    let challenge = '';
    const result = await login(api, {
      fetchImpl: request,
      onUrl: async (value) => {
        const url = new URL(value);
        challenge = url.searchParams.get('code_challenge')!;
        expect(url.searchParams.get('resource')).toBe(resource);
        const redirect = url.searchParams.get('redirect_uri')!;
        expect((await fetch(redirect + '?code=bad&state=bad')).status).toBe(400);
        await fetch(redirect + '?code=code&state=' + url.searchParams.get('state'));
      },
    });
    expect(result.identity.kind).toBe('user');
    expect(result.clientId).toBe('registered');
    const tokenCall = request.mock.calls.find(([url]) => String(url) === issuer + '/token')!;
    const body = new URLSearchParams(tokenCall[1]?.body as URLSearchParams);
    expect(createHash('sha256').update(body.get('code_verifier')!).digest('base64url')).toBe(
      challenge,
    );
    expect(body.get('resource')).toBe(resource);
    expect(body.has('client_secret')).toBe(false);
  });
  it('times out and closes its listener', async () => {
    const listener = await callbackListener('state', 15);
    await expect(listener.result).rejects.toThrow(/timed out/);
    await listener.close();
    await expect(fetch(listener.redirectUri)).rejects.toThrow();
  });
  it('supports a registered callback port and rejects occupied or invalid ports', async () => {
    const initial = await callbackListener('state');
    const port = Number(new URL(initial.redirectUri).port);
    await initial.close();
    const listener = await callbackListener('state', 1000, undefined, port);
    try {
      expect(Number(new URL(listener.redirectUri).port)).toBe(port);
      await expect(callbackListener('other', 1000, undefined, port)).rejects.toMatchObject({
        code: 'EADDRINUSE',
      });
      await expect(callbackListener('other', 1000, undefined, -1)).rejects.toThrow(/callback port/);
    } finally {
      await listener.close();
    }
  });

  it('supports cancellation', async () => {
    const signal = new AbortController();
    const listener = await callbackListener('state', 1000, signal.signal);
    signal.abort();
    await expect(listener.result).rejects.toThrow(/cancelled/);
    await listener.close();
  });
});
describe('mode and commands', () => {
  it('isolates service credentials by explicit target and never mixes legacy token', async () => {
    const config = {
      apiUrl: api,
      authMode: 'service' as const,
      token: 'old',
      serviceToken: { apiUrl: api, clientId: 'client.access', clientSecret: 'machine-secret' },
    };
    const result = await prepareAuth(config, store);
    expect(result.headers).toEqual({
      'CF-Access-Client-Id': 'client.access',
      'CF-Access-Client-Secret': 'machine-secret',
    });
    await expect(
      prepareAuth({ ...config, apiUrl: 'https://other.example.com' }, store),
    ).rejects.toThrow(/matching/);
    await expect(
      prepareAuth({ ...config, serviceToken: { ...config.serviceToken, clientSecret: '' } }, store),
    ).rejects.toThrow(/requires/);
  });
  it('does not silently combine partial machine environment with config-file secrets', async () => {
    const path = join(dir, 'config.json');
    await writeFile(
      path,
      JSON.stringify({ serviceToken: { apiUrl: api, clientId: 'file', clientSecret: 'secret' } }),
    );
    const config = await resolveConfig({
      api,
      authMode: 'service',
      configPath: path,
      env: { MOTE_SERVICE_CLIENT_ID: 'env' },
    });
    await expect(prepareAuth(config, store)).rejects.toThrow(/requires/);
  });
  it('labels offline state as cached and session expiry unknown', async () => {
    await store.locked(api, () => store.save(credential()));
    const request = vi.fn();
    const result = await authStatus({ apiUrl: api }, store, false, request);
    expect(result.source).toBe('cache');
    expect(result.authenticated).toBeNull();
    expect(result.authorizationSessionExpiresAt).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('access-secret');
  });
  it('login rejects JSON and noninteractive use before opening browser', async () => {
    const open = vi.fn();
    const out: string[] = [];
    const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => out.push(s) };
    for (const args of [
      ['auth', 'login'],
      ['auth', 'login', '--json'],
    ])
      expect(
        await run(args, io, {
          env: {},
          configPath: join(dir, 'none'),
          store,
          interactive: false,
          openBrowser: open,
        }),
      ).toBe(1);
    expect(open).not.toHaveBeenCalled();
    expect(out.join()).toContain('interactive');
  });
  it('status defaults online and --offline performs no network request', async () => {
    await store.locked(api, () => store.save(credential()));
    const fetchImpl = mockOAuth();
    const output: string[] = [];
    const io = { stdout: (s: string) => output.push(s), stderr: (s: string) => output.push(s) };
    const deps = { store, fetchImpl, env: { MOTE_API_URL: api }, configPath: join(dir, 'none') };
    expect(await run(['auth', 'status', '--json'], io, deps)).toBe(0);
    expect(JSON.parse(output[0]!).source).toBe('online');
    fetchImpl.mockClear();
    expect(await run(['auth', 'status', '--offline', '--json'], io, deps)).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
