import { isVersion, requireThat, safeCode, validatePrevious } from './policy.mjs';

export function initialState(context, targetSha, manifestDigest, baseline) {
  return {
    schemaVersion: 1,
    ...context,
    targetSha,
    manifestDigest,
    state: 'in_progress',
    error: null,
    components: Object.fromEntries(
      ['viewer', 'api'].map((component) => {
        requireThat(isVersion(baseline[component].version), 'INVALID_BASELINE');
        return [
          component,
          {
            beforeVersion: baseline[component].version,
            afterVersion: null,
            observedVersion: null,
            state: 'pending',
          },
        ];
      }),
    ),
    smoke: { read: 'pending', checks: [], write: context.writeEnabled ? 'pending' : 'skipped' },
  };
}

// All side effects are injected. An attempted operation is persisted BEFORE
// calling Cloudflare; a lost response is reconciled, never blindly retried.
export async function deployPair({
  context,
  targetSha,
  manifestDigest,
  previous,
  snapshot,
  upload,
  smoke,
  persist,
}) {
  const baseline = await snapshot();
  let state;
  if (previous) {
    validatePrevious(previous, context);
    requireThat(
      previous.targetSha === targetSha && previous.manifestDigest === manifestDigest,
      'ARTIFACT_CHANGED_ON_RETRY',
    );
    state = globalThis.structuredClone(previous);
    state.runAttempt = context.runAttempt;
    for (const component of ['viewer', 'api']) {
      const entry = state.components[component];
      const current = baseline[component];
      // A version marker proves code activation, not completion of routes/settings.
      // Unknown attempts need operator investigation; never promote or replay them.
      requireThat(entry.state !== 'unknown', 'UNRESOLVED_UPLOAD');
      requireThat(current.version === (entry.afterVersion ?? entry.beforeVersion), 'STALE_RETRY');
    }
  } else {
    requireThat(context.runAttempt === 1, 'MISSING_CHECKPOINT');
    state = initialState(context, targetSha, manifestDigest, baseline);
  }
  state.state = 'in_progress';
  state.error = null;
  await persist(state);
  try {
    for (const component of ['viewer', 'api']) {
      const entry = state.components[component];
      if (entry.state === 'success') continue;
      const current = await snapshot();
      for (const name of ['viewer', 'api']) {
        requireThat(
          current[name].version ===
            (state.components[name].afterVersion ?? state.components[name].beforeVersion),
          'EXTERNAL_DEPLOYMENT_DRIFT',
        );
      }
      entry.state = 'unknown';
      await persist(state);
      const outcome = await upload(component, markerFor(state));
      requireThat(
        ['success', 'failed', 'unknown'].includes(outcome.state),
        'INVALID_UPLOAD_RESULT',
      );
      if (outcome.state === 'success') {
        requireThat(isVersion(outcome.version), 'INVALID_VERSION');
        entry.afterVersion = outcome.version;
      }
      entry.state = outcome.state;
      if (isVersion(outcome.observedVersion)) entry.observedVersion = outcome.observedVersion;
      await persist(state);
      requireThat(
        outcome.state === 'success',
        outcome.state === 'failed' ? 'UPLOAD_FAILED' : 'UPLOAD_UNKNOWN',
      );
    }
    const current = await snapshot();
    for (const component of ['viewer', 'api'])
      requireThat(
        current[component].version === state.components[component].afterVersion,
        'EXTERNAL_DEPLOYMENT_DRIFT',
      );
    state.smoke.read = 'pending';
    await persist(state);
    state.smoke.checks = await smoke();
    state.smoke.read = 'success';
    state.state =
      context.writeEnabled && state.smoke.write !== 'success' ? 'in_progress' : 'success';
    await persist(state);
    return state;
  } catch (error) {
    state.error = safeCode(error);
    state.state = Object.values(state.components).some((entry) => entry.state === 'unknown')
      ? 'unknown'
      : 'failed';
    if (
      state.smoke.read === 'pending' &&
      Object.values(state.components).every((entry) => entry.state === 'success')
    )
      state.smoke.read = 'failed';
    if (error.checks) state.smoke.checks = error.checks;
    await persist(state);
    throw error;
  }
}

export const markerFor = (state) => `mote:${state.runId}:${state.targetSha}`;

export async function writeOnce({ state, publish, persist }) {
  requireThat(state.writeEnabled && state.smoke.read === 'success', 'WRITE_NOT_READY');
  if (state.smoke.write === 'success') return state;
  requireThat(state.smoke.write === 'pending', 'WRITE_OUTCOME_UNKNOWN_NO_RETRY');
  state.smoke.write = 'unknown';
  await persist(state);
  try {
    await publish();
    state.smoke.write = 'success';
    state.state = 'success';
    state.error = null;
    await persist(state);
    return state;
  } catch (error) {
    state.state = 'unknown';
    state.error = safeCode(error);
    await persist(state);
    throw error;
  }
}
