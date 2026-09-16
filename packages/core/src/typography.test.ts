import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { documentSyntax } from './document-syntax.js';

const md = new MarkdownIt({ html: true }).use(documentSyntax);

describe('shared typography syntax', () => {
  it('marks Chinese text, inline formatting, links and soft line breaks', () => {
    const html = md.render(
      '前文==重点==后文\n\n==**bold** and [link](https://example.com)==\n\n==first\nsecond==',
    );
    expect(html).toContain('前文<mark>重点</mark>后文');
    expect(html).toContain(
      '<mark><strong>bold</strong> and <a href="https://example.com">link</a></mark>',
    );
    expect(html).toContain('<mark>first\nsecond</mark>');
  });
  it.each([
    '== text==',
    '==text ==',
    '==',
    '====',
    '==unclosed',
    '\\==literal\\==',
    '==first\n\nsecond==',
  ])('preserves unmatched, empty, escaped or invalid boundaries: %s', (source) => {
    expect(md.render(source)).not.toContain('<mark>');
  });
  it('keeps odd markers and Setext heading precedence', () => {
    expect(md.render('===text===')).toBe('<p>=<mark>text</mark>=</p>\n');
    expect(md.render('Heading\n===')).toBe('<h1>Heading</h1>\n');
  });
  it('protects code, math, link destinations and HTML attributes', () => {
    const html = md.render(
      '`==code==`\n\n```md\n==fenced==\nTerm\n: definition\n```\n\n    ==indented==\n\n$==inline==$\n\n$$\n==display==\nTerm\n: math\n$$\n\n[link](https://example.com/==path==) <abbr title="==attribute==">Label</abbr>',
    );
    expect(html).not.toMatch(/<mark>|<dl>/);
    expect(html).toContain('title="==attribute=="');
    expect(html).toContain('href="https://example.com/==path=="');
  });
  it('supports multiple definitions, multiline bodies and nested lists', () => {
    const html = md.render(
      'Term\n: first\n: second\n\nNext term\n\n: first paragraph\n\n    second paragraph\n\n    - item\n\n    Nested\n    : inner',
    );
    expect(html.match(/<dt>/g)).toHaveLength(3);
    expect(html.match(/<dd>/g)).toHaveLength(4);
    expect(html).toContain('<p>second paragraph</p>');
    expect(html).toContain('<li>item</li>');
  });
  it.each([
    'Term\n:no space',
    'Term\n\n\n: too far',
    'First\nsecond\n: definition',
    ': no term',
    '```\nTerm\n: code\n```',
    '    Term\n    : code',
  ])('preserves non-definition structures: %s', (source) => {
    expect(md.render(source)).not.toContain('<dl>');
  });
  it('supports the tilde marker and empty definitions', () => {
    expect(md.render('Term\n~ alternate\n:')).toContain('<dd>alternate</dd>\n<dd></dd>');
  });
  it('composes in containers, quotes, lists and footnotes without enabling containers in definitions', () => {
    const html = md.render(
      '!!! note\n\n    Term\n    : ==value==\n\n=== "Tab"\n\n    Term\n    : value\n\n> Term\n> : quote\n\n- Term\n  : list\n\nReference[^n]\n\n[^n]: Term\n    : footnote\n\nPlain\n: text\n\n    !!! tip\n\n        ![code](fake.png)',
    );
    expect(html.match(/<dl>/g)).toHaveLength(6);
    expect(html).toContain('<mark>value</mark>');
    expect(html).toContain('<dt>Term</dt>');
    expect(html).not.toContain('src="fake.png"');
  });
  it('does not leak definition state between renders using the same environment', () => {
    const env = {};
    md.render('Term\n: one\n\n    Nested\n    : two', env);
    expect(md.render('Ordinary\nparagraph.', env)).toBe('<p>Ordinary\nparagraph.</p>\n');
  });
});
