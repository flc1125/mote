import { describe, expect, it } from 'vitest';

import { normalizeRelativePath } from './path.js';

describe('normalizeRelativePath', () => {
  it('resolves . and .. segments', () => {
    expect(normalizeRelativePath('./images/../images/a.png')).toBe('images/a.png');
    expect(normalizeRelativePath('a/./b//c')).toBe('a/b/c');
    expect(normalizeRelativePath('./a.png')).toBe('a.png');
  });

  it('preserves leading .. segments', () => {
    expect(normalizeRelativePath('../a.png')).toBe('../a.png');
    expect(normalizeRelativePath('../a/../b.png')).toBe('../b.png');
    expect(normalizeRelativePath('../../x/y.png')).toBe('../../x/y.png');
  });

  it('converts backslashes to forward slashes', () => {
    expect(normalizeRelativePath('images\\a.png')).toBe('images/a.png');
    expect(normalizeRelativePath('.\\images\\..\\a.png')).toBe('a.png');
  });

  it('throws for non-local references', () => {
    expect(() => normalizeRelativePath('https://example.com/a.png')).toThrow();
    expect(() => normalizeRelativePath('/abs/a.png')).toThrow();
    expect(() => normalizeRelativePath('javascript:alert(1)')).toThrow();
  });

  it('throws when the reference resolves to an empty path', () => {
    expect(() => normalizeRelativePath('./')).toThrow(/empty path/);
    expect(() => normalizeRelativePath('a/..')).toThrow(/empty path/);
  });
});
