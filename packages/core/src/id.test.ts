import { describe, expect, it } from 'vitest';

import {
  ASSET_ID_LENGTH,
  DOCUMENT_ID_LENGTH,
  generateAssetId,
  generateDocumentId,
  isAssetId,
  isDocumentId,
} from './id.js';

describe('generateDocumentId', () => {
  it('generates 16-char Base58 IDs that pass validation', () => {
    const id = generateDocumentId();
    expect(id).toHaveLength(DOCUMENT_ID_LENGTH);
    expect(isDocumentId(id)).toBe(true);
  });

  it('generates unique IDs across 10k samples (entropy sanity check)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(generateDocumentId());
    expect(ids.size).toBe(10_000);
  });
});

describe('generateAssetId', () => {
  it('generates 12-char Base58 IDs that pass validation', () => {
    const id = generateAssetId();
    expect(id).toHaveLength(ASSET_ID_LENGTH);
    expect(isAssetId(id)).toBe(true);
  });
});

describe('isDocumentId', () => {
  it('accepts valid IDs', () => {
    expect(isDocumentId('7Vk3mQ9x2NFaP4Ls')).toBe(true);
  });

  it('rejects wrong length, ambiguous chars, and non-strings', () => {
    expect(isDocumentId('7Vk3mQ9x2NFaP4L')).toBe(false); // 15 chars
    expect(isDocumentId('7Vk3mQ9x2NFaP4LsX')).toBe(false); // 17 chars
    expect(isDocumentId('0Vk3mQ9x2NFaP4Ls')).toBe(false); // contains 0
    expect(isDocumentId('OVk3mQ9x2NFaP4Ls')).toBe(false); // contains O
    expect(isDocumentId('IVk3mQ9x2NFaP4Ls')).toBe(false); // contains I
    expect(isDocumentId('lVk3mQ9x2NFaP4Ls')).toBe(false); // contains l
    expect(isDocumentId('')).toBe(false);
    expect(isDocumentId(undefined)).toBe(false);
    expect(isDocumentId(null)).toBe(false);
    expect(isDocumentId(123)).toBe(false);
  });
});

describe('isAssetId', () => {
  it('accepts valid IDs and rejects invalid ones', () => {
    expect(isAssetId('Aq8K3pLm92Xq')).toBe(true);
    expect(isAssetId('Aq8K3pLm92X')).toBe(false); // 11 chars
    expect(isAssetId('Aq8K3pLm92XqZ')).toBe(false); // 13 chars
    expect(isAssetId('Aq8K3pLm920q')).toBe(false); // contains 0
    expect(isAssetId(null)).toBe(false);
  });
});
