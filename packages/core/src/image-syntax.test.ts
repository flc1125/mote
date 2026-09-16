import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { documentSyntax } from './document-syntax.js';

const md = new MarkdownIt({ html: true }).use(documentSyntax);
describe('shared image syntax', () => {
  it.each(['1', '640', '4096', '1%', '100%'])('accepts width %s without changing src', (width) => {
    expect(md.render(`![alt](encoded%20name.png){ width="${width}" }`)).toContain(
      `src="encoded%20name.png" alt="alt" width="${width}"`,
    );
  });
  it.each(['0', '4097', '101%', '-1', '1.5', '640px', '01', '1" height="2', '2" width="3', "'20'"])(
    'preserves invalid width %s as literal text',
    (value) => {
      const html = md.render(`![alt](a.png){ width="${value}" }`);
      expect(html).not.toContain('alt="alt" width=');
      expect(html).toContain('{ width=');
    },
  );
  it('does not consume spaced, escaped, code or link attributes', () => {
    const html = md.render(
      '![a](a.png) { width="20" }\n\n`![b](b.png){ width="20" }`\n\n![c](c.png)\\{ width="20" }\n\n[link](a.png){ width="20" }',
    );
    expect(html).not.toContain(' width="20"');
  });
  it('renders reference images and formatted captions, retaining alt and title', () => {
    const html = md.render(
      '![alternative][photo]{ width="50%" }\n/// caption\n**Visible** caption with [link](https://example.com).\n///\n\n[photo]: a.png "Tooltip"',
    );
    expect(html).toContain('<figure class="mote-figure">');
    expect(html).toContain('alt="alternative" title="Tooltip" width="50%"');
    expect(html).toContain('<figcaption><strong>Visible</strong>');
    expect(html).not.toContain('///');
  });
  it.each([
    'Text\n/// caption\nCaption\n///',
    '[![alt](a.png)](https://example.com)\n/// caption\nCaption\n///',
    '![alt](a.png)\n/// caption\nCaption',
    '![alt](a.png)\n/// caption\nCaption\n///\nMore text',
    '![alt](a.png)\n/// caption\nCaption\n\nOther paragraph\n///',
    '![alt](a.png)\n/// caption\n' + 'x'.repeat(4097) + '\n///',
    '![alt](a.png)\n/// caption\n' + 'x\n'.repeat(33) + '///',
    '```md\n![alt](a.png)\n/// caption\nCaption\n///\n```',
  ])('keeps unsupported caption structures ordinary Markdown', (source) => {
    expect(md.render(source)).not.toContain('<figure');
  });
  it('allocates caption footnote references exactly once', () => {
    const html = md.render('![alt](a.png)\n/// caption\nCaption[^n].\n///\n\n[^n]: Footnote.');
    expect(html.match(/id="fnref1"/g)).toHaveLength(1);
    expect(html.match(/class="footnote-backref"/g)).toHaveLength(1);
  });
  it('limits attempts per document and resets for the next document', () => {
    const sample = '![alt](a.png)\n/// caption\nCaption\n///\n\n';
    expect(md.render(sample.repeat(70)).match(/<figure/g)).toHaveLength(64);
    const invalid = 'text\n/// caption\nCaption\n///\n\n';
    expect(md.render(invalid.repeat(64) + sample)).not.toContain('<figure');
    expect(md.render(sample)).toContain('<figure');
  });
});
