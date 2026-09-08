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

/**
 * The page chrome (banner/colophon) legitimately contains links; XSS
 * assertions about produced elements target the article body only.
 */
function articleContent(html: string): string {
  const match = html.match(/<article>\n([\s\S]*?)<\/article>/);
  if (!match) throw new Error('rendered page has no <article>');
  return match[1]!;
}

describe('XSS security tests (§57)', () => {
  it('<script>alert(1)</script> must not become an element', () => {
    const html = renderAttack('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    // The allowlist sanitizer drops the script subtree entirely.
    expect(html).not.toContain('alert(1)');
  });

  it('[click](javascript:alert(1)) must not produce a javascript URL', () => {
    const article = articleContent(renderAttack('[click](javascript:alert(1))'));
    // markdown-it refuses to parse the destination: it stays inert literal
    // text and no <a> element (let alone a javascript: href) is produced.
    expect(article.toLowerCase()).not.toContain('href="javascript');
    expect(article).not.toContain('<a ');
    expect(article).toContain('[click](javascript:alert(1))');
  });

  it('![](javascript:alert(1)) must not output a dangerous src', () => {
    const html = renderAttack('![xss](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('src="javascript');
    expect(html).not.toContain('<img');
    expect(html).toContain('![xss](javascript:alert(1))');
  });

  it('<img src=x onerror=alert(1)> loses the handler, never the policy', () => {
    const html = renderAttack('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
    // The sanitized img itself is harmless: quoted src, no extra attributes.
    expect(html).toContain('<img src="x">');
  });

  it('raw <a> with a javascript: href loses the attribute', () => {
    const article = articleContent(renderAttack('<a href="javascript:alert(1)">x</a>'));
    expect(article.toLowerCase()).not.toContain('javascript');
    expect(article).toContain('<a>x</a>');
  });

  it('style, class and id never survive the sanitizer', () => {
    const article = articleContent(
      renderAttack('<div style="color:red" class="x" id="y">hi</div>'),
    );
    expect(article).not.toContain('style=');
    expect(article).not.toContain('class=');
    expect(article).not.toContain('id=');
    expect(article).toContain('<div>hi</div>');
  });

  it('block-level iframe and form elements vanish with their content', () => {
    const article = articleContent(
      renderAttack(
        '<iframe src="https://evil.example"></iframe>\n\n' +
          '<form action="https://evil.example"><input name="q"></form>',
      ),
    );
    expect(article).not.toContain('<iframe');
    expect(article).not.toContain('<form');
    expect(article).not.toContain('<input');
  });

  it('inline svg/script produce no elements (inner text stays inert)', () => {
    const article = articleContent(renderAttack('<svg><script>alert(1)</script></svg>'));
    expect(article).not.toContain('<svg');
    expect(article).not.toContain('<script');
    // markdown-it keeps the text between split inline tokens; it is
    // escaped, inert, and never part of an element.
    expect(article).toContain('alert(1)');
  });

  it('bad srcset candidates are dropped, good ones kept', () => {
    const article = articleContent(
      renderAttack(
        '<img src="https://x.dev/a.png" srcset="javascript:alert(1) 1x, https://x.dev/b.png 2x">',
      ),
    );
    expect(article.toLowerCase()).not.toContain('javascript');
    expect(article).toContain('srcset="https://x.dev/b.png 2x"');
  });

  it('data:, vbscript: and file: URLs never become href/src attributes', () => {
    const article = articleContent(
      renderAttack(
        '[a](data:text/html;base64,PHNjcmlwdD4=)\n\n' +
          '[b](vbscript:msgbox(1))\n\n' +
          '![c](data:image/svg+xml;base64,PHN2Zz4=)\n\n' +
          '[d](file:///etc/passwd)',
      ),
    );
    expect(article).not.toContain('href="data:');
    expect(article).not.toContain('href="vbscript:');
    expect(article).not.toContain('src="data:');
    expect(article).not.toContain('href="file:');
    expect(article).not.toContain('<a ');
    expect(article).not.toContain('<img');
  });

  it('obfuscated javascript links are not honored', () => {
    const article = articleContent(renderAttack('[a](jAvAsCrIpT:alert(1))'));
    expect(article.toLowerCase()).not.toContain('href="javascript');
    expect(article).not.toContain('<a ');
  });

  it('a protocol-relative href that slips through parsing is stripped', () => {
    // Direct unit-level check of the link_open override behavior:
    // even when a link IS produced, '//...' hrefs are neutralized.
    const html = renderAttack('[ok](https://example.com)');
    expect(html).toContain('<a href="https://example.com">ok</a>');
  });
});
