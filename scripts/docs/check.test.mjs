import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import { dirname, join } from 'node:path';
import MarkdownIt from 'markdown-it';
import { expect, it } from 'vitest';
import { checkRepository } from './check.mjs';

const markdown = new MarkdownIt();
const readSource = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

function contractSection(file, heading) {
  const source = readSource(file);
  const tokens = markdown.parse(source, {});
  const index = tokens.findIndex(
    (token, index) => token.type === 'heading_open' && tokens[index + 1]?.content === heading,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  const opening = tokens[index];
  const next = tokens
    .slice(index + 1)
    .find((token) => token.type === 'heading_open' && token.tag <= opening.tag);
  return source.split('\n').slice(opening.map[0], next?.map[0]).join('\n') + '\n';
}

function withRepository(test) {
  const root = mkdtempSync(join(tmpdir(), 'mote-docs-'));
  function write(file, contents) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), contents);
  }
  try {
    execFileSync('git', ['init', '-q', root]);
    // Select real contract sections by Markdown structure, without stripping tags or links.
    for (const [file, heading] of [
      ['README.md', '📏 Limits'],
      ['README.zh-CN.md', '📏 限制'],
      ['docs/protocol.md', '大小与数量限额'],
    ]) {
      write(file, contractSection(file, heading));
    }
    write('CHANGELOG.md', readSource('CHANGELOG.md'));
    write('apps/cli/package.json', readSource('apps/cli/package.json'));
    // Explicit leaf fixtures satisfy the copied Changelog's local documentation links.
    write('docs/deployment.md', '# Deployment fixture\n');
    write('docs/self-hosting.md', '# Self-hosting fixture\n\n## Deployment automation\n');
    write('docs/authentication.md', '# Authentication fixture\n');
    write('tracked.md', '# Tracked');
    write('image.png', 'test-only-placeholder');
    write('.docs/ignored.md', '[bad](missing.md)');
    write('dist/ignored.md', '[bad](missing.md)');
    execFileSync('git', ['add', '.'], { cwd: root });
    test(root, write);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

it('uses tracked files but reads worktree content, ignoring scratch files and build output', () => {
  withRepository((root, write) => {
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
  });
});

it.each(['README.md', 'README.zh-CN.md', 'docs/protocol.md'])(
  'still detects upload limit drift in the real %s contract section',
  (file) => {
    withRepository((root, write) => {
      expect(checkRepository(root).errors).toEqual([]);
      const source = readFileSync(join(root, file), 'utf8');
      expect(source).toContain('≤ 2 MiB');
      write(file, source.replace('≤ 2 MiB', '≤ 2 MB'));
      expect(checkRepository(root).errors).toEqual([
        {
          file,
          line: source.split('\n').findIndex((line) => line.startsWith('| Markdown')) + 1,
          message: 'Upload limit Markdown must be ≤ 2 MiB (core limits)',
        },
      ]);
    });
  },
);

it('still checks the real CLI package version against the copied release history', () => {
  withRepository((root, write) => {
    expect(checkRepository(root).errors).toEqual([]);
    const pkg = JSON.parse(readFileSync(join(root, 'apps/cli/package.json'), 'utf8'));
    write('apps/cli/package.json', JSON.stringify({ ...pkg, version: '99.0.0' }));
    expect(checkRepository(root).errors).toEqual([
      {
        file: 'CHANGELOG.md',
        line: 1,
        message: expect.stringContaining('CLI version 99.0.0'),
      },
    ]);
  });
});
