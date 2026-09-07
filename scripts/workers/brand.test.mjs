import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { URL } from 'node:url';
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
describe('brand exports', () => {
  it('preserves the original logo geometry and coral icon in the black wordmark variant', async () => {
    const original = await readFile(new URL('docs/assets/logo.svg', root), 'utf8');
    const variant = await readFile(new URL('docs/assets/logo-black.svg', root), 'utf8');
    expect(variant.match(/<path[^>]*>/g)).toEqual(original.match(/<path[^>]*>/g));
    expect(variant.match(/<rect[^>]*>/g)).toEqual(original.match(/<rect[^>]*>/g));
    expect(original).not.toContain('#20252b');
    expect(variant).toContain('<g fill="#20252b" data-wordmark="true">');
    expect(variant).toContain('fill="#ef5552"');
  });
  it('keeps the embedded Worker assets synchronized with the source files', () => {
    expect(() =>
      execFileSync(execPath, ['scripts/brand/sync.mjs', '--check'], { cwd: root }),
    ).not.toThrow();
  });
  it('exports real 16px and 32px ICO frames', async () => {
    const ico = await readFile(new URL('docs/assets/favicon.ico', root));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    for (const [index, size] of [16, 32].entries()) {
      const base = 6 + index * 16;
      expect(ico[base]).toBe(size);
      expect(ico[base + 1]).toBe(size);
      const offset = ico.readUInt32LE(base + 12);
      const length = ico.readUInt32LE(base + 8);
      const png = await readFile(new URL(`docs/assets/favicon-${size}.png`, root));
      expect(ico.subarray(offset, offset + length)).toEqual(png);
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });
});
