// Local-only Phase 0 regression fixture, not a deployable API replacement.
// Fake origins and audience deliberately cannot authenticate against live Access.
export const PROBE_ORIGIN = 'https://mote-probe.example.invalid';
export const PROBE_ISSUER = 'https://access.example.invalid';
export const PROBE_AUD = 'local-probe-audience';

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
