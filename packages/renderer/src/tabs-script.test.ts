import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { TOC_SCRIPT } from './toc-script.js';

/** Minimal DOM surface; execute the actual fixed script, including hash handlers. */
function page(hash = '', failure = '') {
  let active: Element | null = null;
  const events = new Map<string, () => void>();
  const setActive = (element: Element) => {
    active = element;
  };
  class Element {
    children: Element[] = [];
    parentElement: Element | null = null;
    attrs = new Map<string, string>();
    handlers = new Map<string, (e: Record<string, unknown>) => void>();
    hidden = false;
    tabIndex = -1;
    open = false;
    id = '';
    textContent = '';
    className = '';
    type = '';
    constructor(public tagName = 'DIV') {}
    get firstElementChild() {
      return this.children[0];
    }
    append(el: Element) {
      el.parentElement = this;
      this.children.push(el);
    }
    prepend(el: Element) {
      el.parentElement = this;
      this.children.unshift(el);
    }
    remove() {
      if (this.parentElement)
        this.parentElement.children = this.parentElement.children.filter((e) => e !== this);
    }
    setAttribute(k: string, v: string) {
      if (failure === 'commit' && k === 'data-tabs-enhanced') throw new Error('init failure');
      this.attrs.set(k, v);
    }
    getAttribute(k: string) {
      return this.attrs.get(k) ?? null;
    }
    removeAttribute(k: string) {
      this.attrs.delete(k);
      if (k === 'tabindex') this.tabIndex = -1;
    }
    matches(selector: string) {
      return selector.startsWith('section')
        ? this.tagName === 'SECTION'
        : this.className === 'content-panel-title';
    }
    contains(el: Element | null): boolean {
      return el === this || this.children.some((c) => c.contains(el));
    }
    addEventListener(k: string, f: (e: Record<string, unknown>) => void) {
      this.handlers.set(k, f);
    }
    focus() {
      setActive(this);
    }
    scrollIntoView = vi.fn();
    querySelectorAll(selector: string): Element[] {
      const all = this.children.flatMap((c) => [c, ...c.querySelectorAll('*')]);
      return all.filter(
        (e) =>
          selector === '*' ||
          (selector === '.content-tabs'
            ? e.className === 'content-tabs'
            : e.tagName === 'DETAILS' && !e.open),
      );
    }
  }
  const article = new Element('ARTICLE');
  const groups = [new Element(), new Element()];
  const panels: Element[][] = [];
  for (let g = 0; g < 2; g++) {
    const group = groups[g]!;
    group.className = 'content-tabs';
    article.append(group);
    panels[g] = [];
    for (let i = 0; i < 2; i++) {
      const panel = new Element('SECTION');
      panel.id = `mote-tab-${g * 2 + i + 1}`;
      const title = new Element('P');
      title.className = 'content-panel-title';
      title.textContent = 'Label';
      const link = new Element('A');
      link.setAttribute('href', '#' + panel.id);
      title.append(link);
      panel.append(title);
      group.append(panel);
      panels[g]!.push(panel);
    }
  }
  const detail = new Element('DETAILS');
  detail.id = 'folded';
  const heading = new Element('H2');
  heading.id = 'heading';
  detail.append(heading);
  panels[0]![1]!.append(detail);
  const location = new URL('https://example.com/doc' + hash);
  const push = vi.fn((_state, _title, hash: string) => {
    location.hash = hash;
  });
  new Script(TOC_SCRIPT).runInNewContext({
    document: {
      get activeElement() {
        return active;
      },
      getElementById: (id: string) => article.querySelectorAll('*').find((e) => e.id === id),
      querySelector: (s: string) => (s === 'article' ? article : null),
      createElement: (tag: string) => {
        if (failure === 'create') throw new Error('no controls');
        return new Element(tag.toUpperCase());
      },
    },
    location,
    URL,
    history: { pushState: push },
    window: { addEventListener: (k: string, f: () => void) => events.set(k, f) },
  });
  const buttons = (g = 0) => groups[g]!.children[0]!.children;
  const fire = (g: number, i: number, key?: string, extra = {}) => {
    const event = { key, preventDefault: vi.fn(), ...extra };
    buttons(g)[i]!.handlers.get(key ? 'keydown' : 'click')!(event);
    return event;
  };
  return {
    groups,
    panels,
    buttons,
    fire,
    events,
    location,
    push,
    heading,
    detail,
    active: () => active,
  };
}

describe('progressive tabs and unified navigation', () => {
  it('initializes one roving focus per group without changing the URL', () => {
    const p = page();
    expect(p.push).not.toHaveBeenCalled();
    expect(p.buttons().map((b) => b.tabIndex)).toEqual([0, -1]);
    expect(p.panels[0]!.map((b) => b.hidden)).toEqual([false, true]);
    expect(p.panels[0]![0]!.getAttribute('aria-labelledby')).toBe('mote-tab-1-control');
  });
  it('switches independently with click, arrows, Home/End and wraps', () => {
    const p = page();
    p.fire(0, 0, 'ArrowLeft');
    expect(p.location.hash).toBe('#mote-tab-2');
    expect(p.active()).toBe(p.buttons()[1]);
    expect(p.panels[1]!.map((b) => b.hidden)).toEqual([false, true]);
    p.fire(0, 1, 'ArrowRight');
    expect(p.location.hash).toBe('#mote-tab-1');
    p.fire(0, 0, 'End');
    expect(p.location.hash).toBe('#mote-tab-2');
    p.fire(0, 1, 'Home');
    expect(p.location.hash).toBe('#mote-tab-1');
    p.fire(1, 1);
    expect(p.location.hash).toBe('#mote-tab-4');
    for (const key of ['Tab', 'ArrowUp', 'x'])
      expect(p.fire(1, 1, key).preventDefault).not.toHaveBeenCalled();
    expect(p.fire(1, 1, 'Home', { ctrlKey: true }).preventDefault).not.toHaveBeenCalled();
  });
  it('opens hidden panels and disclosures for initial headings without rewriting their hash', () => {
    const p = page('#heading');
    expect(p.panels[0]!.map((b) => b.hidden)).toEqual([true, false]);
    expect(p.detail.open).toBe(true);
    expect(p.heading.scrollIntoView).toHaveBeenCalled();
    expect(p.location.hash).toBe('#heading');
    expect(p.push).not.toHaveBeenCalled();
    p.location.hash = '#mote-tab-1';
    p.events.get('hashchange')!();
    expect(p.panels[0]!.map((b) => b.hidden)).toEqual([false, true]);
    p.location.hash = '#heading';
    p.events.get('pageshow')!();
    expect(p.panels[0]![1]!.hidden).toBe(false);
    p.location.hash = '';
    p.events.get('hashchange')!();
    expect(p.panels[0]![0]!.hidden).toBe(false);
  });
  it.each(['create', 'commit'])(
    'leaves every body visible and removes partial semantics on %s failure',
    (failure) => {
      const p = page('', failure);
      for (const panels of p.panels)
        for (const panel of panels) {
          expect(panel.hidden).toBe(false);
          expect(panel.getAttribute('role')).toBe(null);
        }
      expect(
        p.groups.every((g) => !g.getAttribute('data-tabs-enhanced') && g.children.length === 2),
      ).toBe(true);
    },
  );
});
