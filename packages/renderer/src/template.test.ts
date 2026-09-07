import { describe, expect, it } from 'vitest';

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

  it('inlines the CSS and contains no JS', () => {
    expect(page).toContain('<style>');
    expect(page).toContain('prefers-color-scheme: dark');
    expect(page).not.toContain('<script');
  });

  it('uses same-origin vector and ICO favicons', () => {
    expect(page).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    expect(page).toContain('<link rel="icon" href="/favicon.ico" sizes="16x16 32x32">');
  });

  it('escapes the title wherever it appears', () => {
    expect(page).toContain('<title>Doc &lt;One&gt;</title>');
    expect(page).toContain('<span class="mote-doc-title">Doc &lt;One&gt;</span>');
    expect(page).not.toContain('Doc <One>');
  });

  it('uses the banner > main > article > colophon structure', () => {
    expect(page).toContain('<header class="mote-banner">');
    expect(page).toContain('<main>\n<article>\n<nav class="toc">x</nav>\n<h1 id="one">One</h1>');
    expect(page).toContain('<footer class="mote-colophon">');
  });

  it('points the brand links at the same-origin home (self-host friendly)', () => {
    expect(page).toContain('<a class="mote-brand" href="/">');
    expect(page).toContain('Published with <a href="/">Mote</a>');
  });

  it('inlines no external resources beyond the favicons', () => {
    expect(page).not.toMatch(/url\(/);
    expect(page).not.toContain('@import');
    expect(page).not.toContain('@font-face');
  });
});
