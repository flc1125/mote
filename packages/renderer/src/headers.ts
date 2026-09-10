import { HISTORY_SCRIPT } from './history-script.js';
import { TOC_SCRIPT } from './toc-script.js';

/** Base policy: surfaces opt into an exact trusted script hash where needed. */
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

let tocHeaders: Promise<Record<string, string>> | undefined;

/** Only the exact, static TOC and history scripts are executable; source content never is. */
export async function tocDocumentSecurityHeaders(): Promise<Record<string, string>> {
  // Web Crypto runs on the first request, not during Worker module initialization.
  tocHeaders ??= Promise.all(
    [TOC_SCRIPT, HISTORY_SCRIPT].map(async (script) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(script));
      return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
    }),
  ).then((hashes) => ({
    ...documentSecurityHeaders(),
    'Content-Security-Policy': CONTENT_SECURITY_POLICY.replace(
      "script-src 'none'",
      `script-src ${hashes.join(' ')}`,
    ),
  }));
  return { ...(await tocHeaders) };
}
