import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertInventory, fileInventory, root, sha256, stableTagVersion } from '../deploy/lib.mjs';

export async function verifyReleaseArtifacts(
  directory,
  { expectedSha, tag, manifestDigest, allowLocal = false },
) {
  assert(/^[a-f0-9]{40}$/.test(expectedSha), 'A complete expected SHA is required');
  const inventory = await fileInventory(directory);
  const manifestBytes = await readFile(join(directory, 'release-manifest.json'));
  if (manifestDigest !== undefined)
    assert.equal(sha256(manifestBytes), manifestDigest, 'Release manifest digest mismatch');
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.kind, 'cli-release');
  assert.equal(manifest.source.sha, expectedSha, 'Unexpected source SHA');
  assert(allowLocal || manifest.source.clean === true, 'Dirty local artifacts cannot be released');
  assert.equal(manifest.tag, tag, 'Unexpected release tag');
  assert.equal(manifest.cli.name, 'mote-cli');
  assert.equal(manifest.cli.verified, true, 'CLI package verification missing');
  const tarball = `mote-cli-${manifest.cli.version}.tgz`;
  assert.equal(manifest.cli.tarball, tarball);
  assert.equal(inventory[tarball]?.sha256, manifest.cli.sha256, 'CLI tarball digest mismatch');
  const notes = await readFile(join(directory, 'release-notes.md'), 'utf8');
  stableTagVersion(tag, manifest.cli.version, `## [${manifest.cli.version}]\n${notes}`);
  delete inventory['release-manifest.json'];
  assertInventory(inventory, manifest.files);
  assert.deepEqual(
    Object.keys(inventory).sort(),
    ['release-notes.md', tarball].sort(),
    'Unexpected release artifact files',
  );
  assert.equal(
    manifest.lockfileSha256,
    sha256(await readFile(join(root, 'pnpm-lock.yaml'))),
    'Lockfile digest mismatch',
  );
  return manifest;
}
