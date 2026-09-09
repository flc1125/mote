import { normalizeRelativePath } from './path.js';

/**
 * Image destinations are URL references. Decode exactly once for filesystem
 * lookup, including markdown-it's percent-encoded Unicode and spaces. Keep
 * malformed percent sequences literal; validate locality again after decoding
 * so encoded schemes, absolute paths and control characters cannot be read.
 */
export function normalizeImageReference(reference: string): string {
  // Validate the original spelling as well as the decoded path.
  normalizeRelativePath(reference);
  let decoded = reference;
  try {
    decoded = decodeURIComponent(reference);
  } catch {
    // A literal '%' in a filename is still a valid local reference.
  }
  const hasControl = Array.from(decoded).some(
    (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
  );
  if (hasControl || decoded.trimStart().startsWith('\\')) {
    throw new Error('Invalid local image reference');
  }
  return normalizeRelativePath(decoded);
}
