import { describe, expect, it } from 'vitest';

import { formatBytes, run, type CliIO } from '../src/run.js';

function capture(): { io: CliIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { stdout: (text) => out.push(text), stderr: (text) => err.push(text) },
    out,
    err,
  };
}

describe('run — argument handling', () => {
  it('prints help and version', async () => {
    const help = capture();
    expect(await run(['--help'], help.io, { env: {} })).toBe(0);
    expect(help.out.join()).toContain('mote <markdown-file>');

    const version = capture();
    expect(await run(['--version'], version.io, { env: {} })).toBe(0);
  });

  it('fails without a file argument', async () => {
    const { io, err } = capture();
    expect(await run([], io, { env: {} })).toBe(1);
    expect(err.join()).toMatch(/usage/);
  });

  it('fails when no token is configured', async () => {
    const { io, err } = capture();
    const code = await run(['README.md'], io, { env: {}, configPath: '/nonexistent/config.json' });
    expect(code).toBe(1);
    expect(err.join()).toMatch(/no publish token/);
  });

  it('accepts the "publish" subcommand form', async () => {
    const { io, err } = capture();
    // Fails later (missing token), proving the positional parsing accepted it.
    const code = await run(['publish', 'README.md'], io, {
      env: {},
      configPath: '/nonexistent/config.json',
    });
    expect(code).toBe(1);
    expect(err.join()).toMatch(/no publish token/);
    expect(err.join()).not.toMatch(/usage/);
  });
});

describe('formatBytes', () => {
  it('formats byte counts', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(47.1 * 1024)).toBe('47.1 KB');
    expect(formatBytes(1.84 * 1024 * 1024)).toBe('1.8 MB');
  });
});
