import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { platform } from 'node:process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
export const writeJson = (file, value) => writeFile(file, json(value));
export const pnpm = platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, stdio: 'pipe', ...options });
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
