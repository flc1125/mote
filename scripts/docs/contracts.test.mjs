import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkContracts } from './contracts.mjs';
import { parseDocument } from './documents.mjs';
import * as limits from '../../packages/core/src/limits.ts';

const root = new URL('../../', import.meta.url);
function check(overrides = {}, sourceLimits = limits) {
  const read = (file) => overrides[file] ?? readFileSync(new URL(file, root), 'utf8');
  const documents = new Map([['historical.md', parseDocument(overrides['historical.md'] ?? '')]]);
  return checkContracts(read, documents, sourceLimits);
}

describe('documentation contracts', () => {
  it('accepts the checked-in release history and limits', () => {
    expect(check()).toEqual([]);
  });

  it('allows old releases, Unreleased notes and third-party tool versions', () => {
    expect(
      check({
        'historical.md':
          'Codex 0.153.4\n\n[old](https://github.com/flc1125/mote/blob/v0.2.0/removed.md#old)\n\nUpgrade mote-cli@0.2.0 for this historical migration.',
      }),
    ).toEqual([]);
  });

  it('rejects a package version without a changelog section and unknown versioned links', () => {
    expect(
      check({
        'apps/cli/package.json': '{"version":"99.0.0"}',
        'historical.md': '[unknown](https://github.com/flc1125/mote/blob/v99.0.0/docs/cli.md)',
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'CHANGELOG.md',
          message: expect.stringContaining('CLI version 99.0.0'),
        }),
        {
          file: 'historical.md',
          line: 1,
          message: 'Versioned repository link has no Changelog release: v99.0.0',
        },
      ]),
    );
  });

  it('rejects duplicate and empty release sections', () => {
    const version = JSON.parse(
      readFileSync(new URL('apps/cli/package.json', root), 'utf8'),
    ).version;
    expect(check({ 'CHANGELOG.md': `## [${version}]\n\n## [${version}]\nNotes\n` })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: `Duplicate release: ${version}` }),
      ]),
    );
    expect(check({ 'CHANGELOG.md': `## [${version}]\n\n` })[0].message).toContain(
      'Changelog section is empty',
    );
  });

  it.each(['README.md', 'README.zh-CN.md', 'docs/protocol.md'])(
    'rejects wrong units and missing limit rows in %s',
    (file) => {
      const source = readFileSync(new URL(file, root), 'utf8');
      expect(check({ [file]: source.replace('≤ 10 MiB', '≤ 10 MB') })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ file, message: expect.stringContaining('must be ≤ 10 MiB') }),
        ]),
      );
      expect(check({ [file]: source.replace(/^\|[^\n]*≤ 10 MiB[^\n]*\n/m, '') })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ file, message: expect.stringContaining('must be ≤ 10 MiB') }),
        ]),
      );
    },
  );

  it('detects drift when core changes, not just when documentation changes', () => {
    const errors = check({}, { ...limits, MAX_ASSET_COUNT: limits.MAX_ASSET_COUNT + 1 });
    expect(errors).toHaveLength(3);
    expect(errors.every((error) => error.message.includes('must be ≤ 51'))).toBe(true);
  });

  it('rejects incorrect exact byte counts and binary-unit definitions', () => {
    const source = readFileSync(new URL('docs/protocol.md', root), 'utf8');
    expect(
      check({ 'docs/protocol.md': source.replace('2,097,152 字节', '2,000,000 字节') }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'Exact byte limit Markdown must be 2,097,152 字节' }),
      ]),
    );
    expect(
      check({
        'README.md': readFileSync(new URL('README.md', root), 'utf8').replace(
          '1,048,576',
          '1,000,000',
        ),
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'Binary unit definition must be 1 MiB = 1,048,576' }),
      ]),
    );
  });
});
