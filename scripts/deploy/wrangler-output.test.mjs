import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { cloudflareClient } from './cloudflare.mjs';
import { wranglerBin } from './lib.mjs';

const exec = promisify(execFile);
const version = '00000000-0000-0000-0000-000000000001';

// Exercise the installed Wrangler handlers and logger in a child process.
// Only auth, Cloudflare responses and telemetry are replaced; JSON rendering
// and log-level filtering are real. Internal names intentionally fail loudly
// on an incompatible Wrangler upgrade instead of silently mocking the output.
const appended = `
exports.testHandler = async function () {
  init_src7();
  setLogLevel(logger2.loggerLevel);
  sendMetricsEvent = () => {};
  requireAuth = async () => 'fake-account';
  fetchLatestDeployments2 = async () => [
    {
      created_on: '2026-09-06',
      versions: [{ version_id: '${version}', percentage: 100 }],
    },
  ];
  fetchVersion2 = async () => ({ annotations: { 'workers/message': 'fake-marker' } });
  const handler =
    process.argv[2] === 'deployments'
      ? deploymentsListCommand.handler
      : versionsViewCommand.handler;
  await handler(
    { name: 'fake-worker', json: true, versionId: '${version}' },
    { config: { send_metrics: false } },
  );
};
`;
const harness = `
  const fs = require('node:fs');
  const Module = require('node:module');
  const path = require('node:path');
  const file = path.resolve(path.dirname(process.argv[1]), '../wrangler-dist/cli.js');
  const appended = ${JSON.stringify(appended)};
  globalThis.fetch = () => { throw new Error('Network forbidden in offline contract test'); };
  const mod = new Module(file);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(fs.readFileSync(file, 'utf8') + appended, file);
  mod.exports.testHandler().catch(() => { process.exitCode = 1; });
`;

it('preserves real Wrangler JSON through the deployment adapter without forwarding logs', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'mote-wrangler-output-'));
  try {
    const execImpl = (_bin, args, options) =>
      exec(execPath, ['-e', harness, ...args], {
        ...options,
        env: { ...options.env, WRANGLER_WRITE_LOGS: 'false' },
      });
    // Negative control: the former production setting really suppresses JSON.
    for (const command of ['deployments', 'versions']) {
      const result = await execImpl(execPath, [wranglerBin, command], {
        cwd: scratch,
        env: { HOME: scratch, WRANGLER_LOG: 'error', WRANGLER_SEND_METRICS: 'false' },
      });
      expect(result.stdout).toBe('');
    }
    const cloud = await cloudflareClient({
      environment: 'access-test',
      directory: scratch,
      scratch,
      token: 'fake-token',
      processEnv: {},
      execImpl,
    });
    expect(await cloud.snapshot()).toEqual({
      api: { version, marker: 'fake-marker' },
      viewer: { version, marker: 'fake-marker' },
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}, 30000);
