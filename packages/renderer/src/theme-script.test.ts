import { Script } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { THEME_SCRIPT } from './theme-script.js';

/** Minimal DOM/localStorage stubs for the fixed theme script. */
function harness(saved: string | null = null) {
  const storage = new Map<string, string>();
  if (saved !== null) storage.set('mote-theme', saved);
  const root = { dataset: {} as Record<string, string> };
  const docListeners = new Map<string, (event: unknown) => void>();
  const documentStub: { activeElement: unknown } = { activeElement: null };

  const makeIcon = (name: string, hidden: boolean) => ({
    name,
    attrs: { hidden } as Record<string, boolean>,
    toggleAttribute(attr: string, force: boolean) {
      this.attrs[attr] = force;
    },
    classList: { contains: (cls: string) => cls === `theme-icon-${name}` || cls === 'theme-icon' },
  });
  const icons = [makeIcon('auto', false), makeIcon('light', true), makeIcon('dark', true)];

  const items = ['auto', 'light', 'dark'].map((value) => ({
    attrs: { 'data-theme-value': value, 'aria-checked': String(value === 'auto') } as Record<
      string,
      string
    >,
    setAttribute(name: string, val: string) {
      this.attrs[name] = val;
    },
    getAttribute(name: string) {
      return this.attrs[name] ?? null;
    },
    focus() {
      documentStub.activeElement = this;
    },
  }));

  const button = {
    hidden: true,
    attrs: { 'aria-expanded': 'false' } as Record<string, string>,
    listeners: new Map<string, () => void>(),
    setAttribute(name: string, value: string) {
      this.attrs[name] = value;
    },
    addEventListener(type: string, handler: () => void) {
      this.listeners.set(type, handler);
    },
    querySelectorAll: () => icons,
    focus() {
      documentStub.activeElement = this;
    },
  };

  const menu = {
    hidden: true,
    listeners: new Map<string, (event: never) => void>(),
    addEventListener(type: string, handler: never) {
      this.listeners.set(type, handler);
    },
    querySelectorAll: () => items,
    querySelector(selector: string) {
      return selector === '[aria-checked="true"]'
        ? (items.find((item) => item.attrs['aria-checked'] === 'true') ?? null)
        : null;
    },
  };

  const wrap = {
    contains: (target: unknown) => target === button || items.includes(target as never),
  };

  new Script(THEME_SCRIPT).runInNewContext({
    document: {
      documentElement: root,
      readyState: 'complete',
      get activeElement() {
        return documentStub.activeElement;
      },
      querySelector(selector: string) {
        if (selector === '.theme-menu') return wrap;
        if (selector === '.theme-toggle') return button;
        if (selector === '.theme-menu-list') return menu;
        return null;
      },
      addEventListener(type: string, handler: (event: unknown) => void) {
        docListeners.set(type, handler);
      },
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  });

  // activeElement lives on the shared stub; keep the document reference current.
  const context = {
    root,
    button,
    menu,
    items,
    icons,
    storage,
    clickButton: () => button.listeners.get('click')!(),
    clickItem: (value: string) =>
      menu.listeners.get('click')!({
        target: { closest: () => items.find((item) => item.attrs['data-theme-value'] === value) },
      } as never),
    key: (key: string) =>
      menu.listeners.get('keydown')!({ key, preventDefault: () => {} } as never),
    clickOutside: () => docListeners.get('click')!({ target: null }),
    setActive: (el: unknown) => {
      documentStub.activeElement = el;
    },
    activeElement: () => documentStub.activeElement,
  };
  return context;
}

describe('theme script', () => {
  it('is valid standalone JavaScript and safely does nothing without the menu', () => {
    expect(() =>
      new Script(THEME_SCRIPT).runInNewContext({
        document: {
          documentElement: { dataset: {} },
          readyState: 'complete',
          querySelector: () => null,
          addEventListener: () => {},
        },
        localStorage: { getItem: () => null },
      }),
    ).not.toThrow();
  });

  it('applies a saved explicit choice before paint', () => {
    expect(harness('dark').root.dataset.theme).toBe('dark');
    expect(harness('light').root.dataset.theme).toBe('light');
  });

  it('ignores absent, invalid or hostile stored values', () => {
    expect(harness(null).root.dataset.theme).toBeUndefined();
    expect(harness('blue').root.dataset.theme).toBeUndefined();
    expect(harness('dark";alert(1)//').root.dataset.theme).toBeUndefined();
  });

  it('survives localStorage access failures', () => {
    const root = { dataset: {} as Record<string, string> };
    expect(() =>
      new Script(THEME_SCRIPT).runInNewContext({
        document: {
          documentElement: root,
          readyState: 'complete',
          querySelector: () => null,
          addEventListener: () => {},
        },
        localStorage: {
          getItem() {
            throw new Error('denied');
          },
        },
      }),
    ).not.toThrow();
    expect(root.dataset.theme).toBeUndefined();
  });

  it('reveals the button with the saved state icon and checked item', () => {
    const { button, items, icons } = harness('dark');
    expect(button.hidden).toBe(false);
    expect(button.attrs['aria-label']).toBe('Theme: Dark');
    expect(icons.find((i) => i.name === 'dark')!.attrs.hidden).toBe(false);
    expect(icons.find((i) => i.name === 'auto')!.attrs.hidden).toBe(true);
    expect(items.find((i) => i.attrs['data-theme-value'] === 'dark')!.attrs['aria-checked']).toBe(
      'true',
    );
  });

  it('opens the menu on click, focusing the checked item', () => {
    const { button, menu, items, clickButton, setActive, activeElement } = harness('light');
    setActive(null);
    clickButton();
    expect(menu.hidden).toBe(false);
    expect(button.attrs['aria-expanded']).toBe('true');
    expect(activeElement()).toBe(items.find((i) => i.attrs['data-theme-value'] === 'light'));
  });

  it('selecting an item applies the state, persists it, closes and refocuses', () => {
    const { root, button, menu, items, storage, clickButton, clickItem, activeElement } =
      harness(null);
    clickButton();
    clickItem('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(storage.get('mote-theme')).toBe('dark');
    expect(menu.hidden).toBe(true);
    expect(button.attrs['aria-expanded']).toBe('false');
    expect(activeElement()).toBe(button);
    expect(items.find((i) => i.attrs['data-theme-value'] === 'dark')!.attrs['aria-checked']).toBe(
      'true',
    );
  });

  it('selecting auto removes the attribute and the stored value', () => {
    const { root, storage, clickButton, clickItem } = harness('light');
    clickButton();
    clickItem('auto');
    expect(root.dataset.theme).toBeUndefined();
    expect(storage.has('mote-theme')).toBe(false);
  });

  it('closes on Escape with focus restored, and on Tab without', () => {
    const { button, menu, clickButton, key, activeElement } = harness(null);
    clickButton();
    key('Escape');
    expect(menu.hidden).toBe(true);
    expect(activeElement()).toBe(button);

    clickButton();
    key('Tab');
    expect(menu.hidden).toBe(true);
    expect(activeElement()).not.toBe(button);
  });

  it('closes on outside click without touching focus', () => {
    const { menu, clickButton, clickOutside } = harness(null);
    clickButton();
    clickOutside();
    expect(menu.hidden).toBe(true);
  });

  it('arrow keys cycle focus through the items', () => {
    const { items, clickButton, key, setActive, activeElement } = harness(null);
    clickButton(); // focuses the checked item (auto, index 0)
    setActive(items[0]);
    key('ArrowDown');
    expect(activeElement()).toBe(items[1]);
    key('ArrowDown');
    key('ArrowDown');
    expect(activeElement()).toBe(items[0]); // wraps around
    key('ArrowUp');
    expect(activeElement()).toBe(items[2]);
  });
});
