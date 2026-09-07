import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileInventory, root, sha256, writeJson } from '../deploy/lib.mjs';
import { verifyReleaseArtifacts } from './artifacts.mjs';

const sha = 'a'.repeat(40);
const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'mote-cli-release-test-'));
  temporary.push(directory);
  const tarball = 'mote-cli-1.2.3.tgz';
  await writeFile(join(directory, tarball), 'verified tarball bytes');
  await writeFile(join(directory, 'release-notes.md'), '### Fixed\n\n- A release fix.\n');
  const files = await fileInventory(directory);
  const manifest = {
    schemaVersion: 1,
    kind: 'cli-release',
    tag: 'v1.2.3',
    source: { sha, clean: true, treeSha256: 'b'.repeat(64) },
    tools: { node: 'v24.0.0', pnpm: '11.23.0' },
    lockfileSha256: sha256(await readFile(join(root, 'pnpm-lock.yaml'))),
    cli: {
      name: 'mote-cli',
      version: '1.2.3',
      tarball,
      sha256: files[tarball].sha256,
      verified: true,
    },
    files,
  };
  await writeJson(join(directory, 'release-manifest.json'), manifest);
  return { directory, manifest };
}

describe('CLI-only release artifacts', () => {
  it('accepts the exact verified tarball, notes, source and lockfile', async () => {
    const { directory, manifest } = await fixture();
    expect(await verifyReleaseArtifacts(directory, { expectedSha: sha, tag: 'v1.2.3' })).toEqual(
      manifest,
    );
  });

  it.each(['mote-cli-1.2.3.tgz', 'release-notes.md'])('rejects corrupted %s', async (name) => {
    const { directory } = await fixture();
    await writeFile(join(directory, name), 'corrupted');
    await expect(
      verifyReleaseArtifacts(directory, { expectedSha: sha, tag: 'v1.2.3' }),
    ).rejects.toThrow();
  });

  it('rejects extra files and a mismatched manifest digest', async () => {
    const { directory } = await fixture();
    await writeFile(join(directory, 'worker.js'), 'must not ship');
    await expect(
      verifyReleaseArtifacts(directory, { expectedSha: sha, tag: 'v1.2.3' }),
    ).rejects.toThrow('inventory/digest');
    await expect(
      verifyReleaseArtifacts(directory, {
        expectedSha: sha,
        tag: 'v1.2.3',
        manifestDigest: 'c'.repeat(64),
      }),
    ).rejects.toThrow('manifest digest');
  });
});
