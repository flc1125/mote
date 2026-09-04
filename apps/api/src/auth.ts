import { sha256Hex } from '@mote/core';

/**
 * Compares tokens without leaking the secret through timing: both sides are
 * hashed first, so the compared values are fixed-length and uniform.
 */
async function tokenMatches(presented: string, expected: string): Promise<boolean> {
  return (
    (await sha256Hex(new TextEncoder().encode(presented))) ===
    (await sha256Hex(new TextEncoder().encode(expected)))
  );
}

/** Validates the Authorization: Bearer header against the publish token (§38). */
export async function authorize(request: Request, secret: string): Promise<boolean> {
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length).trim();
  if (token === '') return false;
  return tokenMatches(token, secret);
}
