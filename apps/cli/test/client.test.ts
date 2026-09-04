import { describe, expect, it } from 'vitest';

import { publishBundle } from '../src/client.js';
import type { Bundle } from '../src/bundle.js';

const BUNDLE: Bundle = {
  entryName: 'README.md',
  markdownBytes: new TextEncoder().encode('# hi'),
  manifest: {
    version: 1,
    entry: 'README.md',
    assets: [{ field: 'asset_0', references: ['./a.png'] }],
  },
  assets: [
    {
      field: 'asset_0',
      references: ['./a.png'],
      path: '/tmp/a.png',
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
      sha256: 'b'.repeat(64),
    },
  ],
  totalBytes: 8,
};

const TOKEN = 'secret-token-do-not-leak';

describe('publishBundle', () => {
  it('posts multipart with a Bearer token and parses the 201 response', async () => {
    let seenUrl = '';
    let seenAuth = '';
    let seenForm: unknown = null;

    const fetchImpl = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      seenUrl = String(input);
      seenAuth = new Headers(init?.headers).get('Authorization') ?? '';
      seenForm = init?.body;
      return new Response(
        JSON.stringify({ id: '7Vk3mQ9x2NFaP4Ls', url: 'https://mote.flc.io/7Vk3mQ9x2NFaP4Ls' }),
        { status: 201 },
      );
    };

    const result = await publishBundle(
      { apiUrl: 'https://api.example.com', token: TOKEN, fetchImpl: fetchImpl as typeof fetch },
      BUNDLE,
    );

    const form = seenForm as FormData;
    expect(seenUrl).toBe('https://api.example.com/api/v1/publish');
    expect(seenAuth).toBe(`Bearer ${TOKEN}`);
    expect(form.get('document')).toBeInstanceOf(File);
    expect(form.get('asset_0')).toBeInstanceOf(File);
    expect(JSON.parse(String(form.get('manifest')))).toEqual(BUNDLE.manifest);
    // The token must not leak into the multipart body.
    for (const value of form.values()) {
      expect(String(value)).not.toContain(TOKEN);
    }
    expect(result.url).toBe('https://mote.flc.io/7Vk3mQ9x2NFaP4Ls');
  });

  it('maps API errors without leaking the token', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'invalid token' } }), {
        status: 401,
      });

    const error = await publishBundle(
      { apiUrl: 'https://api.example.com', token: TOKEN, fetchImpl: fetchImpl as typeof fetch },
      BUNDLE,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('UNAUTHORIZED');
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it('wraps network failures', async () => {
    const fetchImpl = async (): Promise<Response> => {
      throw new TypeError('fetch failed');
    };

    await expect(
      publishBundle(
        { apiUrl: 'https://api.example.com', token: TOKEN, fetchImpl: fetchImpl as typeof fetch },
        BUNDLE,
      ),
    ).rejects.toThrow(/network error/);
  });
});
