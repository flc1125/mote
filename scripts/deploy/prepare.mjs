import assert from 'node:assert/strict';
import { log } from 'node:console';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { argv, execPath, version } from 'node:process';
import { parseArgs } from 'node:util';
import { verifyArtifacts } from './artifacts.mjs';
import {
  fileInventory,
  assertTaggedSha,
  json,
  pnpm,
  readJson,
  root,
  run,
  sha256,
  sourceConfig,
  stableTagVersion,
  targetFor,
  wranglerVersion,
  writeJson,
} from './lib.mjs';

const { values } = parseArgs({
  args: argv.slice(2),
  options: {
    environment: { type: 'string', default: 'production' },
    out: { type: 'string' },
    sha: { type: 'string' },
    tag: { type: 'string' },
    'allow-dirty': { type: 'boolean', default: false },
  },
});
const environment = values.environment;
targetFor(environment);
const output = resolve(values.out ?? join(root, 'dist/deployment', environment));

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
  'Use a clean checkout; --allow-dirty is for non-deployable local verification only',
);
const packageManifest = await readJson(join(root, 'apps/cli/package.json'));
assert.equal(packageManifest.publishConfig.name, 'mote-cli');
const notes =
  values.tag === undefined
    ? null
    : stableTagVersion(
        values.tag,
        packageManifest.version,
        await readFile(join(root, 'CHANGELOG.md'), 'utf8'),
      );
if (values.tag !== undefined) {
  const taggedSha = run('git', [
    'rev-parse',
    '--verify',
    '--end-of-options',
    `refs/tags/${values.tag}^{commit}`,
  ])
    .toString()
    .trim();
  assertTaggedSha(source.sha, taggedSha);
}
for (const component of ['api', 'viewer']) sourceConfig(component);
const pnpmVersion = run(pnpm, ['--version']).toString().trim();
assert.equal(
  `pnpm@${pnpmVersion}`,
  (await readJson(join(root, 'package.json'))).packageManager,
  'Use the pinned pnpm version',
);

// Never overwrite a previous artifact set or leave an old success manifest.
await mkdir(join(output, '..'), { recursive: true });
await mkdir(output);
run(pnpm, ['build'], { stdio: 'inherit' });
for (const component of ['api', 'viewer']) {
  await cp(join(root, `apps/${component}/dist/${environment}`), join(output, component), {
    recursive: true,
    errorOnExist: true,
  });
}
const packDir = join(output, 'cli');
await mkdir(packDir);
// Exactly one pack; the verifier, npm and Release all consume this same file.
run(pnpm, ['pack', '--pack-destination', packDir], {
  cwd: join(root, 'apps/cli'),
  stdio: 'inherit',
});
const tarballs = await readdir(packDir);
assert.deepEqual(
  tarballs,
  [`mote-cli-${packageManifest.version}.tgz`],
  'Unexpected pnpm pack output',
);
const tarball = `cli/${tarballs[0]}`;
run(
  execPath,
  [join(root, 'apps/cli/scripts/test-package.mjs'), '--tarball', join(output, tarball)],
  { stdio: 'inherit' },
);
if (notes !== null) await writeFile(join(output, 'release-notes.md'), notes);
assert.deepEqual(await snapshot(), source, 'Source changed during artifact preparation');
const sourceConfigs = {};
for (const component of ['api', 'viewer'])
  sourceConfigs[component] = sha256(await readFile(join(root, `apps/${component}/wrangler.toml`)));
const files = await fileInventory(output);
const manifest = {
  schemaVersion: 1,
  environment,
  tag: values.tag ?? null,
  source,
  tools: { node: version, pnpm: pnpmVersion, wrangler: wranglerVersion },
  lockfileSha256: sha256(await readFile(join(root, 'pnpm-lock.yaml'))),
  targetsSha256: sha256(await readFile(join(root, 'scripts/deploy/targets.json'))),
  sourceConfigs,
  cli: {
    name: 'mote-cli',
    version: packageManifest.version,
    tarball,
    sha256: files[tarball].sha256,
    verified: true,
  },
  files,
};
await writeJson(join(output, 'build-manifest.json'), manifest);
await verifyArtifacts(output, {
  expectedSha: source.sha,
  environment,
  allowLocal: values['allow-dirty'],
});
log(
  `Artifacts verified: ${output}; manifest sha256=${sha256(json(manifest))}; sourceClean=${source.clean}`,
);
