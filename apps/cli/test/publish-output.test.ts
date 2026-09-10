import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatBytes, run, type CliIO } from '../src/run.js';

const api = 'https://mote.example.com';
const published = { id: '7Vk3mQ9x2NFaP4Ls', url: `${api}/7Vk3mQ9x2NFaP4Ls` };
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mote-output-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function capture(stderrIsTTY = true, stdoutIsTTY = true) {
  const out: string[] = [],
    err: string[] = [],
    events: string[] = [];
  const io: CliIO = {
    stdoutIsTTY,
    stderrIsTTY,
    stdout: (text) => {
      out.push(text);
      events.push(`out:${text}`);
    },
    stderr: (text) => {
      err.push(text);
      events.push(`err:${text}`);
    },
  };
  return { out, err, events, io };
}
async function document(markdown: string) {
  const path = join(dir, 'README.md');
  await writeFile(path, markdown);
  return path;
}
const config = () => ({
  env: { MOTE_TOKEN: 'fake-publish-token', MOTE_API_URL: api },
  configPath: join(dir, 'none'),
});
const success = () =>
  new Response(JSON.stringify(published), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });

describe('publishing terminal progress', () => {
  it('reports actual UTF-8 bytes and deduplicated images before making the upload request', async () => {
    const markdown =
      '# 示例\n![a](a.png)\n![copy](copy.png)\n![remote](https://example.com/remote.png)';
    const path = await document(markdown);
    await writeFile(join(dir, 'a.png'), png);
    await writeFile(join(dir, 'copy.png'), png);
    const output = capture(true, false); // stdout can be captured independently.
    const bytes = Buffer.byteLength(markdown);
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(output.out).toEqual([]);
      expect(output.err[0]).toBe(`Scanning ${path}…`);
      expect(output.err.join('\n')).toContain(`Markdown  ${formatBytes(bytes)}`);
      expect(output.err.join('\n')).toContain('Assets    1');
      expect(output.err.join('\n')).toContain(`Total     ${formatBytes(bytes + png.length)}`);
      expect(output.err.at(-1)).toBe('Publishing…');
      const manifest = JSON.parse((init?.body as FormData).get('manifest') as string);
      expect(manifest.assets).toHaveLength(1);
      output.events.push('upload');
      return success();
    });
    expect(await run([path], output.io, { ...config(), fetchImpl })).toBe(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(output.out).toEqual([`Published:\n${published.url}`]);
    expect(output.events.at(-2)).toBe('upload');
    expect(output.events.at(-1)).toBe(`out:Published:\n${published.url}`);
    expect(output.err.join()).not.toContain('fake-publish-token');
    expect(output.err.join()).not.toContain('\x1b');
  });

  it.each([false, true])('reports a Markdown-only total with noAssets=%s', async (noAssets) => {
    const markdown = noAssets ? '# Text\n![missing](not-present.png)' : '# Just text';
    const path = await document(markdown),
      output = capture();
    const fetchImpl = vi.fn(async () => success());
    expect(
      await run([path, ...(noAssets ? ['--no-assets'] : [])], output.io, {
        ...config(),
        fetchImpl,
      }),
    ).toBe(0);
    expect(output.err.join('\n')).toContain(`Assets    ${noAssets ? '0 (skipped)' : '0'}`);
    expect(output.err.join('\n')).toContain(
      `Total     ${formatBytes(Buffer.byteLength(markdown))}`,
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([
    { tty: false, args: [], progress: false },
    { tty: false, args: ['--verbose'], progress: true },
    { tty: true, args: ['--verbose'], progress: true },
    { tty: true, args: ['--json'], progress: false },
    { tty: true, args: ['--json', '--verbose'], progress: false },
    { tty: false, args: ['--json', '--verbose'], progress: false },
  ])('preserves output routing for $args with stderr TTY=$tty', async ({ tty, args, progress }) => {
    const path = await document('# Hello'),
      output = capture(tty);
    expect(
      await run([path, ...args], output.io, { ...config(), fetchImpl: async () => success() }),
    ).toBe(0);
    if (progress) expect(output.err.filter((s) => s.startsWith('Scanning'))).toHaveLength(1);
    else expect(output.err).toEqual([]);
    expect(output.out).toEqual([
      args.includes('--json') ? JSON.stringify(published) : `Published:\n${published.url}`,
    ]);
  });

  it('keeps authentication before scanning and reports missing credentials without reading a file', async () => {
    const output = capture(),
      fetchImpl = vi.fn();
    expect(
      await run([join(dir, 'missing.md')], output.io, { ...config(), env: {}, fetchImpl }),
    ).toBe(1);
    expect(output.out).toEqual([]);
    expect(output.err).toHaveLength(1);
    expect(output.err[0]).toContain('no publish token');
    expect(output.err.join()).not.toContain('Scanning');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('prints scan failure without a summary or upload attempt', async () => {
    const path = await document('# Broken\n![missing](absent.png)'),
      output = capture();
    const fetchImpl = vi.fn();
    expect(await run([path], output.io, { ...config(), fetchImpl })).toBe(1);
    expect(output.err[0]).toBe(`Scanning ${path}…`);
    expect(output.err.at(-1)).toContain('asset not found');
    expect(output.err.join()).not.toContain('Markdown  ');
    expect(output.err.join()).not.toContain('Publishing…');
    expect(output.out).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'reports upload failure without success or a retry (json=%s)',
    async (json) => {
      const path = await document('# Failure'),
        output = capture();
      const fetchImpl = vi.fn(async () => {
        throw new Error('simulated network failure');
      });
      expect(
        await run([path, ...(json ? ['--json', '--verbose'] : [])], output.io, {
          ...config(),
          fetchImpl,
        }),
      ).toBe(1);
      expect(output.out).toEqual([]);
      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(output.err.at(-1)).toContain('error:');
      if (json) expect(output.err).toHaveLength(1);
      else expect(output.err.join()).toContain('Publishing…');
    },
  );
});
