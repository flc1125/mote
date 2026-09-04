import {
  detectImageMimeType,
  generateAssetId,
  generateDocumentId,
  MAX_BUNDLE_BYTES,
  sha256Hex,
  validateBundleSize,
  type RandomSource,
  type SupportedImageMimeType,
} from '@mote/core';
import {
  ErrorCode,
  validatePublishManifest,
  type DocumentManifest,
  type PublishManifest,
} from '@mote/protocol';

/** A publish failure that maps to a client-facing error response (§18). */
export class PublishError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

export interface PreparedAsset {
  id: string;
  references: string[];
  contentType: SupportedImageMimeType;
  bytes: Uint8Array;
  sha256: string;
}

export interface PreparedBundle {
  id: string;
  entryName: string;
  markdownBytes: Uint8Array;
  assets: PreparedAsset[];
}

const MANIFEST_KEY = (id: string) => `documents/${id}/manifest.json`;
const DOCUMENT_KEY = (id: string) => `documents/${id}/document.md`;
const ASSET_KEY = (id: string, assetId: string) => `documents/${id}/assets/${assetId}`;

const MAX_ID_GENERATION_ATTEMPTS = 5;

/**
 * Generates a document ID and verifies it is unused by checking the commit
 * marker in R2 (baseline §5). Collisions are retried internally; clients
 * never see a 409 (baseline §18).
 */
export async function allocateDocumentId(bucket: R2Bucket, random?: RandomSource): Promise<string> {
  for (let attempt = 0; attempt < MAX_ID_GENERATION_ATTEMPTS; attempt++) {
    const id = generateDocumentId(random);
    if ((await bucket.head(MANIFEST_KEY(id))) === null) return id;
  }
  // Effectively unreachable: 94-bit IDs collide with negligible probability.
  throw new PublishError(ErrorCode.InternalError, 'could not allocate a document ID');
}

function isFile(value: FormDataValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

// The embedded workerd types do not export FormDataEntryValue.
type FormDataValue = File | string;

/**
 * Validates the multipart form of a publish request and prepares the
 * immutable bundle. Throws PublishError with the agreed error codes (§18):
 * 400 malformed request, 413 too large, 415 unsupported type, 422 invalid
 * bundle.
 */
export async function prepareBundle(
  form: FormData,
  bucket: R2Bucket,
  random?: RandomSource,
): Promise<PreparedBundle> {
  // --- document field ---
  const documentField = form.get('document');
  if (!isFile(documentField)) {
    throw new PublishError(ErrorCode.MalformedRequest, 'multipart field "document" must be a file');
  }
  const markdownBytes = new Uint8Array(await documentField.arrayBuffer());
  if (markdownBytes.length === 0) {
    throw new PublishError(ErrorCode.InvalidDocument, 'document must not be empty');
  }
  try {
    // Strict UTF-8 check; the document is stored as-is but must be text.
    new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(markdownBytes);
  } catch {
    throw new PublishError(ErrorCode.InvalidDocument, 'document must be valid UTF-8');
  }

  // --- manifest field ---
  const manifestField = form.get('manifest');
  if (manifestField === null) {
    throw new PublishError(ErrorCode.MalformedRequest, 'multipart field "manifest" is required');
  }
  const manifestText =
    typeof manifestField === 'string' ? manifestField : await manifestField.text();
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(manifestText);
  } catch {
    throw new PublishError(ErrorCode.MalformedRequest, 'manifest must be valid JSON');
  }
  const manifestResult = validatePublishManifest(manifestValue);
  if (!manifestResult.ok) {
    throw new PublishError(ErrorCode.InvalidDocument, manifestResult.issues.join('; '));
  }
  const manifest = manifestValue as PublishManifest;

  // --- assets ---
  const assetEntries: {
    references: string[];
    bytes: Uint8Array;
    contentType: SupportedImageMimeType;
  }[] = [];
  for (const asset of manifest.assets) {
    const field = form.get(asset.field);
    if (!isFile(field)) {
      throw new PublishError(
        ErrorCode.InvalidDocument,
        `manifest asset ${asset.field} has no matching multipart file`,
      );
    }
    const bytes = new Uint8Array(await field.arrayBuffer());
    // Magic bytes decide the type (§13); the declared type is not trusted.
    const contentType = detectImageMimeType(bytes);
    if (contentType === null) {
      throw new PublishError(
        ErrorCode.UnsupportedMediaType,
        `${asset.field}: not a supported image (png/jpeg/webp/gif/avif)`,
      );
    }
    assetEntries.push({ references: asset.references, bytes, contentType });
  }

  // --- size limits (§14) ---
  const sizeResult = validateBundleSize({
    markdownBytes: markdownBytes.length,
    assetSizes: assetEntries.map((entry) => entry.bytes.length),
  });
  if (!sizeResult.ok) {
    throw new PublishError(ErrorCode.BundleTooLarge, sizeResult.issues.join('; '));
  }

  // --- IDs & hashes ---
  const id = await allocateDocumentId(bucket, random);

  const usedAssetIds = new Set<string>();
  const assets: PreparedAsset[] = [];
  for (const entry of assetEntries) {
    let assetId = generateAssetId(random);
    while (usedAssetIds.has(assetId)) assetId = generateAssetId(random);
    usedAssetIds.add(assetId);
    assets.push({
      id: assetId,
      references: entry.references,
      contentType: entry.contentType,
      bytes: entry.bytes,
      sha256: await sha256Hex(entry.bytes),
    });
  }

  return { id, entryName: manifest.entry, markdownBytes, assets };
}

/**
 * Writes the bundle to R2 with the manifest LAST: the manifest is the
 * document commit marker (baseline §10, §54), so a failed publish never
 * produces a half-visible document.
 */
export async function commitBundle(bucket: R2Bucket, bundle: PreparedBundle): Promise<void> {
  for (const asset of bundle.assets) {
    await bucket.put(ASSET_KEY(bundle.id, asset.id), asset.bytes, {
      httpMetadata: { contentType: asset.contentType },
    });
  }

  await bucket.put(DOCUMENT_KEY(bundle.id), bundle.markdownBytes);

  const manifest: DocumentManifest = {
    version: 1,
    id: bundle.id,
    createdAt: new Date().toISOString(),
    source: {
      name: bundle.entryName,
      size: bundle.markdownBytes.length,
      sha256: await sha256Hex(bundle.markdownBytes),
    },
    assets: bundle.assets.map((asset) => ({
      id: asset.id,
      references: asset.references,
      contentType: asset.contentType,
      size: asset.bytes.length,
      sha256: asset.sha256,
    })),
  };

  await bucket.put(MANIFEST_KEY(bundle.id), JSON.stringify(manifest));
}

/** Early body-size guard before multipart parsing (§14). */
export function isDefinitelyTooLarge(contentLength: number): boolean {
  // 1 MiB slack for multipart boundaries, headers and the manifest part.
  return contentLength > MAX_BUNDLE_BYTES + 1024 * 1024;
}
