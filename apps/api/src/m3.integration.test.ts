import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { PublishResponse } from '@mote/protocol';

import viewerWorker from '../../viewer/src/index.js';

import apiWorker, { type Env as ApiEnv } from './index.js';
import { TEST_PUBLISH_TOKEN } from './test-token.js';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 8, 7]);

/**
 * M3 gate: the document published through the API Worker is rendered by the
 * Viewer Worker, and its asset is served — both sharing the same R2 bucket
 * (baseline §58).
 */
describe('M3 gate: API publish → Viewer render → asset', () => {
  it('completes the full server-side loop', async () => {
    // 1. Publish through the API worker.
    const form = new FormData();
    form.append(
      'document',
      new File(['# M3 联调\n\n![demo](./images/demo.png)\n'], 'README.md', {
        type: 'text/markdown',
      }),
    );
    form.append(
      'manifest',
      JSON.stringify({
        version: 1,
        entry: 'README.md',
        assets: [{ field: 'asset_0', references: ['./images/demo.png'] }],
      }),
    );
    form.append('asset_0', new File([PNG_BYTES], 'demo.png', { type: 'image/png' }));

    const publishResponse = await apiWorker.fetch(
      new Request('http://localhost/api/v1/publish', {
        method: 'POST',
        headers: { Authorization: `Bearer ${TEST_PUBLISH_TOKEN}` },
        body: form,
      }),
      env as unknown as ApiEnv,
    );
    expect(publishResponse.status).toBe(201);
    const { id, url } = (await publishResponse.json()) as PublishResponse;
    expect(url).toBe(`https://mote.flc.io/${id}`);

    // 2. Render through the Viewer worker against the same bucket.
    const pageResponse = await viewerWorker.fetch(new Request(`http://localhost/${id}`), env);
    expect(pageResponse.status).toBe(200);
    const html = await pageResponse.text();
    expect(html).toContain('<h1 id="m3-联调">M3 联调</h1>');

    // 3. The rewritten asset URL resolves and serves the bytes.
    const assetMatch = html.match(/src="(\/[^"]+\/a\/[^"]+)"/);
    expect(assetMatch).not.toBeNull();
    const assetPath = assetMatch![1];

    const assetResponse = await viewerWorker.fetch(
      new Request(`http://localhost${assetPath}`),
      env,
    );
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await assetResponse.arrayBuffer())).toEqual(PNG_BYTES);
  });
});
