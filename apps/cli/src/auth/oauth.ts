import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as oauth from 'oauth4webapi';

import { CliError } from '../errors.js';
import type { Identity, OAuthCredential, OAuthServer } from './types.js';
import { apiOrigin, sameOriginEndpoint, trustedIssuer } from './urls.js';

export const LOGIN_REQUIRED = 'OAuth login required; run mote auth login';
export interface Discovery {
  apiUrl: string;
  resource: string;
  issuer: string;
  server: OAuthServer;
}
async function json(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new CliError(`authentication request failed (HTTP ${response.status})`);
  const text = await response.text();
  if (text.length > 65536) throw new CliError('authentication response too large');
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new CliError('invalid authentication response');
  }
}
/** No redirect can forward credentials or change the metadata trust boundary. */
export function guardedFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return (async (input, init) => {
    try {
      return await fetchImpl(input, {
        ...init,
        redirect: 'error',
        signal: init?.signal ?? AbortSignal.timeout(15000),
      });
    } catch {
      throw new CliError('authentication network request failed; no request was replayed');
    }
  }) as typeof fetch;
}
export async function discover(api: string, fetchImpl: typeof fetch = fetch): Promise<Discovery> {
  const apiUrl = apiOrigin(api, true);
  const resource = `${apiUrl}/api/mcp`;
  const request = guardedFetch(fetchImpl);
  const challenge = await request(resource, { headers: { Accept: 'application/json' } });
  const location = challenge.headers
    .get('www-authenticate')
    ?.match(/\bresource_metadata="([^"]+)"/i)?.[1];
  if (challenge.status !== 401 || !location)
    throw new CliError('API did not advertise OAuth protected-resource metadata');
  const metadataUrl = sameOriginEndpoint(location, apiUrl);
  const metadata = await json(await request(metadataUrl));
  if (
    metadata.resource !== resource ||
    !Array.isArray(metadata.authorization_servers) ||
    metadata.authorization_servers.length !== 1 ||
    typeof metadata.authorization_servers[0] !== 'string'
  ) {
    throw new CliError('OAuth resource/authority mismatch');
  }
  const issuer = trustedIssuer(metadata.authorization_servers[0]);
  const server = await json(await request(`${issuer}/.well-known/oauth-authorization-server`));
  validateServer(server as unknown as OAuthServer, issuer);
  return { apiUrl, resource, issuer, server: server as unknown as OAuthServer };
}
export function validateServer(server: OAuthServer, issuer: string) {
  if (server.issuer !== trustedIssuer(issuer)) throw new CliError('OAuth issuer mismatch');
  sameOriginEndpoint(server.authorization_endpoint, issuer);
  sameOriginEndpoint(server.token_endpoint, issuer);
  if (server.registration_endpoint) sameOriginEndpoint(server.registration_endpoint, issuer);
  if (
    !Array.isArray(server.code_challenge_methods_supported) ||
    !Array.isArray(server.token_endpoint_auth_methods_supported) ||
    !server.code_challenge_methods_supported?.includes('S256') ||
    !server.token_endpoint_auth_methods_supported?.includes('none')
  ) {
    throw new CliError('OAuth server must support PKCE S256 and public clients');
  }
}
export async function identity(
  api: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<Identity> {
  const response = await guardedFetch(fetchImpl)(`${apiOrigin(api)}/api/auth/session`, { headers });
  if (response.status === 401) throw new CliError(LOGIN_REQUIRED);
  const data = await json(response);
  const p = data.publisher as Identity | undefined;
  if (
    data.authenticated !== true ||
    !p ||
    !['user', 'service', 'token'].includes(p.kind) ||
    (p.kind !== 'token' && (typeof p.subject !== 'string' || !p.subject)) ||
    (p.email !== undefined && typeof p.email !== 'string') ||
    !response.headers.get('cache-control')?.includes('no-store')
  )
    throw new CliError('invalid or cacheable identity response');
  return {
    kind: p.kind,
    ...(p.subject ? { subject: p.subject } : {}),
    ...(p.email ? { email: p.email } : {}),
  };
}
function tokens(result: oauth.TokenEndpointResponse) {
  if (
    result.token_type.toLowerCase() !== 'bearer' ||
    !result.access_token ||
    !Number.isFinite(result.expires_in) ||
    result.expires_in! <= 0
  )
    throw new CliError('invalid OAuth token response');
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: Date.now() + result.expires_in! * 1000,
  };
}

export async function callbackListener(
  state: string,
  timeoutMs = 600000,
  signal?: AbortSignal,
  port = 0,
) {
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new CliError('callback port must be an integer from 0 to 65535');
  let resolve!: (url: URL) => void;
  let reject!: (error: Error) => void;
  let redirectUri = '';
  const result = new Promise<URL>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  // Discovery/registration can fail before the caller starts awaiting this promise.
  void result.catch(() => {});
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    const url = new URL(req.url ?? '/', redirectUri);
    if (
      req.method !== 'GET' ||
      req.headers.host !== new URL(redirectUri).host ||
      url.pathname !== '/oauth/callback' ||
      url.searchParams.getAll('state').length !== 1 ||
      url.searchParams.get('state') !== state
    ) {
      res.writeHead(400).end('Invalid callback.');
      return;
    }
    if (url.searchParams.has('error')) {
      res.writeHead(400).end('Authorization was not completed.');
      reject(new CliError('OAuth authorization denied'));
      return;
    }
    if (url.searchParams.getAll('code').length !== 1 || !url.searchParams.get('code')) {
      res.writeHead(400).end('Missing authorization code.');
      return;
    }
    res.end('Authorization received. Return to the terminal to check the result.');
    resolve(url);
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/oauth/callback`;
  const timeout = setTimeout(() => reject(new CliError('OAuth login timed out')), timeoutMs);
  const abort = () => reject(new CliError('OAuth login cancelled'));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  return {
    redirectUri,
    result,
    close: async () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      server.closeAllConnections();
      await new Promise<void>((ok) => server.close(() => ok()));
    },
  };
}
export async function openBrowser(url: string): Promise<boolean> {
  const [command, args] =
    process.platform === 'darwin'
      ? (['open', [url]] as const)
      : process.platform === 'win32'
        ? (['rundll32.exe', ['url.dll,FileProtocolHandler', url]] as const)
        : (['xdg-open', [url]] as const);
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { stdio: 'ignore', shell: false });
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(code === 0));
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
    timer.unref();
    child.once('close', () => clearTimeout(timer));
  });
}
export interface LoginOptions {
  clientId?: string;
  callbackPort?: number;
  fetchImpl?: typeof fetch;
  onUrl: (url: string) => Promise<void>;
  signal?: AbortSignal;
  timeoutMs?: number;
}
export async function login(api: string, options: LoginOptions): Promise<OAuthCredential> {
  const d = await discover(api, options.fetchImpl);
  const request = guardedFetch(options.fetchImpl);
  const state = oauth.generateRandomState();
  const verifier = oauth.generateRandomCodeVerifier();
  const listener = await callbackListener(
    state,
    options.timeoutMs,
    options.signal,
    options.callbackPort,
  );
  try {
    let clientId = options.clientId;
    if (!clientId) {
      const endpoint = sameOriginEndpoint(d.server.registration_endpoint, d.issuer);
      const registration = await json(
        await request(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: 'Mote CLI',
            redirect_uris: [listener.redirectUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            resource: d.resource,
          }),
        }),
      );
      if (
        typeof registration.client_id !== 'string' ||
        !registration.client_id ||
        registration.client_secret ||
        (registration.token_endpoint_auth_method !== undefined &&
          registration.token_endpoint_auth_method !== 'none')
      )
        throw new CliError('registration did not return a public OAuth client');
      clientId = registration.client_id;
    }
    const client: oauth.Client = { client_id: clientId };
    const url = new URL(d.server.authorization_endpoint!);
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: listener.redirectUri,
      state,
      resource: d.resource,
      code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
    }).toString();
    await options.onUrl(url.href);
    const callback = oauth.validateAuthResponse(d.server, client, await listener.result, state);
    const response = await oauth.authorizationCodeGrantRequest(
      d.server,
      client,
      oauth.None(),
      callback,
      listener.redirectUri,
      verifier,
      {
        [oauth.customFetch]: request,
        additionalParameters: { resource: d.resource },
        signal: AbortSignal.timeout(15000),
      },
    );
    const token = tokens(await oauth.processAuthorizationCodeResponse(d.server, client, response));
    const publisher = await identity(
      d.apiUrl,
      { Authorization: `Bearer ${token.accessToken}` },
      options.fetchImpl,
    );
    if (publisher.kind !== 'user') throw new CliError('expected a user OAuth identity');
    return { version: 1, ...d, clientId, ...token, identity: publisher };
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError('OAuth login failed; no credentials saved');
  } finally {
    await listener.close();
  }
}
export async function refresh(
  c: OAuthCredential,
  fetchImpl?: typeof fetch,
): Promise<OAuthCredential> {
  validateServer(c.server, c.issuer);
  if (!c.refreshToken) throw new CliError(LOGIN_REQUIRED);
  try {
    const client = { client_id: c.clientId };
    const response = await oauth.refreshTokenGrantRequest(
      c.server,
      client,
      oauth.None(),
      c.refreshToken,
      {
        [oauth.customFetch]: guardedFetch(fetchImpl),
        additionalParameters: { resource: c.resource },
        signal: AbortSignal.timeout(15000),
      },
    );
    const result = tokens(await oauth.processRefreshTokenResponse(c.server, client, response));
    return {
      ...c,
      ...result,
      refreshToken: result.refreshToken ?? c.refreshToken,
      refreshPending: false,
    };
  } catch {
    throw new CliError('OAuth refresh failed or outcome unknown; run mote auth login');
  }
}
