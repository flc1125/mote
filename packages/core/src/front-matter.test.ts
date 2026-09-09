import { describe, expect, it } from 'vitest';

import { stripFrontMatter } from './front-matter.js';

describe('conservative YAML front matter', () => {
  it('hides metadata mappings with nested values, lists and block scalars', () => {
    const source =
      '---\ntitle: Example\ntags: [markdown, 中文]\nauthor:\n  name: Reader\ndescription: |\n  Multiple lines\n  **literal metadata**\ncustom: true\n---\n# Body\n';
    expect(stripFrontMatter(source)).toBe('# Body\n');
  });

  it('supports BOM, CRLF and closing delimiters at EOF without changing the body', () => {
    expect(stripFrontMatter('\uFEFF---\r\ntitle: Test\r\n---\r\n\r\n# Body\r\n')).toBe(
      '\r\n# Body\r\n',
    );
    expect(stripFrontMatter('---\ntitle: Test\n---')).toBe('');
  });

  it.each([
    '---\nA normal paragraph\n---\nBody',
    '---\nHeading\n---',
    '---\nstatus: stable\n---\nBody',
    '---\n- title\n- list\n---\nBody',
    '---\n# comment only\n---\nBody',
    '\n---\ntitle: After blank\n---\nBody',
    '# Body\n\n---\ntitle: Later\n---',
    '```yaml\n---\ntitle: Code\n---\n```',
    '---\ntitle: Unclosed',
    '---\ntitle: [Unclosed\n---\nBody',
    '---\ntitle: One\ntitle: Two\n---\nBody',
    '---\ntitle: !unsafe value\n---\nBody',
    '---\ntitle: *missing\n---\nBody',
    '---\ntitle: &a [*a]\n---\nBody',
    '---\n? [complex, key]\n: value\ntitle: Test\n---\nBody',
    '+++\ntitle = "TOML"\n+++\nBody',
  ])('preserves ambiguous, unsupported or invalid input: %s', (source) => {
    expect(stripFrontMatter(source)).toBe(source);
  });

  it('preserves oversized or truncated metadata instead of hiding partial input', () => {
    const oversized = `---\ntitle: ${'x'.repeat(16_384)}\n---\nBody`;
    expect(stripFrontMatter(oversized)).toBe(oversized);
    const truncated = `---\ntitle: ${'x'.repeat(16_370)}\n---not-a-delimiter\nBody`;
    expect(stripFrontMatter(truncated)).toBe(truncated);
  });
});
