import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { documentSyntax } from './document-syntax.js';
import { ABBREVIATION_LIMITS } from './abbreviations.js';

const md = new MarkdownIt({ html: true, linkify: true }).use(documentSyntax);

describe('document abbreviations', () => {
  it('uses definitions before or after text, longest first, with escaped plain titles', () => {
    const html = md.render(
      'API and API client.\n\n*[API]: <b>Interface</b> "quoted"\n*[API client]: Client\n*[API]: ignored',
    );
    expect(html).toContain(
      '<abbr title="&lt;b&gt;Interface&lt;/b&gt; &quot;quoted&quot;">API</abbr>',
    );
    expect(html).toContain('<abbr title="Client">API client</abbr>');
    expect(html).not.toContain('ignored');
  });
  it('honors case and Unicode boundaries, including CJK and combining marks', () => {
    const html = md.render(
      'API api APIs xAPI API_ API9 中文API API中文 API\u0301 （API） 中文\n\n*[API]: Interface\n*[中文]: Chinese',
    );
    expect(html.match(/<abbr /g)).toHaveLength(3);
    expect(html).toContain('中文API API中文 API\u0301');
  });
  it('keeps formatting and protects code, math, links, images and HTML', () => {
    const html = md.render(
      '**API** ==API== `API` $API$ [API](https://example.com/API) ![API](API.png)\n\n<abbr title="API">API</abbr> API\n\n```txt\nAPI\n*[NO]: literal\n```\n\n    API\n\n*[API]: Interface',
    );
    expect(html.match(/title="Interface"/g)).toHaveLength(2);
    expect(html).toContain('<code>API</code>');
    expect(html).toContain('alt="API"');
    expect(html).toContain('<abbr title="API">API</abbr> API');
  });
  it('matches literal punctuation without treating terms as regex', () => {
    expect(md.render('C++ and a.b\n\n*[C++]: language\n*[a.b]: dotted')).toContain(
      '<abbr title="language">C++</abbr>',
    );
    expect(md.render('axb\n\n*[a.b]: dotted')).not.toContain('<abbr');
  });
  it('rejects malformed, indented, multiline and oversized definitions', () => {
    for (const definition of [
      '*[API]:',
      '*[API]:   ',
      '*[ API]: text',
      '*[A\\PI]: text',
      '*[API]: ' + 'x'.repeat(513),
      '*[' + 'A'.repeat(65) + ']: text',
      '    *[API]: code',
    ]) {
      expect(md.render('API\n\n' + definition)).not.toContain('<abbr');
    }
    expect(md.render('API\n\n> *[API]: nested')).not.toContain('<abbr');
  });
  it('resets definitions even when parser and environment are reused', () => {
    const env = {};
    expect(md.render('API\n\n*[API]: Interface', env)).toContain('<abbr');
    expect(md.render('API', env)).toBe('<p>API</p>\n');
  });
  it('composes with definitions, footnotes, tabs and captions', () => {
    const html = md.render(
      'Term\n: API\n\nReference[^n]\n\n[^n]: API\n\n=== "One"\n\n    API\n\n=== "Two"\n\n    API\n\n![image](x.png)\n/// caption\nAPI\n///\n\n*[API]: Interface',
    );
    expect(html.match(/<abbr /g)).toHaveLength(5);
  });
  it('bounds definitions and leaves excess declarations visible', () => {
    const source = Array.from({ length: 65 }, (_, i) => `*[T${i}]: Title`).join('\n');
    const html = md.render('T0 T63 T64\n\n' + source);
    expect(html).toContain('>T0</abbr>');
    expect(html).toContain('>T63</abbr>');
    expect(html).toContain('*[T64]: Title');
  });
  it('bounds replacements, text and candidate work with readable remaining text', () => {
    expect(md.render('API '.repeat(600) + '\n\n*[API]: Interface').match(/<abbr /g)).toHaveLength(
      ABBREVIATION_LIMITS.replacements,
    );
    expect(md.render('x'.repeat(65536) + ' API\n\nAPI\n\n*[API]: Interface')).not.toContain(
      '<abbr',
    );
    expect(md.render('xAPI '.repeat(4096) + 'API\n\n*[API]: Interface')).not.toContain('<abbr');
  });
});
