import { describe, expect, it } from 'vitest';

import {
  detectImageMimeType,
  isSupportedImageMimeType,
  SUPPORTED_IMAGE_MIME_TYPES,
} from './mime.js';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
const AVIF = bytes(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66);
const AVIS = bytes(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x73);

describe('detectImageMimeType', () => {
  it('detects each supported format from magic bytes', () => {
    expect(detectImageMimeType(PNG)).toBe('image/png');
    expect(detectImageMimeType(JPEG)).toBe('image/jpeg');
    expect(detectImageMimeType(GIF)).toBe('image/gif');
    expect(detectImageMimeType(WEBP)).toBe('image/webp');
    expect(detectImageMimeType(AVIF)).toBe('image/avif');
    expect(detectImageMimeType(AVIS)).toBe('image/avif'); // avif sequence brand
  });

  it('returns null for truncated or non-image content', () => {
    expect(detectImageMimeType(bytes(0x89, 0x50, 0x4e))).toBe(null); // truncated PNG
    expect(detectImageMimeType(bytes())).toBe(null);
    expect(detectImageMimeType(new TextEncoder().encode('<svg xmlns="...">'))).toBe(null);
    expect(detectImageMimeType(new TextEncoder().encode('# markdown'))).toBe(null);
    // RIFF but not WEBP (e.g. WAV)
    expect(
      detectImageMimeType(bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)),
    ).toBe(null);
    // ftyp but not avif (e.g. mp4)
    expect(
      detectImageMimeType(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32)),
    ).toBe(null);
  });
});

describe('isSupportedImageMimeType', () => {
  it('accepts the V1 whitelist and rejects active content types (§13)', () => {
    for (const mime of SUPPORTED_IMAGE_MIME_TYPES) {
      expect(isSupportedImageMimeType(mime)).toBe(true);
    }
    expect(isSupportedImageMimeType('image/svg+xml')).toBe(false);
    expect(isSupportedImageMimeType('text/html')).toBe(false);
    expect(isSupportedImageMimeType('application/javascript')).toBe(false);
    expect(isSupportedImageMimeType('IMAGE/PNG')).toBe(false); // case sensitive
    expect(isSupportedImageMimeType(undefined)).toBe(false);
  });
});
