import { json, sha256 } from './lib.mjs';
import { isVersion, requireThat, safeCode, validatePrevious } from './policy.mjs';

export function releaseReady(deployment, context, manifestDigest, targetSha) {
  validatePrevious(deployment, context);
  requireThat(context.trigger === 'tag' && context.environment === 'production', 'NOT_A_RELEASE');
  requireThat(deployment.runAttempt === context.runAttempt, 'RERUN_ALL_JOBS_REQUIRED');
  requireThat(
    deployment.targetSha === targetSha && deployment.manifestDigest === manifestDigest,
    'RELEASE_ARTIFACT_MISMATCH',
  );
  requireThat(
    deployment.state === 'success' &&
      deployment.smoke.read === 'success' &&
      ['success', 'skipped'].includes(deployment.smoke.write),
    'DEPLOYMENT_NOT_VERIFIED',
  );
  for (const name of ['viewer', 'api'])
    requireThat(
      deployment.components[name].state === 'success' &&
        isVersion(deployment.components[name].afterVersion),
      'DEPLOYMENT_NOT_VERIFIED',
    );
}

export function releaseState(context, deployment, manifest, digest, previous) {
  if (previous) {
    validatePrevious(previous, context);
    requireThat(
      previous.targetSha === manifest.source.sha &&
        previous.manifestDigest === digest &&
        previous.cli.sha256 === manifest.cli.sha256,
      'RELEASE_ARTIFACT_MISMATCH',
    );
    return globalThis.structuredClone(previous);
  }
  return {
    schemaVersion: 1,
    ...context,
    targetSha: manifest.source.sha,
    manifestDigest: digest,
    tag: manifest.tag,
    cli: manifest.cli,
    deployment: globalThis.structuredClone(deployment),
    state: 'in_progress',
    error: null,
    npm: { state: 'pending', integrity: null },
    release: { state: 'pending', id: null },
  };
}

export async function ensureNpm({ state, lookup, publish, persist, guard }) {
  await guard();
  try {
    let found = await lookup(); // Errors are not absence; identity/hash conflicts throw.
    if (!found.present) {
      requireThat(state.npm.state === 'pending', 'NPM_OUTCOME_UNKNOWN_NO_RETRY');
      state.npm.state = 'unknown';
      state.state = 'in_progress';
      await persist(state); // Durable intent before the irreversible operation.
      await guard();
      try {
        await publish();
      } catch (error) {
        // These adapter errors prove publish was never invoked. Keep them
        // recoverable after configuration is fixed; all other errors reconcile.
        if (['MISSING_NPM_OIDC', 'NPM_OIDC_VERSION_UNSUPPORTED'].includes(safeCode(error))) {
          state.npm.state = 'pending';
          throw error;
        }
      }
      found = await lookup();
      requireThat(found.present, 'NPM_OUTCOME_UNKNOWN');
    }
    state.npm = { state: 'success', integrity: found.integrity };
    state.state = state.release.state === 'success' ? 'success' : 'in_progress';
    state.error = null;
    await persist(state);
    return state;
  } catch (error) {
    state.state = state.npm.state === 'unknown' ? 'unknown' : 'failed';
    state.error = safeCode(error);
    await persist(state);
    throw error;
  }
}

export function releaseBody(state, notes) {
  return `${notes.trim()}\n\n<!-- mote-release:${state.runId}:${state.targetSha}:${state.manifestDigest} -->\n`;
}

export function validateRelease(existing, state, body) {
  requireThat(
    Number.isSafeInteger(existing.id) &&
      existing.tag_name === state.tag &&
      existing.name === state.tag &&
      typeof existing.draft === 'boolean' &&
      existing.prerelease === false &&
      existing.body === body,
    'RELEASE_IDENTITY_CONFLICT',
  );
  requireThat(state.release.id === null || state.release.id === existing.id, 'RELEASE_ID_CHANGED');
}

// Stable across attempts: no timestamps/attempt counters or predicted final state.
export function receipt(state) {
  return json({
    schemaVersion: 1,
    repository: state.repository,
    tag: state.tag,
    targetSha: state.targetSha,
    workflowSha: state.workflowSha,
    runId: state.runId,
    manifestDigest: state.manifestDigest,
    components: state.deployment.components,
    smoke: state.deployment.smoke,
    cli: state.cli,
    npm: state.npm,
    release: { id: state.release.id, tag: state.tag },
  });
}

function checkAssets(remote, files, requireAll = false) {
  for (const file of files) {
    const matches = remote.filter((asset) => asset.name === file.name);
    requireThat(matches.length <= 1, 'RELEASE_DUPLICATE_ASSET');
    if (!matches.length && !requireAll) continue;
    requireThat(
      matches.length === 1 &&
        matches[0].state === 'uploaded' &&
        matches[0].size === globalThis.Buffer.byteLength(file.bytes) &&
        matches[0].digest === `sha256:${sha256(file.bytes)}`,
      'RELEASE_ASSET_CONFLICT',
    );
  }
}

export async function preflightRelease({ context, manifest, manifestDigest, notes, files, api }) {
  await api.assertTag(manifest.tag, manifest.source.sha);
  const existing = await api.find(manifest.tag);
  if (existing) {
    const state = {
      ...context,
      tag: manifest.tag,
      targetSha: manifest.source.sha,
      manifestDigest,
      release: { id: null },
    };
    validateRelease(existing, state, releaseBody(state, notes));
    checkAssets(await api.assets(existing.id), files);
  }
}

export async function ensureRelease({ state, notes, files, api, persist, guard }) {
  requireThat(state.npm.state === 'success', 'NPM_NOT_VERIFIED');
  await guard();
  const body = releaseBody(state, notes);
  try {
    let existing = await api.find(state.tag);
    if (!existing) {
      requireThat(state.release.id === null, 'RELEASE_DISAPPEARED');
      state.release.state = 'unknown';
      await persist(state);
      await guard();
      existing = await api.create({
        tag_name: state.tag,
        target_commitish: state.targetSha,
        name: state.tag,
        body,
        draft: true,
        prerelease: false,
        make_latest: 'legacy',
      });
    }
    validateRelease(existing, state, body);
    state.release.id = existing.id;
    state.release.state = 'in_progress';
    await persist(state);
    const assets = [
      ...files,
      { name: 'deployment-result.json', bytes: receipt(state), type: 'application/json' },
    ];
    let remote = await api.assets(existing.id);
    checkAssets(remote, assets);
    for (const file of assets) {
      const matches = remote.filter((asset) => asset.name === file.name);
      requireThat(matches.length <= 1, 'RELEASE_DUPLICATE_ASSET');
      if (!matches.length) {
        requireThat(!existing.immutable, 'IMMUTABLE_RELEASE_INCOMPLETE');
        state.release.state = 'unknown';
        await persist(state);
        await guard();
        await api.upload(existing.id, file); // No retry and no clobber.
        remote = await api.assets(existing.id);
      }
      checkAssets(remote, [file], true);
    }
    await guard();
    if (existing.draft) {
      state.release.state = 'unknown';
      await persist(state);
      await api.publish(existing.id);
    }
    existing = await api.find(state.tag);
    requireThat(existing && existing.draft === false, 'RELEASE_NOT_PUBLISHED');
    validateRelease(existing, state, body);
    checkAssets(await api.assets(existing.id), assets, true);
    state.release.state = 'success';
    state.state = 'success';
    state.error = null;
    await persist(state);
    return state;
  } catch (error) {
    state.state = state.release.state === 'unknown' ? 'unknown' : 'failed';
    state.error = safeCode(error);
    await persist(state);
    throw error;
  }
}
