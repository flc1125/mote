import { isLocalReference, normalizeRelativePath } from '@mote/core';
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
  for (const asset of manifest.assets) {
    const url = `/${documentId}/a/${asset.id}`;
    for (const reference of asset.references) {
      try {
        if (isLocalReference(reference)) {
          map.set(normalizeRelativePath(reference), url);
        }
      } catch {
        // A reference that does not normalize is skipped; the renderer
        // will leave the original src untouched.
      }
    }
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
    return assetUrls.get(normalizeRelativePath(src)) ?? null;
  } catch {
    return null;
  }
}
