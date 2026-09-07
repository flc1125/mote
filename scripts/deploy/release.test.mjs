import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from './engine.mjs';
import { contextFrom, DeployError, resolveTarget } from './policy.mjs';
import {
  ensureNpm,
  ensureRelease,
  preflightRelease,
  releasePreflightIdentity,
  requireReleasePreflight,
  receipt,
  releaseBody,
  releaseReady,
  releaseState,
} from './release.mjs';
import { integrity, npmPublisher, registryClient, releaseClient } from './release-clients.mjs';
import { root, sha256 } from './lib.mjs';
import { ledger } from './github.mjs';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const bytes = Buffer.from('fake-tarball');
const context = {
  repository: 'flc1125/mote',
  environment: 'production',
  requestedRef: 'v1.2.3',
  workflowSha: sha,
  runId: '123',
  runAttempt: 1,
  trigger: 'tag',
  writeEnabled: false,
};
const manifest = {
  tag: 'v1.2.3',
  source: { sha },
  cli: {
    name: 'mote-cli',
    version: '1.2.3',
    tarball: 'cli/mote-cli-1.2.3.tgz',
    sha256: sha256(bytes),
    verified: true,
  },
};
function deployed() {
  const version = '00000000-0000-0000-0000-000000000001';
  const state = initialState(context, sha, digest, { viewer: { version }, api: { version } });
  for (const entry of Object.values(state.components))
    Object.assign(entry, { state: 'success', afterVersion: version });
  state.state = 'success';
  state.smoke.read = 'success';
  return state;
}
const fresh = () => releaseState(context, deployed(), manifest, digest, null);
const found = { present: true, integrity: integrity(bytes) };
const persist = () => vi.fn(async () => {});
const guard = () => vi.fn(async () => {});
const fail = (code) => {
  throw new DeployError(code);
};
const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});
async function scratch() {
  const path = await mkdtemp(join(tmpdir(), 'mote-release-test-'));
  temporary.push(path);
  return path;
}

describe('release prerequisites', () => {
  it('accepts only the stable production tag caller identity', () => {
    const env = {
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: context.repository,
      GITHUB_WORKFLOW_SHA: sha,
      GITHUB_RUN_ID: '123',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: 'refs/tags/v1.2.3',
      GITHUB_WORKFLOW_REF: 'flc1125/mote/.github/workflows/release.yml@refs/tags/v1.2.3',
      MOTE_ENVIRONMENT: 'production',
      MOTE_REF: 'v1.2.3',
      MOTE_WRITE_SMOKE: 'false',
    };
    expect(contextFrom(env)).toEqual(context);
    expect(() => contextFrom({ ...env, MOTE_ENVIRONMENT: 'access-test' })).toThrow(
      'INVALID_RELEASE_TARGET',
    );
    expect(() => contextFrom({ ...env, GITHUB_REF: 'refs/tags/v1.2.3-rc.1' })).toThrow(
      'UNTRUSTED_WORKFLOW_REF',
    );
  });
  it('requires fresh same-attempt deployment evidence', () => {
    expect(() => releaseReady(deployed(), context, digest, sha)).not.toThrow();
    expect(() => releaseReady(deployed(), { ...context, runAttempt: 2 }, digest, sha)).toThrow(
      'RERUN_ALL_JOBS_REQUIRED',
    );
  });
  it.each(['failed', 'unknown', 'in_progress'])('rejects deployment %s', (state) => {
    expect(() => releaseReady({ ...deployed(), state }, context, digest, sha)).toThrow(
      'DEPLOYMENT_NOT_VERIFIED',
    );
  });
  it('rejects failed online checks even with successful Worker uploads', () => {
    const state = deployed();
    state.smoke.read = 'failed';
    expect(() => releaseReady(state, context, digest, sha)).toThrow('DEPLOYMENT_NOT_VERIFIED');
  });
  it('rejects a tag moved away from its workflow commit', () => {
    expect(() => resolveTarget(context, null, () => 'c'.repeat(40))).toThrow(
      'TAG_WORKFLOW_SHA_MISMATCH',
    );
  });
  it('rejects a checkpoint for different build bytes', () => {
    expect(() => releaseState(context, deployed(), manifest, 'c'.repeat(64), fresh())).toThrow(
      'RELEASE_ARTIFACT_MISMATCH',
    );
  });
  it('records release checkpoints under a separate task from deployment recovery', async () => {
    const client = vi.fn(async () => ({ id: 1 }));
    await ledger(client, context, 'mote-release').save(fresh());
    expect(client.mock.calls[0][1].task).toBe('mote-release:123');
  });
  it('supports a CLI-only release receipt without Worker deployment evidence', () => {
    const state = releaseState(context, null, manifest, digest, null);
    expect(state).not.toHaveProperty('deployment');
    expect(JSON.parse(receipt(state))).toMatchObject({
      tag: manifest.tag,
      targetSha: sha,
      cli: manifest.cli,
    });
    expect(JSON.parse(receipt(state))).not.toHaveProperty('components');
    expect(JSON.parse(receipt(state))).not.toHaveProperty('smoke');
  });
});

describe('npm recovery', () => {
  it.each(['MISSING_NPM_OIDC', 'NPM_OIDC_VERSION_UNSUPPORTED'])(
    'keeps proven pre-publish failure %s recoverable',
    async (code) => {
      const state = fresh();
      const publish = vi.fn(async () => fail(code));
      await expect(
        ensureNpm({
          state,
          publish,
          lookup: async () => ({ present: false }),
          persist: persist(),
          guard: guard(),
        }),
      ).rejects.toThrow(code);
      expect(state.npm.state).toBe('pending');
      expect(state.state).toBe('failed');
      await ensureNpm({
        state,
        publish: vi.fn(async () => {}),
        lookup: vi.fn().mockResolvedValueOnce({ present: false }).mockResolvedValueOnce(found),
        persist: persist(),
        guard: guard(),
      });
      expect(state.npm.state).toBe('success');
    },
  );
  it('skips an already published identical package', async () => {
    const state = fresh();
    const publish = vi.fn();
    await ensureNpm({
      state,
      publish,
      lookup: async () => found,
      persist: persist(),
      guard: guard(),
    });
    expect(publish).not.toHaveBeenCalled();
    expect(state.npm.state).toBe('success');
  });
  it('persists intent, publishes once, and reads actual bytes back', async () => {
    const state = fresh();
    const save = persist();
    const publish = vi.fn(async () => {
      expect(state.npm.state).toBe('unknown');
      expect(save).toHaveBeenCalled();
    });
    const lookup = vi.fn().mockResolvedValueOnce({ present: false }).mockResolvedValueOnce(found);
    await ensureNpm({ state, publish, lookup, persist: save, guard: guard() });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(state.npm).toEqual({ state: 'success', integrity: found.integrity });
  });
  it('reconciles a lost publish response without publishing twice', async () => {
    const state = fresh();
    const publish = vi.fn(async () => fail('NPM_PUBLISH_UNKNOWN'));
    await ensureNpm({
      state,
      publish,
      lookup: vi.fn().mockResolvedValueOnce({ present: false }).mockResolvedValueOnce(found),
      persist: persist(),
      guard: guard(),
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(state.npm.state).toBe('success');
  });
  it('does not retry an uncertain publish when the registry still reports absence', async () => {
    const state = fresh();
    const publish = vi.fn(async () => fail('NPM_PUBLISH_UNKNOWN'));
    const args = {
      state,
      publish,
      lookup: async () => ({ present: false }),
      persist: persist(),
      guard: guard(),
    };
    await expect(ensureNpm(args)).rejects.toThrow('NPM_OUTCOME_UNKNOWN');
    await expect(ensureNpm(args)).rejects.toThrow('NPM_OUTCOME_UNKNOWN_NO_RETRY');
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it.each(['REGISTRY_QUERY_FAILED', 'NPM_IDENTITY_CONFLICT'])(
    'never publishes after %s',
    async (code) => {
      const publish = vi.fn();
      await expect(
        ensureNpm({
          state: fresh(),
          publish,
          lookup: async () => fail(code),
          persist: persist(),
          guard: guard(),
        }),
      ).rejects.toThrow(code);
      expect(publish).not.toHaveBeenCalled();
    },
  );
  it('does not publish without a durable intent', async () => {
    const publish = vi.fn();
    await expect(
      ensureNpm({
        state: fresh(),
        publish,
        lookup: async () => ({ present: false }),
        persist: async () => fail('GITHUB_REQUEST_FAILED'),
        guard: guard(),
      }),
    ).rejects.toThrow('GITHUB_REQUEST_FAILED');
    expect(publish).not.toHaveBeenCalled();
  });
  it('blocks old-run finalization after a superseding deployment', async () => {
    const publish = vi.fn();
    const lookup = vi.fn();
    await expect(
      ensureNpm({
        state: fresh(),
        publish,
        lookup,
        persist: persist(),
        guard: async () => fail('SUPERSEDED_RUN'),
      }),
    ).rejects.toThrow('SUPERSEDED_RUN');
    expect(lookup).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});

function releaseScenario() {
  const state = fresh();
  state.npm = { state: 'success', integrity: found.integrity };
  const remote = { release: null, assets: [] };
  const files = [{ name: 'mote-cli-1.2.3.tgz', bytes, type: 'application/octet-stream' }];
  const api = {
    assertTag: vi.fn(async () => {}),
    find: vi.fn(async () => remote.release),
    create: vi.fn(async (body) => {
      remote.release = { ...body, id: 10, immutable: false };
      return remote.release;
    }),
    assets: vi.fn(async () => remote.assets),
    upload: vi.fn(async (_id, file) => {
      remote.assets.push({
        name: file.name,
        state: 'uploaded',
        size: Buffer.byteLength(file.bytes),
        digest: `sha256:${sha256(file.bytes)}`,
      });
    }),
    publish: vi.fn(async () => {
      remote.release.draft = false;
    }),
  };
  const args = { state, notes: 'Release notes', files, api, persist: persist(), guard: guard() };
  return { args, state, api, remote, run: () => ensureRelease(args) };
}

describe('GitHub Release reconciliation', () => {
  it('rejects a draft hidden from the read token when preflight uses the write token', async () => {
    const draft = {
      id: 10,
      tag_name: manifest.tag,
      name: manifest.tag,
      prerelease: false,
      draft: true,
      body: 'conflicting draft',
    };
    const fetch = vi.fn(async (url, options) => {
      expect(options.method).toBe('GET');
      const body = url.includes('git/ref/')
        ? { object: { type: 'commit', sha } }
        : options.headers.Authorization === 'Bearer fake-write'
          ? [draft]
          : [];
      return new globalThis.Response(JSON.stringify(body));
    });
    const readApi = releaseClient(context.repository, 'fake-read', fetch);
    expect(await readApi.find(manifest.tag)).toBeNull();
    const writeApi = releaseClient(context.repository, 'fake-write', fetch);
    expect(await writeApi.find(manifest.tag)).toEqual(draft);
    await expect(
      preflightRelease({
        context,
        manifest,
        manifestDigest: digest,
        notes: 'Release notes',
        files: [],
        api: writeApi,
      }),
    ).rejects.toThrow('RELEASE_IDENTITY_CONFLICT');
  });
  it('binds the mandatory draft preflight to the exact run, attempt, SHA and artifacts', () => {
    const identity = releasePreflightIdentity(context, sha, digest);
    expect(() => requireReleasePreflight(context, sha, digest, identity)).not.toThrow();
    for (const invalid of [undefined, '', 'true', identity.replace('123:', '124:')])
      expect(() => requireReleasePreflight(context, sha, digest, invalid)).toThrow(
        'RELEASE_PREFLIGHT_REQUIRED',
      );
    expect(() =>
      requireReleasePreflight({ ...context, runAttempt: 2 }, sha, digest, identity),
    ).toThrow('RELEASE_PREFLIGHT_REQUIRED');
    expect(() => requireReleasePreflight(context, 'c'.repeat(40), digest, identity)).toThrow(
      'RELEASE_PREFLIGHT_REQUIRED',
    );
    expect(() => requireReleasePreflight(context, sha, 'd'.repeat(64), identity)).toThrow(
      'RELEASE_PREFLIGHT_REQUIRED',
    );
  });
  it('checks known Release conflicts before deployment or npm writes', async () => {
    const s = releaseScenario();
    s.remote.release = {
      id: 10,
      tag_name: manifest.tag,
      name: manifest.tag,
      prerelease: false,
      draft: true,
      body: 'different build',
    };
    await expect(
      preflightRelease({
        context,
        manifest,
        manifestDigest: digest,
        notes: s.args.notes,
        files: s.args.files,
        api: s.api,
      }),
    ).rejects.toThrow('RELEASE_IDENTITY_CONFLICT');
    expect(s.api.create).not.toHaveBeenCalled();
    expect(s.api.upload).not.toHaveBeenCalled();
  });
  it('accepts a matching partial Release in read-only preflight', async () => {
    const s = releaseScenario();
    s.remote.release = {
      id: 10,
      tag_name: manifest.tag,
      name: manifest.tag,
      prerelease: false,
      draft: true,
      body: releaseBody(s.state, s.args.notes),
    };
    await preflightRelease({
      context,
      manifest,
      manifestDigest: digest,
      notes: s.args.notes,
      files: s.args.files,
      api: s.api,
    });
    expect(s.api.assertTag).toHaveBeenCalledWith(manifest.tag, sha);
    expect(s.api.create).not.toHaveBeenCalled();
    expect(s.api.upload).not.toHaveBeenCalled();
  });
  it('does not add a missing first asset when another existing asset conflicts', async () => {
    const s = releaseScenario();
    await s.run();
    s.remote.assets.shift();
    s.remote.assets[0].digest = 'sha256:wrong';
    s.api.upload.mockClear();
    await expect(s.run()).rejects.toThrow('RELEASE_ASSET_CONFLICT');
    expect(s.api.upload).not.toHaveBeenCalled();
  });
  it('creates a draft, verifies all attachments, then publishes', async () => {
    const s = releaseScenario();
    await s.run();
    expect(s.api.create).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true, target_commitish: sha }),
    );
    expect(s.api.upload).toHaveBeenCalledTimes(2);
    expect(s.api.publish).toHaveBeenCalledTimes(1);
    expect(s.state.state).toBe('success');
    expect(JSON.parse(receipt(s.state))).toMatchObject({
      tag: manifest.tag,
      targetSha: sha,
      npm: { state: 'success' },
      release: { id: 10 },
    });
  });
  it('rechecks an existing completed release without overwriting anything', async () => {
    const s = releaseScenario();
    await s.run();
    const first = receipt(s.state);
    s.api.create.mockClear();
    s.api.upload.mockClear();
    s.api.publish.mockClear();
    s.state.runAttempt = 2;
    await s.run();
    expect(s.api.create).not.toHaveBeenCalled();
    expect(s.api.upload).not.toHaveBeenCalled();
    expect(s.api.publish).not.toHaveBeenCalled();
    expect(receipt(s.state)).toBe(first);
  });
  it('resumes after npm success and a failed Release asset upload, without republishing npm', async () => {
    const s = releaseScenario();
    const upload = s.api.upload.getMockImplementation();
    s.api.upload
      .mockImplementationOnce(upload)
      .mockImplementationOnce(async () => fail('RELEASE_REQUEST_FAILED'));
    await expect(s.run()).rejects.toThrow('RELEASE_REQUEST_FAILED');
    expect(s.state.npm.state).toBe('success');
    expect(s.remote.release.draft).toBe(true);
    const publish = vi.fn();
    await ensureNpm({
      state: s.state,
      publish,
      lookup: async () => found,
      persist: persist(),
      guard: guard(),
    });
    expect(publish).not.toHaveBeenCalled();
    s.api.upload.mockImplementation(upload).mockClear();
    await s.run();
    expect(s.api.upload).toHaveBeenCalledTimes(1);
    expect(s.state.state).toBe('success');
  });
  it('rejects different notes, SHA or run identity rather than editing the release', async () => {
    const s = releaseScenario();
    s.remote.release = {
      id: 10,
      tag_name: manifest.tag,
      name: manifest.tag,
      body: 'other release',
      prerelease: false,
    };
    await expect(s.run()).rejects.toThrow('RELEASE_IDENTITY_CONFLICT');
    expect(s.api.upload).not.toHaveBeenCalled();
    expect(s.api.publish).not.toHaveBeenCalled();
  });
  it.each(['wrong-digest', 'missing-digest', 'starter', 'wrong-size'])(
    'rejects conflicting asset %s',
    async (kind) => {
      const s = releaseScenario();
      await s.run();
      const asset = s.remote.assets[0];
      if (kind === 'wrong-digest') asset.digest = 'sha256:bad';
      if (kind === 'missing-digest') delete asset.digest;
      if (kind === 'starter') asset.state = 'starter';
      if (kind === 'wrong-size') asset.size++;
      s.api.upload.mockClear();
      await expect(s.run()).rejects.toThrow('RELEASE_ASSET_CONFLICT');
      expect(s.api.upload).not.toHaveBeenCalled();
    },
  );
  it('reconciles a published draft after a lost PATCH response', async () => {
    const s = releaseScenario();
    s.api.publish.mockImplementationOnce(async () => {
      s.remote.release.draft = false;
      fail('RELEASE_REQUEST_FAILED');
    });
    await expect(s.run()).rejects.toThrow('RELEASE_REQUEST_FAILED');
    await s.run();
    expect(s.api.publish).toHaveBeenCalledTimes(1);
    expect(s.state.state).toBe('success');
  });
  it('refuses to create any release before npm verification', async () => {
    const s = releaseScenario();
    s.state.npm.state = 'unknown';
    await expect(s.run()).rejects.toThrow('NPM_NOT_VERIFIED');
    expect(s.api.find).not.toHaveBeenCalled();
  });
  it('does not silently recreate a deleted release', async () => {
    const s = releaseScenario();
    await s.run();
    s.remote.release = null;
    s.api.create.mockClear();
    await expect(s.run()).rejects.toThrow('RELEASE_DISAPPEARED');
    expect(s.api.create).not.toHaveBeenCalled();
  });
});

const response = (body, status = 200) =>
  new globalThis.Response(
    typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body),
    { status },
  );
function packument(present = true) {
  return {
    name: 'mote-cli',
    'dist-tags': { latest: present ? '1.2.3' : '1.2.2' },
    versions: present
      ? {
          '1.2.3': {
            name: 'mote-cli',
            version: '1.2.3',
            dist: {
              integrity: found.integrity,
              tarball: 'https://registry.npmjs.org/mote-cli/-/mote-cli-1.2.3.tgz',
            },
          },
        }
      : {},
  };
}

describe('registry adapter', () => {
  it('recognizes absence only in a valid public package index', async () => {
    expect(await registryClient(manifest, bytes, async () => response(packument(false)))()).toEqual(
      { present: false },
    );
  });
  it('verifies both metadata integrity and actual remote tarball bytes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(packument()))
      .mockResolvedValueOnce(response(bytes));
    expect(await registryClient(manifest, bytes, fetch)()).toEqual(found);
    expect(fetch.mock.calls[1][0]).toBe(packument().versions['1.2.3'].dist.tarball);
  });
  it.each([401, 403, 404, 500])('does not treat HTTP %s as package absence', async (status) => {
    await expect(
      registryClient(manifest, bytes, async () => response('private', status))(),
    ).rejects.toThrow('REGISTRY_QUERY_FAILED');
  });
  it('rejects registry transport failure', async () => {
    await expect(
      registryClient(manifest, bytes, async () => {
        throw new Error('private transport details');
      })(),
    ).rejects.toThrow('REGISTRY_QUERY_FAILED');
  });
  it('rejects an existing version with different integrity', async () => {
    const data = packument();
    data.versions['1.2.3'].dist.integrity = 'sha512:wrong';
    await expect(registryClient(manifest, bytes, async () => response(data))()).rejects.toThrow(
      'NPM_IDENTITY_CONFLICT',
    );
  });
  it('rejects corrupt actual tarball bytes even with matching metadata', async () => {
    await expect(
      registryClient(manifest, bytes, async (url) =>
        url.endsWith('.tgz') ? response('wrong') : response(packument()),
      )(),
    ).rejects.toThrow('NPM_TARBALL_CONFLICT');
  });
  it('refuses to move latest backward for an unpublished lower version', async () => {
    const data = packument(false);
    data['dist-tags'].latest = '2.0.0';
    await expect(registryClient(manifest, bytes, async () => response(data))()).rejects.toThrow(
      'NEWER_NPM_VERSION_EXISTS',
    );
  });
});

describe('publishing adapters without live writes', () => {
  it('uses OIDC, a fixed registry, the existing tarball, no lifecycle scripts and no Cloudflare/GitHub tokens', async () => {
    const exec = vi.fn(async () => ({ stdout: '11.5.1\n' }));
    await npmPublisher({
      tarball: '/fake/package.tgz',
      scratch: await scratch(),
      execImpl: exec,
      processEnv: {
        PATH: '/fake/path',
        GITHUB_REPOSITORY: context.repository,
        GITHUB_TOKEN: 'fake-github',
        NODE_AUTH_TOKEN: 'fake-npm',
        CLOUDFLARE_API_TOKEN: 'fake-cloud',
        ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc',
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fake-oidc',
      },
    });
    const [, args, options] = exec.mock.calls[1];
    expect(args).toEqual([
      'publish',
      '/fake/package.tgz',
      '--registry',
      'https://registry.npmjs.org',
      '--access',
      'public',
      '--tag',
      'latest',
      '--ignore-scripts',
      '--provenance',
      '--fetch-retries=0',
    ]);
    expect(options.env.GITHUB_TOKEN).toBeUndefined();
    expect(options.env.NODE_AUTH_TOKEN).toBeUndefined();
    expect(options.env.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(options.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN).toBe('fake-oidc');
  });
  it('refuses missing OIDC before executing npm', async () => {
    const exec = vi.fn();
    await expect(
      npmPublisher({
        tarball: '/fake/pkg',
        scratch: await scratch(),
        processEnv: {},
        execImpl: exec,
      }),
    ).rejects.toThrow('MISSING_NPM_OIDC');
    expect(exec).not.toHaveBeenCalled();
  });
  it('rejects an npm version without trusted publishing support', async () => {
    const exec = vi.fn(async () => ({ stdout: '11.5.0' }));
    await expect(
      npmPublisher({
        tarball: '/fake/pkg',
        scratch: await scratch(),
        processEnv: {
          ACTIONS_ID_TOKEN_REQUEST_URL: 'fake',
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fake',
        },
        execImpl: exec,
      }),
    ).rejects.toThrow('NPM_OIDC_VERSION_UNSUPPORTED');
    expect(exec).toHaveBeenCalledTimes(1);
  });
  it('finds draft releases and resolves annotated tags', async () => {
    const fetch = vi.fn(async (url) =>
      response(
        url.includes('git/ref/')
          ? { object: { type: 'tag', sha } }
          : url.includes('git/tags/')
            ? { object: { type: 'commit', sha } }
            : [{ tag_name: manifest.tag, draft: true, id: 10 }],
      ),
    );
    const api = releaseClient(context.repository, 'fake', fetch);
    await api.assertTag(manifest.tag, sha);
    expect(await api.find(manifest.tag)).toMatchObject({ draft: true });
  });
  it('rejects a moved remote tag', async () => {
    await expect(
      releaseClient(context.repository, 'fake', async () =>
        response({ object: { type: 'commit', sha: 'c'.repeat(40) } }),
      ).assertTag(manifest.tag, sha),
    ).rejects.toThrow('REMOTE_TAG_CHANGED');
  });
  it('does not treat release list authentication failure as absence', async () => {
    await expect(
      releaseClient(context.repository, 'fake', async () => response('denied', 403)).find(
        manifest.tag,
      ),
    ).rejects.toThrow('RELEASE_REQUEST_FAILED');
  });
  it('uploads to a fixed GitHub endpoint and never retries failed POST', async () => {
    const fetch = vi.fn(async () => response('private', 500));
    await expect(
      releaseClient(context.repository, 'fake', fetch).upload(10, {
        name: 'fixture.tgz',
        bytes,
        type: 'application/octet-stream',
      }),
    ).rejects.toThrow('RELEASE_REQUEST_FAILED');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(
      'https://uploads.github.com/repos/flc1125/mote/releases/10/assets?name=fixture.tgz',
    );
    expect(fetch.mock.calls[0][1].redirect).toBe('manual');
  });
});

describe('release workflow contract', () => {
  it('keeps the manual deployment entry isolated from tag releases', async () => {
    const manual = await readFile(join(root, '.github/workflows/deploy.yml'), 'utf8');
    const release = await readFile(join(root, '.github/workflows/release.yml'), 'utf8');
    const direct = manual.split('\n  deploy:\n')[1].split('\n  write-smoke:\n')[0];
    expect(direct).toContain('runs-on: ubuntu-latest');
    expect(direct).toContain('needs: prepare');
    expect(direct).toContain('node scripts/deploy/action.mjs deploy');
    expect(release).not.toMatch(/scripts\/deploy\/action\.mjs deploy|\n {2}deploy:\n/);
    expect(manual).toContain('MOTE_REF: ${{ inputs.ref }}');
    expect(manual).toContain('MOTE_ENVIRONMENT: ${{ inputs.environment }}');
    expect(manual).toContain('MOTE_WRITE_SMOKE: ${{ inputs.write_smoke }}');
    expect(release).toContain('MOTE_REF: ${{ github.ref_name }}');
    expect(release).toContain("MOTE_WRITE_SMOKE: 'false'");
  });

  it('requires an explicit readiness output in the manual deployment entry point', async () => {
    const source = await readFile(join(root, '.github/workflows/deploy.yml'), 'utf8');
    const deploy = source.split('\n  deploy:\n')[1].split(/\n {2}[\w-]+:\n/)[0];
    expect(deploy).toContain('needs: prepare');
    const condition = deploy.match(/^ {4}if: (.+)$/m)[1];
    expect(condition).toBe("needs.prepare.outputs.ready == 'true'");
    for (const ready of ['', 'false', 'true', 'unexpected']) {
      const expression = condition.replace('needs.prepare.outputs.ready', JSON.stringify(ready));
      expect(runInNewContext(expression, {}, { timeout: 100 })).toBe(ready === 'true');
    }
    const shared = await readFile(join(root, '.github/workflows/_deploy.yml'), 'utf8');
    expect(shared).toContain('value: ${{ jobs.ready.outputs.ready }}');
    const readyJob = shared.split('\n  ready:\n')[1];
    expect(readyJob).toContain('ready: ${{ steps.ready.outputs.ready }}');
    expect(readyJob).toContain('run: echo \'ready=true\' >> "$GITHUB_OUTPUT"');
    expect(readyJob).not.toMatch(/environment:|secrets\.|uses:/);
  });

  it('runs manual write smoke only after successful preparation and deployment', async () => {
    const source = await readFile(join(root, '.github/workflows/deploy.yml'), 'utf8');
    const job = source.split('\n  write-smoke:\n')[1];
    const condition = job.match(/^ {4}if: (.+)$/m)[1];
    for (const prepare of ['success', 'failure', 'cancelled', 'skipped']) {
      for (const deploy of ['success', 'failure', 'cancelled', 'skipped']) {
        for (const write of [true, false]) {
          const expression = condition
            .replaceAll('always()', 'true')
            .replaceAll('inputs.write_smoke', JSON.stringify(write))
            .replaceAll('needs.prepare.result', JSON.stringify(prepare))
            .replaceAll('needs.deploy.result', JSON.stringify(deploy));
          expect(runInNewContext(expression, {}, { timeout: 100 })).toBe(
            write && prepare === 'success' && deploy === 'success',
          );
        }
      }
    }
    expect(job).toContain('MOTE_SERVICE_CLIENT_ID: ${{ secrets.MOTE_SERVICE_CLIENT_ID }}');
    expect(job).toContain('MOTE_SERVICE_CLIENT_SECRET: ${{ secrets.MOTE_SERVICE_CLIENT_SECRET }}');
    expect(job).not.toContain('CLOUDFLARE_API_TOKEN');
  });

  it('fails closed on missing/failed/cancelled tag preflight, including resumed builds', async () => {
    const shared = await readFile(join(root, '.github/workflows/_deploy.yml'), 'utf8');
    const condition = shared.split('\n  ready:')[1].match(/^ {4}if: (.+)$/m)[1];
    for (const event of ['push', 'workflow_dispatch']) {
      for (const resolve of ['success', 'failure', 'cancelled', 'skipped']) {
        for (const prepare of ['success', 'failure', 'cancelled', 'skipped']) {
          for (const preflight of ['success', 'failure', 'cancelled', 'skipped']) {
            const results = { resolve, prepare, 'release-preflight': preflight };
            // Evaluate the actual simple workflow expression, not a copied gate.
            const expression = condition
              .replaceAll('always()', 'true')
              .replaceAll('github.event_name', JSON.stringify(event))
              .replace(/needs\.([\w-]+)\.result/g, (_, job) => JSON.stringify(results[job]));
            const allowed = runInNewContext(expression, {}, { timeout: 100 });
            expect(allowed).toBe(
              resolve === 'success' &&
                ['success', 'skipped'].includes(prepare) &&
                preflight === (event === 'push' ? 'success' : 'skipped'),
            );
          }
        }
      }
    }
  });
  it('orders CLI validation, read-only preflight, npm OIDC and GitHub Release', async () => {
    const workflow = await readFile(join(root, '.github/workflows/release.yml'), 'utf8');
    expect(workflow).toContain("tags: ['v*']");
    expect(workflow).toContain('group: mote-release-${{ github.ref }}');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('node scripts/release/prepare.mjs');
    expect(workflow).toContain('node scripts/release/action.mjs preflight');
    expect(workflow).toContain('node scripts/release/action.mjs npm');
    expect(workflow).toContain('node scripts/release/action.mjs github');
    const prepare = workflow.split('  prepare:')[1].split('  preflight:')[0];
    const preflight = workflow.split('  preflight:')[1].split('  npm:')[0];
    const npm = workflow.split('  npm:')[1].split('  release:')[0];
    const release = workflow.split('  release:')[1];
    expect(preflight).toContain('needs: prepare');
    expect(npm).toContain('needs: [prepare, preflight]');
    expect(release).toContain('needs: [prepare, npm]');
    expect(prepare).not.toContain('contents: write');
    expect(preflight).toContain('contents: write');
    expect(preflight).not.toContain('id-token: write');
    expect(npm).toContain('id-token: write');
    expect(npm).not.toContain('contents: write');
    expect(npm).not.toMatch(/environment:|secrets\.|deployments: write/);
    expect(release).not.toContain('id-token: write');
    expect(release).toContain('contents: write');
    expect(release).not.toContain('deployments: write');
    expect(workflow).not.toMatch(
      /CLOUDFLARE|MOTE_RELEASE_PREFLIGHT_IDENTITY|MOTE_SMOKE_|mote-build-|mote-deploy-result|deployment-result|scripts\/deploy\/action\.mjs deploy|npm@latest|--clobber|npm view|gh release edit|NODE_AUTH_TOKEN|NPM_TOKEN/,
    );
    expect(workflow.match(/mote-release-\$\{\{ github\.run_id \}\}/g)).toHaveLength(4);
    const manual = await readFile(join(root, '.github/workflows/deploy.yml'), 'utf8');
    expect(manual).not.toMatch(/release-action|id-token: write/);
  });
});
