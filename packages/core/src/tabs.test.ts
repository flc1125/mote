import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';

import { documentSyntax } from './document-syntax.js';
import { CONTAINER_LIMITS } from './container-syntax.js';

const indent = (s: string) =>
  s
    .split('\n')
    .map((s) => '    ' + s)
    .join('\n');
const tab = (label = 'One', body = '![real](image.png)') => `=== "${label}"\n\n${indent(body)}\n\n`;
const parse = (s: string) => new MarkdownIt({ html: true }).use(documentSyntax).parse(s, {});
const count = (s: string, type = 'mote_tabs_open') =>
  parse(s).filter((t) => t.type === type).length;
const render = (s: string, containers = true) =>
  new MarkdownIt({ html: true }).use(documentSyntax, { containers }).render(s);

describe('shared content tabs', () => {
  it('groups adjacent panels, preserves duplicate labels and ends at an ordinary block', () => {
    const source = tab() + tab() + 'Between.\n\n' + tab();
    expect(count(source)).toBe(2);
    expect(count(source, 'mote_panel_open')).toBe(3);
    expect(
      parse(source)
        .filter((t) => t.type === 'mote_panel_title')
        .map((t) => t.content),
    ).toEqual(['One', 'One', 'One']);
    expect(render(source)).not.toMatch(/hidden|role="tab/);
    expect(parse(tab()).find((t) => t.type === 'mote_panel_open')?.map).toEqual([0, 3]);
  });
  it('uses plain text labels with only two escapes', () => {
    expect(render(tab('<b> \\"quote\\" \\\\ **bold**'))).toContain(
      '&lt;b&gt; &quot;quote&quot; \\ **bold**',
    );
  });
  it.each([
    '=== ""\n\n    Body.',
    '=== "   "\n\n    Body.',
    "=== 'One'\n\n    Body.",
    '=== "bad\\n"\n\n    Body.',
    '=== "One" extra\n\n    Body.',
    '=== "One"\n    Body.',
    '=== "One"\n\n',
    '=== "One"\n\n\tBody.',
    ' === "One"\n\n     Body.',
    'Before\n=== "One"\n\n    Body.',
    '> === "One"\n>\n>     Body.',
    '- === "One"\n\n      Body.',
    'ref[^n]\n\n[^n]: === "One"\n\n        Body.',
    '```md\n=== "One"\n\n    Body.\n```',
    '$$\n=== "One"\n\n    Body.\n$$',
    '<!--\n=== "One"\n\n    Body.\n-->',
  ])('leaves unsupported syntax to ordinary Markdown: %s', (source) => {
    expect(count(source)).toBe(0);
    expect(render(source)).toBe(render(source, false));
  });
  it('allows admonition → tabs → admonition but never another tab group', () => {
    const source = '!!! note\n\n' + indent(tab('Outer', '!!! tip\n\n' + indent(tab('Inner'))));
    expect(count(source)).toBe(1);
    expect(count(source, 'mote_container_open')).toBe(2);
    expect(render(source)).toContain('<pre><code>![real](image.png)');
  });
  it('preserves references, footnotes, math and code indentation', () => {
    const tokens = parse(
      tab('One', '![a][ref]\n\n    ![fake](no.png)\n\n$x$ and ref[^n].') +
        '[ref]: yes.png\n\n[^n]: Footnote.',
    );
    expect(
      tokens
        .flatMap((t) => t.children ?? [])
        .filter((t) => t.type === 'image')
        .map((t) => t.attrGet('src')),
    ).toEqual(['yes.png']);
    expect(tokens.find((t) => t.type === 'code_block')?.content).toBe('![fake](no.png)\n');
    expect(tokens.some((t) => t.type === 'footnote_open')).toBe(true);
  });
  it('accepts CRLF without changing physical source maps', () => {
    expect(count(tab().replaceAll('\n', '\r\n'))).toBe(1);
  });
});

describe('shared tab budgets', () => {
  it('accepts 16 panels but rejects all members of a 17 or 1000 panel group', () => {
    expect(count(tab().repeat(16), 'mote_panel_open')).toBe(16);
    for (const n of [17, 1000]) {
      const source = tab().repeat(n);
      expect(count(source)).toBe(0);
      expect(render(source)).toBe(render(source, false));
      expect(count(source + 'Boundary.\n\n' + tab())).toBe(1);
    }
  });
  it('enforces decoded label and opening line budgets', () => {
    expect(count(tab('x'.repeat(160)))).toBe(1);
    expect(count(tab('x'.repeat(161)))).toBe(0);
    expect(count('=== "x"' + ' '.repeat(505) + '\n\n    Body.')).toBe(1);
    expect(count('=== "x"' + ' '.repeat(506) + '\n\n    Body.')).toBe(0);
  });
  it('charges a group and every panel as components before nested bodies', () => {
    const full = '!!! note\n\n    Body.\n\n'.repeat(253);
    expect(count(full + tab() + tab())).toBe(1);
    expect(count(full + tab() + tab() + tab())).toBe(0);
    const body = '!!! note\n\n    Body.\n\n'.repeat(256);
    expect(count(tab('First', body) + tab('Last'))).toBe(1);
    expect(count(tab('First', body) + tab('Last'), 'mote_container_open')).toBe(253);
  });
  it('charges two nesting levels and counts overlapping source only once', () => {
    let source = tab('One', 'x'.repeat(90000));
    for (let i = 0; i < 6; i++) source = '!!! note\n\n' + indent(source);
    expect(count(source)).toBe(1);
    expect(count('!!! note\n\n' + indent(source))).toBe(0);
    const prefix = '=== "One"\n\n    ';
    expect(count(prefix + 'a'.repeat(CONTAINER_LIMITS.source - prefix.length))).toBe(1);
    expect(count(prefix + 'a'.repeat(CONTAINER_LIMITS.source - prefix.length + 1))).toBe(0);
  });
  it('does not charge probes and resets state on each parse', () => {
    const md = new MarkdownIt().use(documentSyntax);
    const source = tab().repeat(16);
    const state = new md.block.State(source, md, {}, []);
    const rule = md.block.ruler.getRules('').find((r) => r(state, 0, state.lineMax, true));
    expect(rule).toBeDefined();
    for (let i = 0; i < 300; i++) expect(rule!(state, 0, state.lineMax, true)).toBe(true);
    expect(state.tokens).toHaveLength(0);
    expect(rule!(state, 0, state.lineMax, false)).toBe(true);
    for (let i = 0; i < 2; i++)
      expect(md.parse(source, {}).filter((t) => t.type === 'mote_panel_open')).toHaveLength(16);
  });
});
