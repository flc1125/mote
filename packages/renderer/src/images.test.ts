import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.js';
import { renderHtmlPage } from './template.js';
import { IMAGE_SCRIPT } from './image-script.js';
import { THEME_SCRIPT } from './theme-script.js';
import { PAGE_SCRIPT } from './page-script.js';

const render = (source: string) => renderMarkdown(source, new Map([['photo.png', '/asset/photo']]));
describe('image presentation', () => {
  it('resolves assets while preserving distinct alt/title/caption and sanitizing caption HTML', () => {
    const { html } = render(
      '![Alternative](photo.png "Tooltip"){ width="640" }\n/// caption\n**Visible** <script>attack()</script><img src="photo.png" onerror="attack()">\n///',
    );
    expect(html).toContain('<figure class="mote-figure">');
    expect(html).toContain('src="/asset/photo" alt="Alternative" title="Tooltip" width="640"');
    expect(html).toContain('<figcaption><strong>Visible</strong>');
    expect(html).not.toMatch(/<script|onerror/);
  });
  it('keeps the first Markdown image eager and marks later ones lazy without changing raw HTML', () => {
    const { html } = render('![one](photo.png)\n\n![two](photo.png)\n\n<img src="photo.png">');
    const images = html.match(/<img[^>]*>/g)!;
    expect(images[0]).toContain('decoding="async"');
    expect(images[0]).not.toContain('loading=');
    expect(images[1]).toContain('loading="lazy"');
    expect(images[2]).not.toContain('loading=');
  });
  it('injects the fixed image script on an image-only page, with a readable no-script body', () => {
    const { html } = render('![alt](photo.png)');
    const page = renderHtmlPage({ title: 'Image', tocHtml: '', contentHtml: html });
    expect([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])).toEqual([
      THEME_SCRIPT,
      IMAGE_SCRIPT,
      PAGE_SCRIPT,
    ]);
    expect(html).not.toMatch(/button|dialog|hidden/);
    expect(
      renderHtmlPage({ title: 'Text', tocHtml: '', contentHtml: '<p>text</p>' }),
    ).not.toContain(`<script>${IMAGE_SCRIPT}`);
  });
});
