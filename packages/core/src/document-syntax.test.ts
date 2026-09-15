import MarkdownIt, { type MarkdownIt as MarkdownParser, type Token } from 'markdown-it';
import { describe, expect, it } from 'vitest';

import { CONTAINER_LIMITS } from './container-syntax.js';
import { documentSyntax } from './document-syntax.js';

function parser(containers = true): MarkdownParser {
  return new MarkdownIt({ html: true }).use(documentSyntax, { containers });
}
function containers(source: string): Token[] {
  return parser()
    .parse(source, {})
    .filter((token) => token.type === 'mote_container_open');
}
function imageSources(tokens: Token[]): string[] {
  return tokens.flatMap((token) => [
    ...(token.type === 'image' ? [String(token.attrGet('src'))] : []),
    ...imageSources(token.children ?? []),
  ]);
}
function indent(source: string): string {
  return source
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n');
}
function nested(depth: number, body = 'content'): string {
  for (let i = 0; i < depth; i++) body = '!!! note\n\n' + indent(body);
  return body;
}

describe('documentSyntax', () => {
  it('enables shared containers by default for both publishing and rendering', () => {
    const tokens = new MarkdownIt()
      .use(documentSyntax)
      .parse('??? note\n\n    ![inside](image.png)\n', {});
    expect(tokens.some((token) => token.type === 'mote_container_open')).toBe(true);
    expect(imageSources(tokens)).toEqual(['image.png']);
  });

  it('supports explicitly disabling containers for baseline comparisons', () => {
    const source = '!!! note\n\n    ![inside](image.png)\n';
    const md = parser(false);
    const tokens = md.parse(source, {});
    expect(tokens.some((token) => token.type === 'mote_container_open')).toBe(false);
    expect(imageSources(tokens)).toEqual([]);
    expect(md.render(source)).toContain('<pre><code>![inside](image.png)');
  });

  it('does not let containers reinterpret math or footnote bodies', () => {
    const source =
      'A[^n]\n\n[^n]: Note.\n\n    !!! warning\n\n        ![code](missing.png)\n\n    ![real](foot.png)\n\n$$\n!!! tip\n\n    ![math](math.png)\n$$\n';
    const tokens = parser().parse(source, {});
    expect(tokens.some((token) => token.type === 'mote_container_open')).toBe(false);
    expect(imageSources(tokens)).toEqual(['foot.png']);
  });
});

describe('container structures', () => {
  it.each(['note', 'tip', 'important', 'warning', 'caution', 'example', 'success'])(
    'recognizes the controlled %s type with a default title',
    (type) => {
      const [token] = containers(`!!! ${type}\n\n    Body.\n`);
      expect(token?.meta).toEqual({
        type,
        mode: 'static',
        title: type[0]!.toUpperCase() + type.slice(1),
      });
    },
  );

  it.each([
    ['!!!', 'static'],
    ['???', 'closed'],
    ['???+', 'open'],
  ])('preserves %s mode as metadata with a static reading fallback', (marker, mode) => {
    const source = `${marker} tip "Title"\n\n    Body.\n`;
    expect(containers(source)[0]?.meta?.mode).toBe(mode);
    const html = parser().render(source);
    expect(html).toContain('<div>\n<p>Title</p>\n<p>Body.</p>\n</div>');
    expect(html).not.toMatch(/<script|hidden|<details/);
  });

  it('uses plain text titles with only quote and backslash escapes', () => {
    const source = '!!! note "<img src=\\"no.png\\"> **bold** \\\\ path"\n\n    Body.\n';
    const html = parser().render(source);
    expect(html).toContain('&lt;img src=&quot;no.png&quot;&gt; **bold** \\ path');
    expect(html).not.toMatch(/<img|<strong>/);
  });

  it('omits an empty static title and retains nonempty folding labels', () => {
    expect(parser().render('!!! note ""\n\n    Body.')).not.toContain('<p>Note</p>');
    for (const marker of ['???', '???+']) {
      expect(containers(`${marker} note ""\n\n    Body.`)[0]?.meta?.title).toBe('Note');
    }
  });

  it.each([
    '!!! NOTE\n\n    Body.',
    '!!! other\n\n    Body.',
    '!!! note extra\n\n    Body.',
    '!!! note "bad\\n"\n\n    Body.',
    '!!! note "unterminated\n\n    Body.',
    "!!! note 'single'\n\n    Body.",
    '!!! note\n    Body.',
    '!!! note\n\n',
    '!!! note\n\n   Body.',
    '!!! note\n\n\tBody.',
    '!!! note\n\n \tBody.',
    ' !!! note\n\n     Body.',
    '    !!! note\n\n        Body.',
    '\\!!! note\n\n    Body.',
    'Paragraph\n!!! note\n\n    Body.',
    '> !!! note\n>\n>     Body.',
    '- !!! note\n\n      Body.',
    '- Item\n\n  !!! note\n\n      Body.',
    '=== "Tabs are a later phase"\n\n    Body.',
  ])('returns invalid or unsupported candidates to ordinary Markdown: %s', (source) => {
    expect(containers(source)).toEqual([]);
    expect(parser().render(source)).toBe(parser(false).render(source));
  });

  it('keeps image and container lookalikes inside code, math and HTML tokens', () => {
    for (const source of [
      '```md\n!!! note\n\n    ![x](code.png)\n```',
      '$$\n!!! note\n\n    ![x](math.png)\n$$',
      '<!--\n!!! note\n\n    ![x](comment.png)\n-->',
      '<pre>\n!!! note\n\n    ![x](pre.png)\n</pre>',
    ]) {
      expect(parser().render(source)).toBe(parser(false).render(source));
    }
  });

  it('preserves nested block tokens, reference definitions, source maps and the next block', () => {
    const source =
      '!!! note "Outer"\n\n    # Heading\n\n    !!! tip "Inner"\n\n        ![asset][ref]\n\n    [ref]: image.png\n\nAfter.\n';
    const tokens = parser().parse(source, {});
    expect(
      tokens.filter((token) => token.type === 'mote_container_open').map((token) => token.map),
    ).toEqual([
      [0, 9],
      [4, 7],
    ]);
    expect(imageSources(tokens)).toEqual(['image.png']);
    expect(tokens.find((token) => token.type === 'heading_open')?.map).toEqual([2, 3]);
    expect(parser().render(source)).toContain('</div>\n<p>After.</p>');
  });

  it('keeps quotes and lists within a component ordinary and code indentation intact', () => {
    const source =
      '!!! note\n\n' +
      indent(
        '    ![code](c.png)\n\n> !!! tip\n>\n>     ![quote code](q.png)\n\n- !!! note\n\n      ![list code](l.png)\n\n![real](yes.png)',
      );
    expect(containers(source)).toHaveLength(1);
    expect(imageSources(parser().parse(source, {}))).toEqual(['yes.png']);
  });

  it('shares global references and footnotes across the container boundary', () => {
    const source =
      '!!! note\n\n    ![local][outside] and note[^n].\n\n    [inside]: inner.png\n\n![outside][inside]\n\n[outside]: outer.png\n\n[^n]: ![foot](foot.png)\n';
    const tokens = parser().parse(source, {});
    expect(imageSources(tokens)).toEqual(['outer.png', 'inner.png', 'foot.png']);
  });

  it('does not let a container reference definition consume a following block', () => {
    const source = '!!! note\n\n    [inside]:\noutside.png\n\n![x][inside]';
    expect(imageSources(parser().parse(source, {}))).toEqual([]);
    expect(parser().render(source)).toContain('outside.png');
  });

  it('normalizes CRLF and permits tabs only after the four structural spaces', () => {
    const tokens = parser().parse(
      '!!! note\r\n\r\n    ![yes](yes.png)\r\n\r\n    \t![code](no.png)\r\n',
      {},
    );
    expect(imageSources(tokens)).toEqual(['yes.png']);
    expect(tokens.find((token) => token.type === 'code_block')?.content).toBe('![code](no.png)\n');
  });
});

describe('container budgets', () => {
  it('accepts 160 UTF-16 title units and rejects 161 atomically', () => {
    expect(containers(`!!! note "${'中'.repeat(160)}"\n\n    Body.`)).toHaveLength(1);
    expect(containers(`!!! note "${'中'.repeat(161)}"\n\n    Body.`)).toHaveLength(0);
    expect(containers(`!!! note "${'🙂'.repeat(81)}"\n\n    Body.`)).toHaveLength(0);
  });

  it('bounds the whole opening line independently of decoded title length', () => {
    expect(containers('!!! note' + ' '.repeat(504) + '\n\n    Body.')).toHaveLength(1);
    expect(containers('!!! note' + ' '.repeat(505) + '\n\n    Body.')).toHaveLength(0);
  });

  it('limits nesting while preserving the accepted outer structure', () => {
    expect(containers(nested(8))).toHaveLength(8);
    const source = nested(9, '![too deep](missing.png)');
    expect(containers(source)).toHaveLength(8);
    expect(imageSources(parser().parse(source, {}))).toEqual([]);
  });

  it('limits the document to 256 components with subsequent candidates falling back', () => {
    const block = '!!! note\n\n    ![asset](image.png)\n\n';
    const tokens = parser().parse(block.repeat(257), {});
    expect(tokens.filter((token) => token.type === 'mote_container_open')).toHaveLength(256);
    expect(imageSources(tokens)).toHaveLength(256);
    expect(tokens.at(-1)?.type).toBe('code_block');
  });

  it('counts nested source intervals once and enforces the exact source boundary', () => {
    const prefix = '!!! note\n\n    ';
    const source = prefix + 'a'.repeat(CONTAINER_LIMITS.source - prefix.length);
    expect(source.length).toBe(CONTAINER_LIMITS.source);
    expect(containers(source)).toHaveLength(1);
    expect(containers(source + 'a')).toHaveLength(0);
    const tree = nested(8, 'x'.repeat(90000));
    expect(containers(tree)).toHaveLength(8);
  });

  it('accumulates disjoint source intervals and leaves later images in fallback code', () => {
    const block = '!!! note\n\n    ' + 'a'.repeat(70000) + '\n\n';
    const tokens = parser().parse(
      block + '!!! note\n\n    ' + 'b'.repeat(62000) + '\n\n    ![x](missing.png)',
      {},
    );
    expect(tokens.filter((token) => token.type === 'mote_container_open')).toHaveLength(1);
    expect(imageSources(tokens)).toEqual([]);
  });

  it('resets budgets when reusing a parser and does not charge silent probes', () => {
    const md = parser();
    const source = '!!! note\n\n    Body.';
    const rule = md.block.ruler.getRules('').find((candidate) => {
      const state = new md.block.State(source, md, {}, []);
      return (
        candidate(state, 0, state.lineMax, true) && state.tokens.length === 0 && state.line === 0
      );
    });
    expect(rule).toBeDefined();
    const state = new md.block.State(source, md, {}, []);
    for (let i = 0; i < 300; i++) expect(rule!(state, 0, state.lineMax, true)).toBe(true);
    expect(rule!(state, 0, state.lineMax, false)).toBe(true);
    expect(state.tokens[0]?.type).toBe('mote_container_open');
    for (let i = 0; i < 2; i++) {
      expect(
        md
          .parse((source + '\n\n').repeat(256), {})
          .filter((token) => token.type === 'mote_container_open'),
      ).toHaveLength(256);
    }
  });
});
