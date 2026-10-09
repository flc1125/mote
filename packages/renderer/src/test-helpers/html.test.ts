import { Parser } from 'htmlparser2';
import { describe, expect, it, vi } from 'vitest';

import { inspectHtml } from './html.js';

describe('test-only HTML inspection', () => {
  it.each(['', '<!-- <script>comment()</script> -->'])(
    'returns an empty inspection for %j',
    (html) => {
      expect(inspectHtml(html)).toEqual({ elements: [], scripts: [], text: '' });
    },
  );

  it('records every element and attribute without applying a safety policy', () => {
    expect(
      inspectHtml(
        '<DIV DATA-NOTE="&amp;" ONCLICK="attack()"><span>One &amp; 中</span><br><img SRC=x ONERROR="attack()"></DIV>',
      ),
    ).toEqual({
      elements: [
        { tag: 'div', attributes: { 'data-note': '&', onclick: 'attack()' } },
        { tag: 'span', attributes: {} },
        { tag: 'br', attributes: {} },
        { tag: 'img', attributes: { src: 'x', onerror: 'attack()' } },
      ],
      scripts: [],
      text: 'One & 中',
    });
  });

  it.each([
    { name: 'uppercase tags', html: '<SCRIPT>alert(1)</SCRIPT>', attributes: {}, text: 'alert(1)' },
    {
      name: 'mixed-case tags and attributes',
      html: '<ScRiPt TyPe="text/javascript">alert(1)</ScRiPt>',
      attributes: { type: 'text/javascript' },
      text: 'alert(1)',
    },
    {
      name: 'an abnormal closing tag',
      html: '<script>alert(1)</script ignored>',
      attributes: {},
      text: 'alert(1)',
    },
    {
      name: 'the comment end-bang variant',
      html: '<!-- harmless --!><SCRIPT>alert(1)</SCRIPT>',
      attributes: {},
      text: 'alert(1)',
    },
    {
      name: 'an unclosed script',
      html: '<script>unfinished()',
      attributes: {},
      text: 'unfinished()',
    },
    {
      name: 'an HTML self-closing script that is not void',
      html: '<script/>selfClosingIsNotVoid()</script>',
      attributes: {},
      text: 'selfClosingIsNotVoid()',
    },
  ])('captures $name', ({ html, attributes, text }) => {
    expect(inspectHtml(html).scripts).toEqual([{ attributes, text }]);
  });

  it('keeps external, non-JavaScript and empty scripts in opening order', () => {
    expect(
      inspectHtml(
        '<script src="https://example.invalid/a.js"></script><script TYPE="application/json">{"x":1}</script><script></script>',
      ).scripts,
    ).toEqual([
      { attributes: { src: 'https://example.invalid/a.js' }, text: '' },
      { attributes: { type: 'application/json' }, text: '{"x":1}' },
      { attributes: {}, text: '' },
    ]);
  });

  it('does not reinterpret comments, textarea content or escaped code as elements', () => {
    expect(
      inspectHtml(
        '<!-- <script>comment()</script> --><textarea><script>literal()</script></textarea><code>&lt;script&gt;code()&lt;/script&gt;</code>',
      ),
    ).toEqual({
      elements: [
        { tag: 'textarea', attributes: {} },
        { tag: 'code', attributes: {} },
      ],
      scripts: [],
      text: '<script>literal()</script><script>code()</script>',
    });
  });

  it('preserves raw script text without decoding entities or trimming whitespace', () => {
    const text = '\r\nconst text = "&lt;script&gt;";\nif (1 < 2) {}\n';
    expect(inspectHtml(`<script>${text}</script>`)).toEqual({
      elements: [{ tag: 'script', attributes: {} }],
      scripts: [{ attributes: {}, text }],
      text,
    });
  });

  it('concatenates all text callbacks when parser input arrives in chunks', () => {
    const end = Parser.prototype.end;
    const spy = vi.spyOn(Parser.prototype, 'end').mockImplementationOnce(function (
      this: Parser,
      html = '',
    ) {
      for (let index = 0; index < html.length; index += 7) this.write(html.slice(index, index + 7));
      end.call(this);
    });
    const text = 'const a = "&amp;";\nif (1 < 2) {}';
    try {
      expect(inspectHtml(`<SCRIPT TyPe="text/javascript">${text}</SCRIPT>`).scripts).toEqual([
        { attributes: { type: 'text/javascript' }, text },
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it('decodes ordinary text entities while preserving command whitespace and line endings', () => {
    expect(
      inspectHtml(
        '<span class="prompt" aria-hidden="true"></span>npm install -g mote-cli\r\nmote login\n<em>mote</em> README.md &amp; &#x4E2D;  ',
      ).text,
    ).toBe('npm install -g mote-cli\r\nmote login\nmote README.md & 中  ');
  });

  it('includes hidden, script and style text rather than claiming to extract visible text', () => {
    expect(
      inspectHtml('<span hidden>hidden</span><script>script()</script><style>p{color:red}</style>')
        .text,
    ).toBe('hiddenscript()p{color:red}');
  });

  it('does not leak parsing state between inspections', () => {
    const first = inspectHtml('<script>unfinished()');
    expect(inspectHtml('<p>Next</p>')).toEqual({
      elements: [{ tag: 'p', attributes: {} }],
      scripts: [],
      text: 'Next',
    });
    expect(first.scripts).toEqual([{ attributes: {}, text: 'unfinished()' }]);
  });
});

describe('script and event-handler assertion sensitivity', () => {
  const first = '<script>trustedOne();</script>';
  const second = '<script>trustedTwo();</script>';
  const expected = [
    { attributes: {}, text: 'trustedOne();' },
    { attributes: {}, text: 'trustedTwo();' },
  ];

  it('accepts the exact independently specified script list', () => {
    expect(inspectHtml(first + second).scripts).toEqual(expected);
  });

  it.each([
    ['an extra uppercase script', first + '<SCRIPT>unexpected();</SCRIPT>' + second],
    ['an empty script', first + '<script></script>' + second],
    ['an external script', first + '<script src="https://example.invalid/a.js"></script>' + second],
    ['a duplicate script', first + first + second],
    ['reordered scripts', second + first],
    ['a missing script', first],
    ['changed script contents', '<script>unexpected();</script>' + second],
    ['an unexpected type attribute', '<script type="module">trustedOne();</script>' + second],
    [
      'an unexpected src attribute with unchanged text',
      '<script src="https://example.invalid/a.js">trustedOne();</script>' + second,
    ],
  ])('fails the exact script assertion for %s', (_name, html) => {
    const scripts = inspectHtml(html!).scripts;
    expect(() => expect(scripts).toEqual(expected)).toThrow();
  });

  it.each(['<img src=x ONERROR="attack()">', '<svg OnLoAd="attack()"></svg>'])(
    'fails a no-event-handler assertion for %s',
    (html) => {
      const { elements } = inspectHtml(html);
      expect(() => {
        for (const { attributes } of elements) {
          expect(Object.keys(attributes).filter((name) => name.startsWith('on'))).toEqual([]);
        }
      }).toThrow();
    },
  );
});
