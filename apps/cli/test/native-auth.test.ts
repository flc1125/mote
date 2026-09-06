import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { CredentialStore } from '../src/auth/store.js';
import type { OAuthCredential } from '../src/auth/types.js';

// Opt in: touches only a uniquely named test account in the real OS keyring.
it.skipIf(process.env.MOTE_NATIVE_AUTH_TEST !== '1')(
  'real OS credential store round-trip and deletion',
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mote-native-auth-'));
    const apiUrl = `https://${randomUUID()}.example.com`;
    const issuer = 'https://test.cloudflareaccess.com';
    const store = new CredentialStore({ directory: join(dir, 'auth') });
    const c: OAuthCredential = {
      version: 1,
      apiUrl,
      issuer,
      resource: apiUrl + '/api/mcp',
      clientId: 'test-client',
      accessToken: 'non-secret-test-value',
      expiresAt: Date.now() + 3600000,
      identity: { kind: 'user', subject: 'test' },
      server: {
        issuer,
        authorization_endpoint: issuer + '/authorization',
        token_endpoint: issuer + '/token',
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      },
    };
    try {
      await store.locked(apiUrl, () => store.save(c));
      expect((await store.load(apiUrl))?.accessToken).toBe(c.accessToken);
      await store.locked(apiUrl, () => store.remove(apiUrl));
      expect(await store.load(apiUrl)).toBeUndefined();
    } finally {
      await store.locked(apiUrl, () => store.remove(apiUrl));
      await rm(dir, { recursive: true, force: true });
    }
  },
  30000,
);
