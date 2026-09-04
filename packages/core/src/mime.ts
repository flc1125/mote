/**
 * Supported image types for V1 (baseline §13). SVG is intentionally excluded
 * to avoid active content / XSS complexity. Detection is by magic bytes,
 * never by file extension.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export function isSupportedImageMimeType(value: unknown): value is SupportedImageMimeType {
  return (
    typeof value === 'string' && (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(value)
  );
}

function hasSignature(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((expected, index) => bytes[offset + index] === expected);
}

// Magic byte signatures (see https://en.wikipedia.org/wiki/List_of_file_signatures)
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]; // \x89PNG\r\n\x1a\n
const JPEG_SIG = [0xff, 0xd8, 0xff];
const GIF_SIG = [0x47, 0x49, 0x46, 0x38]; // "GIF8"
const RIFF_SIG = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIG = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
const FTYP_SIG = [0x66, 0x74, 0x79, 0x70]; // "ftyp"
const AVIF_BRAND = [0x61, 0x76, 0x69, 0x66]; // "avif"
const AVIS_BRAND = [0x61, 0x76, 0x69, 0x73]; // "avis"

/**
 * Detects the image MIME type from magic bytes.
 * Returns null when the content is not one of the supported image types.
 */
export function detectImageMimeType(bytes: Uint8Array): SupportedImageMimeType | null {
  if (hasSignature(bytes, PNG_SIG)) return 'image/png';
  if (hasSignature(bytes, JPEG_SIG)) return 'image/jpeg';
  if (hasSignature(bytes, GIF_SIG)) return 'image/gif';
  if (hasSignature(bytes, RIFF_SIG) && hasSignature(bytes, WEBP_SIG, 8)) return 'image/webp';
  if (
    hasSignature(bytes, FTYP_SIG, 4) &&
    (hasSignature(bytes, AVIF_BRAND, 8) || hasSignature(bytes, AVIS_BRAND, 8))
  ) {
    return 'image/avif';
  }
  return null;
}
