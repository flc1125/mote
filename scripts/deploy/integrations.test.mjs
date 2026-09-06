import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloudflareClient } from './cloudflare.mjs';
import { githubClient, ledger } from './github.mjs';
import { sha256, root, targets } from './lib.mjs';
import {
  boundedFetch,
  checkDocument,
  fixtureMarker,
  readRetry,
  readSmoke,
  robotsDisallowAll,
  sampleFrom,
} from './smoke.mjs';
import { fixturePng, publishSmoke } from './write-smoke.mjs';

const origin = 'https://mote-oauth-test.flc.io';
const sample = { document: '123456789ABCDEFG', asset: '123456789ABC', digest: sha256(fixturePng) };
const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});
async function scratch() {
  const path = await mkdtemp(join(tmpdir(), 'mote-deployment-test-'));
  temporary.push(path);
  return path;
}
const response = (body, status = 200, headers = {}) =>
  new globalThis.Response(body, { status, headers });
const htmlHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'public, max-age=300',
  'Content-Security-Policy': "default-src 'none'; script-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
};
function fetchFixture(marker = fixtureMarker) {
  return vi.fn(async (url) => {
    expect(url.startsWith(origin)).toBe(true);
    const path = url.slice(origin.length);
    if (['/health', '/api/health'].includes(path)) return response('{"status":"ok"}');
    if (path === '/robots.txt')
      return response('# edge additions\nUser-agent: *\nContent-signal: search=yes\nDisallow: /\n');
    if (path === '/api/v1/publish')
      return response('denied', 401, { 'WWW-Authenticate': 'Bearer' });
    if (path.startsWith('/.well-known/'))
      return response(
        JSON.stringify({ resource: `${origin}/api/mcp`, authorization_servers: [targets.issuer] }),
      );
    if (path === `/${sample.document}`)
      return response(
        `<h1>${marker}</h1><img src="/${sample.document}/a/${sample.asset}">`,
        200,
        htmlHeaders,
      );
    if (path === `/${sample.document}/a/${sample.asset}`)
      return response(fixturePng, 200, {
        ...htmlHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
    throw new Error('unexpected path');
  });
}

describe('read smoke and network boundaries', () => {
  it('checks health, auth, discovery, and actual HTML/image bytes without a write credential', async () => {
    const fetch = fetchFixture();
    const checks = await readSmoke('access-test', sample, fetch);
    expect(checks).toHaveLength(6);
    expect(checks.every((check) => check.state === 'success')).toBe(true);
    for (const [, options] of fetch.mock.calls) {
      expect(options.redirect).toBe('manual');
      expect(options.headers).toBeUndefined();
    }
    expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  });
  it.each([
    ['Content-Security-Policy', 'default-src *', 'SMOKE_CSP'],
    ['Cache-Control', 'no-store', 'SMOKE_BROWSER_CACHE'],
    ['X-Content-Type-Options', '', 'SMOKE_NOSNIFF'],
    ['X-Robots-Tag', '', 'SMOKE_NOINDEX'],
    ['Referrer-Policy', 'unsafe-url', 'SMOKE_REFERRER'],
  ])('rejects invalid %s', async (header, value, code) => {
    const fetch = fetchFixture();
    fetch.mockResolvedValueOnce(
      response(`${fixtureMarker} /${sample.document}/a/${sample.asset}`, 200, {
        ...htmlHeaders,
        [header]: value,
      }),
    );
    await expect(checkDocument('access-test', sample, fetch)).rejects.toThrow(code);
  });
  it('rejects a corrupt image even when its URL responds 200', async () => {
    await expect(
      checkDocument('access-test', { ...sample, digest: '0'.repeat(64) }, fetchFixture()),
    ).rejects.toThrow('SMOKE_ASSET');
  });
  it('requires a preapproved public sample and refuses path injection', () => {
    expect(() => sampleFrom({ MOTE_SMOKE_DOCUMENT_ID: '../secret' })).toThrow(
      'MISSING_PUBLIC_DOCUMENT_SAMPLE',
    );
    expect(
      sampleFrom({
        MOTE_SMOKE_DOCUMENT_ID: sample.document,
        MOTE_SMOKE_ASSET_ID: sample.asset,
        MOTE_SMOKE_ASSET_SHA256: sample.digest,
      }),
    ).toEqual(sample);
  });
  it('does not follow redirects or treat them as healthy', async () => {
    const fetch = vi.fn(async () => response('login', 302, { Location: 'https://other.test/' }));
    await expect(readSmoke('access-test', sample, fetch)).rejects.toThrow('SMOKE_HEALTH');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('records partial checks and sanitizes transport errors without retrying POST', async () => {
    const fetch = fetchFixture();
    const read = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, options) => {
      if (options.method === 'POST') throw new Error(`private ${origin}/${sample.document}`);
      return read(url, options);
    });
    const error = await readSmoke('access-test', sample, fetch).catch((error) => error);
    expect(error.message).toBe('SMOKE_REQUEST_FAILED');
    expect(error.checks).toEqual([
      { name: 'viewer-health', state: 'success' },
      { name: 'api-health', state: 'success' },
      { name: 'anonymous-rejected', state: 'failed' },
    ]);
    expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
    expect(JSON.stringify(error)).not.toContain(sample.document);
  });
  it('bounds response size', async () => {
    await expect(boundedFetch(origin, {}, async () => response('12345'), 4)).rejects.toThrow(
      'RESPONSE_TOO_LARGE',
    );
  });
  it('bounds read retries to three', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('transient'));
    const wait = vi.fn();
    await expect(readRetry(operation, wait)).rejects.toThrow('transient');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[250], [500]]);
  });
  it.each([
    ['User-agent: *\nDisallow: / # no crawling\n', true],
    ['User-agent: special\nDisallow: /\n', false],
    ['User-agent: *\nDisallow: /\nAllow: /public\n', false],
    ['User-agent: *\nDisallow: /private\n', false],
    ['# Cloudflare\nUser-agent: Bot\nDisallow: /\nUser-agent: *\nDisallow: /\n', true],
  ])('interprets wildcard robots rules without matching the whole body', (text, expected) => {
    expect(robotsDisallowAll(text)).toBe(expected);
  });
});

describe('Cloudflare adapter without live cloud writes', () => {
  const version = '00000000-0000-0000-0000-000000000001';
  const older = '00000000-0000-0000-0000-000000000002';
  const marker = `mote:123:${'a'.repeat(40)}`;
  async function client(failDeploy = false) {
    const exec = vi.fn(async (_bin, args) => {
      if (args[1] === 'deploy') {
        if (failDeploy) throw new Error('token/private-url in command output');
        return { stdout: '' };
      }
      if (args[1] === 'deployments')
        return {
          stdout: JSON.stringify([
            { created_on: '2026-09-05', versions: [{ version_id: older, percentage: 100 }] },
            { created_on: '2026-09-06', versions: [{ version_id: version, percentage: 100 }] },
          ]),
        };
      return { stdout: JSON.stringify({ annotations: { 'workers/message': marker } }) };
    });
    return {
      exec,
      cloud: await cloudflareClient({
        environment: 'access-test',
        directory: '/fake/artifact',
        scratch: await scratch(),
        token: 'fake-management-token',
        processEnv: {
          PATH: '/fake/path',
          GITHUB_TOKEN: 'fake-github',
          MOTE_SERVICE_CLIENT_SECRET: 'fake-service',
        },
        execImpl: exec,
      }),
    };
  }
  it('selects newest 100% deployment and deploys verified prebuilt config with scrubbed env', async () => {
    const { cloud, exec } = await client();
    expect(await cloud.snapshot()).toEqual({
      viewer: { version, marker },
      api: { version, marker },
    });
    expect(await cloud.upload('viewer', marker)).toEqual({ state: 'success', version });
    const [, args, options] = exec.mock.calls.find(([, args]) => args[1] === 'deploy');
    expect(args).toContain('--no-bundle');
    expect(args).toContain('/fake/artifact/viewer/wrangler.json');
    expect(JSON.stringify(args)).not.toContain('fake-management-token');
    expect(options.env.CLOUDFLARE_API_TOKEN).toBe('fake-management-token');
    expect(options.env.GITHUB_TOKEN).toBeUndefined();
    expect(options.env.MOTE_SERVICE_CLIENT_SECRET).toBeUndefined();
    expect(options.timeout).toBe(120000);
  });
  it('records observed activation but stays unknown when deploy command fails', async () => {
    const { cloud, exec } = await client(true);
    expect(await cloud.upload('api', marker)).toEqual({
      state: 'unknown',
      observedVersion: version,
    });
    expect(exec.mock.calls.filter(([, args]) => args[1] === 'deploy')).toHaveLength(1);
  });
  it('rejects arbitrary components before command execution', async () => {
    const { cloud, exec } = await client();
    await expect(cloud.upload('../probe', marker)).rejects.toThrow('INVALID_COMPONENT');
    expect(exec).not.toHaveBeenCalled();
  });
});

describe('GitHub checkpoint ledger', () => {
  const context = { repository: 'flc1125/mote', environment: 'access-test', runId: '123' };
  it('writes checkpoints without auto-merge or arbitrary status gates and marks unknown as failure', async () => {
    const request = vi.fn(async () => ({ id: 42 }));
    await ledger(request, context).save({ targetSha: 'a'.repeat(40), state: 'unknown' });
    expect(request.mock.calls[0][1]).toMatchObject({
      task: 'mote-deploy:123',
      auto_merge: false,
      required_contexts: [],
      production_environment: false,
    });
    expect(request.mock.calls[1]).toEqual([
      'deployments/42/statuses',
      expect.objectContaining({ state: 'failure', auto_inactive: false }),
    ]);
  });
  it('rejects a rerun superseded by a later deployment run', async () => {
    const request = vi.fn(async () => [
      { id: 1, task: 'mote-deploy:123', payload: { runId: '123' } },
      { id: 2, task: 'mote-deploy:456', payload: { runId: '456' } },
    ]);
    await expect(ledger(request, context).rejectSuperseded()).rejects.toThrow('SUPERSEDED_RUN');
  });
  it('selects latest checkpoint within the same run', async () => {
    const request = vi.fn(async () => [
      { id: 1, payload: 'old' },
      { id: 2, payload: 'latest' },
    ]);
    expect(await ledger(request, context).previous()).toBe('latest');
    expect(request.mock.calls[0][0]).toContain('task=mote-deploy:123');
  });
  it('never retries a failed checkpoint POST or exposes response body', async () => {
    const fetch = vi.fn(async () => response('private credential', 500));
    await expect(
      githubClient(context.repository, 'fake', fetch)('deployments', {}),
    ).rejects.toThrow('GITHUB_REQUEST_FAILED');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('retries a failed GET with a bounded count', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response('fail', 503))
      .mockResolvedValueOnce(response('[]'));
    expect(await githubClient(context.repository, 'fake', fetch)('deployments')).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('one-shot real CLI adapter, simulated service', () => {
  it('publishes with only service credentials, verifies returned document and image, and returns no URL', async () => {
    const exec = vi.fn(async () => ({
      stdout: JSON.stringify({ id: sample.document, url: `${origin}/${sample.document}` }),
    }));
    const result = await publishSmoke({
      context: { environment: 'access-test', runId: '123' },
      scratch: await scratch(),
      cliPath: '/fake/cli.js',
      serviceId: 'fake-id',
      serviceSecret: 'fake-secret',
      processEnv: {
        PATH: '/fake/path',
        CLOUDFLARE_API_TOKEN: 'must-not-forward',
        GITHUB_TOKEN: 'must-not-forward',
      },
      fetchImpl: fetchFixture(`${fixtureMarker} run 123`),
      execImpl: exec,
    });
    expect(result).toBeUndefined();
    expect(exec).toHaveBeenCalledTimes(1);
    const [, args, options] = exec.mock.calls[0];
    expect(args).toContain('publish');
    expect(args).toContain('service');
    expect(options.env.MOTE_SERVICE_CLIENT_SECRET).toBe('fake-secret');
    expect(options.env.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(options.env.GITHUB_TOKEN).toBeUndefined();
    expect(JSON.stringify(args)).not.toContain('fake-secret');
  });
  it('captures failed CLI output and does not retry', async () => {
    const exec = vi.fn(async () => {
      throw new Error('secret output and private URL');
    });
    await expect(
      publishSmoke({
        context: { environment: 'access-test', runId: '123' },
        scratch: await scratch(),
        cliPath: '/fake/cli.js',
        serviceId: 'fake-id',
        serviceSecret: 'fake-secret',
        processEnv: {},
        execImpl: exec,
      }),
    ).rejects.toThrow('WRITE_OUTCOME_UNKNOWN');
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe('workflow trust boundaries', () => {
  it('provides only a manual server entry with caller-owned concurrency', async () => {
    const caller = await readFile(join(root, '.github/workflows/deploy.yml'), 'utf8');
    const shared = await readFile(join(root, '.github/workflows/_deploy.yml'), 'utf8');
    expect(caller).toContain('workflow_dispatch:');
    expect(caller).toContain('group: mote-${{ inputs.environment }}');
    expect(caller).toContain('cancel-in-progress: false');
    expect(shared).not.toContain('concurrency:');
    expect(caller + shared).not.toMatch(/npm publish|gh release|id-token: write|contents: write/);
    const prepare = shared.split('  prepare:')[1].split('  deploy:')[0];
    expect(prepare).not.toContain('secrets.');
    const write = shared.split('  write-smoke:')[1];
    expect(write).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(shared.match(/secrets\.CLOUDFLARE_API_TOKEN/g)).toHaveLength(1);
    expect(shared).not.toContain('persist-credentials: true');
  });
});
