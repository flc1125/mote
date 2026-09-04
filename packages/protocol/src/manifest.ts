import type { SupportedImageMimeType } from '@mote/core';

/** Current manifest schema version (baseline §10, §16). */
export const MANIFEST_VERSION = 1;

/**
 * Client-side manifest sent in the publish request (baseline §16).
 * The client never generates document or asset IDs — the server does.
 */
export interface PublishManifestAsset {
  /** Multipart field carrying the asset bytes, e.g. "asset_0". */
  field: string;
  /** All references in the Markdown that resolve to this asset. */
  references: string[];
}

export interface PublishManifest {
  version: typeof MANIFEST_VERSION;
  /** Entry file name, e.g. "README.md". */
  entry: string;
  assets: PublishManifestAsset[];
}

/**
 * Stored manifest, written LAST to R2 as the document commit marker
 * (baseline §10, §54). A document exists if and only if this object exists.
 */
export interface DocumentManifestSource {
  name: string;
  size: number;
  sha256: string;
}

export interface DocumentManifestAsset {
  /** Server-generated 12-char Base58 asset ID. */
  id: string;
  references: string[];
  contentType: SupportedImageMimeType;
  size: number;
  sha256: string;
}

export interface DocumentManifest {
  version: typeof MANIFEST_VERSION;
  id: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  source: DocumentManifestSource;
  assets: DocumentManifestAsset[];
}
