import { describe, expect, it } from 'vitest';

import { BASE58_ALPHABET, decodeBase58, encodeBase58, randomBase58 } from './base58.js';

describe('BASE58_ALPHABET', () => {
  it('has 58 characters and excludes 0, O, I, l', () => {
    expect(BASE58_ALPHABET).toHaveLength(58);
    for (const excluded of ['0', 'O', 'I', 'l']) {
      expect(BASE58_ALPHABET).not.toContain(excluded);
    }
  });
});

describe('encodeBase58', () => {
  it('encodes known vectors', () => {
    expect(encodeBase58(new Uint8Array([]))).toBe('');
    expect(encodeBase58(new Uint8Array([0]))).toBe('1');
    expect(encodeBase58(new Uint8Array([0, 0, 1]))).toBe('112');
    expect(encodeBase58(new Uint8Array([1]))).toBe('2');
    expect(encodeBase58(new Uint8Array([58]))).toBe('21');
  });

  it('round-trips arbitrary bytes', () => {
    for (let i = 0; i < 20; i++) {
      const bytes = new Uint8Array(1 + i * 3);
      crypto.getRandomValues(bytes);
      expect(decodeBase58(encodeBase58(bytes))).toEqual(bytes);
    }
  });
});

describe('decodeBase58', () => {
  it('decodes known vectors', () => {
    expect(decodeBase58('')).toEqual(new Uint8Array([]));
    expect(decodeBase58('1')).toEqual(new Uint8Array([0]));
    expect(decodeBase58('112')).toEqual(new Uint8Array([0, 0, 1]));
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => decodeBase58('0')).toThrow(/Invalid Base58 character/);
    expect(() => decodeBase58('abcO')).toThrow(/Invalid Base58 character/);
  });
});

describe('randomBase58', () => {
  it('produces strings of the exact requested length and alphabet', () => {
    for (const length of [1, 12, 16, 64]) {
      const value = randomBase58(length);
      expect(value).toHaveLength(length);
      for (const char of value) expect(BASE58_ALPHABET).toContain(char);
    }
  });

  it('rejects bytes >= 232 to avoid modulo bias', () => {
    // First fill: all 255 (rejected); second fill: 0 and 231 (accepted).
    let call = 0;
    const rigged = (array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
      call++;
      array.fill(call === 1 ? 255 : 231);
      return array;
    };
    // 231 % 58 = 57 -> last alphabet character 'z'
    expect(randomBase58(4, rigged)).toBe('zzzz');
    expect(call).toBeGreaterThanOrEqual(2);
  });

  it('rejects non-positive lengths', () => {
    expect(() => randomBase58(0)).toThrow();
    expect(() => randomBase58(-1)).toThrow();
    expect(() => randomBase58(1.5)).toThrow();
  });
});
