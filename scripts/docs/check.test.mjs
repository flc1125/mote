import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { checkRepository } from './check.mjs';

it('uses tracked files but reads worktree content, ignoring scratch files and build output', () => {
  const root = mkdtempSync(join(tmpdir(), 'mote-docs-'));
  function write(file, contents) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), contents);
  }
  try {
    execFileSync('git', ['init', '-q', root]);
    for (const file of [
      'README.md',
      'README.zh-CN.md',
      'docs/protocol.md',
      'CHANGELOG.md',
      'apps/cli/package.json',
    ]) {
      write(file, readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
    }
    // Only exercise link inventory here; preserve the real contract tables.
    for (const file of ['README.md', 'README.zh-CN.md', 'docs/protocol.md', 'CHANGELOG.md']) {
      const source = readFileSync(join(root, file), 'utf8');
      write(file, source.replace(/\[[^\]\n]+\]\([^)]+\)/g, '').replace(/<[^>]+>/g, ''));
    }
    write('tracked.md', '# Tracked');
    write('image.png', 'test-only-placeholder');
    write('.docs/ignored.md', '[bad](missing.md)');
    write('dist/ignored.md', '[bad](missing.md)');
    execFileSync('git', ['add', '.'], { cwd: root });
    write('untracked.md', '[bad](missing.md)');
    expect(checkRepository(root).errors).toEqual([]);
    write('tracked.md', '[link](untracked.md)');
    expect(checkRepository(root).errors).toEqual([
      { file: 'tracked.md', line: 1, message: 'Untracked or missing target: untracked.md' },
    ]);
    execFileSync('git', ['add', 'untracked.md'], { cwd: root });
    write('untracked.md', '# Present');
    expect(checkRepository(root).errors).toEqual([]);
    write('tracked.md', '![image](image.png)');
    rmSync(join(root, 'image.png'));
    expect(checkRepository(root).errors).toEqual([
      { file: 'tracked.md', line: 1, message: 'Untracked or missing target: image.png' },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
