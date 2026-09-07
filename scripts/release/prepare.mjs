import assert from 'node:assert/strict';
import { log } from 'node:console';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { argv, execPath, version } from 'node:process';
import { parseArgs } from 'node:util';
import {
  assertTaggedSha,
  fileInventory,
  json,
  pnpm,
  readJson,
  root,
  run,
  sha256,
  stableTagVersion,
  writeJson,
} from './lib.mjs';
import { verifyReleaseArtifacts } from './artifacts.mjs';

const { values } = parseArgs({
  args: argv.slice(2),
  options: {
    out: { type: 'string' },
    sha: { type: 'string' },
    tag: { type: 'string' },
    'allow-dirty': { type: 'boolean', default: false },
  },
});
assert(values.tag, 'A stable release tag is required');
const output = resolve(values.out ?? join(root, 'dist/release'));

async function snapshot() {
  const sha = run('git', ['rev-parse', 'HEAD']).toString().trim();
  const clean = run('git', ['status', '--porcelain', '--untracked-files=all']).length === 0;
  const paths = [
    ...new Set(
      run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
        .toString()
        .split('\0')
        .filter(Boolean),
    ),
  ].sort();
  const files = [];
  for (const path of paths) files.push([path, sha256(await readFile(join(root, path)))]);
  return { sha, clean, treeSha256: sha256(json(files)) };
}

const source = await snapshot();
assert(/^[a-f0-9]{40}$/.test(source.sha), 'Invalid Git SHA');
if (values.sha !== undefined)
  assert.equal(source.sha, values.sha, 'Checkout SHA does not match input');
assert(
  source.clean || values['allow-dirty'],
  'Use a clean checkout; --allow-dirty is for local verification only',
);
const packageManifest = await readJson(join(root, 'apps/cli/package.json'));
assert.equal(packageManifest.publishConfig.name, 'mote-cli');
const notes = stableTagVersion(
  values.tag,
  packageManifest.version,
  await readFile(join(root, 'CHANGELOG.md'), 'utf8'),
);
const taggedSha = run('git', [
  'rev-parse',
  '--verify',
  '--end-of-options',
  `refs/tags/${values.tag}^{commit}`,
])
  .toString()
  .trim();
assertTaggedSha(source.sha, taggedSha);
const pnpmVersion = run(pnpm, ['--version']).toString().trim();
assert.equal(
  `pnpm@${pnpmVersion}`,
  (await readJson(join(root, 'package.json'))).packageManager,
  'Use the pinned pnpm version',
);

await mkdir(output, { recursive: false });
run(pnpm, ['--filter', '@mote/cli', 'build'], { stdio: 'inherit' });
run(pnpm, ['pack', '--pack-destination', output], {
  cwd: join(root, 'apps/cli'),
  stdio: 'inherit',
});
const tarballs = (await readdir(output)).filter((name) => name.endsWith('.tgz'));
assert.deepEqual(
  tarballs,
  [`mote-cli-${packageManifest.version}.tgz`],
  'Unexpected pnpm pack output',
);
const tarball = tarballs[0];
run(
  execPath,
  [join(root, 'apps/cli/scripts/test-package.mjs'), '--tarball', join(output, tarball)],
  { stdio: 'inherit' },
);
await writeFile(join(output, 'release-notes.md'), notes);
assert.deepEqual(await snapshot(), source, 'Source changed during release preparation');
const files = await fileInventory(output);
const manifest = {
  schemaVersion: 1,
  kind: 'cli-release',
  tag: values.tag,
  source,
  tools: { node: version, pnpm: pnpmVersion },
  lockfileSha256: sha256(await readFile(join(root, 'pnpm-lock.yaml'))),
  cli: {
    name: 'mote-cli',
    version: packageManifest.version,
    tarball,
    sha256: files[tarball].sha256,
    verified: true,
  },
  files,
};
await writeJson(join(output, 'release-manifest.json'), manifest);
await verifyReleaseArtifacts(output, {
  expectedSha: source.sha,
  tag: values.tag,
  allowLocal: values['allow-dirty'],
});
log(`Release artifacts verified: ${output}; manifest sha256=${sha256(json(manifest))}`);
