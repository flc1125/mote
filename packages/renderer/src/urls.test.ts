import { describe, expect, it } from 'vitest';

import { safeImageUrl, safeLinkUrl } from './urls.js';

describe('URL policies with control characters (§57)', () => {
  it('strips TAB/LF/CR before judging the scheme', () => {
    // Browsers ignore these characters anywhere in a URL, so
    // "java\nscript:" must be judged as javascript: and rejected.
    expect(safeLinkUrl('java\nscript:alert(1)')).toBeNull();
    expect(safeLinkUrl('java\tscript:alert(1)')).toBeNull();
    expect(safeLinkUrl('java\r\nscript:alert(1)')).toBeNull();
    expect(safeImageUrl('java\nscript:alert(1)')).toBeNull();
    expect(safeImageUrl('data:image/svg+xml,\n<svg>')).toBeNull();
  });

  it('rejects URLs carrying other ASCII control characters', () => {
    expect(safeLinkUrl('java\x00script:alert(1)')).toBeNull();
    expect(safeLinkUrl('https://example.com/\x7f')).toBeNull();
  });

  it('emits the normalized URL for safe inputs', () => {
    expect(safeLinkUrl('https://example.com/a\nb')).toBe('https://example.com/ab');
    expect(safeLinkUrl('https://example.com/docs')).toBe('https://example.com/docs');
    expect(safeLinkUrl('#anchor')).toBe('#anchor');
    expect(safeLinkUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeImageUrl('/doc/a/AbC123')).toBe('/doc/a/AbC123');
    expect(safeImageUrl('./images/x.png')).toBe('./images/x.png');
  });

  it('still rejects dangerous schemes and absolute paths', () => {
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(safeLinkUrl('data:text/html,x')).toBeNull();
    expect(safeLinkUrl('file:///etc/passwd')).toBeNull();
    expect(safeLinkUrl('//evil.example/x')).toBeNull();
    expect(safeLinkUrl('/abs/path')).toBeNull();
    expect(safeImageUrl('data:image/svg+xml,x')).toBeNull();
  });
});
