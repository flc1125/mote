import { isLocalReference, normalizeImageReference, normalizeRelativePath } from '@mote/core';
import type { DocumentManifest } from '@mote/protocol';

/**
 * Builds the reference -> public asset URL map used by the renderer
 * (baseline §31). Keys are normalized references as they appear in the
 * Markdown source; values are opaque asset URLs that never expose the
 * original file name.
 */
export function buildAssetUrlMap(
  manifest: DocumentManifest,
  documentId: string,
): Map<string, string> {
  const map = new Map<string, string>();
  const aliases = new Map<string, string>();
  for (const asset of manifest.assets) {
    const url = `/${documentId}/a/${asset.id}`;
    for (const reference of asset.references) {
      try {
        if (isLocalReference(reference)) {
          map.set(normalizeRelativePath(reference), url);
          aliases.set(normalizeImageReference(reference), url);
        }
      } catch {
        // A reference that does not normalize is skipped; the renderer
        // will leave the original src untouched.
      }
    }
  }
  // Keep exact historical spellings authoritative. Older CLI versions could
  // upload a literal percent-encoded filename and a space-containing filename
  // as different assets; adding decoded aliases must not swap those images.
  for (const [reference, url] of aliases) {
    if (!map.has(reference)) map.set(reference, url);
  }
  return map;
}

/**
 * Resolves a Markdown image src to its public asset URL.
 * Returns null when the src is not a local reference or has no asset.
 */
export function resolveAssetUrl(src: string, assetUrls: Map<string, string>): string | null {
  if (!isLocalReference(src)) return null;
  try {
    const decoded = normalizeImageReference(src);
    return assetUrls.get(normalizeRelativePath(src)) ?? assetUrls.get(decoded) ?? null;
  } catch {
    return null;
  }
}
