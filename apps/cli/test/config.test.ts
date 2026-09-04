import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_API_URL, defaultConfigPath, resolveConfig } from '../src/config.js';

let dir: string;
let configPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mote-config-'));
  configPath = join(dir, 'config.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('resolveConfig priority (§21)', () => {
  it('falls back to defaults when nothing is configured', async () => {
    const config = await resolveConfig({ env: {}, configPath });
    expect(config.apiUrl).toBe(DEFAULT_API_URL);
    expect(config.token).toBeUndefined();
  });

  it('reads values from the config file', async () => {
    await writeFile(
      configPath,
      JSON.stringify({ apiUrl: 'https://api.example.com', token: 'file-token' }),
    );
    const config = await resolveConfig({ env: {}, configPath });
    expect(config.apiUrl).toBe('https://api.example.com');
    expect(config.token).toBe('file-token');
  });

  it('environment overrides the config file', async () => {
    await writeFile(
      configPath,
      JSON.stringify({ apiUrl: 'https://api.example.com', token: 'file-token' }),
    );
    const config = await resolveConfig({
      env: { MOTE_API_URL: 'https://env.example.com', MOTE_TOKEN: 'env-token' },
      configPath,
    });
    expect(config.apiUrl).toBe('https://env.example.com');
    expect(config.token).toBe('env-token');
  });

  it('CLI arguments override environment', async () => {
    const config = await resolveConfig({
      api: 'https://arg.example.com',
      token: 'arg-token',
      env: { MOTE_API_URL: 'https://env.example.com', MOTE_TOKEN: 'env-token' },
      configPath,
    });
    expect(config.apiUrl).toBe('https://arg.example.com');
    expect(config.token).toBe('arg-token');
  });

  it('errors on a malformed config file', async () => {
    await writeFile(configPath, '{not json');
    await expect(resolveConfig({ env: {}, configPath })).rejects.toThrow(/invalid config file/);
  });

  it('honors XDG_CONFIG_HOME for the default path', () => {
    expect(defaultConfigPath({ XDG_CONFIG_HOME: '/tmp/xdg' })).toBe(
      join('/tmp/xdg', 'mote', 'config.json'),
    );
  });
});
