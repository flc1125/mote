import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';
import { sanitizeDiagramSvg } from './diagram-svg.js';
import { renderMarkdown } from './markdown.js';

const render = (source: string) => renderMarkdown(`~~~mermaid\n${source}\n~~~`, new Map()).html;
const samples = [
  ['flowchart', 'flowchart LR\n A[Start] --> B{Check}\n B -->|Yes| C[Done]'],
  ['state', 'stateDiagram-v2\n [*] --> Ready\n Ready --> Done\n Done --> [*]'],
  [
    'sequence',
    'sequenceDiagram\n participant A as Alice\n participant B as Bob\n A->>B: Hello\n B-->>A: Hi',
  ],
  ['class', 'classDiagram\n Animal <|-- Duck\n Animal: +int age\n Duck: +swim()'],
  ['er', 'erDiagram\n CUSTOMER ||--o{ ORDER : places'],
  [
    'xychart',
    'xychart-beta\n x-axis [Jan, Feb, Mar]\n y-axis "Sales" 0 --> 100\n bar [20, 40, 80]',
  ],
];
describe('static Mermaid subset', () => {
  it.each(samples)('renders %s without external resources or scripts', (_name, source) => {
    const html = render(source!);
    expect(html).toContain('<svg');
    expect(html).toContain('查看 Mermaid 源码');
    expect(html).not.toMatch(/<(?:script|style|foreignObject|image|a)\b/);
    expect(html).not.toContain('fonts.googleapis');
    expect(html).not.toContain(' style=');
    expect(html).toContain('role="img"');
  });
  it('allocates diagram-local marker IDs and renders deterministically', () => {
    const source = '~~~mermaid\nflowchart LR\n A-->B\n~~~\n\n~~~mermaid\nflowchart LR\n A-->B\n~~~';
    const html = renderMarkdown(source, new Map()).html;
    expect(renderMarkdown(source, new Map()).html).toBe(html);
    const ids: string[] = [],
      references: string[] = [];
    new Parser({
      onopentag(_tag, attrs) {
        if (attrs.id) ids.push(attrs.id);
        for (const value of Object.values(attrs)) {
          const match = /^url\(#(.+)\)$/.exec(value);
          if (match) references.push(match[1]!);
        }
      },
    }).end(html);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const ref of references) expect(ids).toContain(ref);
  });
  it.each([
    'gantt\n title Plan',
    'flowchart LR\n click A "javascript:alert(1)"',
    'flowchart LR\n A-->B\n classDef red fill:red',
    'flowchart LR; A-->B; click A "https://example.com"',
    '%%{init: {"securityLevel":"loose"}}%%\nflowchart LR\n A-->B',
    'not a diagram',
    'xychart-beta\n y-axis 1000000000 --> 1000000000.0000001\n line [1000000000]',
    'xychart-beta\n line [1e308, 2e308]',
    'xychart-beta\n y-axis 0 --> 0.0000000000001\n line [0]',
  ])('preserves unsupported syntax: %s', (source) => {
    const html = render(source);
    expect(html).not.toContain('<svg');
    expect(html).toContain('language-mermaid');
  });
  it('bounds graph sizes and diagram counts', () => {
    expect(
      render(
        'flowchart LR\n' + Array.from({ length: 40 }, (_, i) => `A${i}-->A${i + 1}`).join('\n'),
      ),
    ).not.toContain('<svg');
    const html = renderMarkdown(
      '~~~mermaid\nflowchart LR\n A-->B\n~~~\n\n'.repeat(6),
      new Map(),
    ).html;
    expect(html.match(/<svg/g)).toHaveLength(4);
  });
  it('restores globals and renders a valid diagram after invalid input', () => {
    const globals = ['global', 'self', 'setTimeout'].map((key) =>
      Object.getOwnPropertyDescriptor(globalThis, key),
    );
    render('flowchart LR\n A[unclosed');
    expect(render('flowchart LR\n A-->B')).toContain('<svg');
    expect(
      ['global', 'self', 'setTimeout'].map((key) =>
        Object.getOwnPropertyDescriptor(globalThis, key),
      ),
    ).toEqual(globals);
  });
});
describe('generated SVG isolation', () => {
  it('keeps only scoped chart classes for theme-aware bars and lines', () => {
    const html = render('xychart-beta\n x-axis [Jan, Feb]\n bar [20, 40]\n line [30, 50]');
    expect(html).toContain('class="mote-xychart-bar mote-xychart-color-0"');
    expect(html).toContain('mote-xychart-line mote-xychart-color-1');
    expect(html).toContain('mote-xychart-label');
    expect(
      sanitizeDiagramSvg('<svg><text class="evil xychart-label">Label</text></svg>', 'test:'),
    ).toContain('class="mote-xychart-label"');
    expect(sanitizeDiagramSvg('<svg><text class="evil">Label</text></svg>', 'test:')).not.toContain(
      'class=',
    );
  });
  it('rejects active SVG subtrees and strips untrusted attributes/resources', () => {
    expect(
      sanitizeDiagramSvg(
        '<svg><foreignObject><script>bad()</script></foreignObject></svg>',
        'test:',
      ),
    ).toBe(null);
    const svg = sanitizeDiagramSvg(
      '<svg viewBox="0 0 100 100" onload="bad()"><style>@import url(https://example.com)</style><rect fill="url(https://example.com)" style="fill:red"/><text href="javascript:bad()">Safe</text></svg>',
      'test:',
    );
    expect(svg).toContain('Safe');
    expect(svg).not.toMatch(/onload|style=|href=|https:|javascript:|<style/);
  });
});
