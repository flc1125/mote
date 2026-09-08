import { isLocalReference, isRemoteUrl } from '@mote/core';

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

// Browsers strip TAB/LF/CR anywhere in a URL, so "java\nscript:" must be
// judged as javascript: (baseline §57, defense in depth). Any other ASCII
// control character left over makes the URL junk — reject it outright.
const STRIP_RE = /[\t\n\r]+/g;
// eslint-disable-next-line no-control-regex -- control characters are the whole point
const LEFTOVER_CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

/** Returns the URL with browser-ignored characters removed, or null. */
function cleanUrl(url: string): string | null {
  const clean = url.replace(STRIP_RE, '');
  return LEFTOVER_CONTROL_RE.test(clean) ? null : clean;
}

/**
 * Links may point to http(s), mailto, fragments, or relative references.
 * Everything with another scheme (javascript:, data:, vbscript:, file:, ...),
 * protocol-relative URLs, and absolute paths is rejected (baseline §57).
 *
 * Returns the normalized URL to emit, or null when the URL is unsafe.
 * markdown-it already neutralizes bad protocols at parse time; this is a
 * second layer of defense, also applied to allowlisted raw HTML.
 */
export function safeLinkUrl(url: string): string | null {
  const clean = cleanUrl(url);
  if (clean === null) return null;
  if (clean.startsWith('#')) return clean;
  if (isRemoteUrl(clean)) return clean;
  if (/^mailto:/i.test(clean)) return clean;
  if (SCHEME_RE.test(clean)) return null;
  if (clean.startsWith('/')) return null;
  return isLocalReference(clean) ? clean : null;
}

/**
 * Images may point to http(s) (remote assets, baseline §32), to public
 * asset URLs (root-absolute, produced by the asset rewrite), or keep an
 * unresolved relative reference. Anything with another scheme (notably
 * javascript: and data:) is rejected.
 *
 * Returns the normalized URL to emit, or null when the URL is unsafe.
 */
export function safeImageUrl(url: string): string | null {
  const clean = cleanUrl(url);
  if (clean === null) return null;
  if (clean.startsWith('/')) return clean;
  if (isRemoteUrl(clean)) return clean;
  if (SCHEME_RE.test(clean)) return null;
  return isLocalReference(clean) ? clean : null;
}
