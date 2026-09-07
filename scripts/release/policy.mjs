export class ReleaseError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function requireThat(condition, code) {
  if (!condition) throw new ReleaseError(code);
}

export const isSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export const isDigest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const stableTag = (value) =>
  typeof value === 'string' && /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);

export function contextFrom(env) {
  requireThat(
    env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'flc1125/mote',
    'UNTRUSTED_RUN',
  );
  requireThat(isSha(env.GITHUB_WORKFLOW_SHA), 'INVALID_WORKFLOW_SHA');
  const tag = env.GITHUB_REF?.replace(/^refs\/tags\//, '');
  requireThat(
    env.GITHUB_EVENT_NAME === 'push' &&
      env.GITHUB_REF === `refs/tags/${tag}` &&
      stableTag(tag) &&
      env.GITHUB_WORKFLOW_REF ===
        `${env.GITHUB_REPOSITORY}/.github/workflows/release.yml@refs/tags/${tag}`,
    'UNTRUSTED_WORKFLOW_REF',
  );
  requireThat(
    /^\d+$/.test(env.GITHUB_RUN_ID ?? '') && /^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT ?? ''),
    'INVALID_RUN_ID',
  );
  return {
    repository: env.GITHUB_REPOSITORY,
    requestedRef: tag,
    workflowSha: env.GITHUB_WORKFLOW_SHA,
    runId: env.GITHUB_RUN_ID,
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    trigger: 'tag',
  };
}

export const safeCode = (error) => (error instanceof ReleaseError ? error.code : 'INTERNAL_ERROR');
