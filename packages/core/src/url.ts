/**
 * Classification of URLs/references found in Markdown image and link targets
 * (baseline §22). Only local relative references are uploaded as assets.
 */

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/;

/** http:// or https:// references stay as-is and are never uploaded. */
export function isRemoteUrl(reference: string): boolean {
  return /^https?:\/\//i.test(reference);
}

/**
 * True for relative filesystem references like `./a.png`, `../a.png`,
 * `images/a.png`. False for remote URLs, protocol-relative URLs, fragments,
 * any scheme (javascript:, data:, mailto:, ...), and absolute paths.
 */
export function isLocalReference(reference: string): boolean {
  const trimmed = reference.trim();
  if (trimmed === '') return false;
  if (trimmed.startsWith('#')) return false;
  if (trimmed.startsWith('//')) return false;
  if (isRemoteUrl(trimmed)) return false;
  if (SCHEME_RE.test(trimmed)) return false;
  if (trimmed.startsWith('/')) return false;
  if (WINDOWS_ABSOLUTE_RE.test(trimmed)) return false;
  return true;
}
