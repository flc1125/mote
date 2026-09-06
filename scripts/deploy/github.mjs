import { boundedFetch, readRetry } from './smoke.mjs';
import { DeployError, requireThat } from './policy.mjs';

export function githubClient(repository, token, fetchImpl = globalThis.fetch) {
  requireThat(repository === 'flc1125/mote' && Boolean(token), 'MISSING_GITHUB_AUTH');
  return async (path, body) => {
    const request = async () => {
      const response = await boundedFetch(
        `https://api.github.com/repos/${repository}/${path}`,
        {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        fetchImpl,
        4 * 1024 * 1024,
      );
      requireThat(response.status >= 200 && response.status < 300, 'GITHUB_REQUEST_FAILED');
      try {
        return JSON.parse(response.text);
      } catch {
        throw new DeployError('GITHUB_INVALID_RESPONSE');
      }
    };
    // A failed checkpoint POST must stop the deployment, not be blindly repeated.
    return body === undefined ? readRetry(request) : request();
  };
}

export function ledger(client, context) {
  const query = `environment=${encodeURIComponent(context.environment)}&per_page=100`;
  return {
    async previous() {
      const rows = await client(`deployments?${query}&task=mote-deploy:${context.runId}`);
      requireThat(Array.isArray(rows), 'INVALID_LEDGER');
      return rows.sort((a, b) => b.id - a.id)[0]?.payload ?? null;
    },
    async rejectSuperseded() {
      const rows = await client(`deployments?${query}`);
      requireThat(Array.isArray(rows), 'INVALID_LEDGER');
      const latest = rows
        .sort((a, b) => b.id - a.id)
        .find((row) => row.task?.startsWith('mote-deploy:'));
      requireThat(latest?.payload?.runId === context.runId, 'SUPERSEDED_RUN');
    },
    async save(state) {
      const deployment = await client('deployments', {
        ref: state.targetSha,
        task: `mote-deploy:${context.runId}`,
        auto_merge: false,
        required_contexts: [],
        environment: context.environment,
        production_environment: context.environment === 'production',
        transient_environment: false,
        description: `Mote checkpoint ${state.state}`,
        payload: state,
      });
      requireThat(Number.isSafeInteger(deployment.id), 'INVALID_LEDGER_WRITE');
      const status =
        state.state === 'success'
          ? 'success'
          : ['failed', 'unknown'].includes(state.state)
            ? 'failure'
            : 'in_progress';
      await client(`deployments/${deployment.id}/statuses`, {
        state: status,
        auto_inactive: false,
        description: `Mote checkpoint: ${state.state}`,
        log_url: `https://github.com/${context.repository}/actions/runs/${context.runId}`,
      });
    },
  };
}
