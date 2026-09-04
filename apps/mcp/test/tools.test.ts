import { describe, expect, it } from 'vitest';

import type { Bundle, BundleAsset, PublishClientOptions } from '@mote/cli';
import { MAX_MARKDOWN_BYTES } from '@mote/core';

import { publishMarkdown, publishMarkdownFile, type McpDeps } from '../src/tools.js';

const TOKEN = 'unit-test-token';
const API_URL = 'https://api.test';

describe('publishMarkdown', () => {
  it('publishes an asset-less bundle built from the raw markdown', async () => {
    let seenOptions: PublishClientOptions | undefined;
    let seenBundle: Bundle | undefined;

    const deps: McpDeps = {
      buildBundle: async () => {
        throw new Error('buildBundle must not be called for raw markdown');
      },
      publishBundle: async (options, bundle) => {
        seenOptions = options;
        seenBundle = bundle;
        return { id: '7Vk3mQ9x2NFaP4Ls', url: 'https://mote.flc.io/7Vk3mQ9x2NFaP4Ls' };
      },
      resolveConfig: async () => ({ apiUrl: API_URL, token: TOKEN }),
    };

    const result = await publishMarkdown('# Hello', 'report.md', deps);

    expect(result).toEqual({ id: '7Vk3mQ9x2NFaP4Ls', url: 'https://mote.flc.io/7Vk3mQ9x2NFaP4Ls' });
    expect(seenOptions?.apiUrl).toBe(API_URL);
    expect(seenOptions?.token).toBe(TOKEN);
    expect(seenBundle?.entryName).toBe('report.md');
    expect(seenBundle?.assets).toEqual([]);
    expect(seenBundle?.manifest).toEqual({ version: 1, entry: 'report.md', assets: [] });
    expect(new TextDecoder().decode(seenBundle?.markdownBytes)).toBe('# Hello');
    expect(seenBundle?.totalBytes).toBe(new TextEncoder().encode('# Hello').length);
  });

  it('rejects markdown over the 2 MB limit before touching the network', async () => {
    const deps: McpDeps = {
      buildBundle: async () => {
        throw new Error('buildBundle must not be called');
      },
      publishBundle: async () => {
        throw new Error('publishBundle must not be called');
      },
      resolveConfig: async () => {
        throw new Error('resolveConfig must not be called');
      },
    };

    await expect(
      publishMarkdown('x'.repeat(MAX_MARKDOWN_BYTES + 1), 'big.md', deps),
    ).rejects.toThrow(/limit is/);
  });

  it('rejects when no publish token is configured', async () => {
    const deps: McpDeps = {
      buildBundle: async () => {
        throw new Error('buildBundle must not be called');
      },
      publishBundle: async () => {
        throw new Error('publishBundle must not be called');
      },
      resolveConfig: async () => ({ apiUrl: API_URL }),
    };

    await expect(publishMarkdown('# Hello', 'report.md', deps)).rejects.toThrow(/no publish token/);
  });
});

describe('publishMarkdownFile', () => {
  it('passes path and noAssets to buildBundle and returns the full result', async () => {
    const markdown = '# Hello\n\n![demo](./demo.png)\n';
    const asset: BundleAsset = {
      field: 'asset_0',
      references: ['./demo.png'],
      path: '/tmp/doc/demo.png',
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
      sha256: 'deadbeef',
    };
    const markdownBytes = new TextEncoder().encode(markdown);
    const bundle: Bundle = {
      entryName: 'README.md',
      markdownBytes,
      manifest: {
        version: 1,
        entry: 'README.md',
        assets: [{ field: 'asset_0', references: ['./demo.png'] }],
      },
      assets: [asset],
      totalBytes: markdownBytes.length + asset.bytes.length,
    };

    let seenPath: string | undefined;
    let seenNoAssets: boolean | undefined;

    const deps: McpDeps = {
      buildBundle: async (path, options) => {
        seenPath = path;
        seenNoAssets = options?.noAssets === true;
        return bundle;
      },
      publishBundle: async () => ({ id: 'abc123', url: 'https://mote.flc.io/abc123' }),
      resolveConfig: async () => ({ apiUrl: API_URL, token: TOKEN }),
    };

    const result = await publishMarkdownFile('/tmp/doc/README.md', true, deps);

    expect(seenPath).toBe('/tmp/doc/README.md');
    expect(seenNoAssets).toBe(true);
    expect(result).toEqual({
      id: 'abc123',
      url: 'https://mote.flc.io/abc123',
      markdownBytes: markdownBytes.length,
      assetCount: 1,
      totalBytes: bundle.totalBytes,
    });
  });
});
