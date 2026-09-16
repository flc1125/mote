import { readFileSync } from 'node:fs';
import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.js';
import { renderHtmlPage } from './template.js';
import { COPY_SCRIPT } from './copy-script.js';
import { THEME_SCRIPT } from './theme-script.js';
import MarkdownIt from 'markdown-it';
import { codeBlockCases } from './fixtures/code-blocks.js';

function inspect(html: string) {
  const codes: string[] = [];
  const numbered: string[] = [];
  let codeDepth = 0;
  let highlights = 0;
  new Parser({
    onopentag(tag, attrs) {
      if (tag === 'code') {
        codeDepth++;
        codes.push('');
      }
      if (attrs['data-line']) numbered.push(attrs['data-line']);
      if (attrs.class?.includes('is-highlighted')) highlights++;
      expect(Object.keys(attrs).some((key) => /^on/i.test(key))).toBe(false);
    },
    onclosetag(tag) {
      if (tag === 'code') codeDepth--;
    },
    ontext(text) {
      if (codeDepth) codes[codes.length - 1] += text;
    },
  }).end(html);
  return { codes, numbered, highlights };
}
const fence = (info: string, source: string) => `\`\`\`${info}\n${source}\`\`\`\n`;
const render = (input: string) => renderMarkdown(input, new Map());

describe('code block enhancements', () => {
  it.each(['text', 'text title=""', 'js title="discarded" linenums="0"'])(
    'places untitled controls after intact code without a toolbar: %s',
    (info) => {
      const source = 'const unchanged = true;\n';
      const result = render(fence(info, source));
      expect(result.html).toContain('class="code-block is-compact"');
      expect(result.html).not.toContain('code-toolbar');
      expect(result.html).toContain('</code></pre><button');
      expect(inspect(result.html).codes).toEqual([source]);
      expect(result.codeCopy).toBe(true);
    },
  );
  it('keeps titled controls before the code, including empty titled blocks', () => {
    for (const source of ['one\n', '']) {
      const result = render(fence('text title="config.txt"', source));
      expect(result.html).not.toContain('is-compact');
      expect(result.html).toContain('<div class="code-toolbar"><span class="code-title">');
      expect(result.html.indexOf('code-toolbar')).toBeLessThan(result.html.indexOf('<pre'));
      expect(inspect(result.html).codes).toEqual([source]);
      expect(result.codeCopy).toBe(source !== '');
    }
  });
  it.each(codeBlockCases)('fulfills frozen case $id with parser-exact text', (fixture) => {
    const result = render(fixture.input);
    const token = new MarkdownIt().parse(fixture.input, {})[0]!;
    const parsed = inspect(result.html);
    expect(parsed.codes).toEqual([token.content]);
    expect(parsed.numbered).toEqual(fixture.numbers ?? []);
    expect(parsed.highlights).toBe(fixture.highlights ?? 0);
    expect(result.codeCopy).toBe(fixture.copy);
    if (fixture.title) expect(result.html).toContain(`class="code-title">${fixture.title}</span>`);
    else expect(result.html).not.toContain('class="code-title"');
  });
  it('preserves multiline highlighting and exact code while decorating physical lines', () => {
    const source = '/* first\nsecond */\nconst x = `a\nb`;\n';
    const result = render(
      fence('js title="config.js" linenums="10" hl_lines="2-3 3-4 999999"', source),
    );
    expect(inspect(result.html)).toEqual({
      codes: [source],
      numbered: ['10', '11', '12', '13'],
      highlights: 3,
    });
    expect(result.html).toContain('class="hljs-comment">second */</span>');
    expect(result.html).toContain('class="code-title">config.js</span>');
    expect(result.codeCopy).toBe(true);
  });
  it.each(['', 'text', 'unknown'])(
    'copies plain/unknown language %s without modifying escaped markup',
    (lang) => {
      const source = '<script>unsafe()</script> & ">\n\n';
      const result = render(fence(`${lang}${lang ? ' linenums="1"' : ''}`, source));
      expect(inspect(result.html).codes).toEqual([source]);
      expect(result.html).not.toContain('<script>');
      expect(result.codeCopy).toBe(true);
    },
  );
  it('normalizes CRLF exactly as markdown-it does and preserves trailing blank lines', () => {
    const result = render('~~~text linenums="1"\r\none\r\ntwo\r\n\r\n~~~\r\n');
    expect(inspect(result.html)).toEqual({
      codes: ['one\ntwo\n\n'],
      numbered: ['1', '2', '3'],
      highlights: 0,
    });
  });
  it.each([
    [1, 1],
    [9, 2],
    [99, 3],
    [999, 4],
    [9999, 5],
    [99999, 6],
    [999999, 7],
    [1000000, 7],
  ])('sizes the gutter for the last displayed line starting at %i', (start, digits) => {
    const source = 'first\nsecond\nthird\n';
    const result = render(fence(`text linenums="${start}"`, source));
    expect(result.html).toContain(`data-line-digits="${digits}"`);
    expect(inspect(result.html)).toEqual({
      codes: [source],
      numbered: [start, start + 1, start + 2].map(String),
      highlights: 0,
    });
  });
  it('omits the number gutter for unnumbered and empty blocks', () => {
    for (const input of [
      fence('text hl_lines="1"', 'plain\n'),
      fence('text linenums="1" title="empty"', ''),
    ]) {
      expect(render(input).html).not.toContain('data-line-digits');
    }
  });
  it('escapes title text and ignores a malformed metadata tail atomically', () => {
    const result = render(fence('js title="</script><img src=x onerror=bad>"', 'const x = 1;\n'));
    expect(result.html).toContain('&lt;/script&gt;&lt;img src=x onerror=bad&gt;');
    expect(result.html).not.toContain('<img');
    const invalid = render(fence('js title="valid" linenums="0"', 'const x = 1;\n'));
    expect(invalid.html).not.toContain('code-title');
    expect(invalid.html).toContain('hljs-keyword');
    expect(inspect(invalid.html).codes).toEqual(['const x = 1;\n']);
  });
  it('requires an explicit language before parameters and counts trailing metadata whitespace', () => {
    for (const info of [
      'title="no-language" linenums="1"',
      `text title="oversized"${' '.repeat(1024)}`,
    ]) {
      const result = render(fence(info, 'plain\n'));
      expect(result.html).not.toContain('class="code-title"');
      expect(inspect(result.html)).toEqual({ codes: ['plain\n'], numbered: [], highlights: 0 });
    }
  });
  it('keeps empty code, indented code, raw HTML and Mermaid outside copying', () => {
    for (const source of [
      '```text\n```',
      '    code\n',
      '<pre><code>raw</code></pre>',
      fence('mermaid title="diagram"', 'graph LR\nA-->B\n'),
      fence('mermaid', 'pie\n"A": 1\n'),
    ]) {
      expect(render(source).codeCopy).toBe(false);
    }
    const empty = render('```text title="empty" linenums="1"\n```');
    expect(empty.html).toContain('code-title');
    expect(inspect(empty.html)).toEqual({ codes: [''], numbered: [], highlights: 0 });
    expect(empty.codeCopy).toBe(false);
  });
  it('bounds individual blocks and cumulative enhancement work, resetting per document', () => {
    const large = render(fence('text linenums="1"', 'x'.repeat(16385) + '\n'));
    expect(large.codeCopy).toBe(false);
    expect(inspect(large.html).codes[0]).toHaveLength(16386);
    expect(render(fence('text linenums="1"', 'x\n'.repeat(513))).codeCopy).toBe(false);
    const block = fence('text', 'x\n');
    const many = render(block.repeat(65));
    expect(many.html.match(/class="code-copy"/g)).toHaveLength(64);
    expect(inspect(many.html).codes).toHaveLength(65);
    expect(render(block).codeCopy).toBe(true);
    const units = render(fence('text', 'x'.repeat(16383) + '\n').repeat(5));
    expect(units.html.match(/class="code-copy"/g)).toHaveLength(4);
    const lines = render(fence('text', 'x\n'.repeat(512)).repeat(9));
    expect(lines.html.match(/class="code-copy"/g)).toHaveLength(8);
  });
  it('falls back atomically when line decoration exceeds the extra-output budget', () => {
    const source = 'x\n'.repeat(512);
    const result = render(fence('text linenums="1" hl_lines="1-512"', source));
    expect(result.codeCopy).toBe(false);
    expect(inspect(result.html)).toEqual({ codes: [source], numbered: [], highlights: 0 });
    const repeated = render(fence('text linenums="1"', source).repeat(8) + fence('text', 'last\n'));
    expect(repeated.codeCopy).toBe(false);
  });
  it('enforces the document output budget and preserves every fallback block', () => {
    const source = 'x\n'.repeat(250);
    const result = render(fence('text linenums="1"', source).repeat(12));
    const copies = result.html.match(/class="code-copy"/g) ?? [];
    expect(copies.length).toBeGreaterThan(1);
    expect(copies.length).toBeLessThan(12);
    expect(inspect(result.html).codes).toEqual(Array(12).fill(source));
  });
  it('emits the fixed copy script without a TOC, and no script for an ordinary paragraph', () => {
    const result = render(fence('text', 'hello\n'));
    const page = renderHtmlPage({
      title: 'Code',
      tocHtml: '',
      contentHtml: result.html,
      codeCopy: result.codeCopy,
    });
    expect([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])).toEqual([
      THEME_SCRIPT,
      COPY_SCRIPT,
    ]);
    // A plain page still carries the always-on theme script, nothing else.
    const plain = renderHtmlPage({ title: 'Plain', tocHtml: '', contentHtml: '<p>text</p>' });
    expect([...plain.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])).toEqual([
      THEME_SCRIPT,
    ]);
  });
  it('renders the committed specimen with code text intact and no image assets', () => {
    const source = readFileSync(
      new URL('../../../docs/examples/markdown-code-blocks.md', import.meta.url),
      'utf8',
    );
    const result = render(source);
    const parsed = inspect(result.html);
    expect(parsed.numbered).toEqual(['10', '11', '12', '13', '1', '2', '3', '4']);
    expect(parsed.highlights).toBe(3);
    expect(parsed.codes).toContain('const config = {\n  timeout: 3000,\n  retries: 2,\n};\n');
    expect(result.html).not.toContain('<img');
  });
});
