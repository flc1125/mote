import { TOC_SCRIPT } from './toc-script.js';
import { IMAGE_SCRIPT } from './image-script.js';
import { COPY_SCRIPT } from './copy-script.js';

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

/** Fixed hashes keep GET/HEAD identical without reading the body for HEAD. */
export async function tocDocumentSecurityHeaders(): Promise<Record<string, string>> {
  // Web Crypto runs on the first request, not during Worker module initialization.
  tocHeaders ??= Promise.all(
    [TOC_SCRIPT, COPY_SCRIPT, IMAGE_SCRIPT].map(async (script) => {
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
