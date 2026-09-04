// Deliberately pinned to the approved Phase 0 host. This is not a deployable
// replacement for the production API's future configurable auth mode.
export const PROBE_ORIGIN = 'https://mote-oauth-test.flc.io';
export const PROBE_ISSUER = 'https://flc1125.cloudflareaccess.com';
export const PROBE_AUD = '67f852eaf06730f1a47b30b8fc2594df66d9e09a9d51b44b48ff932808831853';

export function isProbeRequest(request: Request): boolean {
  // Do not trust Host/X-Forwarded-Host headers supplied by callers.
  return new URL(request.url).origin === PROBE_ORIGIN;
}

export function probeJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Mote-Probe': 'phase-0-api',
    },
  });
}
