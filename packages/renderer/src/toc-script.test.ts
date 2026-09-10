import { HISTORY_SCRIPT } from './history-script.js';
import { Script } from 'node:vm';
import { Parser } from 'htmlparser2';
import { describe, expect, it } from 'vitest';

import { render } from './index.js';
import { TOC_SCRIPT } from './toc-script.js';

const id = '7Vk3mQ9x2NFaP4Ls';
const manifest = {
  version: 1 as const,
  id,
  createdAt: '2026-09-10T00:00:00Z',
  source: { name: 'toc.md', size: 100, sha256: 'a'.repeat(64) },
  assets: [],
};

describe('TOC enhancement boundary', () => {
  it('is valid standalone JavaScript and safely does nothing without a TOC', () => {
    expect(() =>
      new Script(TOC_SCRIPT).runInNewContext({
        document: { getElementById: () => null, querySelector: () => null },
      }),
    ).not.toThrow();
  });

  it('never interpolates hostile headings into the trusted script or control markup', () => {
    const html = render(
      '# Normal\n\n## </script><script>attack()</script> " &\n\n### Child\n\n# mote-toc-group-0\n\n## Group',
      manifest,
      id,
    );
    const scripts: string[] = [];
    const ids: string[] = [];
    let inScript = false;
    new Parser({
      onopentag(tag, attrs) {
        if (attrs.id) ids.push(attrs.id);
        if (tag === 'script') {
          inScript = true;
          scripts.push('');
        }
        for (const key of Object.keys(attrs)) expect(key).not.toMatch(/^on/i);
      },
      ontext(text) {
        if (inScript) scripts[scripts.length - 1] += text;
      },
      onclosetag(tag) {
        if (tag === 'script') inScript = false;
      },
    }).end(html);
    expect(scripts).toEqual([TOC_SCRIPT, HISTORY_SCRIPT]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('mote-toc-group-0-1');
    expect(TOC_SCRIPT).not.toContain('attack()');
    expect(html).not.toContain('<script>attack()');
  });
});
