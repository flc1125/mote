import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { env, execPath } from 'node:process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const targets = JSON.parse(
  await readFile(join(root, 'scripts/workers/targets.json'), 'utf8'),
);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const require = createRequire(join(root, 'apps/api/package.json'));
export const wranglerVersion = require('wrangler/package.json').version;
const wranglerBin = join(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');

export function targetFor(environment) {
  assert(Object.hasOwn(targets.environments, environment), 'Unsupported environment');
  return targets.environments[environment];
}

export function expectedConfig(component, environment) {
  assert(['api', 'viewer'].includes(component), 'Only formal api/viewer Workers are allowed');
  const target = targetFor(environment);
  return {
    name: target[component],
    main: 'src/index.ts',
    compatibility_date: targets.compatibilityDate,
    ...(environment === 'access-test' ? { account_id: targets.accountId } : {}),
    ...(component === 'api' || environment === 'access-test'
      ? { workers_dev: false, preview_urls: false }
      : {}),
    routes: [
      {
        pattern: `${target.hostname}/${component === 'api' ? 'api/*' : '*'}`,
        zone_name: targets.zoneName,
      },
    ],
    ...(component === 'viewer'
      ? { cache: { enabled: true } }
      : {
          vars: {
            VIEWER_BASE_URL: `https://${target.hostname}`,
            MOTE_AUTH_MODE: 'cloudflare-access',
            MOTE_ACCESS_ISSUER: targets.issuer,
            MOTE_ACCESS_AUD: target.aud,
            MOTE_ACCESS_HOSTNAME: target.hostname,
          },
        }),
    r2_buckets: [{ binding: 'DOCUMENTS', bucket_name: target.bucket }],
  };
}

export function validateSourceConfig(raw, component) {
  const { env: environments, ...base } = raw;
  assert(
    isDeepStrictEqual(base, expectedConfig(component, 'production')),
    'Production configuration drift',
  );
  assert.deepEqual(Object.keys(environments ?? {}), ['access-test'], 'Unexpected environments');
  assert(
    isDeepStrictEqual(
      { ...base, ...environments['access-test'] },
      expectedConfig(component, 'access-test'),
    ),
    'Test configuration drift',
  );
  assert(
    Object.hasOwn(environments['access-test'], 'r2_buckets'),
    'Explicit test R2 binding required',
  );
  if (component === 'api')
    assert(Object.hasOwn(environments['access-test'], 'vars'), 'Explicit test vars required');
}

export function sourceConfig(component, projectRoot = root) {
  assert(['api', 'viewer'].includes(component), 'Invalid component');
  const { experimental_readRawConfig: readRaw } = require('wrangler');
  const parsed = readRaw({ config: join(projectRoot, `apps/${component}/wrangler.toml`) });
  assert(!parsed.redirected, 'Redirected Wrangler configuration is not allowed');
  validateSourceConfig(parsed.rawConfig, component);
  return parsed.rawConfig;
}

export function offlineWrangler(args, cwd, logPath) {
  assert(
    args[0] === 'deploy' && args.includes('--dry-run'),
    'Offline helper requires deploy --dry-run',
  );
  const envFile = join(dirname(logPath), 'empty.env');
  writeFileSync(envFile, '', { mode: 0o600 });
  const cleanEnv = Object.fromEntries(
    ['PATH', 'HOME', 'SystemRoot', 'TMPDIR', 'TEMP']
      .filter((key) => env[key])
      .map((key) => [key, env[key]]),
  );
  execFileSync(execPath, [wranglerBin, ...args, '--env-file', envFile], {
    cwd,
    stdio: 'pipe',
    env: {
      ...cleanEnv,
      WRANGLER_SEND_METRICS: 'false',
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
      WRANGLER_LOG_PATH: logPath,
    },
  });
}

export async function uploadParts(file) {
  const bytes = await readFile(file);
  const boundary = bytes.subarray(0, bytes.indexOf('\r\n')).toString().slice(2);
  assert(/^[-\w]+$/.test(boundary), 'Invalid Wrangler multipart output');
  const form = await new globalThis.Response(bytes, {
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
  }).formData();
  const parts = {};
  for (const [name, value] of form) {
    assert(!Object.hasOwn(parts, name), 'Duplicate upload part');
    const content =
      typeof value === 'string' ? Buffer.from(value) : Buffer.from(await value.arrayBuffer());
    parts[name] =
      name === 'metadata'
        ? JSON.parse(content.toString())
        : { sha256: sha256(content), size: content.length };
  }
  assert.deepEqual(
    Object.keys(parts).sort(),
    ['index.js', 'metadata'],
    'Unexpected upload modules',
  );
  assert.equal(parts.metadata.main_module, 'index.js');
  return parts;
}
