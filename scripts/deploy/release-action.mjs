import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';
import { log } from 'node:console';
import { verifyArtifacts } from './artifacts.mjs';
import { githubClient, ledger } from './github.mjs';
import { contextFrom, isDigest, requireThat, safeCode } from './policy.mjs';
import { writeJson } from './lib.mjs';
import {
  ensureNpm,
  ensureRelease,
  preflightRelease,
  releaseReady,
  releaseState,
} from './release.mjs';
import { npmPublisher, registryClient, releaseClient } from './release-clients.mjs';

const env = process.env;
let state;
async function main() {
  const context = contextFrom(env);
  requireThat(context.trigger === 'tag' && !context.writeEnabled, 'NOT_A_RELEASE');
  requireThat(['preflight', 'npm', 'github'].includes(process.argv[2]), 'INVALID_RELEASE_COMMAND');
  requireThat(
    env.MOTE_TARGET_SHA === context.workflowSha && isDigest(env.MOTE_MANIFEST_DIGEST),
    'RELEASE_ARTIFACT_MISMATCH',
  );
  const directory = env.MOTE_ARTIFACT_DIR ?? join(env.RUNNER_TEMP, 'mote-prepared');
  const manifest = await verifyArtifacts(directory, {
    expectedSha: env.MOTE_TARGET_SHA,
    environment: 'production',
    manifestDigest: env.MOTE_MANIFEST_DIGEST,
  });
  requireThat(manifest.tag === context.requestedRef, 'ARTIFACT_TAG_MISMATCH');
  const tarball = join(directory, manifest.cli.tarball);
  const bytes = await readFile(tarball);
  const lookup = registryClient(manifest, bytes);
  const api = releaseClient(context.repository, env.GITHUB_TOKEN);
  const notes = await readFile(join(directory, 'release-notes.md'), 'utf8');
  const files = [
    { name: basename(tarball), bytes, type: 'application/octet-stream' },
    {
      name: 'build-manifest.json',
      bytes: await readFile(join(directory, 'build-manifest.json')),
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
  if (process.argv[2] === 'preflight') {
    await lookup(); // Reject version conflicts before any production mutation.
    log('Release registry and tag preflight passed; nothing was published.');
    return;
  }
  const github = githubClient(context.repository, env.GITHUB_TOKEN);
  const deployments = ledger(github, context);
  const history = ledger(github, context, 'mote-release');
  const guard = async () => {
    await deployments.rejectSuperseded();
    const deployment = await deployments.previous();
    releaseReady(deployment, context, env.MOTE_MANIFEST_DIGEST, manifest.source.sha);
    await api.assertTag(manifest.tag, manifest.source.sha);
    return deployment;
  };
  const deployment = await guard();
  state = releaseState(
    context,
    deployment,
    manifest,
    env.MOTE_MANIFEST_DIGEST,
    await history.previous(),
  );
  const resultDir = join(env.RUNNER_TEMP, 'mote-release-result');
  await mkdir(resultDir, { recursive: true });
  const persist = async (value) => {
    value.runAttempt = context.runAttempt;
    value.updatedAt = new Date().toISOString();
    await writeJson(join(resultDir, 'release-result.json'), value);
    await history.save(value);
  };
  const scratch = await mkdtemp(join(env.RUNNER_TEMP, 'mote-release-'));
  try {
    if (process.argv[2] === 'npm') {
      await ensureNpm({
        state,
        lookup,
        persist,
        guard,
        publish: () => npmPublisher({ tarball, scratch, processEnv: env }),
      });
    } else {
      requireThat(state.npm.state === 'success' && (await lookup()).present, 'NPM_NOT_VERIFIED');
      await ensureRelease({
        state,
        persist,
        guard,
        api,
        notes,
        files,
      });
    }
    if (env.GITHUB_STEP_SUMMARY)
      await appendFile(
        env.GITHUB_STEP_SUMMARY,
        `### Mote release\n\nTag: ${state.tag}; SHA: ${state.targetSha}\n\nnpm: ${state.npm.state}; GitHub Release: ${state.release.state}\n\nSee the sanitized release-result artifact and deployment checkpoint.\n`,
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
    await appendFile(
      env.GITHUB_STEP_SUMMARY,
      `Mote release failed: ${code}. Server versions are not automatically rolled back.\n`,
    );
  process.exitCode = 1;
});
