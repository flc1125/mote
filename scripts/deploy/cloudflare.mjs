import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { promisify } from 'node:util';
import { targets, targetFor, wranglerBin } from './lib.mjs';
import { DeployError, isVersion, requireThat } from './policy.mjs';
import { readRetry } from './smoke.mjs';

const execAsync = promisify(execFile);

export async function cloudflareClient({
  environment,
  directory,
  scratch,
  token,
  processEnv,
  execImpl = execAsync,
}) {
  const target = targetFor(environment);
  requireThat(Boolean(token), 'MISSING_DEPLOY_TOKEN');
  const envFile = join(scratch, 'empty.env');
  await writeFile(envFile, '', { mode: 0o600 });
  const run = async (args) => {
    try {
      const result = await execImpl(execPath, [wranglerBin, ...args, '--env-file', envFile], {
        cwd: scratch,
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          PATH: processEnv.PATH,
          HOME: scratch,
          TMPDIR: scratch,
          CLOUDFLARE_API_TOKEN: token,
          CLOUDFLARE_ACCOUNT_ID: targets.accountId,
          WRANGLER_SEND_METRICS: 'false',
          WRANGLER_LOG: 'error',
          WRANGLER_LOG_PATH: join(scratch, 'wrangler.log'),
        },
      });
      return result.stdout;
    } catch {
      throw new DeployError('CLOUDFLARE_COMMAND_FAILED');
    }
  };
  const current = async (component) =>
    readRetry(async () => {
      const deployments = JSON.parse(
        await run(['deployments', 'list', '--name', target[component], '--json']),
      );
      requireThat(Array.isArray(deployments), 'INVALID_CLOUDFLARE_RESPONSE');
      const latest = deployments.sort(
        (a, b) => Date.parse(b.created_on) - Date.parse(a.created_on),
      )[0];
      requireThat(
        latest?.versions?.length === 1 && latest.versions[0].percentage === 100,
        'UNSUPPORTED_TRAFFIC_SPLIT',
      );
      const version = latest.versions[0].version_id;
      requireThat(isVersion(version), 'INVALID_CLOUDFLARE_VERSION');
      const detail = JSON.parse(
        await run(['versions', 'view', version, '--name', target[component], '--json']),
      );
      return { version, marker: detail.annotations?.['workers/message'] ?? null };
    });
  return {
    async snapshot() {
      return { viewer: await current('viewer'), api: await current('api') };
    },
    async upload(component, marker) {
      requireThat(['api', 'viewer'].includes(component), 'INVALID_COMPONENT');
      let completed = false;
      try {
        await run([
          'deploy',
          '--config',
          join(directory, component, 'wrangler.json'),
          '--env',
          '',
          '--no-bundle',
          '--tag',
          marker.split(':').at(-1),
          '--message',
          marker,
        ]);
        completed = true;
      } catch {
        /* Read back code activation, but never assume settings/route success. */
      }
      try {
        const actual = await current(component);
        return completed && actual.marker === marker
          ? { state: 'success', version: actual.version }
          : { state: 'unknown', observedVersion: actual.version };
      } catch {
        return { state: 'unknown' };
      }
    },
  };
}
