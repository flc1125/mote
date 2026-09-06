import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyArtifacts } from './artifacts.mjs';
import {
  assertTaggedSha,
  deploymentConfig,
  expectedConfig,
  fileInventory,
  json,
  readJson,
  root,
  offlineWrangler,
  sha256,
  sourceConfig,
  stableTagVersion,
  targetFor,
  validateSourceConfig,
  wranglerVersion,
  writeJson,
} from './lib.mjs';

const expectedSha = 'a'.repeat(40);
const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});

async function fixture(environment = 'production') {
  const directory = await mkdtemp(join(tmpdir(), 'mote-artifact-test-'));
  temporary.push(directory);
  for (const component of ['api', 'viewer']) {
    const path = join(directory, component);
    await mkdir(path);
    const script = 'export default { fetch() { return new Response("fixture"); } };\n';
    const config = deploymentConfig(component, environment);
    await writeFile(join(path, 'index.js'), script);
    await writeJson(join(path, 'wrangler.json'), config);
    await writeJson(join(path, 'build.json'), {
      schemaVersion: 1,
      component,
      environment,
      wranglerVersion,
      configSha256: sha256(json(config)),
      sourceConfigSha256: 'b'.repeat(64),
      uploadParts: {
        'index.js': { sha256: sha256(script), size: script.length },
        metadata: {
          main_module: 'index.js',
          bindings: [
            ...Object.entries(config.vars ?? {}).map(([name, text]) => ({
              name,
              type: 'plain_text',
              text,
            })),
            { name: 'DOCUMENTS', type: 'r2_bucket', bucket_name: targetFor(environment).bucket },
          ],
          compatibility_date: config.compatibility_date,
          compatibility_flags: [],
          ...(component === 'viewer' ? { cache_options: { enabled: true } } : {}),
        },
      },
    });
  }
  await mkdir(join(directory, 'cli'));
  const tarball = 'cli/mote-cli-1.2.3.tgz';
  // This fixture exercises artifact integrity; real install/type tests run in prepare.
  await writeFile(join(directory, tarball), 'synthetic tarball bytes');
  const files = await fileInventory(directory);
  const manifest = {
    targetsSha256: sha256(await readFile(join(root, 'scripts/deploy/targets.json'))),
    schemaVersion: 1,
    environment,
    tag: null,
    source: { sha: expectedSha, clean: true },
    tools: { wrangler: wranglerVersion },
    sourceConfigs: { api: 'b'.repeat(64), viewer: 'b'.repeat(64) },
    cli: {
      name: 'mote-cli',
      version: '1.2.3',
      tarball,
      sha256: files[tarball].sha256,
      verified: true,
    },
    files,
  };
  await writeJson(join(directory, 'build-manifest.json'), manifest);
  return { directory, manifest, options: { expectedSha, environment } };
}

describe('source configuration allowlist', () => {
  it.each(['api', 'viewer'])('accepts checked-in formal %s configuration', (component) => {
    expect(() => sourceConfig(component)).not.toThrow();
  });
  it.each(['staging', '__proto__', '../production', ''])(
    'rejects environment %s',
    (environment) => {
      expect(() => targetFor(environment)).toThrow();
    },
  );
  it('rejects the historical probe', () =>
    expect(() => expectedConfig('access-oauth-probe', 'production')).toThrow());
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
      'wrong AUD',
      (raw) => {
        raw.vars.MOTE_ACCESS_AUD = 'synthetic-wrong-aud';
      },
    ],
    [
      'alternate host',
      (raw) => {
        raw.workers_dev = true;
      },
    ],
    [
      'unknown binding',
      (raw) => {
        raw.services = [{ binding: 'OTHER', service: 'other' }];
      },
    ],
    [
      'custom build hook',
      (raw) => {
        raw.build = { command: 'false' };
      },
    ],
    [
      'test R2 inheritance',
      (raw) => {
        delete raw.env['access-test'].r2_buckets;
      },
    ],
    [
      'test vars inheritance',
      (raw) => {
        delete raw.env['access-test'].vars;
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
});

describe('release preparation gates', () => {
  it('requires the tag to resolve to the exact checkout SHA', () => {
    expect(() => assertTaggedSha(expectedSha, expectedSha)).not.toThrow();
    expect(() => assertTaggedSha(expectedSha, 'b'.repeat(40))).toThrow('checkout SHA');
  });
  it('prevents the offline helper from uploading', () => {
    expect(() => offlineWrangler(['deploy'], '', '')).toThrow('dry-run');
  });
  const changelog =
    '# Changelog\n\n## [Unreleased]\n\nFuture\n\n## [1.2.3] - 2026-09-06\n\n### Fixed\n\n- A fix.\n\n## [1.2.2]\n\nOld\n';
  it('extracts only the matching version notes', () => {
    expect(stableTagVersion('v1.2.3', '1.2.3', changelog)).toBe('### Fixed\n\n- A fix.\n');
  });
  it.each(['v1.2.3-rc.1', 'v01.2.3', 'v1.2', 'main', 'v1.2.3;echo bad'])(
    'rejects tag %s',
    (tag) => {
      expect(() => stableTagVersion(tag, '1.2.3', changelog)).toThrow();
    },
  );
  it('rejects version mismatch', () =>
    expect(() => stableTagVersion('v1.2.4', '1.2.3', changelog)).toThrow());
  it.each(['# Changelog\n', '## [1.2.3]\n\n## [1.2.2]\nOld', '## [1.2.3]\nOne\n## [1.2.3]\nTwo'])(
    'rejects missing/empty/duplicate notes',
    (text) => {
      expect(() => stableTagVersion('v1.2.3', '1.2.3', text)).toThrow();
    },
  );
});

describe('prebuilt artifact verification', () => {
  it.each(['production', 'access-test'])(
    'replays %s upload without credentials',
    async (environment) => {
      const f = await fixture(environment);
      expect(await verifyArtifacts(f.directory, f.options)).toEqual(f.manifest);
    },
    15000,
  );
  it.each(['api/index.js', 'viewer/wrangler.json', 'cli/mote-cli-1.2.3.tgz'])(
    'rejects corrupted %s',
    async (file) => {
      const f = await fixture();
      await writeFile(join(f.directory, file), 'corrupted');
      await expect(verifyArtifacts(f.directory, f.options)).rejects.toThrow('inventory/digest');
    },
  );
  it('rejects an untrusted manifest digest', async () => {
    const f = await fixture();
    await expect(
      verifyArtifacts(f.directory, { ...f.options, manifestDigest: '0'.repeat(64) }),
    ).rejects.toThrow('Manifest digest');
  });
  it('rejects a mismatched SHA and environment', async () => {
    const f = await fixture();
    await expect(
      verifyArtifacts(f.directory, { ...f.options, expectedSha: 'c'.repeat(40) }),
    ).rejects.toThrow('source SHA');
    await expect(
      verifyArtifacts(f.directory, { ...f.options, environment: 'access-test' }),
    ).rejects.toThrow('environment');
  });
  it('rejects dirty artifacts by default', async () => {
    const f = await fixture();
    f.manifest.source.clean = false;
    await writeJson(join(f.directory, 'build-manifest.json'), f.manifest);
    await expect(verifyArtifacts(f.directory, f.options)).rejects.toThrow('Dirty local artifacts');
  });
  it('rejects symlinks instead of following them', async () => {
    const f = await fixture();
    await symlink(join(f.directory, 'api/index.js'), join(f.directory, 'extra-link'));
    await expect(verifyArtifacts(f.directory, f.options)).rejects.toThrow('symlinks');
  });
  it('rejects a manifest symlink before parsing its target', async () => {
    const f = await fixture();
    const path = join(f.directory, 'build-manifest.json');
    await rm(path);
    await symlink(join(f.directory, 'api/index.js'), path);
    await expect(verifyArtifacts(f.directory, f.options)).rejects.toThrow('symlinks');
  });
  it('rejects changed configuration even with recalculated file hashes', async () => {
    const f = await fixture();
    const path = join(f.directory, 'api/wrangler.json');
    const config = await readJson(path);
    config.r2_buckets[0].bucket_name = 'wrong-bucket';
    await writeJson(path, config);
    const content = await readFile(path);
    f.manifest.files['api/wrangler.json'] = { sha256: sha256(content), size: content.length };
    await writeJson(join(f.directory, 'build-manifest.json'), f.manifest);
    await expect(verifyArtifacts(f.directory, f.options)).rejects.toThrow('inventory/digest');
  });
  it('rejects extra files', async () => {
    const f = await fixture();
    await writeFile(join(f.directory, 'unexpected.txt'), 'extra');
    await expect(verifyArtifacts(f.directory, f.options)).rejects.toThrow('inventory/digest');
  });
});
