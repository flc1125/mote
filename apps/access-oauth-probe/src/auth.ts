import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { PROBE_AUD, PROBE_ISSUER, PROBE_ORIGIN } from './boundary.js';

// Only public signing keys are cached; no per-request identity or credentials.
// The URL is trusted configuration, never a JWT jku/x5u or request parameter.
const keys = createRemoteJWKSet(new URL(`${PROBE_ISSUER}/cdn-cgi/access/certs`), {
  timeoutDuration: 5000,
  cooldownDuration: 30_000,
  cacheMaxAge: 600_000,
});

export type Publisher = { subject: string; email?: string };

export function hasProbeConfiguration(env: ProbeEnv): boolean {
  return (
    env.ACCESS_ISSUER === PROBE_ISSUER &&
    env.ACCESS_AUD === PROBE_AUD &&
    env.VIEWER_BASE_URL === PROBE_ORIGIN
  );
}

export async function verifyAccessAssertion(
  request: Request,
  env: ProbeEnv,
  getKey: JWTVerifyGetKey = keys,
): Promise<Publisher | null> {
  if (!hasProbeConfiguration(env)) return null;
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion || assertion.length > 16_384) return null;
  try {
    const { payload } = await jwtVerify(assertion, getKey, {
      issuer: env.ACCESS_ISSUER,
      audience: env.ACCESS_AUD,
      algorithms: ['RS256'],
      requiredClaims: ['iss', 'aud', 'exp', 'iat', 'sub'],
      clockTolerance: 0,
    });
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.iat > Date.now() / 1000 ||
      payload.exp <= payload.iat
    ) {
      return null;
    }
    return {
      subject: payload.sub,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
    };
  } catch {
    // Fail closed for bad signatures/claims, unavailable JWKS, and key rotation
    // misses. Do not put assertion contents or library errors into responses.
    return null;
  }
}
