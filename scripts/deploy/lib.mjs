import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { env, execPath, platform } from 'node:process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const targets = JSON.parse(
  await readFile(join(root, 'scripts/deploy/targets.json'), 'utf8'),
);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
export const writeJson = (file, value) => writeFile(file, json(value));
export const pnpm = platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const require = createRequire(join(root, 'apps/api/package.json'));
export const wranglerVersion = require('wrangler/package.json').version;
export const wranglerBin = join(
  dirname(require.resolve('wrangler/package.json')),
  'bin/wrangler.js',
);

export function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, stdio: 'pipe', ...options });
}

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

// Only known fields/configuration are accepted, including unknown dormant envs.
// This intentionally fails closed when a reviewed configuration changes.
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
  // R2/vars do not inherit in Wrangler named environments.
  assert(
    Object.hasOwn(environments['access-test'], 'r2_buckets'),
    'Explicit test R2 binding required',
  );
  if (component === 'api')
    assert(Object.hasOwn(environments['access-test'], 'vars'), 'Explicit test vars required');
}

export function sourceConfig(component) {
  assert(['api', 'viewer'].includes(component), 'Invalid component');
  // Isolate Wrangler's experimental parser behind this adapter and regression tests.
  const { experimental_readRawConfig: readRaw } = require('wrangler');
  const parsed = readRaw({ config: join(root, `apps/${component}/wrangler.toml`) });
  assert(!parsed.redirected, 'Redirected Wrangler configuration is not allowed');
  validateSourceConfig(parsed.rawConfig, component);
  return parsed.rawConfig;
}

export function deploymentConfig(component, environment) {
  return {
    ...expectedConfig(component, environment),
    account_id: targets.accountId,
    main: 'index.js',
    no_bundle: true,
    find_additional_modules: false,
    upload_source_maps: false,
    // Dependency inventory is recorded in build.json, independent of upload cwd.
    dependencies_instrumentation: { enabled: false },
  };
}

export function stableTagVersion(tag, packageVersion, changelog) {
  assert(
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag),
    'A stable vX.Y.Z tag is required',
  );
  const version = tag.slice(1);
  assert.equal(version, packageVersion, 'Tag/package version mismatch');
  const sections = [
    ...changelog.matchAll(/^## \[([^\]]+)\][^\n]*\n([\s\S]*?)(?=^## \[|$(?![\s\S]))/gm),
  ];
  const matches = sections.filter((section) => section[1] === version);
  assert.equal(matches.length, 1, 'Exactly one matching changelog section is required');
  assert(matches[0][2].trim(), 'Changelog section is empty');
  return matches[0][2].trim() + '\n';
}

export function assertTaggedSha(expectedSha, taggedSha) {
  assert(/^[a-f0-9]{40}$/.test(expectedSha), 'A complete checkout SHA is required');
  assert.equal(taggedSha, expectedSha, 'Tag does not point to the checkout SHA');
}

// Do not inherit CI name overrides, local auth or .env into an offline build.
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
  run(execPath, [wranglerBin, ...args, '--env-file', envFile], {
    cwd,
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

export async function fileInventory(directory, prefix = '') {
  const directoryInfo = await lstat(directory);
  assert(
    directoryInfo.isDirectory() && !directoryInfo.isSymbolicLink(),
    'Artifact directory symlinks are not allowed',
  );
  const result = {};
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    const key = prefix + name;
    const info = await lstat(path);
    assert(!info.isSymbolicLink(), 'Artifact symlinks are not allowed');
    if (info.isDirectory()) Object.assign(result, await fileInventory(path, `${key}/`));
    else {
      assert(info.isFile(), 'Only regular artifact files are allowed');
      result[key] = { sha256: sha256(await readFile(path)), size: info.size };
    }
  }
  return result;
}

export function assertInventory(actual, expected) {
  assert(isDeepStrictEqual(actual, expected), 'Artifact inventory/digest mismatch');
}
