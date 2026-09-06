import { targetFor, targets } from './lib.mjs';

export class DeployError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function requireThat(condition, code) {
  if (!condition) throw new DeployError(code);
}
export const isSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export const isDigest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const isVersion = (value) =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const stableTag = (value) =>
  typeof value === 'string' && /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);

export function validateRef(ref) {
  requireThat(ref === 'main' || isSha(ref) || stableTag(ref), 'INVALID_REF');
  return ref === 'main' ? 'refs/remotes/origin/main' : stableTag(ref) ? `refs/tags/${ref}` : ref;
}

export function assertMainAncestor(sha, git) {
  requireThat(isSha(sha), 'INVALID_TARGET_SHA');
  try {
    git(['merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main']);
  } catch {
    throw new DeployError('TARGET_NOT_ON_MAIN');
  }
}

export function resolveTarget(context, previous, git) {
  assertMainAncestor(context.workflowSha, git);
  let sha;
  if (context.runAttempt > 1) {
    validatePrevious(previous, context);
    sha = previous.targetSha;
  } else {
    const ref = validateRef(context.requestedRef);
    try {
      sha = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
    } catch {
      throw new DeployError('REF_NOT_FOUND');
    }
  }
  assertMainAncestor(sha, git);
  return sha;
}

export function contextFrom(env) {
  requireThat(
    env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'flc1125/mote',
    'UNTRUSTED_RUN',
  );
  requireThat(isSha(env.GITHUB_WORKFLOW_SHA), 'INVALID_WORKFLOW_SHA');
  const prefix = `${env.GITHUB_REPOSITORY}/.github/workflows/`;
  const manual =
    env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_REF === 'refs/heads/main' &&
    env.GITHUB_WORKFLOW_REF === `${prefix}deploy.yml@refs/heads/main`;
  const tag = env.GITHUB_REF?.replace(/^refs\/tags\//, '');
  const release =
    env.GITHUB_EVENT_NAME === 'push' &&
    env.GITHUB_REF === `refs/tags/${tag}` &&
    stableTag(tag) &&
    env.GITHUB_WORKFLOW_REF === `${prefix}release.yml@refs/tags/${tag}`;
  requireThat(manual || release, 'UNTRUSTED_WORKFLOW_REF');
  requireThat(
    /^\d+$/.test(env.GITHUB_RUN_ID ?? '') && /^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT ?? ''),
    'INVALID_RUN_ID',
  );
  targetFor(env.MOTE_ENVIRONMENT);
  requireThat(['true', 'false'].includes(env.MOTE_WRITE_SMOKE), 'INVALID_WRITE_INPUT');
  validateRef(env.MOTE_REF);
  requireThat(
    !release || (env.MOTE_ENVIRONMENT === 'production' && env.MOTE_REF === tag),
    'INVALID_RELEASE_TARGET',
  );
  return {
    repository: env.GITHUB_REPOSITORY,
    environment: env.MOTE_ENVIRONMENT,
    requestedRef: env.MOTE_REF,
    workflowSha: env.GITHUB_WORKFLOW_SHA,
    runId: env.GITHUB_RUN_ID,
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    trigger: manual ? 'workflow_dispatch' : 'tag',
    writeEnabled: env.MOTE_WRITE_SMOKE === 'true',
  };
}

export function validatePrevious(previous, context) {
  requireThat(previous?.schemaVersion === 1, 'MISSING_CHECKPOINT');
  for (const key of [
    'repository',
    'environment',
    'requestedRef',
    'workflowSha',
    'runId',
    'trigger',
    'writeEnabled',
  ]) {
    requireThat(previous[key] === context[key], 'CHECKPOINT_IDENTITY_MISMATCH');
  }
  requireThat(isSha(previous.targetSha) && isDigest(previous.manifestDigest), 'INVALID_CHECKPOINT');
}

export function deployPreflight(env, context) {
  requireThat(env.MOTE_DEPLOY_ENABLED === 'true', 'ENVIRONMENT_NOT_ENABLED');
  requireThat(env.CLOUDFLARE_ACCOUNT_ID === targets.accountId, 'ACCOUNT_MISMATCH');
  requireThat(Boolean(env.CLOUDFLARE_API_TOKEN), 'MISSING_DEPLOY_TOKEN');
  requireThat(
    !context.writeEnabled ||
      (env.MOTE_HAS_SERVICE_ID === 'true' && env.MOTE_HAS_SERVICE_SECRET === 'true'),
    'MISSING_SERVICE_CREDENTIALS',
  );
}

export const safeCode = (error) => (error instanceof DeployError ? error.code : 'INTERNAL_ERROR');
