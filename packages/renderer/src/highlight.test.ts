import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';

import { createCodeHighlighter } from './highlight.js';
import { renderMarkdown } from './markdown.js';

function textContent(html: string): string {
  let text = '';
  new Parser({
    ontext: (value) => {
      text += value;
    },
  }).end(html);
  return text;
}

describe('static code highlighting', () => {
  it.each([
    ['js', 'const name = "Mote";'],
    ['ts', 'const n: number = 1;'],
    ['json', '{"ok": true}'],
    ['sh', 'echo "$HOME"'],
    ['yml', 'title: Mote'],
    ['python', 'def hello():\n    return True'],
    ['go', 'func main() {}'],
    ['rust', 'fn main() { let n = 1; }'],
    ['java', 'public class Mote {}'],
    ['c', 'int main(void) { return 0; }'],
    ['cpp', 'class Mote {};'],
    ['sql', 'SELECT name FROM documents;'],
    ['css', '.mote { color: red; }'],
    ['html', '<img src="example.png">'],
    ['diff', '+added\n-removed'],
    ['md', '**说明：**正文'],
    ['JS', 'const n = 1;'],
  ])('highlights %s without changing its text', (language, code) => {
    const highlighted = createCodeHighlighter()(code, language);
    expect(highlighted).toContain('class="hljs-');
    expect(textContent(highlighted)).toBe(code);
  });

  it.each(['', 'text', 'plaintext', 'unknown', 'mermaid', 'constructor', '__proto__'])(
    'keeps %s as escaped plain code',
    (language) => {
      const { html } = renderMarkdown(
        `~~~${language}\n<script>alert("x")</script> & **text**\n~~~`,
        new Map(),
      );
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('class="hljs-');
      expect(textContent(html).trim()).toBe('<script>alert("x")</script> & **text**');
    },
  );

  it('escapes markup and fence attributes without trusting user highlighting classes', () => {
    const { html } = renderMarkdown(
      '~~~html\n</code><script>alert(1)</script><img onerror="bad()">\n~~~\n\n~~~js"onmouseover="bad\n<unsafe>\n~~~\n\n<span class="hljs-keyword" style="color:red">raw</span>',
      new Map(),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain(' onmouseover=');
    expect(html).toContain('<span>raw</span>');
    expect(html).not.toContain('style="color:red"');
  });

  it('bounds block size and long lines while keeping all source text', () => {
    const code = `const s = "${'x'.repeat(20_000)}";\n`;
    const { html } = renderMarkdown(`~~~js\n${code}~~~`, new Map());
    expect(html).not.toContain('hljs-');
    expect(textContent(html)).toBe(`${code}\n`);
    expect(createCodeHighlighter()('x'.repeat(4097), 'js')).toBe('');
  });

  it('resets the block and input budgets for each document', () => {
    const highlighter = createCodeHighlighter();
    for (let i = 0; i < 64; i++) expect(highlighter('const x = 1;', 'js')).not.toBe('');
    expect(highlighter('const x = 1;', 'js')).toBe('');
    expect(createCodeHighlighter()('const x = 1;', 'js')).not.toBe('');
    const bySize = createCodeHighlighter();
    const code = '// comment\n'.repeat(1400);
    for (let i = 0; i < 4; i++) expect(bySize(code, 'js')).not.toBe('');
    expect(bySize(code, 'js')).toBe('');
  });
});
