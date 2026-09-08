import { isLocalReference, isRemoteUrl } from '@mote/core';

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Links may point to http(s), mailto, fragments, or relative references.
 * Everything with another scheme (javascript:, data:, vbscript:, file:, ...),
 * protocol-relative URLs, and absolute paths are stripped (baseline §57).
 * markdown-it already neutralizes bad protocols at parse time; this is a
 * second layer of defense, also applied to allowlisted raw HTML.
 */
export function isSafeLinkUrl(url: string): boolean {
  if (url.startsWith('#')) return true;
  if (isRemoteUrl(url)) return true;
  if (/^mailto:/i.test(url)) return true;
  if (SCHEME_RE.test(url)) return false;
  if (url.startsWith('/')) return false;
  return isLocalReference(url);
}

/**
 * Images may point to http(s) (remote assets, baseline §32), to public
 * asset URLs (root-absolute, produced by the asset rewrite), or keep an
 * unresolved relative reference. Anything with another scheme (notably
 * javascript: and data:) is stripped.
 */
export function isSafeImageUrl(url: string): boolean {
  if (url.startsWith('/')) return true;
  if (isRemoteUrl(url)) return true;
  if (SCHEME_RE.test(url)) return false;
  return isLocalReference(url);
}
