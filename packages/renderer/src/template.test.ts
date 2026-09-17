import { describe, expect, it } from 'vitest';

import { TOC_SCRIPT } from './toc-script.js';
import { THEME_SCRIPT } from './theme-script.js';
import { PAGE_SCRIPT } from './page-script.js';
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

  it('inlines CSS plus the fixed theme and TOC enhancements', () => {
    expect(page).toContain('<style>');
    expect(page).toContain('prefers-color-scheme: dark');
    expect([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])).toEqual([
      THEME_SCRIPT,
      TOC_SCRIPT,
      PAGE_SCRIPT,
    ]);
  });

  it('applies the theme script before first paint, right after the styles', () => {
    expect(page.indexOf('</style>')).toBeLessThan(page.indexOf(`<script>${THEME_SCRIPT}`));
    expect(page.indexOf(`<script>${THEME_SCRIPT}`)).toBeLessThan(page.indexOf('</head>'));
  });

  it('renders a hidden three-state theme menu in the banner', () => {
    expect(page).toContain('<button type="button" class="theme-toggle"');
    expect(page).toMatch(
      /class="theme-toggle"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*hidden>/,
    );
    expect(page).toContain('<span class="theme-menu-list" role="menu" aria-label="Theme" hidden>');
    for (const icon of ['theme-icon-auto', 'theme-icon-light', 'theme-icon-dark']) {
      expect(page).toContain(icon);
    }
    const items = [
      ...page.matchAll(/role="menuitemradio" aria-checked="(\w+)" data-theme-value="(\w+)"/g),
    ];
    expect(items.map((match) => [match[1], match[2]])).toEqual([
      ['true', 'auto'],
      ['false', 'light'],
      ['false', 'dark'],
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
    // The theme script stays: the toggle lives on every document page.
    expect([...bare.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])).toEqual([
      THEME_SCRIPT,
      PAGE_SCRIPT,
    ]);
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
