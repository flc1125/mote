import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { boundedFetch, readRetry } from './smoke.mjs';
import { DeployError, requireThat, stableTag } from './policy.mjs';
import { sha256 } from './lib.mjs';

const execAsync = promisify(execFile);
export const integrity = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const registry = 'https://registry.npmjs.org';

export function registryClient(manifest, bytes, fetchImpl = globalThis.fetch) {
  const version = manifest.cli.version;
  requireThat(
    stableTag(`v${version}`) &&
      manifest.cli.name === 'mote-cli' &&
      sha256(bytes) === manifest.cli.sha256,
    'INVALID_NPM_ARTIFACT',
  );
  const expectedIntegrity = integrity(bytes);
  return async () => {
    try {
      return await readRetry(async () => {
        const response = await boundedFetch(`${registry}/mote-cli`, {}, fetchImpl, 4 * 1024 * 1024);
        // This is an existing public package. Even a package-level 404 is NOT
        // evidence that a version is safe to publish (could be auth/routing).
        requireThat(response.status === 200, 'REGISTRY_QUERY_FAILED');
        const packument = JSON.parse(response.text);
        requireThat(
          packument.name === 'mote-cli' &&
            packument.versions &&
            typeof packument.versions === 'object' &&
            !Array.isArray(packument.versions),
          'REGISTRY_INVALID_RESPONSE',
        );
        if (!Object.hasOwn(packument.versions, version)) {
          const latest = packument['dist-tags']?.latest;
          requireThat(stableTag(`v${latest}`), 'REGISTRY_INVALID_LATEST');
          const left = latest.split('.').map(BigInt);
          const right = version.split('.').map(BigInt);
          const first = left.findIndex((part, index) => part !== right[index]);
          requireThat(first === -1 || left[first] < right[first], 'NEWER_NPM_VERSION_EXISTS');
          return { present: false };
        }
        const found = packument.versions[version];
        requireThat(
          found.name === 'mote-cli' &&
            found.version === version &&
            found.dist?.integrity === expectedIntegrity &&
            found.dist.tarball === `${registry}/mote-cli/-/mote-cli-${version}.tgz`,
          'NPM_IDENTITY_CONFLICT',
        );
        const tarball = await boundedFetch(found.dist.tarball, {}, fetchImpl, 16 * 1024 * 1024);
        requireThat(
          tarball.status === 200 &&
            sha256(tarball.bytes) === manifest.cli.sha256 &&
            integrity(tarball.bytes) === expectedIntegrity,
          'NPM_TARBALL_CONFLICT',
        );
        return { present: true, integrity: expectedIntegrity };
      });
    } catch (error) {
      throw error instanceof DeployError ? error : new DeployError('REGISTRY_QUERY_FAILED');
    }
  };
}

export async function npmPublisher({ tarball, scratch, processEnv, execImpl = execAsync }) {
  requireThat(
    Boolean(processEnv.ACTIONS_ID_TOKEN_REQUEST_URL) &&
      Boolean(processEnv.ACTIONS_ID_TOKEN_REQUEST_TOKEN),
    'MISSING_NPM_OIDC',
  );
  const userConfig = join(scratch, 'user.npmrc');
  const globalConfig = join(scratch, 'global.npmrc');
  await writeFile(userConfig, '', { mode: 0o600 });
  await writeFile(globalConfig, '', { mode: 0o600 });
  const ci = Object.fromEntries(
    Object.entries(processEnv).filter(
      ([key]) =>
        (key.startsWith('GITHUB_') && key !== 'GITHUB_TOKEN') ||
        [
          'CI',
          'RUNNER_ENVIRONMENT',
          'ACTIONS_ID_TOKEN_REQUEST_URL',
          'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
        ].includes(key),
    ),
  );
  const options = {
    cwd: scratch,
    timeout: 120000,
    maxBuffer: 1024 * 1024,
    env: {
      ...ci,
      PATH: processEnv.PATH,
      HOME: scratch,
      TMPDIR: scratch,
      NPM_CONFIG_USERCONFIG: userConfig,
      NPM_CONFIG_GLOBALCONFIG: globalConfig,
      NPM_CONFIG_CACHE: join(scratch, 'npm-cache'),
      NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    },
  };
  try {
    const version = (await execImpl('npm', ['--version'], options)).stdout.trim();
    const [major, minor, patch] = version.split('.').map(Number);
    requireThat(
      /^\d+\.\d+\.\d+$/.test(version) &&
        (major > 11 || (major === 11 && (minor > 5 || (minor === 5 && patch >= 1)))),
      'NPM_OIDC_VERSION_UNSUPPORTED',
    );
    await execImpl(
      'npm',
      [
        'publish',
        tarball,
        '--registry',
        registry,
        '--access',
        'public',
        '--tag',
        'latest',
        '--ignore-scripts',
        '--provenance',
        '--fetch-retries=0',
      ],
      options,
    );
  } catch (error) {
    throw error instanceof DeployError ? error : new DeployError('NPM_PUBLISH_UNKNOWN');
  }
}

export function releaseClient(repository, token, fetchImpl = globalThis.fetch) {
  requireThat(repository === 'flc1125/mote' && Boolean(token), 'MISSING_GITHUB_AUTH');
  const base = `https://api.github.com/repos/${repository}/`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  async function request(path, method = 'GET', body, binary = false) {
    const operation = async () => {
      try {
        const url = binary ? `https://uploads.github.com/repos/${repository}/${path}` : base + path;
        const response = await boundedFetch(
          url,
          {
            method,
            headers: { ...headers, 'Content-Type': binary ? body.type : 'application/json' },
            ...(body === undefined ? {} : { body: binary ? body.bytes : JSON.stringify(body) }),
          },
          fetchImpl,
          4 * 1024 * 1024,
        );
        requireThat(response.status >= 200 && response.status < 300, 'RELEASE_REQUEST_FAILED');
        return JSON.parse(response.text);
      } catch (error) {
        throw error instanceof DeployError ? error : new DeployError('RELEASE_REQUEST_FAILED');
      }
    };
    return method === 'GET' ? readRetry(operation) : operation();
  }
  async function list(path) {
    const result = [];
    for (let page = 1; page <= 20; page++) {
      const items = await request(`${path}?per_page=100&page=${page}`);
      requireThat(Array.isArray(items), 'RELEASE_INVALID_RESPONSE');
      result.push(...items);
      if (items.length < 100) return result;
    }
    throw new DeployError('RELEASE_PAGINATION_LIMIT');
  }
  const validId = (id) => requireThat(Number.isSafeInteger(id) && id > 0, 'INVALID_RELEASE_ID');
  return {
    async assertTag(tag, sha) {
      requireThat(stableTag(tag), 'INVALID_RELEASE_TAG');
      let ref = (await request(`git/ref/tags/${encodeURIComponent(tag)}`)).object;
      for (let depth = 0; ref?.type === 'tag' && depth < 5; depth++) {
        requireThat(/^[a-f0-9]{40}$/.test(ref.sha), 'INVALID_RELEASE_TAG');
        ref = (await request(`git/tags/${ref.sha}`)).object;
      }
      requireThat(ref?.type === 'commit' && ref.sha === sha, 'REMOTE_TAG_CHANGED');
    },
    async find(tag) {
      const releases = (await list('releases')).filter((item) => item.tag_name === tag);
      requireThat(releases.length <= 1, 'RELEASE_DUPLICATE_TAG');
      // Drafts are visible only with push access. The workflow must run its
      // authoritative preflight in the isolated contents: write job.
      return releases[0] ?? null; // Never infer absence from a 404.
    },
    create: (body) => request('releases', 'POST', body),
    assets: (id) => {
      validId(id);
      return list(`releases/${id}/assets`);
    },
    upload: (id, file) => {
      validId(id);
      return request(
        `releases/${id}/assets?name=${encodeURIComponent(file.name)}`,
        'POST',
        file,
        true,
      );
    },
    publish: (id) => {
      validId(id);
      return request(`releases/${id}`, 'PATCH', { draft: false, make_latest: 'legacy' });
    },
  };
}
