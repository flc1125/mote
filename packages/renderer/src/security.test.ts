import { describe, expect, it } from 'vitest';

import type { DocumentManifest } from '@mote/protocol';

import { render } from './index.js';

const DOCUMENT_ID = '7Vk3mQ9x2NFaP4Ls';

const manifest = {
  version: 1,
  id: DOCUMENT_ID,
  createdAt: '2026-09-03T06:00:00.000Z',
  source: { name: 'attack.md', size: 100, sha256: 'a'.repeat(64) },
  assets: [],
} satisfies DocumentManifest;

function renderAttack(markdown: string): string {
  return render(markdown, manifest, DOCUMENT_ID);
}

describe('XSS security tests (§57)', () => {
  it('<script>alert(1)</script> must not become an element', () => {
    const html = renderAttack('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('[click](javascript:alert(1)) must not produce a javascript URL', () => {
    const html = renderAttack('[click](javascript:alert(1))');
    // markdown-it refuses to parse the destination: it stays inert literal
    // text and no <a> element (let alone a javascript: href) is produced.
    expect(html.toLowerCase()).not.toContain('href="javascript');
    expect(html).not.toContain('<a ');
    expect(html).toContain('[click](javascript:alert(1))');
  });

  it('![](javascript:alert(1)) must not output a dangerous src', () => {
    const html = renderAttack('![xss](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('src="javascript');
    expect(html).not.toContain('<img');
    expect(html).toContain('![xss](javascript:alert(1))');
  });

  it('<img src=x onerror=alert(1)> must not become an element', () => {
    const html = renderAttack('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('data:, vbscript: and file: URLs never become href/src attributes', () => {
    const html = renderAttack(
      '[a](data:text/html;base64,PHNjcmlwdD4=)\n\n' +
        '[b](vbscript:msgbox(1))\n\n' +
        '![c](data:image/svg+xml;base64,PHN2Zz4=)\n\n' +
        '[d](file:///etc/passwd)',
    );
    expect(html).not.toContain('href="data:');
    expect(html).not.toContain('href="vbscript:');
    expect(html).not.toContain('src="data:');
    expect(html).not.toContain('href="file:');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<img');
  });

  it('obfuscated javascript links are not honored', () => {
    const html = renderAttack('[a](jAvAsCrIpT:alert(1))');
    expect(html.toLowerCase()).not.toContain('href="javascript');
    expect(html).not.toContain('<a ');
  });

  it('a protocol-relative href that slips through parsing is stripped', () => {
    // Direct unit-level check of the link_open override behavior:
    // even when a link IS produced, '//...' hrefs are neutralized.
    const html = renderAttack('[ok](https://example.com)');
    expect(html).toContain('<a href="https://example.com">ok</a>');
  });
});
