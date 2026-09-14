import { describe, expect, it } from 'vitest';
import { checkDocuments, parseDocument } from './documents.mjs';

function check(files) {
  return checkDocuments(Object.keys(files), (file) => files[file]);
}

describe('documentation references', () => {
  it('resolves encoded paths, reference links, root paths, directories and GitHub main URLs', () => {
    const result = check({
      'README.md':
        '[guide][g]\n\n[g]: <docs/中文 guide.md#中文-标题>\n\n[dir](docs/)\n[code](/src/a.ts)\n[query](src/a.ts?raw=1)',
      'docs/中文 guide.md':
        '# 中文 *标题*\n\n[home](../README.md)\n![photo](../assets/a%20b%23%25.png)\n[api](https://github.com/flc1125/mote/blob/main/src/a.ts)',
      'assets/a b#%.png': '',
      'src/a.ts': '',
    });
    expect(result.errors).toEqual([]);
    expect(result.references).toBe(7);
  });

  it('uses GitHub slugs for punctuation, emoji, inline markup and colliding numbered headings', () => {
    const result = check({
      'README.md': [
        '# 中文：标题',
        '# 🚀 Start `here`',
        '# Repeat',
        '# Repeat-1',
        '# Repeat',
        '# <em>HTML</em> &amp; text',
        '# ![Logo](logo.png)',
        '[a](#中文标题) [b](#-start-here) [c](#repeat-2) [d](#html--text) [e](#logo)',
      ].join('\n\n'),
      'logo.png': '',
    });
    expect(result.errors).toEqual([]);
    expect(result.documents.get('README.md').anchors).toContain('repeat-1');
  });

  it('checks HTML href/src/srcset and explicit ids with locations', () => {
    const result = check({
      'README.md':
        '<a id="旧锚点"></a>\n\n[old](#旧锚点)\n\n<picture>\n<source srcset="assets/a,b.png 1x, assets/a.png 2x">\n<img src="assets/a.png" srcset="data:image/png;base64,AAAA 1x, missing.png 2x">\n</picture>\n\n<a href="no.md">missing</a>',
      'assets/a,b.png': '',
      'assets/a.png': '',
    });
    expect(result.errors).toEqual([
      { file: 'README.md', line: 7, message: 'Untracked or missing target: missing.png' },
      { file: 'README.md', line: 10, message: 'Untracked or missing target: no.md' },
    ]);
    expect(result.external).toBe(1);
  });

  it('does not mistake fenced, indented, inline or HTML code and comments for links', () => {
    const result = check({
      'README.md': [
        '```md\n[bad](missing.md)\n<img src="missing.png">\n```',
        '    [bad](missing.md)',
        '`[bad](missing.md)`',
        '<!-- <img src="missing.png"> -->',
        '<pre><code><a href="missing.md">code</a></code></pre>',
        '<code>[bad](missing.md)</code> [good](real.md)',
      ].join('\n\n'),
      'real.md': '# Real',
    });
    expect(result.errors).toEqual([]);
    expect(result.references).toBe(1);
  });

  it('reports broken relative links, missing fragments and paths escaping the repository', () => {
    const result = check({
      'docs/a.md':
        '# Present\n\n[missing](no.md)\n\n[fragment](#absent)\n\n[out](../../private.md)\n\n[bad](#%E0%A4)',
    });
    expect(result.errors.map((error) => [error.line, error.message])).toEqual([
      [3, 'Untracked or missing target: no.md'],
      [5, 'Missing anchor: #absent'],
      [7, 'Untracked or missing target: ../../private.md'],
      [9, 'Invalid reference #%E0%A4: URI malformed'],
    ]);
  });

  it('does not fetch external links or resolve historical paths against current files', () => {
    const result = check({
      'README.md':
        '[web](https://example.invalid/gone) [mail](mailto:docs@example.invalid) [cdn](//example.invalid/a) [old](https://github.com/flc1125/mote/blob/v0.1.0/removed.md#old)',
    });
    expect(result.errors).toEqual([]);
    expect(result.external).toBe(4);
  });

  it('reports invalid JSON examples and unreadable tracked Markdown', () => {
    expect(parseDocument('```json\n{"bad":}\n```').errors[0]).toMatchObject({
      line: 1,
      message: expect.stringContaining('Invalid JSON code block'),
    });
    expect(
      checkDocuments(['gone.md'], () => {
        throw new Error('deleted from worktree');
      }).errors,
    ).toEqual([
      { file: 'gone.md', line: 1, message: 'Cannot read Markdown: deleted from worktree' },
    ]);
  });
});
