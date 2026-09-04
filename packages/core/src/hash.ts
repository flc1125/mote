const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

/**
 * SHA-256 of the given bytes as a lowercase hex string.
 * Uses WebCrypto (crypto.subtle), available in both Workers and Node >= 20.
 */
export async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  // Bare `crypto` for cross-runtime compatibility (see base58.ts).
  const digest = await crypto.subtle.digest(
    'SHA-256',
    data as ArrayBuffer | Uint8Array<ArrayBuffer>,
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_RE.test(value);
}
