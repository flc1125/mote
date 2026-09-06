import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { argv, env, execPath } from 'node:process';
import process from 'node:process';
import { log } from 'node:console';
import { verifyArtifacts } from './artifacts.mjs';
import { cloudflareClient } from './cloudflare.mjs';
import { deployPair, writeOnce } from './engine.mjs';
import { githubClient, ledger } from './github.mjs';
import {
  contextFrom,
  assertMainAncestor,
  deployPreflight,
  isDigest,
  isSha,
  requireThat,
  safeCode,
  stableTag,
  resolveTarget,
  validatePrevious,
} from './policy.mjs';
import { pnpm, root, run, sha256, sourceConfig, writeJson } from './lib.mjs';
import { readSmoke, sampleFrom } from './smoke.mjs';
import { publishSmoke } from './write-smoke.mjs';

async function output(name, value) {
  await appendFile(env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
const git = (args, cwd = root) => run('git', args, { cwd }).toString().trim();
let lastState;

async function main() {
  const context = contextFrom(env);
  const command = argv[2];
  const store = () => ledger(githubClient(context.repository, env.GITHUB_TOKEN), context);
  if (command === 'resolve') {
    let previous;
    if (context.runAttempt > 1) {
      const history = store();
      previous = await history.previous();
      validatePrevious(previous, context);
      await history.rejectSuperseded();
    }
    const sha = resolveTarget(context, previous, git);
    await output('target_sha', sha);
    await output('resume', previous ? 'true' : 'false');
    await output('manifest_digest', previous?.manifestDigest ?? '');
    return;
  }
  const targetSha = env.MOTE_TARGET_SHA;
  requireThat(isSha(targetSha), 'INVALID_TARGET_SHA');
  if (command === 'prepare-target') {
    const target = resolve(env.MOTE_SOURCE_DIR);
    requireThat(git(['rev-parse', 'HEAD'], target) === targetSha, 'CHECKOUT_MISMATCH');
    assertMainAncestor(targetSha, git);
    for (const component of ['api', 'viewer']) sourceConfig(component, target);
    // The target tree runs only in this unprivileged job; no deployment or
    // Service Token secrets are supplied to install, tests, or build scripts.
    for (const args of [
      ['install', '--frozen-lockfile'],
      ['lint'],
      ['typecheck'],
      ['test'],
      ['format:check'],
    ])
      run(pnpm, args, { cwd: target, stdio: 'inherit' });
    const directory = resolve(env.MOTE_ARTIFACT_DIR);
    const args = [
      join(target, 'scripts/deploy/prepare.mjs'),
      '--environment',
      context.environment,
      '--sha',
      targetSha,
      '--out',
      directory,
    ];
    if (stableTag(context.requestedRef)) args.push('--tag', context.requestedRef);
    run(execPath, args, { cwd: target, stdio: 'inherit' });
    await output('manifest_digest', sha256(await readFile(join(directory, 'build-manifest.json'))));
    return;
  }
  requireThat(['deploy', 'install-cli', 'write'].includes(command), 'INVALID_COMMAND');
  const directory = resolve(env.MOTE_ARTIFACT_DIR ?? join(env.RUNNER_TEMP, 'mote-prepared'));
  requireThat(isDigest(env.MOTE_MANIFEST_DIGEST), 'MISSING_MANIFEST_DIGEST');
  const manifest = await verifyArtifacts(directory, {
    expectedSha: targetSha,
    environment: context.environment,
    manifestDigest: env.MOTE_MANIFEST_DIGEST,
  });
  requireThat(
    manifest.tag === (stableTag(context.requestedRef) ? context.requestedRef : null),
    'ARTIFACT_TAG_MISMATCH',
  );
  if (command === 'install-cli') {
    requireThat(context.writeEnabled, 'WRITE_DISABLED');
    run(
      'npm',
      [
        'install',
        '--prefix',
        join(env.RUNNER_TEMP, 'mote-smoke-cli'),
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        join(directory, manifest.cli.tarball),
      ],
      { timeout: 180000 },
    );
    return;
  }
  requireThat(env.MOTE_DEPLOY_ENABLED === 'true', 'ENVIRONMENT_NOT_ENABLED');
  const history = store();
  const previous = await history.previous();
  if (previous) lastState = previous;
  if (context.runAttempt > 1 || command === 'write') {
    validatePrevious(previous, context);
    await history.rejectSuperseded();
  }
  const resultDir = join(env.RUNNER_TEMP, 'mote-deployment-result');
  await mkdir(resultDir, { recursive: true });
  const persist = async (state) => {
    state.updatedAt = new Date().toISOString();
    state.runAttempt = context.runAttempt;
    lastState = state;
    await writeJson(join(resultDir, 'deployment-result.json'), state);
    await history.save(state);
  };
  const scratch = await mkdtemp(join(env.RUNNER_TEMP, 'mote-deploy-'));
  try {
    if (command === 'deploy') {
      deployPreflight(env, context);
      const sample = sampleFrom(env);
      const cloud = await cloudflareClient({
        environment: context.environment,
        directory,
        scratch,
        token: env.CLOUDFLARE_API_TOKEN,
        processEnv: env,
      });
      await deployPair({
        context,
        targetSha,
        manifestDigest: env.MOTE_MANIFEST_DIGEST,
        previous,
        snapshot: cloud.snapshot,
        upload: cloud.upload,
        smoke: () => readSmoke(context.environment, sample),
        persist,
      });
    } else {
      requireThat(
        previous.targetSha === targetSha && previous.manifestDigest === env.MOTE_MANIFEST_DIGEST,
        'ARTIFACT_CHANGED_ON_RETRY',
      );
      requireThat(
        Boolean(env.MOTE_SERVICE_CLIENT_ID) && Boolean(env.MOTE_SERVICE_CLIENT_SECRET),
        'MISSING_SERVICE_CREDENTIALS',
      );
      await writeOnce({
        state: previous,
        persist,
        publish: () =>
          publishSmoke({
            context,
            scratch,
            cliPath: join(env.RUNNER_TEMP, 'mote-smoke-cli/node_modules/mote-cli/dist/cli.js'),
            serviceId: env.MOTE_SERVICE_CLIENT_ID,
            serviceSecret: env.MOTE_SERVICE_CLIENT_SECRET,
            processEnv: env,
          }),
      });
    }
    log('Mote deployment stage succeeded; see the sanitized checkpoint artifact.');
  } finally {
    if (env.GITHUB_STEP_SUMMARY && lastState)
      await appendFile(env.GITHUB_STEP_SUMMARY, summary(lastState));
    await rm(scratch, { recursive: true, force: true });
  }
}

function summary(state) {
  return [
    '### Mote deployment checkpoint',
    '',
    `SHA: ${state.targetSha}; environment: ${state.environment}; state: ${state.state}.`,
    '',
    '| Component | State | Before | Confirmed after | Observed after uncertain command |',
    '| --- | --- | --- | --- | --- |',
    ...['viewer', 'api'].map((name) => {
      const entry = state.components[name];
      return `| ${name} | ${entry.state} | ${entry.beforeVersion} | ${entry.afterVersion ?? '—'} | ${entry.observedVersion ?? '—'} |`;
    }),
    '',
    `Read smoke: ${state.smoke.read}; write smoke: ${state.smoke.write}.`,
    '',
  ].join('\n');
}

// Never print raw subprocess errors, HTTP bodies, or CLI output.
void main().catch(async (error) => {
  const code = safeCode(error);
  log(`Mote deployment stopped: ${code}`);
  if (env.RUNNER_TEMP && ['deploy', 'write'].includes(argv[2])) {
    const directory = join(env.RUNNER_TEMP, 'mote-deployment-result');
    await mkdir(directory, { recursive: true });
    await writeJson(join(directory, 'stage-failure.json'), {
      stage: argv[2],
      state: 'failed',
      error: code,
      checkpointAvailable: Boolean(lastState),
    });
    if (lastState) await writeJson(join(directory, 'deployment-result.json'), lastState);
  }
  if (env.GITHUB_STEP_SUMMARY)
    await appendFile(
      env.GITHUB_STEP_SUMMARY,
      `Mote stage failed: ${code}. Inspect the last checkpoint before retrying.\n`,
    );
  process.exitCode = 1;
});
