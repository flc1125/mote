import { describe, expect, it } from 'vitest';

import { CONTENT_SECURITY_POLICY, documentSecurityHeaders } from './headers.js';

describe('CONTENT_SECURITY_POLICY (§33)', () => {
  it('matches the agreed strict policy', () => {
    expect(CONTENT_SECURITY_POLICY).toBe(
      "default-src 'none'; img-src 'self' https: http:; style-src 'unsafe-inline'; " +
        "object-src 'none'; frame-src 'none'; script-src 'none'; connect-src 'none'; " +
        "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  });
});

describe('documentSecurityHeaders', () => {
  it('returns every header from §33', () => {
    expect(documentSecurityHeaders()).toEqual({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
  });
});
