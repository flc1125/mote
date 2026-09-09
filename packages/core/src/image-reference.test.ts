import { describe, expect, it } from 'vitest';

import { normalizeImageReference } from './image-reference.js';

describe('normalizeImageReference', () => {
  it.each([
    ['图片/a (1).png', '图片/a (1).png'],
    ['%E5%9B%BE%E7%89%87/a%20(1).png', '图片/a (1).png'],
    ['./images/../a%20b.png', 'a b.png'],
    ['../shared/a.png', '../shared/a.png'],
    ['100%25.png', '100%.png'],
    ['literal%2520.png', 'literal%20.png'],
    ['100%.png', '100%.png'],
  ])('normalizes %s once', (source, expected) => {
    expect(normalizeImageReference(source)).toBe(expected);
  });

  it.each([
    'https://example.com/a.png',
    '%2Fetc/passwd',
    '%2f%2fhost/a.png',
    '%5C%5Chost/a.png',
    'data%3Aimage/png',
    'C%3A%5Ca.png',
    'a%00.png',
    'a%0a.png',
    './',
  ])('rejects nonlocal or invalid destinations: %s', (source) => {
    expect(() => normalizeImageReference(source)).toThrow();
  });
});
