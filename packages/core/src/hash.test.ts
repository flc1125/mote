import { describe, expect, it } from 'vitest';

import { isSha256Hex, sha256Hex } from './hash.js';

describe('sha256Hex', () => {
  it('matches the known SHA-256 vector for "abc"', async () => {
    const digest = await sha256Hex(new TextEncoder().encode('abc'));
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches the known SHA-256 vector for empty input', async () => {
    const digest = await sha256Hex(new Uint8Array(0));
    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('isSha256Hex', () => {
  it('accepts lowercase 64-char hex and rejects everything else', () => {
    expect(isSha256Hex('a'.repeat(64))).toBe(true);
    expect(isSha256Hex('A'.repeat(64))).toBe(false); // uppercase
    expect(isSha256Hex('a'.repeat(63))).toBe(false);
    expect(isSha256Hex('g'.repeat(64))).toBe(false);
    expect(isSha256Hex(null)).toBe(false);
  });
});
