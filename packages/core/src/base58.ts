/**
 * Base58 encoding (Bitcoin alphabet), excluding visually ambiguous
 * characters: 0, O, I, l. See architecture baseline §5.
 */
export const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const BASE = 58n;
const BYTE = 256n;

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  let value = 0n;
  for (const byte of bytes) value = value * BYTE + BigInt(byte);

  let encoded = '';
  while (value > 0n) {
    encoded = BASE58_ALPHABET.charAt(Number(value % BASE)) + encoded;
    value /= BASE;
  }

  // Each leading zero byte is represented by a leading '1'.
  return '1'.repeat(zeros) + encoded;
}

export function decodeBase58(text: string): Uint8Array {
  if (text.length === 0) return new Uint8Array(0);

  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros++;

  let value = 0n;
  for (const char of text) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid Base58 character: ${JSON.stringify(char)}`);
    value = value * BASE + BigInt(index);
  }

  const body: number[] = [];
  while (value > 0n) {
    body.unshift(Number(value % BYTE));
    value /= BYTE;
  }

  const out = new Uint8Array(zeros + body.length);
  out.set(body, zeros);
  return out;
}

export type RandomSource = (array: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

const defaultRandom: RandomSource = (array) => {
  // Bare `crypto` (WebCrypto global): available in Workers, Node >= 20, and
  // browsers. `globalThis.crypto` is intentionally not used because
  // @cloudflare/workers-types declares crypto as a global const, which does
  // not become a property of the globalThis type.
  crypto.getRandomValues(array);
  return array;
};

/**
 * Largest byte value that maps uniformly onto the 58-character alphabet
 * (58 * 4 = 232). Bytes >= 232 are rejected to avoid modulo bias.
 */
const MAX_UNBIASED_BYTE = 232;

/**
 * Generates a random Base58 string of exactly `length` characters.
 * Randomness comes from crypto.getRandomValues by default; the source is
 * injectable only for tests. Production callers must use the default.
 */
export function randomBase58(length: number, random: RandomSource = defaultRandom): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(`length must be a positive integer, got ${length}`);
  }

  let result = '';
  // Rejection rate is 24/256 (~9%), so 2x length is a generous buffer.
  const buffer = new Uint8Array(length * 2);
  let iterations = 0;

  while (result.length < length) {
    if (++iterations > 100) throw new Error('Random source produced too many rejected bytes');
    random(buffer);
    for (const byte of buffer) {
      if (result.length >= length) break;
      if (byte < MAX_UNBIASED_BYTE) {
        result += BASE58_ALPHABET.charAt(byte % BASE58_ALPHABET.length);
      }
    }
  }

  return result;
}
