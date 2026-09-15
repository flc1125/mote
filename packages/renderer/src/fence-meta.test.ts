import { describe, expect, it } from 'vitest';
import { parseFenceMeta } from './fence-meta.js';

describe('bounded fence metadata', () => {
  it('accepts reordered keys, quoted text and overlapping ranges without expanding endpoints', () => {
    expect(
      parseFenceMeta(' hl_lines="2-4 1 3-6 1000000" title="a\\"b\\\\c" linenums="10"'),
    ).toEqual({
      title: 'a"b\\c',
      start: 10,
      ranges: [
        [1, 6],
        [1000000, 1000000],
      ],
    });
    expect(parseFenceMeta(' title=""')).toEqual({ title: '' });
  });
  it.each([
    ' title="ok" onclick="bad"',
    ' title="one" title="two"',
    ' title="unterminated',
    ' title="bad\\n"',
    ' title="one"linenums="1"',
    ' title=unquoted',
    ' linenums="0"',
    ' linenums="01"',
    ' linenums="-1"',
    ' linenums="1000001"',
    ' hl_lines="3-2"',
    ' hl_lines="0"',
    ' hl_lines=""',
    ' hl_lines="1\t2"',
    ' hl_lines="1-999999999999999999999999999999999"',
    ' TITLE="case"',
    ` title="${'x'.repeat(241)}"`,
    ` hl_lines="${Array(65).fill('1').join(' ')}"`,
    ' '.repeat(1025),
  ])('rejects the entire tail: %s', (tail) => {
    expect(parseFenceMeta(tail)).toEqual({});
  });
  it('accepts the exact title boundary', () => {
    expect(parseFenceMeta(` title="${'字'.repeat(240)}"`).title).toHaveLength(240);
  });
});
