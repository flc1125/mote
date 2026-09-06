import assert from 'node:assert/strict';
import { log } from 'node:console';
import { copyFile, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv } from 'node:process';
import {
  deploymentConfig,
  json,
  offlineWrangler,
  root,
  sha256,
  sourceConfig,
  uploadParts,
  wranglerVersion,
  writeJson,
} from './lib.mjs';

const component = argv[2];
sourceConfig(component);
const app = join(root, 'apps', component);
const scratch = await mkdtemp(join(tmpdir(), 'mote-worker-build-'));
const output = await mkdtemp(join(app, '.wrangler-build-'));
try {
  for (const environment of ['production', 'access-test']) {
    const buildDir = join(scratch, environment);
    const bundleDir = join(buildDir, 'bundle');
    await mkdir(buildDir);
    offlineWrangler(
      [
        'deploy',
        '--config',
        join(app, 'wrangler.toml'),
        '--env',
        environment === 'production' ? '' : environment,
        '--dry-run',
        '--outdir',
        bundleDir,
        '--outfile',
        join(buildDir, 'built.multipart'),
      ],
      app,
      join(scratch, 'wrangler.log'),
    );
    const prepared = join(output, environment);
    await mkdir(prepared);
    await copyFile(join(bundleDir, 'index.js'), join(prepared, 'index.js'));
    const config = deploymentConfig(component, environment);
    await writeJson(join(prepared, 'wrangler.json'), config);
    // Replay the exact command shape intended for upload, but always dry-run here.
    offlineWrangler(
      [
        'deploy',
        '--config',
        join(prepared, 'wrangler.json'),
        '--env',
        '',
        '--no-bundle',
        '--dry-run',
        '--outfile',
        join(buildDir, 'replayed.multipart'),
      ],
      prepared,
      join(scratch, 'wrangler.log'),
    );
    const built = await uploadParts(join(buildDir, 'built.multipart'));
    // Wrangler includes package discovery telemetry when building in the source
    // tree. Preserve it as provenance, but it is not runtime upload metadata.
    const sourcePackageDependencies = built.metadata.package_dependencies ?? [];
    delete built.metadata.package_dependencies;
    assert.deepEqual(
      await uploadParts(join(buildDir, 'replayed.multipart')),
      built,
      'Prebuilt upload changed modules or metadata',
    );
    assert.equal(built['index.js'].sha256, sha256(await readFile(join(prepared, 'index.js'))));
    await writeJson(join(prepared, 'build.json'), {
      schemaVersion: 1,
      component,
      environment,
      wranglerVersion,
      sourceConfigSha256: sha256(await readFile(join(app, 'wrangler.toml'))),
      configSha256: sha256(json(config)),
      sourcePackageDependencies,
      uploadParts: built,
    });
    log(`Verified ${component}/${environment}: prebuilt upload bytes and metadata match`);
  }
  // Only replace this script's fixed generated dist directory after BOTH builds pass.
  await rm(join(app, 'dist'), { recursive: true, force: true });
  await rename(output, join(app, 'dist'));
} finally {
  await rm(scratch, { recursive: true, force: true });
  await rm(output, { recursive: true, force: true });
}
