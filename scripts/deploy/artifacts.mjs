import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertInventory,
  deploymentConfig,
  fileInventory,
  json,
  offlineWrangler,
  readJson,
  root,
  sha256,
  stableTagVersion,
  targetFor,
  uploadParts,
  wranglerVersion,
} from './lib.mjs';

// A digest detects corruption, not an untrusted builder. The caller must obtain
// expectedSha/environment and (in Phase 2) manifestDigest from trusted run data.
export async function verifyArtifacts(
  directory,
  { expectedSha, environment, manifestDigest, allowLocal = false },
) {
  targetFor(environment);
  assert(/^[a-f0-9]{40}$/.test(expectedSha), 'A complete expected SHA is required');
  // Check links before reading even the manifest; archive contents are untrusted.
  const inventory = await fileInventory(directory);
  const manifestBytes = await readFile(join(directory, 'build-manifest.json'));
  if (manifestDigest !== undefined)
    assert.equal(sha256(manifestBytes), manifestDigest, 'Manifest digest mismatch');
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.source.sha, expectedSha, 'Unexpected source SHA');
  assert.equal(manifest.environment, environment, 'Unexpected environment');
  assert(allowLocal || manifest.source.clean === true, 'Dirty local artifacts cannot be deployed');
  assert.equal(manifest.tools.wrangler, wranglerVersion, 'Wrangler version mismatch');
  assert.equal(
    manifest.targetsSha256,
    sha256(await readFile(join(root, 'scripts/deploy/targets.json'))),
    'Target allowlist digest mismatch',
  );
  delete inventory['build-manifest.json'];
  assertInventory(inventory, manifest.files);
  assert.equal(manifest.cli.name, 'mote-cli');
  assert(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(manifest.cli.version),
    'Invalid CLI version',
  );
  const tarball = `cli/mote-cli-${manifest.cli.version}.tgz`;
  assert.equal(manifest.cli.tarball, tarball);
  assert.equal(manifest.cli.verified, true, 'CLI package verification missing');
  assert.equal(inventory[tarball]?.sha256, manifest.cli.sha256, 'CLI tarball digest mismatch');
  const expectedFiles = ['api', 'viewer'].flatMap((component) =>
    ['index.js', 'wrangler.json', 'build.json'].map((name) => `${component}/${name}`),
  );
  expectedFiles.push(tarball);
  if (manifest.tag !== null) {
    expectedFiles.push('release-notes.md');
    const notes = await readFile(join(directory, 'release-notes.md'), 'utf8');
    stableTagVersion(manifest.tag, manifest.cli.version, `## [${manifest.cli.version}]\n${notes}`);
  }
  assert.deepEqual(
    Object.keys(inventory).sort(),
    expectedFiles.sort(),
    'Unexpected artifact files',
  );
  const scratch = await mkdtemp(join(tmpdir(), 'mote-artifact-verify-'));
  try {
    for (const component of ['api', 'viewer']) {
      const componentDir = join(directory, component);
      const config = await readJson(join(componentDir, 'wrangler.json'));
      const expected = deploymentConfig(component, environment);
      assertInventory(config, expected);
      const build = await readJson(join(componentDir, 'build.json'));
      assert.equal(build.schemaVersion, 1);
      assert.equal(build.environment, environment);
      assert.equal(build.component, component);
      assert.equal(build.wranglerVersion, wranglerVersion);
      assert.equal(build.configSha256, sha256(json(expected)));
      assert.equal(build.sourceConfigSha256, manifest.sourceConfigs[component]);
      assert.equal(build.uploadParts['index.js'].sha256, inventory[`${component}/index.js`].sha256);
      const multipart = join(scratch, `${component}.multipart`);
      offlineWrangler(
        [
          'deploy',
          '--config',
          join(componentDir, 'wrangler.json'),
          '--env',
          '',
          '--no-bundle',
          '--dry-run',
          '--outfile',
          multipart,
        ],
        componentDir,
        join(scratch, 'wrangler.log'),
      );
      assertInventory(await uploadParts(multipart), build.uploadParts);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  return manifest;
}
