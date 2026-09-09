import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.js';

const render = (source: string) => renderMarkdown(source, new Map()).html;

describe('static MathML', () => {
  it.each([
    '$E=mc^2$',
    '\\(\\frac{a}{b}\\)',
    '$$\\sum_{i=1}^{n}i$$',
    '\\[\n\\int_0^1 x^2\\,dx\n\\]',
    '$$\n\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}\n$$',
  ])('renders %s', (source) => {
    const html = render(source);
    expect(html).toContain('<math');
    expect(html).toContain('application/x-tex');
    expect(html).not.toMatch(/<(script|link)\b/);
  });
  it.each([
    'Cost $5 and $10 today.',
    'US$10',
    '$ 5 $',
    '$x',
    '$x\ny$',
    '\\$x\\$',
    '`$x$`',
    '~~~tex\n$x$\n~~~',
    '    $$x$$',
    '$$\nunclosed',
    '$$x$$ trailing text',
  ])('preserves non-math: %s', (source) => {
    expect(render(source)).not.toContain('<math');
  });
  it('renders in alerts, tables and headings without losing TOC text', () => {
    const result = renderMarkdown(
      '# Energy $E=mc^2$\n\n> [!NOTE]\n> \\(x^2\\)\n\n| Formula |\n|---|\n| $x+y$ |',
      new Map(),
    );
    expect(result.html.match(/<math/g)).toHaveLength(3);
    expect(result.headings[0]?.text).toBe('Energy E=mc^2');
  });
  it('preserves image descriptions and renders display math inside containers', () => {
    expect(render('![Energy $E=mc^2$](https://example.com/a.png)')).toContain(
      'alt="Energy E=mc^2"',
    );
    expect(render('> $$\n> x^2\n> $$\n\n- \\[\n  y^2\n  \\]').match(/<math/g)).toHaveLength(2);
  });
  it.each(['$\\unknowncommand{x}$', '$\\def\\x{\\x}\\x$', '$$\\frac{$$'])(
    'falls back on invalid or recursive TeX: %s',
    (source) => {
      const html = render(source);
      expect(html).not.toContain('<math');
      expect(html).toContain(source);
    },
  );
  it('blocks links, images, HTML attributes and raw MathML', () => {
    const html = render(
      '$\\href{javascript:alert(1)}{x}$ $\\includegraphics{https://example.com/image.png}$ $\\htmlStyle{background:url(https://example.com)}{x}$\n\n<math href="javascript:alert(1)"><mi>x</mi></math>',
    );
    expect(html).not.toMatch(/<(?:a|img|script|style)\b/);
    expect(html).not.toContain('href=');
    expect(html).not.toContain('style="background');
  });
  it('bounds formula size and resets macros between formulas/documents', () => {
    expect(render(`$${'x+'.repeat(2200)}x$`)).not.toContain('<math');
    expect(render('$\\gdef\\secret{42}x$ $\\secret$')).toContain('$\\secret$');
    expect(render('$\\secret$')).not.toContain('<math');
    expect(render('$x$ '.repeat(140)).match(/<math/g)).toHaveLength(128);
  });
});
