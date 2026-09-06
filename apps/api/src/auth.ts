import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type AuthMode = 'token' | 'cloudflare-access';

/** Deployment configuration, never populated from request headers or claims. */
export interface AuthConfig {
  MOTE_AUTH_MODE?: string;
  MOTE_TOKEN?: string;
  MOTE_ACCESS_ISSUER?: string;
  MOTE_ACCESS_AUD?: string;
  MOTE_ACCESS_HOSTNAME?: string;
}

export type Publisher =
  | { kind: 'token' }
  | { kind: 'user'; subject: string; email?: string }
  | { kind: 'service'; subject: string };

export type Authenticate = (request: Request, config: AuthConfig) => Promise<Publisher | null>;

/** Only public keys are cached; no credentials or per-request identity. */
function createKeyCache() {
  const cache = new Map<string, JWTVerifyGetKey>();
  return (issuer: string): JWTVerifyGetKey => {
    let keys = cache.get(issuer);
    if (!keys) {
      keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
        timeoutDuration: 5000,
        cooldownDuration: 30_000,
        cacheMaxAge: 600_000,
      });
      if (cache.size >= 4) cache.delete(cache.keys().next().value!);
      cache.set(issuer, keys);
    }
    return keys;
  };
}

function validAccessConfig(config: AuthConfig): boolean {
  return (
    typeof config.MOTE_ACCESS_ISSUER === 'string' &&
    /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(
      config.MOTE_ACCESS_ISSUER,
    ) &&
    typeof config.MOTE_ACCESS_AUD === 'string' &&
    /^[^\s,]{1,256}$/.test(config.MOTE_ACCESS_AUD) &&
    typeof config.MOTE_ACCESS_HOSTNAME === 'string' &&
    config.MOTE_ACCESS_HOSTNAME.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(config.MOTE_ACCESS_HOSTNAME) &&
    !config.MOTE_ACCESS_HOSTNAME.endsWith('.workers.dev')
  );
}

/** Dependency injection is local to this factory, never an HTTP/env auth bypass. */
export function createAuthenticator(getKeys = createKeyCache()): Authenticate {
  return async (request, config) => {
    try {
      const mode = config.MOTE_AUTH_MODE ?? 'token';
      if (mode === 'token') {
        if (!config.MOTE_TOKEN) return null;
        const header = request.headers.get('Authorization');
        if (!header?.startsWith('Bearer ')) return null;
        const token = header.slice('Bearer '.length).trim();
        if (!token) return null;
        const encoder = new TextEncoder();
        // Native HMAC verification avoids JS string comparisons and works in
        // both Workers and the Node-hosted integration harness (Web Crypto).
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(config.MOTE_TOKEN),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign', 'verify'],
        );
        const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(config.MOTE_TOKEN));
        return (await crypto.subtle.verify('HMAC', key, expected, encoder.encode(token)))
          ? { kind: 'token' }
          : null;
      }
      if (mode !== 'cloudflare-access' || !validAccessConfig(config)) return null;
      const url = new URL(request.url);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== config.MOTE_ACCESS_HOSTNAME ||
        url.port !== ''
      )
        return null;

      // Access owns opaque OAuth tokens and Service Token pair validation.
      // Authorization/Cookie/client credential/email headers never establish identity.
      const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
      if (!assertion || assertion.length > 16_384) return null;
      const { payload } = await jwtVerify(assertion, getKeys(config.MOTE_ACCESS_ISSUER!), {
        algorithms: ['RS256'],
        issuer: config.MOTE_ACCESS_ISSUER!,
        audience: config.MOTE_ACCESS_AUD!,
        requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp'],
        clockTolerance: 0,
      });
      if (
        payload.type !== 'app' ||
        typeof payload.sub !== 'string' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        payload.iat > Date.now() / 1000 ||
        payload.exp <= payload.iat
      )
        return null;

      if (payload.sub === '') {
        if (
          typeof payload.common_name !== 'string' ||
          !/^[a-f0-9]+\.access$/i.test(payload.common_name) ||
          payload.email !== undefined
        )
          return null;
        return { kind: 'service', subject: payload.common_name };
      }
      if (
        payload.sub.trim() === '' ||
        payload.common_name !== undefined ||
        (payload.email !== undefined && typeof payload.email !== 'string')
      )
        return null;
      return {
        kind: 'user',
        subject: payload.sub,
        ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      };
    } catch {
      // Configuration, claims, signatures and key failures all fail closed.
      // Library errors may contain credentials; never log or return them.
      return null;
    }
  };
}

export const authenticate = createAuthenticator();
