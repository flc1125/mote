import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';
import { TAB_CASES } from '../../core/src/fixtures/tabs.js';
import { renderMarkdown } from './markdown.js';
import { render } from './index.js';
import { TOC_SCRIPT } from './toc-script.js';
import { THEME_SCRIPT } from './theme-script.js';
import { COPY_SCRIPT } from './copy-script.js';

const source = '=== "npm"\n\n    ```sh\n    npm install\n    ```\n\n=== "pnpm"\n\n    Second.';
const id = '7Vk3mQ9x2NFaP4Ls';
const manifest = {
  version: 1 as const,
  id,
  createdAt: '2026-09-15T00:00:00Z',
  source: { name: 'tabs.md', size: 1, sha256: 'a'.repeat(64) },
  assets: [],
};

describe('content tab rendering', () => {
  it('renders all content as linkable static sections and includes fixed scripts without headings', () => {
    const html = render(source, manifest, id);
    expect(html).toContain('<section class="content-panel" id="mote-tab-1">');
    expect(html).toContain('<a href="#mote-tab-2">pnpm</a>');
    expect(html).toContain('<p>Second.</p>');
    expect(html).not.toContain('<aside');
    expect([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])).toEqual([
      THEME_SCRIPT,
      TOC_SCRIPT,
      COPY_SCRIPT,
    ]);
    const fragment = renderMarkdown(source, new Map()).html;
    expect(fragment).not.toMatch(/role="tab|<section[^>]* hidden/);
  });
  it('reserves panel, label and future control IDs after ordinary headings', () => {
    const result = renderMarkdown(
      '# mote-tab-1\n\n# mote-tab-2-label\n\n# mote-tab-3-control\n\n' + source,
      new Map(),
    );
    expect(result.headings.map((h) => h.slug)).toEqual([
      'mote-tab-1',
      'mote-tab-2-label',
      'mote-tab-3-control',
    ]);
    expect(result.html).toContain('class="content-panel" id="mote-tab-4"');
    const ids = [...result.html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('never interprets label HTML or expands user HTML permissions', () => {
    const html = renderMarkdown(
      '=== "<img src=x onerror=attack()> **bold**"\n\n    <div class="content-tabs" id="mote-tab-2" role="tabpanel" hidden onclick="attack()">Safe</div>\n\n    <script>attack()</script>',
      new Map(),
    ).html;
    expect(html).toContain('&lt;img src=x onerror=attack()&gt; **bold**');
    expect(html).toContain('<div>Safe</div>');
    expect(html).not.toMatch(/<img|<script|onclick=|role="tabpanel"/);
  });
  it('preserves existing code and diagram budgets across panels', () => {
    const block = '    ```js\n    x();\n    ```\n\n';
    const html = renderMarkdown(
      '=== "First"\n\n' + block.repeat(40) + '=== "Second"\n\n' + block.repeat(40),
      new Map(),
    ).html;
    expect(html.match(/class="code-copy"/g)).toHaveLength(64);
    expect(html.match(/<pre/g)).toHaveLength(80);
    const diagram = renderMarkdown(
      '=== "Math"\n\n    $x^2$\n\n=== "Diagram"\n\n    ```mermaid\n    graph LR\n    A-->B\n    ```',
      new Map(),
    ).html;
    expect(diagram).toContain('<math');
    expect(diagram).toContain('aria-label="Mermaid diagram"');
    const rich =
      '    ' +
      '$x$ '.repeat(70) +
      '\n\n' +
      '    ```mermaid\n    graph LR\n    A-->B\n    ```\n\n'.repeat(3);
    const bounded = renderMarkdown(
      '=== "First"\n\n' + rich + '=== "Second"\n\n' + rich,
      new Map(),
    ).html;
    expect(bounded.match(/<math\b/g)).toHaveLength(128);
    expect(bounded.match(/aria-label="Mermaid diagram"/g)).toHaveLength(4);
  });
  it.each(TAB_CASES)('agrees with the scanner: $name', ({ source, images }) => {
    const urls = new Map(images.map((src, i) => [src, `/doc/a/${i}`]));
    const found: string[] = [];
    new Parser({
      onopentag(tag, attrs) {
        if (tag === 'img') found.push(attrs.src!);
      },
    }).end(renderMarkdown(source, urls).html);
    expect(found).toEqual([...urls.values()]);
  });
});
