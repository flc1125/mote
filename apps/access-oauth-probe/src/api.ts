import legacyApi from '@mote/api';

import { hasProbeConfiguration, verifyAccessAssertion } from './auth.js';
import { isProbeRequest, probeJson } from './boundary.js';

// Test injection is a module-level factory, never a request/env auth bypass.
export function createApiProbe(verify = verifyAccessAssertion) {
  return {
    async fetch(request: Request, env: ProbeEnv): Promise<Response> {
      if (!isProbeRequest(request)) return probeJson({ error: 'not found' }, 404);
      const { pathname } = new URL(request.url);
      if (pathname === '/api/health' && request.method === 'GET') {
        return probeJson({ status: 'ok', phase: 0 });
      }
      if (
        pathname !== '/api/mcp' &&
        pathname !== '/api/v1/publish' &&
        pathname !== '/api/auth/session'
      ) {
        return probeJson({ error: 'not found' }, 404);
      }
      if (!hasProbeConfiguration(env)) {
        return probeJson({ error: 'invalid probe configuration' }, 503);
      }
      try {
        // Must precede body consumption and even reads of the R2 binding.
        const publisher = await verify(request, env);
        if (!publisher) {
          // Access owns the real OAuth challenge/discovery. Do not manufacture
          // metadata that could conceal an edge routing failure in Phase 0.
          return probeJson({ error: 'missing or invalid Access assertion' }, 401);
        }
        if (pathname === '/api/auth/session') {
          if (request.method !== 'GET') {
            const response = probeJson({ error: 'method not allowed' }, 405);
            response.headers.set('Allow', 'GET');
            return response;
          }
          return probeJson({ authenticated: true, publisher });
        }

        // Phase 0 compatibility shim, NOT token-mode fallback. After successful
        // JWT verification only, call the unmodified API in this same isolate
        // with an ephemeral, per-request random token. No secret is configured,
        // persisted, returned, or transmitted to another Worker/host.
        const internalToken = crypto.randomUUID();
        const headers = new Headers(request.headers);
        headers.delete('Cookie');
        headers.delete('Cf-Access-Jwt-Assertion');
        headers.delete('Cf-Access-Authenticated-User-Email');
        headers.set('Authorization', `Bearer ${internalToken}`);
        const response = await legacyApi.fetch(new Request(request, { headers }), {
          DOCUMENTS: env.DOCUMENTS,
          VIEWER_BASE_URL: env.VIEWER_BASE_URL,
          MOTE_TOKEN: internalToken,
        });
        const result = new Response(response.body, response);
        result.headers.set('Cache-Control', 'no-store');
        result.headers.set('X-Mote-Probe', 'phase-0-api');
        return result;
      } catch {
        console.error(JSON.stringify({ event: 'phase0_request_failed' }));
        return probeJson({ error: 'internal error' }, 500);
      }
    },
  } satisfies ExportedHandler<ProbeEnv>;
}

export default createApiProbe();
