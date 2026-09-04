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

  it('escapes the title and uses the main > article structure', () => {
    expect(page).toContain('<title>Doc &lt;One&gt;</title>');
    expect(page).toContain('<main>\n<article>\n<nav class="toc">x</nav>\n<h1 id="one">One</h1>');
  });
});
