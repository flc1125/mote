import { randomBase58, type RandomSource } from './base58.js';

/** Document IDs are 16-char Base58 (~94 bit entropy), baseline §5. */
export const DOCUMENT_ID_LENGTH = 16;

/** Asset IDs are 12-char Base58, baseline §12. */
export const ASSET_ID_LENGTH = 12;

const BASE58_CLASS = '[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]';
const DOCUMENT_ID_RE = new RegExp(`^${BASE58_CLASS}{${DOCUMENT_ID_LENGTH}}$`);
const ASSET_ID_RE = new RegExp(`^${BASE58_CLASS}{${ASSET_ID_LENGTH}}$`);

export function generateDocumentId(random?: RandomSource): string {
  return randomBase58(DOCUMENT_ID_LENGTH, random);
}

export function generateAssetId(random?: RandomSource): string {
  return randomBase58(ASSET_ID_LENGTH, random);
}

export function isDocumentId(value: unknown): value is string {
  return typeof value === 'string' && DOCUMENT_ID_RE.test(value);
}

export function isAssetId(value: unknown): value is string {
  return typeof value === 'string' && ASSET_ID_RE.test(value);
}
