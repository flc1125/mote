import { describe, expect, it } from 'vitest';

import { TOC_SCRIPT } from './toc-script.js';
import { renderHtmlPage } from './template.js';

const page = renderHtmlPage({
  title: 'Doc <One>',
  tocHtml: '<nav class="toc">x</nav>\n',
  contentHtml: '<h1 id="one">One</h1>\n',
});

describe('renderHtmlPage (§29, §32, §34)', () => {
  it('emits the required meta tags', () => {
    expect(page).toContain('<meta name="referrer" content="no-referrer">');
    expect(page).toContain('<meta name="robots" content="noindex,nofollow,noarchive">');
    expect(page).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  });

  it('inlines CSS and only the fixed TOC enhancement', () => {
    expect(page).toContain('<style>');
    expect(page).toContain('prefers-color-scheme: dark');
    expect([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])).toEqual([
      TOC_SCRIPT,
    ]);
  });

  it('uses same-origin vector and ICO favicons', () => {
    expect(page).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    expect(page).toContain('<link rel="icon" href="/favicon.ico" sizes="16x16 32x32">');
  });

  it('escapes the title wherever it appears', () => {
    expect(page).toContain('<title>Doc &lt;One&gt;</title>');
    expect(page).not.toContain('Doc <One>');
  });

  it('keeps the banner brand-only (no document title)', () => {
    expect(page).not.toContain('mote-doc-title');
  });

  it('uses the banner > main > article > colophon structure', () => {
    expect(page).toContain('<header class="mote-banner">');
    expect(page).toContain('<main>\n<article>\n<h1 id="one">One</h1>');
    expect(page).toContain('<footer class="mote-colophon">');
  });

  it('provides static anchors and an accessible outline shell', () => {
    expect(page).toContain('<a class="toc-trigger" href="#mote-toc"');
    expect(page).toMatch(
      /aria-label="Open table of contents" title="Show contents"><svg[^]*?<\/svg><\/a>/,
    );
    expect(page).toContain('<span class="toc-title">Contents</span>');
    expect(page).toContain(
      '<aside class="toc-drawer" id="mote-toc" aria-label="Table of contents" tabindex="-1">',
    );
    expect(page).toContain('<a class="toc-scrim" href="#!"');
    expect(page).toContain('<nav class="toc">x</nav>');
  });

  it('omits the drawer entirely when there is no TOC', () => {
    const bare = renderHtmlPage({ title: 'T', tocHtml: '', contentHtml: '<p>x</p>' });
    expect(bare).not.toContain('<aside class="toc-drawer"');
    expect(bare).not.toContain('<a class="toc-trigger"');
    expect(bare).not.toContain('<script>');
  });

  it('opens the same-origin home in a new tab from both brand links', () => {
    expect(page).toContain(
      '<a class="mote-brand" href="/" target="_blank" rel="noopener noreferrer">',
    );
    expect(page).toContain(
      'Published with <a href="/" target="_blank" rel="noopener noreferrer">Mote</a>',
    );
  });

  it('inlines no external resources beyond the favicons', () => {
    expect(page).not.toMatch(/url\(/);
    expect(page).not.toContain('@import');
    expect(page).not.toContain('@font-face');
  });
});
