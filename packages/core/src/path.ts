import { isLocalReference } from './url.js';

/**
 * Normalizes a local relative reference to a canonical POSIX-style path:
 * resolves `.` and `..` segments, collapses duplicate separators, converts
 * backslashes to `/`, and strips a leading `./`.
 *
 * Leading `..` segments are preserved (the reference may legitimately point
 * outside the Markdown file's directory; the CLI resolves it against the
 * actual filesystem). Throws when the reference is not a local relative
 * reference or resolves to nothing.
 */
export function normalizeRelativePath(reference: string): string {
  if (!isLocalReference(reference)) {
    throw new Error(`Not a local relative reference: ${JSON.stringify(reference)}`);
  }

  const segments = reference.trim().replace(/\\/g, '/').split('/');
  const stack: string[] = [];

  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      const top = stack[stack.length - 1];
      if (top !== undefined && top !== '..') {
        stack.pop();
      } else {
        stack.push('..');
      }
    } else {
      stack.push(segment);
    }
  }

  if (stack.length === 0) {
    throw new Error(`Reference resolves to an empty path: ${JSON.stringify(reference)}`);
  }

  return stack.join('/');
}
