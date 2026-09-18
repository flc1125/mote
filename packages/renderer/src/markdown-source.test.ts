import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';

import { render } from './index.js';
import { PAGE_SCRIPT } from './page-script.js';
import { THEME_SCRIPT } from './theme-script.js';

const id = '7Vk3mQ9x2NFaP4Ls';
function page(source: string) {
  return render(
    source,
    {
      version: 1,
      id,
      createdAt: '2026-09-18T00:00:00.000Z',
      source: {
        name: 'source.md',
        size: new TextEncoder().encode(source).length,
        sha256: 'a'.repeat(64),
      },
      assets: [],
    },
    id,
  );
}

function payload(html: string) {
  let encoded = '';
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === 'input' && attributes.class === 'markdown-source') encoded = attributes.value!;
    },
  });
  parser.end(html);
  return Buffer.from(encoded, 'base64').toString('utf8');
}

describe('copyable Markdown source', () => {
  it('preserves original metadata, extensions, Unicode, CRLF, BOM and relative images', () => {
    const source =
      '\ufeff---\r\ntitle: hidden metadata\r\n---\r\n# 中文 📝\r\n\r\n' +
      '=== "Tab"\r\n\r\n    ??? note "Closed"\r\n\r\n        ![图](../assets/a.png)\r\n' +
      '\r\n```html\r\n<div>&amp;</div>\r\n```\r\n\r\nNote[^1]\r\n\r\n[^1]: footnote\r\n';
    expect(payload(page(source))).toBe(source);
  });

  it('keeps hostile source inert outside the sanitized article and fixed scripts', () => {
    const source =
      '</textarea></dialog></script><script>alert(1)</script>' +
      '\n<input autofocus onfocus="alert(2)"><img src=x onerror="alert(3)">\u0000&"\'';
    const html = page(source);
    expect(payload(html)).toBe(source);
    const scripts: string[] = [];
    const handlers: string[] = [];
    let script = false;
    new Parser({
      onopentag(name, attrs) {
        script = name === 'script';
        for (const attr of Object.keys(attrs)) if (attr.startsWith('on')) handlers.push(attr);
      },
      ontext(text) {
        if (script) scripts.push(text);
      },
      onclosetag(name) {
        if (name === 'script') script = false;
      },
    }).end(html);
    expect(handlers).toEqual([]);
    expect(scripts).toEqual(expect.arrayContaining([THEME_SCRIPT, PAGE_SCRIPT]));
    expect(scripts.some((text) => /alert\([123]\)/.test(text))).toBe(false);
  });

  it('handles the 2 MiB source limit without argument-list overflow or truncation', () => {
    const source = 'x'.repeat(2 * 1024 * 1024 - 2) + '\r\n';
    expect(payload(page(source))).toBe(source);
  });

  it('provides a copy control for an empty source too', () => {
    const html = page('');
    expect(html).toContain('aria-label="Copy Markdown source"');
    expect(payload(html)).toBe('');
  });
});
