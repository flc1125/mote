import { describe, expect, it } from 'vitest';

import { CONTENT_SECURITY_POLICY, documentSecurityHeaders } from './headers.js';

describe('CONTENT_SECURITY_POLICY (§33)', () => {
  it('matches the agreed strict policy', () => {
    expect(CONTENT_SECURITY_POLICY).toBe(
      "default-src 'none'; img-src 'self' https: http:; style-src 'unsafe-inline'; " +
        "object-src 'none'; frame-src 'none'; script-src 'none'; connect-src 'none'; " +
        "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  });
});

describe('documentSecurityHeaders', () => {
  it('returns every header from §33', () => {
    expect(documentSecurityHeaders()).toEqual({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
  });
});

describe('trusted TOC script policy', () => {
  it('authorizes only the exact emitted script, preserving all other restrictions', async () => {
    const { createHash } = await import('node:crypto');
    const { TOC_SCRIPT } = await import('./toc-script.js');
    const { tocDocumentSecurityHeaders } = await import('./headers.js');
    const { renderHtmlPage } = await import('./template.js');
    const html = renderHtmlPage({ title: 'TOC', tocHtml: '<nav></nav>', contentHtml: '' });
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    expect(scripts).toEqual([TOC_SCRIPT]);
    const hash = createHash('sha256').update(scripts[0]!).digest('base64');
    const headers = await tocDocumentSecurityHeaders();
    expect(headers['Content-Security-Policy']).toBe(
      CONTENT_SECURITY_POLICY.replace("script-src 'none'", `script-src 'sha256-${hash}'`),
    );
    headers['Content-Security-Policy'] = 'tampered';
    expect((await tocDocumentSecurityHeaders())['Content-Security-Policy']).not.toBe('tampered');
  });
});
