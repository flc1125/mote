import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MAX_MARKDOWN_BYTES } from '@mote/core';

import { buildBundle } from '../src/bundle.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9]);

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mote-cli-'));
});

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(dir, { recursive: true, force: true });
});

async function setup(): Promise<string> {
  await mkdir(join(dir, 'images'), { recursive: true });
  await writeFile(join(dir, 'images', 'a.png'), PNG);
  await writeFile(join(dir, 'images', 'b.webp'), WEBP);
  // Same content as a.png under a different name: must dedupe by content.
  await writeFile(join(dir, 'images', 'a-copy.png'), PNG);
  const markdownPath = join(dir, 'README.md');
  await writeFile(
    markdownPath,
    '# Doc\n\n![a](./images/a.png)\n\n![b](images/b.webp)\n\n![copy](./images/a-copy.png)\n',
  );
  return markdownPath;
}

describe('buildBundle (§22, §23)', () => {
  it('builds a bundle with deduped assets and a client manifest', async () => {
    const bundle = await buildBundle(await setup());

    expect(bundle.entryName).toBe('README.md');
    expect(bundle.assets).toHaveLength(2); // a-copy.png deduped into a.png

    const png = bundle.assets.find((asset) => asset.contentType === 'image/png');
    expect(png?.references).toEqual(['./images/a.png', './images/a-copy.png']);
    expect(png?.field).toBe('asset_0');

    expect(bundle.manifest).toEqual({
      version: 1,
      entry: 'README.md',
      assets: [
        { field: 'asset_0', references: ['./images/a.png', './images/a-copy.png'] },
        { field: 'asset_1', references: ['images/b.webp'] },
      ],
    });

    expect(bundle.totalBytes).toBe(bundle.markdownBytes.length + PNG.length + WEBP.length);
  });

  it('skips assets entirely with noAssets', async () => {
    const bundle = await buildBundle(await setup(), { noAssets: true });
    expect(bundle.assets).toEqual([]);
    expect(bundle.manifest.assets).toEqual([]);
  });

  it('errors with the reference when an asset is missing', async () => {
    const markdownPath = join(dir, 'doc.md');
    await writeFile(markdownPath, '![gone](./nope/missing.png)');
    await expect(buildBundle(markdownPath)).rejects.toThrow(
      /asset not found: \.\/nope\/missing\.png/,
    );
  });

  it('errors when the markdown file does not exist', async () => {
    await expect(buildBundle(join(dir, 'nope.md'))).rejects.toThrow(/markdown file not found/);
  });

  it('errors when a reference points at a directory', async () => {
    await mkdir(join(dir, 'images'));
    const markdownPath = join(dir, 'doc.md');
    await writeFile(markdownPath, '![dir](./images)');
    await expect(buildBundle(markdownPath)).rejects.toThrow(/not a regular file/);
  });

  it('errors on unsupported image types (SVG)', async () => {
    await writeFile(join(dir, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const markdownPath = join(dir, 'doc.md');
    await writeFile(markdownPath, '![svg](./icon.svg)');
    await expect(buildBundle(markdownPath)).rejects.toThrow(/unsupported image type/);
  });

  it('errors on oversized markdown', async () => {
    const markdownPath = join(dir, 'big.md');
    await writeFile(markdownPath, 'x'.repeat(MAX_MARKDOWN_BYTES + 1));
    await expect(buildBundle(markdownPath)).rejects.toThrow(/limit is/);
  });

  it('never reads files the markdown does not reference', async () => {
    const markdownPath = await setup();
    // A huge unreferenced file in the same directory must be ignored.
    await writeFile(join(dir, 'images', 'unreferenced.png'), new Uint8Array(12 * 1024 * 1024));
    const bundle = await buildBundle(markdownPath);
    expect(bundle.assets).toHaveLength(2);
  });
});
