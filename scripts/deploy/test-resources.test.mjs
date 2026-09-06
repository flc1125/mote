import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { root, sourceConfig, targetFor, validateSourceConfig } from './lib.mjs';

const require = createRequire(join(root, 'apps/api/package.json'));
const { experimental_readRawConfig: readRaw } = require('wrangler');

describe('Phase 3A resource isolation', () => {
  it('pins the new test resources and independent Access audience', () => {
    expect(targetFor('access-test')).toEqual({
      hostname: 'mote-test.flc.io',
      api: 'mote-test-api',
      viewer: 'mote-test-viewer',
      bucket: 'mote-test-documents',
      aud: 'd4a8fb385f160677a736f54466c781d99b4806ae6b85d7d752c27ceda51ab859',
    });
    expect(targetFor('access-test').aud).not.toBe(targetFor('production').aud);
  });

  it.each(['api', 'viewer'])('rejects restoring an old test target in %s', (component) => {
    const raw = globalThis.structuredClone(sourceConfig(component));
    raw.env['access-test'].name = `mote-oauth-test-${component}`;
    expect(() => validateSourceConfig(raw, component)).toThrow('Test configuration drift');
  });

  it.each(['api', 'viewer'])('keeps the %s probe local-only', (component) => {
    const config = readRaw({
      config: join(root, `apps/access-oauth-probe/wrangler.${component}.jsonc`),
    });
    expect(config.redirected).toBeFalsy();
    const raw = config.rawConfig;
    expect(raw.account_id).toBe('00000000000000000000000000000000');
    expect(raw.name).toBe(`mote-local-probe-${component}`);
    expect(raw.routes).toEqual([]);
    expect(raw.route).toBeUndefined();
    expect(raw.env).toBeUndefined();
    expect(raw.workers_dev).toBe(false);
    expect(raw.preview_urls).toBe(false);
    expect(raw.r2_buckets).toEqual([
      { binding: 'DOCUMENTS', bucket_name: 'mote-local-probe-documents', remote: false },
    ]);
    if (component === 'api') {
      expect(raw.vars).toEqual({
        VIEWER_BASE_URL: 'https://mote-probe.example.invalid',
        ACCESS_ISSUER: 'https://access.example.invalid',
        ACCESS_AUD: 'local-probe-audience',
      });
    }
  });

  it('only exposes dry-run builds for the historical probe', async () => {
    const { scripts } = JSON.parse(
      await readFile(join(root, 'apps/access-oauth-probe/package.json'), 'utf8'),
    );
    expect(scripts.deploy).toBeUndefined();
    expect(scripts['build:probe'].split(' && ')).toHaveLength(2);
    for (const command of scripts['build:probe'].split(' && ')) {
      expect(command).toContain(' --dry-run ');
    }
  });
});
