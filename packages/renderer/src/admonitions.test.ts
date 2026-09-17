import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';

import { ADMONITION_CASES } from '../../core/src/fixtures/admonitions.js';
import { renderMarkdown } from './markdown.js';
import { render } from './index.js';
import { TOC_SCRIPT } from './toc-script.js';
import { COPY_SCRIPT } from './copy-script.js';
import { THEME_SCRIPT } from './theme-script.js';
import { PAGE_SCRIPT } from './page-script.js';

const id = '7Vk3mQ9x2NFaP4Ls';
const manifest = {
  version: 1 as const,
  id,
  createdAt: '2026-09-15T00:00:00Z',
  source: { name: 'notes.md', size: 1, sha256: 'a'.repeat(64) },
  assets: [],
};
const html = (source: string) => renderMarkdown(source, new Map()).html;

describe('shared admonition presentation', () => {
  it.each(['note', 'tip', 'important', 'warning', 'caution'])(
    'uses the same title, icon and classes as the existing %s alert',
    (type) => {
      expect(html(`!!! ${type}\n\n    Body.`).replace(/ id="mote-admonition-\d+"/, '')).toBe(
        html(`> [!${type.toUpperCase()}]\n> Body.`),
      );
    },
  );
  it.each(['example', 'success'])('provides a %s title and icon', (type) => {
    expect(html(`!!! ${type}\n\n    Body.`)).toContain(`markdown-alert-${type}`);
    expect(html(`!!! ${type}\n\n    Body.`)).toContain('<svg');
    expect(html(`!!! ${type}\n\n    Body.`)).toContain(type[0]!.toUpperCase() + type.slice(1));
  });
  it('renders native closed and open disclosures with complete bodies', () => {
    const result = html('??? warning "Closed"\n\n    First.\n\n???+ success "Open"\n\n    Second.');
    expect(result).toContain(
      '<details id="mote-admonition-1" class="markdown-alert markdown-alert-warning">',
    );
    expect(result).toContain(
      '<details id="mote-admonition-2" class="markdown-alert markdown-alert-success" open="">',
    );
    expect(result.match(/<summary class="markdown-alert-title">/g)).toHaveLength(2);
    expect(result).toMatch(/First\.[\s\S]*<\/details>[\s\S]*Second\.[\s\S]*<\/details>/);
  });
  it('keeps empty static titles absent and folding summaries nonempty', () => {
    expect(html('!!! note ""\n\n    Body.')).not.toContain('markdown-alert-title');
    expect(html('??? note ""\n\n    Body.')).toContain('<span>Note</span></summary>');
  });
  it('escapes hostile titles and preserves body sanitization', () => {
    const result = html(
      '??? warning "<img src=x onerror=alert(1)> **raw**"\n\n    <script>attack()</script>\n\n    <img src="safe.png" onerror="attack()">',
    );
    expect(result).toContain('&lt;img src=x onerror=alert(1)&gt; **raw**');
    expect(result).not.toContain('<strong>raw');
    expect(result).not.toMatch(/<script|onerror="|<img src=x/);
  });
  it('allocates component IDs after all headings and keeps legacy alert nesting unchanged', () => {
    const result = html(
      '??? note\n\n    # mote-admonition-1\n\n    > [!TIP]\n    > Literal marker inside a new container.\n\n!!! tip\n\n    Text[^n].\n\n[^n]: Note.',
    );
    const ids = [...result.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result).toContain('<h1 id="mote-admonition-1">');
    expect(result).toContain('<details id="mote-admonition-2"');
    expect(result).toContain('[!TIP]');
    expect(result).toContain('<div id="mote-admonition-3"');
  });
  it('adds only fixed scripts to a heading-free disclosure with code', () => {
    const page = render(
      '??? note "Details"\n\n    ```ts title="x.ts"\n    const x = 1;\n    ```',
      manifest,
      id,
    );
    expect(page).not.toContain('<aside');
    expect([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])).toEqual([
      THEME_SCRIPT,
      TOC_SCRIPT,
      COPY_SCRIPT,
      PAGE_SCRIPT,
    ]);
  });
  it('keeps an ordinary heading-free static admonition script-free', () => {
    const page = render('!!! note\n\n    Body.', manifest, id);
    expect([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])).toEqual([
      THEME_SCRIPT,
      PAGE_SCRIPT,
    ]);
  });
  it('preserves native HTML summary content and open state without accepting custom attributes', () => {
    const page = render(
      '<details class="custom" style="color:red"><summary><strong>HTML title</strong></summary>\n\nBody.\n\n</details>\n\n<details open><summary>Already open</summary>\n\nMore.\n\n</details>',
      manifest,
      id,
    );
    expect(page).toContain('<details><summary><strong>HTML title</strong></summary>');
    expect(page).toContain('<details open><summary>Already open</summary>');
    expect(page).not.toContain('class="custom"');
    expect(page).not.toContain('style="color:red"');
    expect(page).not.toContain('<aside');
    expect([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])).toEqual([
      THEME_SCRIPT,
      TOC_SCRIPT,
      PAGE_SCRIPT,
    ]);
  });
  it('preserves nested math, diagrams, code and headings', () => {
    const result = renderMarkdown(
      '!!! note\n\n    ??? tip\n\n        ## Inner\n\n        $x^2$\n\n        ```mermaid\n        graph LR\n        A-->B\n        ```\n\n        ```ts title="config.ts" linenums="1" hl_lines="1"\n        const x = 1;\n        ```',
      new Map(),
    );
    expect(result.headings).toEqual([{ level: 2, text: 'Inner', slug: 'inner' }]);
    expect(result.html).toContain('<math');
    expect(result.html).toContain('aria-label="Mermaid diagram"');
    expect(result.html).toContain('is-highlighted');
    expect(result.codeCopy).toBe(true);
  });
});

describe('container image agreement', () => {
  it.each(ADMONITION_CASES)('$name', ({ source, images, containers }) => {
    const urls = new Map(images.map((src, i) => [src, `/doc/a/${i}`]));
    const result = renderMarkdown(source, urls).html;
    const found = new Set<string>();
    new Parser({
      onopentag(tag, attrs) {
        if (tag !== 'img' && tag !== 'source') return;
        if (attrs.src) found.add(attrs.src);
        for (const part of (attrs.srcset ?? '').split(',')) {
          const url = part.trim().split(/\s+/)[0];
          if (url) found.add(url);
        }
      },
    }).end(result);
    expect([...found]).toEqual([...urls.values()]);
    expect(result.match(/<(?:div|details) id="mote-admonition-/g) ?? []).toHaveLength(containers);
  });
  it('falls back in both oversized and excess-depth structures without active images', () => {
    const big = '!!! note\n\n    ' + 'x'.repeat(128 * 1024) + '\n\n    ![hidden](missing.png)';
    expect(html(big)).not.toContain('<img');
    let nested = '![hidden](missing.png)';
    for (let i = 0; i < 9; i++)
      nested =
        '!!! note\n\n' +
        nested
          .split('\n')
          .map((line) => '    ' + line)
          .join('\n');
    expect(html(nested)).not.toContain('<img');
    expect(html(nested).match(/<div id="mote-admonition-/g)).toHaveLength(8);
  });
});
