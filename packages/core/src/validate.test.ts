import { describe, expect, it } from 'vitest';

import { MAX_ASSET_BYTES, MAX_ASSET_COUNT, MAX_MARKDOWN_BYTES } from './limits.js';
import { validateBundleSize } from './validate.js';

describe('validateBundleSize (§14)', () => {
  it('accepts a bundle within all limits', () => {
    const result = validateBundleSize({ markdownBytes: 48_000, assetSizes: [300_000, 500_000] });
    expect(result).toEqual({ ok: true });
  });

  it('accepts bundles exactly at the limits', () => {
    const result = validateBundleSize({
      markdownBytes: MAX_MARKDOWN_BYTES,
      assetSizes: [MAX_ASSET_BYTES],
    });
    // 2 MB + 10 MB = 12 MB total, under the 20 MB bundle limit
    expect(result).toEqual({ ok: true });
  });

  it('rejects oversized Markdown', () => {
    const result = validateBundleSize({
      markdownBytes: MAX_MARKDOWN_BYTES + 1,
      assetSizes: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join()).toMatch(/Markdown/);
  });

  it('rejects an oversized asset', () => {
    const result = validateBundleSize({
      markdownBytes: 1000,
      assetSizes: [MAX_ASSET_BYTES + 1],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join()).toMatch(/Asset #0/);
  });

  it('rejects too many assets', () => {
    const result = validateBundleSize({
      markdownBytes: 1000,
      assetSizes: Array.from({ length: MAX_ASSET_COUNT + 1 }, () => 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join()).toMatch(/assets/);
  });

  it('rejects an oversized total bundle', () => {
    const result = validateBundleSize({
      markdownBytes: MAX_MARKDOWN_BYTES,
      assetSizes: [MAX_ASSET_BYTES, MAX_ASSET_BYTES], // 22 MB total
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join()).toMatch(/total/);
  });

  it('reports multiple issues at once', () => {
    const result = validateBundleSize({
      markdownBytes: MAX_MARKDOWN_BYTES + 1,
      // 2 MB + 10 MB + 10 MB = 22 MB total, also exceeding the bundle limit
      assetSizes: [MAX_ASSET_BYTES + 1, MAX_ASSET_BYTES],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });
});
