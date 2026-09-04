/**
 * Security headers for rendered document pages (baseline §33).
 * Because raw HTML is disabled and pages contain no JS, the CSP can be
 * maximally strict.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "img-src 'self' https: http:",
  "style-src 'unsafe-inline'",
  "object-src 'none'",
  "frame-src 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export function documentSecurityHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
}
