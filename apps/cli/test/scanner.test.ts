import { describe, expect, it } from 'vitest';

import { extractLocalImageReferences } from '../src/scanner.js';

describe('extractLocalImageReferences (§22)', () => {
  it('finds inline images', () => {
    expect(extractLocalImageReferences('![foo](./foo.png)\n\n![bar](images/bar.png)')).toEqual([
      './foo.png',
      'images/bar.png',
    ]);
  });

  it('finds reference-style images', () => {
    const markdown = '![foo][image]\n\n[image]: ./images/foo.png';
    expect(extractLocalImageReferences(markdown)).toEqual(['./images/foo.png']);
  });

  it('finds shortcut reference images', () => {
    const markdown = '![image]\n\n[image]: ./images/foo.png';
    expect(extractLocalImageReferences(markdown)).toEqual(['./images/foo.png']);
  });

  it('finds images nested inside links', () => {
    const markdown = '[![alt](./click.png)](https://example.com)';
    expect(extractLocalImageReferences(markdown)).toEqual(['./click.png']);
  });

  it('finds parent-directory references', () => {
    expect(extractLocalImageReferences('![up](../shared/logo.png)')).toEqual([
      '../shared/logo.png',
    ]);
  });

  it('skips remote URLs', () => {
    const markdown = '![a](https://example.com/a.png)\n\n![b](http://example.com/b.png)';
    expect(extractLocalImageReferences(markdown)).toEqual([]);
  });

  it('skips non-file schemes and protocol-relative URLs', () => {
    const markdown = [
      '![a](data:image/png;base64,xxxx)',
      '![b](javascript:alert(1))',
      '![c](//cdn.example.com/c.png)',
    ].join('\n\n');
    expect(extractLocalImageReferences(markdown)).toEqual([]);
  });

  it('returns each distinct spelling once, in order of appearance', () => {
    const markdown = '![a](./a.png)\n\n![a2](./a.png)\n\n![b](images/../a.png)';
    expect(extractLocalImageReferences(markdown)).toEqual(['./a.png', 'images/../a.png']);
  });

  it('ignores links that are not images', () => {
    expect(extractLocalImageReferences('[doc](./doc.md)')).toEqual([]);
  });
});
