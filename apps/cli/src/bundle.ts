import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import {
  detectImageMimeType,
  MAX_MARKDOWN_BYTES,
  normalizeRelativePath,
  sha256Hex,
  validateBundleSize,
} from '@mote/core';
import { assetFieldName } from '@mote/protocol';

import { CliError } from './errors.js';
import { extractLocalImageReferences } from './scanner.js';

export type SupportedImageMimeType =
  'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/avif';

export interface PublishManifestAsset {
  field: string;
  references: string[];
}

export interface PublishManifest {
  version: 1;
  entry: string;
  assets: PublishManifestAsset[];
}

export interface BundleAsset {
  field: string;
  references: string[];
  /** Absolute path of the source file (local only, never uploaded as-is). */
  path: string;
  bytes: Uint8Array;
  contentType: SupportedImageMimeType;
  sha256: string;
}

export interface Bundle {
  entryName: string;
  markdownBytes: Uint8Array;
  manifest: PublishManifest;
  assets: BundleAsset[];
  totalBytes: number;
}

export interface BuildBundleOptions {
  /** Skip all local assets; the Markdown is published as-is (§20). */
  noAssets?: boolean;
}

interface CollectedAsset {
  references: string[];
  path: string;
  bytes: Uint8Array;
  contentType: SupportedImageMimeType;
}

/**
 * Resolves the Markdown file and every local image it references into an
 * upload-ready bundle (baseline §22, §23). Safety chain per asset: resolve
 * absolute path -> exists -> regular file -> MIME by magic bytes -> size ->
 * SHA-256 -> dedupe by content. Only files actually referenced by the
 * Markdown are read — directories are never scanned.
 */
export async function buildBundle(
  markdownPath: string,
  options: BuildBundleOptions = {},
): Promise<Bundle> {
  const absoluteMarkdown = resolve(markdownPath);
  const markdownStat = await stat(absoluteMarkdown).catch(() => null);
  if (markdownStat === null) {
    throw new CliError(`markdown file not found: ${markdownPath}`);
  }
  if (!markdownStat.isFile()) {
    throw new CliError(`not a regular file: ${markdownPath}`);
  }

  const markdownBytes = new Uint8Array(await readFile(absoluteMarkdown));
  if (markdownBytes.length > MAX_MARKDOWN_BYTES) {
    throw new CliError(
      `markdown is ${markdownBytes.length} bytes, limit is ${MAX_MARKDOWN_BYTES} (2 MB)`,
    );
  }

  const entryName = basename(absoluteMarkdown);
  const markdown = new TextDecoder().decode(markdownBytes);
  const references = options.noAssets === true ? [] : extractLocalImageReferences(markdown);

  // Dedupe by content hash: the same image referenced through different
  // names is uploaded once; every reference spelling is recorded (§22).
  const byHash = new Map<string, CollectedAsset>();
  for (const reference of references) {
    const absoluteAsset = resolve(dirname(absoluteMarkdown), normalizeRelativePath(reference));

    const assetStat = await stat(absoluteAsset).catch(() => null);
    if (assetStat === null) {
      throw new CliError(`asset not found: ${reference} (referenced by ${entryName})`);
    }
    if (!assetStat.isFile()) {
      throw new CliError(`asset is not a regular file: ${reference}`);
    }

    const bytes = new Uint8Array(await readFile(absoluteAsset));
    const contentType = detectImageMimeType(bytes);
    if (contentType === null) {
      throw new CliError(
        `unsupported image type: ${reference} (only png/jpeg/webp/gif/avif are supported)`,
      );
    }

    const hash = await sha256Hex(bytes);
    const existing = byHash.get(hash);
    if (existing) {
      existing.references.push(reference);
    } else {
      byHash.set(hash, { references: [reference], path: absoluteAsset, bytes, contentType });
    }
  }

  const collected = [...byHash.entries()].map(([hash, asset]) => ({ hash, ...asset }));

  const sizeResult = validateBundleSize({
    markdownBytes: markdownBytes.length,
    assetSizes: collected.map((asset) => asset.bytes.length),
  });
  if (!sizeResult.ok) {
    throw new CliError(sizeResult.issues.join('; '));
  }

  const assets: BundleAsset[] = collected.map((asset, index) => ({
    field: assetFieldName(index),
    references: asset.references,
    path: asset.path,
    bytes: asset.bytes,
    contentType: asset.contentType,
    sha256: asset.hash,
  }));

  const manifest: PublishManifest = {
    version: 1,
    entry: entryName,
    assets: assets.map((asset) => ({ field: asset.field, references: asset.references })),
  };

  const totalBytes =
    markdownBytes.length + assets.reduce((sum, asset) => sum + asset.bytes.length, 0);

  return { entryName, markdownBytes, manifest, assets, totalBytes };
}
