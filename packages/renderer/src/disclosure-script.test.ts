import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

import { TOC_SCRIPT } from './toc-script.js';

/** Exercise the real fixed script on a heading-free page with nested disclosures. */
function page(hash = '') {
  const windowEvents = new Map<string, () => void>();
  let click: (event: unknown) => void;
  const article = {
    contains: (target: unknown) => target === inner || target === outer,
    addEventListener: (_: string, handler: typeof click) => {
      click = handler;
    },
    querySelectorAll: (selector: string) =>
      [outer, inner, rawClosed, initiallyOpen].filter(
        (node) => !node.open && (!selector.includes('.markdown-alert') || node !== rawClosed),
      ),
  };
  const outer = { tagName: 'DETAILS', open: false, parentElement: article };
  const inner = {
    tagName: 'DETAILS',
    open: false,
    parentElement: outer,
    scrollIntoView: vi.fn(),
  };
  const rawClosed = { open: false };
  const initiallyOpen = { open: true };
  const location = new URL(`https://example.com/document${hash}`);
  new Script(TOC_SCRIPT).runInNewContext({
    document: {
      getElementById: (id: string) => (id === 'inner' ? inner : null),
      querySelector: (selector: string) => (selector === 'article' ? article : null),
    },
    location,
    URL,
    window: {
      addEventListener: (name: string, handler: () => void) => windowEvents.set(name, handler),
    },
  });
  return {
    outer,
    inner,
    initiallyOpen,
    rawClosed,
    location,
    fire: (name: string) => windowEvents.get(name)?.(),
    click: (href: string, options: Record<string, unknown> = {}) => {
      const { target = '', download = false, ...event } = options;
      click({
        button: 0,
        target: { closest: () => ({ href, target, hasAttribute: () => download }) },
        ...event,
      });
    },
  };
}

describe('disclosure navigation without a TOC', () => {
  it('reveals the target itself and all closed ancestors on load and history navigation', () => {
    const p = page('#inner');
    expect([p.outer.open, p.inner.open]).toEqual([true, true]);
    expect(p.inner.scrollIntoView).toHaveBeenCalledOnce();
    p.outer.open = p.inner.open = false;
    p.fire('hashchange');
    expect([p.outer.open, p.inner.open]).toEqual([true, true]);
    p.outer.open = false;
    p.fire('pageshow');
    expect(p.outer.open).toBe(true);
  });

  it('handles a repeated same-fragment click without requiring hashchange', () => {
    const p = page('#inner');
    p.outer.open = p.inner.open = false;
    p.click('#inner');
    expect([p.outer.open, p.inner.open]).toEqual([true, true]);
    expect(p.location.hash).toBe('#inner');
  });

  it.each([
    ['https://elsewhere.example/document#inner', {}],
    ['/other#inner', {}],
    ['?different#inner', {}],
    ['#inner', { ctrlKey: true }],
    ['#inner', { defaultPrevented: true }],
    ['#inner', { button: 1 }],
    ['#inner', { target: '_blank' }],
    ['#inner', { download: true }],
    ['http://[invalid', {}],
    ['#%E0%A4', {}],
  ])('leaves unrelated or modified navigation alone: %s %j', (href, options) => {
    const p = page();
    expect(() => p.click(href, options)).not.toThrow();
    expect([p.outer.open, p.inner.open]).toEqual([false, false]);
  });

  it('opens closed bodies for printing and restores only their previous closed state', () => {
    const p = page();
    p.fire('beforeprint');
    expect(p.rawClosed.open).toBe(true);
    expect([p.outer.open, p.inner.open, p.initiallyOpen.open]).toEqual([true, true, true]);
    p.fire('beforeprint');
    p.fire('afterprint');
    expect(p.rawClosed.open).toBe(false);
    expect([p.outer.open, p.inner.open, p.initiallyOpen.open]).toEqual([false, false, true]);
    p.fire('afterprint');
    expect(p.initiallyOpen.open).toBe(true);
    p.fire('beforeprint');
    expect(p.inner.open).toBe(true);
  });
});
