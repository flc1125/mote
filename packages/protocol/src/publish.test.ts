import { describe, expect, it } from 'vitest';

import { assetFieldName, parseAssetFieldIndex } from './publish.js';

describe('assetFieldName / parseAssetFieldIndex (§16)', () => {
  it('round-trips asset field names', () => {
    expect(assetFieldName(0)).toBe('asset_0');
    expect(assetFieldName(49)).toBe('asset_49');
    expect(parseAssetFieldIndex('asset_0')).toBe(0);
    expect(parseAssetFieldIndex('asset_12')).toBe(12);
  });

  it('rejects non-asset field names', () => {
    expect(parseAssetFieldIndex('document')).toBe(null);
    expect(parseAssetFieldIndex('manifest')).toBe(null);
    expect(parseAssetFieldIndex('asset_')).toBe(null);
    expect(parseAssetFieldIndex('asset_x')).toBe(null);
    expect(parseAssetFieldIndex('asset_1x')).toBe(null);
    expect(parseAssetFieldIndex('asset')).toBe(null);
  });
});
