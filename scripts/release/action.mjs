import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';
import { log } from 'node:console';
import { contextFrom, isDigest, requireThat, safeCode } from '../deploy/policy.mjs';
import { npmPublisher, registryClient, releaseClient } from '../deploy/release-clients.mjs';
import { ensureNpm, ensureRelease, preflightRelease, releaseState } from '../deploy/release.mjs';
import { writeJson } from '../deploy/lib.mjs';
import { verifyReleaseArtifacts } from './artifacts.mjs';

const env = process.env;
let state;

async function main() {
  const command = process.argv[2];
  const context = contextFrom(env);
  requireThat(context.trigger === 'tag' && !context.writeEnabled, 'NOT_A_RELEASE');
  requireThat(['preflight', 'npm', 'github'].includes(command), 'INVALID_RELEASE_COMMAND');
  requireThat(
    env.MOTE_TARGET_SHA === context.workflowSha && isDigest(env.MOTE_MANIFEST_DIGEST),
    'RELEASE_ARTIFACT_MISMATCH',
  );
  const directory = env.MOTE_ARTIFACT_DIR ?? join(env.RUNNER_TEMP, 'mote-release');
  const manifest = await verifyReleaseArtifacts(directory, {
    expectedSha: env.MOTE_TARGET_SHA,
    tag: context.requestedRef,
    manifestDigest: env.MOTE_MANIFEST_DIGEST,
  });
  const tarball = join(directory, manifest.cli.tarball);
  const bytes = await readFile(tarball);
  const lookup = registryClient(manifest, bytes);
  const api = releaseClient(context.repository, env.GITHUB_TOKEN);
  const notes = await readFile(join(directory, 'release-notes.md'), 'utf8');
  const files = [
    { name: basename(tarball), bytes, type: 'application/octet-stream' },
    {
      name: 'release-manifest.json',
      bytes: await readFile(join(directory, 'release-manifest.json')),
      type: 'application/json',
    },
  ];
  await preflightRelease({
    context,
    manifest,
    manifestDigest: env.MOTE_MANIFEST_DIGEST,
    notes,
    files,
    api,
  });
  if (command === 'preflight') {
    await lookup();
    log('Release registry, tag and existing Release preflight passed; nothing was published.');
    return;
  }

  state = releaseState(context, null, manifest, env.MOTE_MANIFEST_DIGEST, null);
  const resultDir = join(env.RUNNER_TEMP, 'mote-release-result');
  await mkdir(resultDir, { recursive: true });
  const persist = async (value) => {
    value.runAttempt = context.runAttempt;
    value.updatedAt = new Date().toISOString();
    await writeJson(join(resultDir, 'release-result.json'), value);
  };
  const guard = () => api.assertTag(manifest.tag, manifest.source.sha);
  const scratch = await mkdtemp(join(env.RUNNER_TEMP, 'mote-release-'));
  try {
    if (command === 'npm') {
      await ensureNpm({
        state,
        lookup,
        persist,
        guard,
        publish: () => npmPublisher({ tarball, scratch, processEnv: env }),
      });
    } else {
      const found = await lookup();
      requireThat(found.present, 'NPM_NOT_VERIFIED');
      state.npm = { state: 'success', integrity: found.integrity };
      await ensureRelease({ state, persist, guard, api, notes, files });
    }
    if (env.GITHUB_STEP_SUMMARY)
      await appendFile(
        env.GITHUB_STEP_SUMMARY,
        `### Mote CLI release\n\nTag: ${state.tag}; SHA: ${state.targetSha}\n\nnpm: ${state.npm.state}; GitHub Release: ${state.release.state}\n`,
      );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

void main().catch(async (error) => {
  const code = safeCode(error);
  log(`Mote release stopped: ${code}`);
  if (env.RUNNER_TEMP) {
    const directory = join(env.RUNNER_TEMP, 'mote-release-result');
    await mkdir(directory, { recursive: true });
    await writeJson(join(directory, 'stage-failure.json'), { error: code, state: 'failed' });
    if (state) await writeJson(join(directory, 'release-result.json'), state);
  }
  if (env.GITHUB_STEP_SUMMARY)
    await appendFile(env.GITHUB_STEP_SUMMARY, `Mote CLI release failed: ${code}.\n`);
  process.exitCode = 1;
});
