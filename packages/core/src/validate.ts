import {
  MAX_ASSET_BYTES,
  MAX_ASSET_COUNT,
  MAX_BUNDLE_BYTES,
  MAX_MARKDOWN_BYTES,
} from './limits.js';

export type ValidationResult = { ok: true } | { ok: false; issues: string[] };

export function validationOk(): ValidationResult {
  return { ok: true };
}

export function validationFail(issues: string[]): ValidationResult {
  return { ok: false, issues };
}

export interface BundleSizeInput {
  markdownBytes: number;
  assetSizes: number[];
}

/**
 * Checks a document bundle against the V1 limits (baseline §14):
 * Markdown <= 2 MB, each asset <= 10 MB, total <= 20 MB, assets <= 50.
 */
export function validateBundleSize(input: BundleSizeInput): ValidationResult {
  const issues: string[] = [];

  if (input.markdownBytes > MAX_MARKDOWN_BYTES) {
    issues.push(`Markdown is ${input.markdownBytes} bytes, limit is ${MAX_MARKDOWN_BYTES}`);
  }

  if (input.assetSizes.length > MAX_ASSET_COUNT) {
    issues.push(`Bundle has ${input.assetSizes.length} assets, limit is ${MAX_ASSET_COUNT}`);
  }

  input.assetSizes.forEach((size, index) => {
    if (size > MAX_ASSET_BYTES) {
      issues.push(`Asset #${index} is ${size} bytes, limit is ${MAX_ASSET_BYTES}`);
    }
  });

  const total = input.markdownBytes + input.assetSizes.reduce((sum, size) => sum + size, 0);
  if (total > MAX_BUNDLE_BYTES) {
    issues.push(`Bundle total is ${total} bytes, limit is ${MAX_BUNDLE_BYTES}`);
  }

  return issues.length === 0 ? validationOk() : validationFail(issues);
}
