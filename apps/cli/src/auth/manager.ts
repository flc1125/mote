import { dirname, join } from 'node:path';
import { defaultConfigPath, type CliConfig } from '../config.js';
import { CliError } from '../errors.js';
import { identity, LOGIN_REQUIRED, refresh } from './oauth.js';
import { CredentialStore } from './store.js';
import type { AuthHeaders } from './types.js';
import { apiOrigin } from './urls.js';

export function defaultCredentialStore(
  env: Record<string, string | undefined> = process.env,
  configPath?: string,
) {
  return new CredentialStore({
    directory: join(dirname(configPath ?? defaultConfigPath(env)), 'auth'),
  });
}
export async function authMode(
  config: CliConfig,
  store: CredentialStore,
): Promise<AuthHeaders['mode']> {
  if (config.authMode) return config.authMode;
  return (await store.backend(config.apiUrl)) ? 'oauth' : 'token';
}
export async function prepareAuth(
  config: CliConfig,
  store: CredentialStore,
  fetchImpl?: typeof fetch,
): Promise<AuthHeaders> {
  const mode = await authMode(config, store);
  const api = apiOrigin(config.apiUrl, mode !== 'token');
  if (mode === 'token') {
    if (!config.token)
      throw new CliError(
        'no publish token configured. Set MOTE_TOKEN, pass --token, or run mote auth login.',
      );
    return { mode, headers: { Authorization: `Bearer ${config.token}` } };
  }
  if (mode === 'service') {
    const s = config.serviceToken;
    if (!s?.apiUrl || !s.clientId || !s.clientSecret || apiOrigin(s.apiUrl, true) !== api)
      throw new CliError(
        'service mode requires matching MOTE_SERVICE_API_URL, MOTE_SERVICE_CLIENT_ID and MOTE_SERVICE_CLIENT_SECRET',
      );
    return {
      mode,
      headers: { 'CF-Access-Client-Id': s.clientId, 'CF-Access-Client-Secret': s.clientSecret },
    };
  }
  return store.locked(api, async () => {
    let credential = await store.load(api);
    if (!credential || credential.refreshPending) throw new CliError(LOGIN_REQUIRED);
    if (credential.expiresAt <= Date.now() + 60000) {
      // Persist before exchange: after a crash, do not replay a possibly rotated refresh token.
      await store.save({ ...credential, refreshPending: true });
      credential = await refresh(credential, fetchImpl);
      await store.save(credential);
    }
    return { mode, headers: { Authorization: `Bearer ${credential.accessToken}` } };
  });
}
export async function authStatus(
  config: CliConfig,
  store: CredentialStore,
  online: boolean,
  fetchImpl?: typeof fetch,
) {
  const mode = await authMode(config, store);
  const cached = mode === 'oauth' ? await store.load(config.apiUrl) : undefined;
  const base = {
    api: apiOrigin(config.apiUrl),
    mode,
    source: online ? 'online' : 'cache',
    accessTokenExpiresAt: cached ? new Date(cached.expiresAt).toISOString() : null,
    authorizationSessionExpiresAt: null,
    storage: mode === 'oauth' ? ((await store.backend(config.apiUrl)) ?? null) : null,
  };
  if (!online)
    return {
      ...base,
      authenticated: null,
      state: cached
        ? cached.refreshPending
          ? 'login-required'
          : cached.expiresAt > Date.now()
            ? 'cached-token-valid'
            : 'refresh-required'
        : 'not-logged-in',
      identity: cached?.identity ?? null,
    };
  const auth = await prepareAuth(config, store, fetchImpl);
  if (mode === 'oauth') {
    const refreshed = await store.load(config.apiUrl);
    base.accessTokenExpiresAt = refreshed ? new Date(refreshed.expiresAt).toISOString() : null;
  }
  const publisher = await identity(config.apiUrl, auth.headers, fetchImpl);
  if (publisher.kind !== (mode === 'oauth' ? 'user' : mode))
    throw new CliError('authentication mode/identity mismatch');
  return { ...base, authenticated: true, state: 'authenticated', identity: publisher };
}
