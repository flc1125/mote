import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  expectedConfig,
  offlineWrangler,
  root,
  sourceConfig,
  targetFor,
  validateSourceConfig,
} from './config.mjs';

const require = createRequire(join(root, 'apps/api/package.json'));
const { experimental_readRawConfig: readRaw } = require('wrangler');

describe('Worker source configuration allowlist', () => {
  it.each(['api', 'viewer'])('accepts checked-in formal %s configuration', (component) => {
    expect(() => sourceConfig(component)).not.toThrow();
  });

  it.each(['staging', '__proto__', '../production', ''])(
    'rejects environment %s',
    (environment) => {
      expect(() => targetFor(environment)).toThrow();
    },
  );

  it.each([
    [
      'wrong bucket',
      (raw) => {
        raw.r2_buckets[0].bucket_name = 'wrong-bucket';
      },
    ],
    [
      'wrong route',
      (raw) => {
        raw.routes[0].pattern = 'wrong.invalid/*';
      },
    ],
    [
      'legacy token mode',
      (raw) => {
        raw.vars.MOTE_AUTH_MODE = 'token';
      },
    ],
    [
      'wrong Access audience',
      (raw) => {
        raw.vars.MOTE_ACCESS_AUD = 'wrong-audience';
      },
    ],
    [
      'unknown binding',
      (raw) => {
        raw.services = [{ binding: 'OTHER', service: 'other' }];
      },
    ],
    [
      'unknown environment',
      (raw) => {
        raw.env.other = {};
      },
    ],
  ])('rejects %s', (_label, change) => {
    const raw = globalThis.structuredClone(sourceConfig('api'));
    change(raw);
    expect(() => validateSourceConfig(raw, 'api')).toThrow();
  });

  it('pins isolated test resources and a distinct Access audience', () => {
    expect(targetFor('access-test')).toEqual({
      hostname: 'mote-test.flc.io',
      api: 'mote-test-api',
      viewer: 'mote-test-viewer',
      bucket: 'mote-test-documents',
      aud: 'd4a8fb385f160677a736f54466c781d99b4806ae6b85d7d752c27ceda51ab859',
    });
    expect(targetFor('access-test').aud).not.toBe(targetFor('production').aud);
  });

  it.each(['api', 'viewer'])('keeps the %s probe local-only', (component) => {
    const config = readRaw({
      config: join(root, `apps/auth-probe/wrangler.${component}.jsonc`),
    });
    expect(config.redirected).toBeFalsy();
    const raw = config.rawConfig;
    expect(raw.account_id).toBe('00000000000000000000000000000000');
    expect(raw.name).toBe(`mote-local-probe-${component}`);
    expect(raw.routes).toEqual([]);
    expect(raw.workers_dev).toBe(false);
    expect(raw.preview_urls).toBe(false);
    expect(raw.r2_buckets).toEqual([
      { binding: 'DOCUMENTS', bucket_name: 'mote-local-probe-documents', remote: false },
    ]);
  });

  it('never lets the offline helper run a real deploy', () => {
    expect(() => offlineWrangler(['deploy'], '', '')).toThrow('dry-run');
  });
});

describe('Workers Builds migration contract', () => {
  it('keeps CI quality checks, Worker dry-runs and CLI package verification', async () => {
    const ci = await readFile(join(root, '.github/workflows/ci.yml'), 'utf8');
    for (const command of [
      'pnpm lint',
      'pnpm typecheck',
      'pnpm test',
      'pnpm build',
      'pnpm --filter @mote/cli test:package',
      'pnpm format:check',
    ]) {
      expect(ci).toContain(command);
    }
    const rootPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    expect(rootPackage.scripts).not.toHaveProperty('artifacts:prepare');
    expect(rootPackage.scripts).not.toHaveProperty('artifacts:verify');
    for (const component of ['api', 'viewer']) {
      const packageJson = JSON.parse(
        await readFile(join(root, `apps/${component}/package.json`), 'utf8'),
      );
      expect(packageJson.scripts.build).toBe(`node ../../scripts/workers/verify.mjs ${component}`);
      const production = globalThis.structuredClone(sourceConfig(component));
      delete production.env;
      expect(production).toEqual(expectedConfig(component, 'production'));
    }
  });

  it('has no repository-owned Worker deployment or secret-diagnostic workflow', async () => {
    for (const file of [
      '_deploy.yml',
      'deploy.yml',
      '_diagnose-secrets.yml',
      'diagnose-secrets.yml',
    ]) {
      await expect(access(join(root, '.github/workflows', file))).rejects.toThrow();
    }
    const release = await readFile(join(root, '.github/workflows/release.yml'), 'utf8');
    expect(release).not.toMatch(
      /CLOUDFLARE|wrangler deploy|scripts\/deploy|MOTE_SMOKE_|MOTE_DEPLOY_|deployment-result|deployments: write/,
    );
  });
});
