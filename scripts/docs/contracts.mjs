import {
  MAX_MARKDOWN_BYTES,
  MAX_ASSET_BYTES,
  MAX_BUNDLE_BYTES,
  MAX_ASSET_COUNT,
} from '../../packages/core/src/limits.ts';
import { stableTagVersion } from '../release/lib.mjs';
import { repositoryLink } from './documents.mjs';

const MiB = 1024 * 1024;
const defaults = { MAX_MARKDOWN_BYTES, MAX_ASSET_BYTES, MAX_BUNDLE_BYTES, MAX_ASSET_COUNT };

export function checkContracts(read, documents, limits = defaults) {
  const errors = [];
  const report = (file, line, message) => errors.push({ file, line, message });
  const changelog = read('CHANGELOG.md');
  const { version } = JSON.parse(read('apps/cli/package.json'));
  try {
    stableTagVersion(`v${version}`, version, changelog);
  } catch (error) {
    report('CHANGELOG.md', 1, `CLI version ${version}: ${error.message}`);
  }
  const releases = new Set();
  for (const match of changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)) {
    const line = changelog.slice(0, match.index).split('\n').length;
    if (releases.has(match[1])) report('CHANGELOG.md', line, `Duplicate release: ${match[1]}`);
    releases.add(match[1]);
    try {
      stableTagVersion(`v${match[1]}`, match[1], changelog);
    } catch (error) {
      report('CHANGELOG.md', line, error.message);
    }
  }
  for (const [file, document] of documents) {
    for (const { url, line } of document.links) {
      const repo = repositoryLink(url);
      if (repo && /^v\d/.test(repo.ref) && !releases.has(repo.ref.slice(1))) {
        report(file, line, `Versioned repository link has no Changelog release: ${repo.ref}`);
      }
    }
  }

  // Canonical upload tables: values come from core, not another copy of the limits.
  const tables = {
    'README.md': ['Markdown', 'Single image', 'Whole bundle', 'Uploaded assets'],
    'README.zh-CN.md': ['Markdown', '单个图片', '整个文档包', '上传资产数量'],
    'docs/protocol.md': [
      'Markdown',
      '单个上传图片',
      '文档包（Markdown + 上传图片）',
      '上传资产条目',
    ],
  };
  const values = [
    limits.MAX_MARKDOWN_BYTES,
    limits.MAX_ASSET_BYTES,
    limits.MAX_BUNDLE_BYTES,
    limits.MAX_ASSET_COUNT,
  ];
  for (const [file, labels] of Object.entries(tables)) {
    const source = read(file);
    const rows = source.split('\n').map((text, index) => ({
      line: index + 1,
      cells: text.startsWith('|')
        ? text
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim())
        : [],
    }));
    labels.forEach((label, index) => {
      const matches = rows.filter((row) => row.cells[0] === label);
      const expected = index === 3 ? `≤ ${values[index]}` : `≤ ${values[index] / MiB} MiB`;
      if (matches.length !== 1 || matches[0].cells[1] !== expected) {
        report(
          file,
          matches[0]?.line ?? 1,
          `Upload limit ${label} must be ${expected} (core limits)`,
        );
      }
      if (file === 'docs/protocol.md' && index < 3) {
        const bytes = `${values[index].toLocaleString('en-US')} 字节`;
        if (matches[0]?.cells[2] !== bytes) {
          report(file, matches[0]?.line ?? 1, `Exact byte limit ${label} must be ${bytes}`);
        }
      }
    });
    if (!source.includes(`1 MiB = ${MiB.toLocaleString('en-US')}`)) {
      report(file, 1, `Binary unit definition must be 1 MiB = ${MiB.toLocaleString('en-US')}`);
    }
  }
  return errors;
}
