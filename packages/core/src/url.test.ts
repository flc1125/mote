import { describe, expect, it } from 'vitest';

import { isLocalReference, isRemoteUrl } from './url.js';

describe('isRemoteUrl', () => {
  it('detects http and https URLs case-insensitively', () => {
    expect(isRemoteUrl('https://example.com/a.png')).toBe(true);
    expect(isRemoteUrl('http://example.com/a.png')).toBe(true);
    expect(isRemoteUrl('HTTPS://example.com/a.png')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isRemoteUrl('./a.png')).toBe(false);
    expect(isRemoteUrl('//cdn.example.com/a.png')).toBe(false);
    expect(isRemoteUrl('ftp://example.com/a.png')).toBe(false);
  });
});

describe('isLocalReference', () => {
  it('accepts relative references (§22)', () => {
    expect(isLocalReference('./foo.png')).toBe(true);
    expect(isLocalReference('../foo.png')).toBe(true);
    expect(isLocalReference('images/foo.png')).toBe(true);
    expect(isLocalReference('foo.png')).toBe(true);
  });

  it('rejects remote and protocol-relative URLs', () => {
    expect(isLocalReference('https://example.com/a.png')).toBe(false);
    expect(isLocalReference('http://example.com/a.png')).toBe(false);
    expect(isLocalReference('//example.com/a.png')).toBe(false);
  });

  it('rejects dangerous or non-file schemes', () => {
    expect(isLocalReference('javascript:alert(1)')).toBe(false);
    expect(isLocalReference('data:image/png;base64,xxxx')).toBe(false);
    expect(isLocalReference('mailto:a@b.c')).toBe(false);
    expect(isLocalReference('JaVaScRiPt:alert(1)')).toBe(false);
  });

  it('rejects fragments, absolute paths, and empty input', () => {
    expect(isLocalReference('#section')).toBe(false);
    expect(isLocalReference('/abs/path.png')).toBe(false);
    expect(isLocalReference('C:\\docs\\a.png')).toBe(false);
    expect(isLocalReference('C:/docs/a.png')).toBe(false);
    expect(isLocalReference('')).toBe(false);
    expect(isLocalReference('   ')).toBe(false);
  });
});
