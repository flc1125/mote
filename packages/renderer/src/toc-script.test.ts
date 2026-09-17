import { Script } from 'node:vm';
import { Parser } from 'htmlparser2';
import { describe, expect, it, vi } from 'vitest';

import { render } from './index.js';
import { TOC_SCRIPT } from './toc-script.js';
import { THEME_SCRIPT } from './theme-script.js';
import { PAGE_SCRIPT } from './page-script.js';

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
    expect(scripts).toEqual([THEME_SCRIPT, TOC_SCRIPT, PAGE_SCRIPT]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('mote-toc-group-0-1');
    expect(TOC_SCRIPT).not.toContain('attack()');
    expect(html).not.toContain('<script>attack()');
  });
});

/** Exercise anchor copying on a minimal page (no TOC panel needed). */
function anchorPage({ clipboard = true } = {}) {
  let click: (event: unknown) => void;
  const anchor = {
    href: '#section',
    target: '',
    hasAttribute: () => false,
    getAttribute: (name: string): string | null => (name === 'href' ? '#section' : null),
    classList: { add: vi.fn(), remove: vi.fn() },
  };
  const article = {
    contains: () => false,
    addEventListener: (_: string, handler: typeof click) => {
      click = handler;
    },
    querySelectorAll: () => [],
    appendChild: vi.fn(),
  };
  const createElement = vi.fn(() => ({
    className: '',
    setAttribute: () => {},
    textContent: '',
  }));
  const written: string[] = [];
  new Script(TOC_SCRIPT).runInNewContext({
    document: {
      getElementById: () => null,
      querySelector: (selector: string) => (selector === 'article' ? article : null),
      createElement,
    },
    location: new URL('https://mote.pub/7Vk3mQ9x2NFaP4Ls'),
    URL,
    ...(clipboard
      ? {
          navigator: {
            clipboard: {
              writeText: (text: string) => {
                written.push(text);
                return Promise.resolve();
              },
            },
          },
        }
      : {}),
    setTimeout: () => 0,
    clearTimeout: () => {},
    window: { addEventListener: () => {} },
  });
  const clickAnchor = (preventDefault = vi.fn(), target = anchor) => (
    click({
      button: 0,
      preventDefault,
      target: { closest: (selector: string) => (selector.startsWith('a') ? target : null) },
    }),
    preventDefault
  );
  return { anchor, article, createElement, written, clickAnchor };
}

describe('heading anchor copying', () => {
  it('copies the absolute section URL without navigating', async () => {
    const page = anchorPage();
    const preventDefault = page.clickAnchor();
    await Promise.resolve();
    expect(page.written).toEqual(['https://mote.pub/7Vk3mQ9x2NFaP4Ls#section']);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(page.anchor.classList.add).toHaveBeenCalledWith('is-copied');
    expect(page.article.appendChild).toHaveBeenCalledOnce();
  });

  it('reverts the previous checkmark immediately when another anchor is copied', async () => {
    const page = anchorPage();
    page.clickAnchor();
    await Promise.resolve();
    const other = {
      href: '#other',
      target: '',
      hasAttribute: () => false,
      getAttribute: (name: string): string | null => (name === 'href' ? '#other' : null),
      classList: { add: vi.fn(), remove: vi.fn() },
    };
    page.clickAnchor(vi.fn(), other);
    await Promise.resolve();
    expect(page.anchor.classList.remove).toHaveBeenCalledWith('is-copied');
    expect(other.classList.add).toHaveBeenCalledWith('is-copied');
  });

  it('keeps the plain jump when the clipboard is unavailable', () => {
    const page = anchorPage({ clipboard: false });
    const preventDefault = page.clickAnchor();
    expect(page.written).toEqual([]);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(page.createElement).not.toHaveBeenCalled();
  });
});
