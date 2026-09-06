import { describe, expect, it, vi } from 'vitest';
import { deployPair, initialState, markerFor, writeOnce } from './engine.mjs';
import {
  contextFrom,
  deployPreflight,
  DeployError,
  resolveTarget,
  safeCode,
  validateRef,
} from './policy.mjs';
import { targets } from './lib.mjs';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const version = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const environment = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'flc1125/mote',
  GITHUB_WORKFLOW_SHA: 'c'.repeat(40),
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_WORKFLOW_REF: 'flc1125/mote/.github/workflows/deploy.yml@refs/heads/main',
  GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '1',
  MOTE_ENVIRONMENT: 'access-test',
  MOTE_REF: 'main',
  MOTE_WRITE_SMOKE: 'false',
};
const context = contextFrom(environment);
const baseline = () => ({ viewer: { version: version(1) }, api: { version: version(2) } });
const checkpoint = () => initialState(context, sha, digest, baseline());

function scenario(options = {}) {
  const current = baseline();
  const saved = [];
  const upload = vi.fn(async (component, marker) => {
    const next = version(component === 'viewer' ? 3 : 4);
    current[component] = { version: next, marker };
    return { state: 'success', version: next };
  });
  const args = {
    context,
    targetSha: sha,
    manifestDigest: digest,
    snapshot: vi.fn(async () => globalThis.structuredClone(current)),
    upload,
    smoke: vi.fn(async () => [{ name: 'fake-health', state: 'success' }]),
    persist: vi.fn(async (state) => saved.push(globalThis.structuredClone(state))),
    ...options,
  };
  return { args, current, saved, run: () => deployPair(args) };
}

describe('trusted deployment input', () => {
  it.each(['main', 'v1.2.3', sha])('accepts %s', (ref) => expect(validateRef(ref)).toBeTruthy());
  it.each([
    'feature/x',
    'HEAD',
    'v1.2.3-beta.1',
    'v01.2.3',
    '--help',
    'main~1',
    '$(id)',
    'a'.repeat(7),
  ])('rejects %s', (ref) => expect(() => validateRef(ref)).toThrow('INVALID_REF'));
  it.each([
    ['GITHUB_REPOSITORY', 'fork/mote'],
    ['GITHUB_EVENT_NAME', 'pull_request'],
    ['GITHUB_REF', 'refs/heads/feature'],
    ['GITHUB_WORKFLOW_REF', 'flc1125/mote/.github/workflows/other.yml@refs/heads/main'],
    ['GITHUB_WORKFLOW_SHA', 'short'],
    ['MOTE_ENVIRONMENT', 'access-oauth-probe'],
    ['MOTE_WRITE_SMOKE', 'yes'],
  ])('rejects untrusted %s', (key, value) => {
    expect(() => contextFrom({ ...environment, [key]: value })).toThrow();
  });
  it('resolves one namespaced commit and checks both workflow and target ancestry', () => {
    const git = vi.fn(() => sha);
    expect(resolveTarget(context, null, git)).toBe(sha);
    expect(git.mock.calls).toEqual([
      [['merge-base', '--is-ancestor', context.workflowSha, 'refs/remotes/origin/main']],
      [['rev-parse', '--verify', '--end-of-options', 'refs/remotes/origin/main^{commit}']],
      [['merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main']],
    ]);
  });
  it('rejects a valid SHA that is not on main', () => {
    const git = vi.fn((args) => {
      if (args[0] === 'merge-base' && args[2] === sha) throw new Error('not merged');
      return sha;
    });
    expect(() => resolveTarget(context, null, git)).toThrow('TARGET_NOT_ON_MAIN');
  });
  it('reuses the checkpoint SHA instead of a moved main', () => {
    const git = vi.fn(() => 'd'.repeat(40));
    expect(resolveTarget({ ...context, runAttempt: 2 }, checkpoint(), git)).toBe(sha);
    expect(git.mock.calls.every(([args]) => args[0] === 'merge-base')).toBe(true);
  });
  it('fails closed when rerun has no checkpoint', () => {
    expect(() => resolveTarget({ ...context, runAttempt: 2 }, null, vi.fn())).toThrow(
      'MISSING_CHECKPOINT',
    );
  });
  it.each([
    [{}, 'ENVIRONMENT_NOT_ENABLED'],
    [{ MOTE_DEPLOY_ENABLED: 'true' }, 'ACCOUNT_MISMATCH'],
    [
      { MOTE_DEPLOY_ENABLED: 'true', CLOUDFLARE_ACCOUNT_ID: targets.accountId },
      'MISSING_DEPLOY_TOKEN',
    ],
  ])('fails preflight before any deploy', (env, error) => {
    expect(() => deployPreflight(env, context)).toThrow(error);
  });
  it('requires the service credential pair only for explicit write smoke', () => {
    const env = {
      MOTE_DEPLOY_ENABLED: 'true',
      CLOUDFLARE_ACCOUNT_ID: targets.accountId,
      CLOUDFLARE_API_TOKEN: 'fake',
    };
    expect(() => deployPreflight(env, context)).not.toThrow();
    expect(() => deployPreflight(env, { ...context, writeEnabled: true })).toThrow(
      'MISSING_SERVICE_CREDENTIALS',
    );
  });
  it('never exposes raw errors or capability URLs', () => {
    expect(safeCode(new Error('secret https://private.test/document'))).toBe('INTERNAL_ERROR');
  });
});

describe('deployment checkpoints and recovery', () => {
  it('saves baseline, deploys Viewer then API, and smokes only after both succeed', async () => {
    const s = scenario();
    const result = await s.run();
    expect(s.args.upload.mock.calls.map(([component]) => component)).toEqual(['viewer', 'api']);
    expect(s.saved[0].components.viewer.beforeVersion).toBe(version(1));
    expect(s.saved[1].components.viewer.state).toBe('unknown');
    expect(result.components.api.afterVersion).toBe(version(4));
    expect(result.smoke).toMatchObject({ read: 'success', write: 'skipped' });
    expect(result.state).toBe('success');
  });
  it.each(['viewer', 'api'])('preserves partial progress after %s failure', async (failed) => {
    const s = scenario();
    const upload = s.args.upload;
    s.args.upload = vi.fn((component, marker) =>
      component === failed ? { state: 'failed' } : upload(component, marker),
    );
    await expect(s.run()).rejects.toThrow('UPLOAD_FAILED');
    const last = s.saved.at(-1);
    expect(last.state).toBe('failed');
    expect(last.components[failed].state).toBe('failed');
    expect(last.components.viewer.state).toBe(failed === 'api' ? 'success' : 'failed');
    expect(s.args.smoke).not.toHaveBeenCalled();
  });
  it('does not declare overall success when online smoke fails', async () => {
    const s = scenario({
      smoke: vi.fn(async () => {
        throw new DeployError('SMOKE_ASSET');
      }),
    });
    await expect(s.run()).rejects.toThrow('SMOKE_ASSET');
    expect(s.saved.at(-1)).toMatchObject({
      state: 'failed',
      smoke: { read: 'failed' },
      components: { api: { state: 'success' } },
    });
    expect(s.args.upload).toHaveBeenCalledTimes(2); // no automatic rollback
  });
  it('does not upload if the first checkpoint cannot be saved', async () => {
    const s = scenario({
      persist: vi.fn(async () => {
        throw new DeployError('GITHUB_REQUEST_FAILED');
      }),
    });
    await expect(s.run()).rejects.toThrow('GITHUB_REQUEST_FAILED');
    expect(s.args.upload).not.toHaveBeenCalled();
  });
  it('does not upload if the pre-upload intent checkpoint fails', async () => {
    const s = scenario();
    s.args.persist
      .mockImplementationOnce(async () => {})
      .mockRejectedValue(new DeployError('GITHUB_REQUEST_FAILED'));
    await expect(s.run()).rejects.toThrow('GITHUB_REQUEST_FAILED');
    expect(s.args.upload).not.toHaveBeenCalled();
  });
  it('records uncertain activation and blocks retry even when the marker matches', async () => {
    const s = scenario({
      upload: vi.fn(async () => ({ state: 'unknown', observedVersion: version(3) })),
    });
    await expect(s.run()).rejects.toThrow('UPLOAD_UNKNOWN');
    const previous = s.saved.at(-1);
    expect(previous).toMatchObject({
      state: 'unknown',
      components: { viewer: { observedVersion: version(3), afterVersion: null } },
    });
    const retry = scenario({ previous, context: { ...context, runAttempt: 2 } });
    retry.current.viewer = { version: version(3), marker: markerFor(previous) };
    await expect(retry.run()).rejects.toThrow('UNRESOLVED_UPLOAD');
    expect(retry.args.upload).not.toHaveBeenCalled();
  });
  it('resumes only unfinished components with the original artifact', async () => {
    const previous = checkpoint();
    previous.components.viewer = {
      ...previous.components.viewer,
      state: 'success',
      afterVersion: version(3),
    };
    const s = scenario({ previous, context: { ...context, runAttempt: 2 } });
    s.current.viewer.version = version(3);
    await s.run();
    expect(s.args.upload.mock.calls.map(([name]) => name)).toEqual(['api']);
  });
  it('rejects changed artifacts on retry', async () => {
    const s = scenario({ previous: checkpoint(), manifestDigest: 'e'.repeat(64) });
    await expect(s.run()).rejects.toThrow('ARTIFACT_CHANGED_ON_RETRY');
    expect(s.args.upload).not.toHaveBeenCalled();
  });
  it('rejects external version drift before upload', async () => {
    const s = scenario();
    s.args.snapshot.mockResolvedValueOnce(baseline());
    s.current.api.version = version(9);
    await expect(s.run()).rejects.toThrow('EXTERNAL_DEPLOYMENT_DRIFT');
    expect(s.args.upload).not.toHaveBeenCalled();
  });
  it('rejects a stale checkpoint after a newer deployment', async () => {
    const s = scenario({ previous: checkpoint(), context: { ...context, runAttempt: 2 } });
    s.current.api.version = version(9);
    await expect(s.run()).rejects.toThrow('STALE_RETRY');
    expect(s.args.upload).not.toHaveBeenCalled();
  });
  it('does not repeat successful uploads on a completed run', async () => {
    const s = scenario();
    s.args.previous = await s.run();
    s.args.context = { ...context, runAttempt: 2 };
    s.args.upload.mockClear();
    await s.run();
    expect(s.args.upload).not.toHaveBeenCalled();
  });
});

describe('explicit one-shot write smoke', () => {
  const ready = () => {
    const state = initialState({ ...context, writeEnabled: true }, sha, digest, baseline());
    state.smoke.read = 'success';
    return state;
  };
  it('persists unknown before publishing, then never repeats successful writes', async () => {
    const state = ready();
    const publish = vi.fn(async () => expect(state.smoke.write).toBe('unknown'));
    const persist = vi.fn(async () => {});
    await writeOnce({ state, publish, persist });
    await writeOnce({ state, publish, persist });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(state.state).toBe('success');
  });
  it('does not repeat an uncertain POST', async () => {
    const state = ready();
    const publish = vi.fn(async () => {
      throw new DeployError('WRITE_OUTCOME_UNKNOWN');
    });
    const persist = vi.fn(async () => {});
    await expect(writeOnce({ state, publish, persist })).rejects.toThrow('WRITE_OUTCOME_UNKNOWN');
    await expect(writeOnce({ state, publish, persist })).rejects.toThrow(
      'WRITE_OUTCOME_UNKNOWN_NO_RETRY',
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(state.state).toBe('unknown');
  });
  it('does not publish without a durable intent checkpoint', async () => {
    const publish = vi.fn();
    await expect(
      writeOnce({
        state: ready(),
        publish,
        persist: async () => {
          throw new DeployError('GITHUB_REQUEST_FAILED');
        },
      }),
    ).rejects.toThrow('GITHUB_REQUEST_FAILED');
    expect(publish).not.toHaveBeenCalled();
  });
});
