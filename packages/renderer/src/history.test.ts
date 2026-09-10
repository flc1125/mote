import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { HISTORY_SCRIPT } from './history-script.js';

const ID = '7Vk3mQ9x2NFaP4Ls';
const OTHER = 'Q9vLm2NkR7xB4PaS';
const KEY = 'mote:recent:v1';
type Entry = { id: string; title: string };

class Element {
  children: Element[] = [];
  events = new Map<string, (event: Record<string, unknown>) => void>();
  attributes = new Map<string, string>();
  open = false;
  hidden = false;
  disabled = true;
  textContent = '';
  href = '';
  focus = vi.fn();
  addEventListener(name: string, callback: (event: Record<string, unknown>) => void) {
    this.events.set(name, callback);
  }
  removeEventListener(name: string) {
    this.events.delete(name);
  }
  fire(name: string, event: Record<string, unknown> = {}) {
    this.events.get(name)?.(event);
  }
  append(child: Element) {
    this.children.push(child);
  }
  replaceChildren() {
    this.children = [];
  }
  contains(target: Element): boolean {
    return target === this || this.children.some((child) => child.contains(target));
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

function harness(
  options: {
    data?: string;
    path?: string;
    title?: string;
    hidden?: boolean;
    blocked?: boolean;
    quota?: boolean;
    noMenu?: boolean;
  } = {},
) {
  const store = new Map<string, string>();
  if (options.data !== undefined) store.set(KEY, options.data);
  const trigger = new Element(),
    list = new Element(),
    status = new Element(),
    clear = new Element();
  const elements = new Map([
    ['summary', trigger],
    ['ul', list],
    ['[role="status"]', status],
    ['button', clear],
  ]);
  const menu = Object.assign(new Element(), {
    querySelector: (selector: string) => elements.get(selector),
  });
  menu.children.push(...elements.values());
  const document = Object.assign(new Element(), {
    visibilityState: options.hidden ? 'hidden' : 'visible',
    title: options.title ?? 'Current document',
    querySelector: () => (options.noMenu ? null : menu),
    createElement: () => new Element(),
  });
  const window = new Element();
  const fetch = vi.fn();
  new Script(HISTORY_SCRIPT).runInNewContext({
    document,
    window,
    location: { pathname: options.path ?? '/' + ID },
    fetch,
    localStorage: {
      getItem: (key: string) => {
        if (options.blocked) throw new Error('blocked');
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (options.quota) throw new Error('full');
        store.set(key, value);
      },
      removeItem: (key: string) => {
        if (options.blocked) throw new Error('blocked');
        store.delete(key);
      },
    },
  });
  return {
    store,
    menu,
    list,
    trigger,
    status,
    clear,
    document,
    window,
    fetch,
    entries: () => JSON.parse(store.get(KEY) ?? '[]') as Entry[],
    open: () => {
      menu.open = true;
      menu.fire('toggle');
    },
  };
}

describe('document history', () => {
  it('records only the document ID and title, and moves repeated visits to the front', () => {
    const page = harness({
      data: JSON.stringify([
        { id: OTHER, title: 'Other' },
        { id: ID, title: 'Old title' },
      ]),
      path: '//' + ID + '/',
      title: 'Updated title',
    });
    expect(page.entries()).toEqual([
      { id: ID, title: 'Updated title' },
      { id: OTHER, title: 'Other' },
    ]);
    expect(page.fetch).not.toHaveBeenCalled();
  });

  it('keeps at most 20 distinct documents and truncates long titles', () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({
      id: 'A'.repeat(15) + '123456789ABCDEFGHJKLMNPQRS'[i],
      title: 'Older ' + i,
    }));
    const page = harness({ data: JSON.stringify(entries), title: 'x'.repeat(400) });
    expect(page.entries()).toHaveLength(20);
    expect(page.entries()[0]?.title).toHaveLength(300);
    expect(page.entries()[19]).toEqual(entries[18]);
  });

  it.each(['/', '/health', '/history', '/invalid', '/' + ID + '/a/Aq8K3pLm92Xq'])(
    'does not record non-document path %s',
    (path) => {
      expect(harness({ path }).entries()).toEqual([]);
    },
  );

  it('does nothing on pages without the document history control', () => {
    expect(harness({ noMenu: true }).store.size).toBe(0);
  });

  it('records a background tab only on first view, and BFCache returns as new visits', () => {
    const page = harness({ hidden: true });
    expect(page.store.size).toBe(0);
    page.document.visibilityState = 'visible';
    page.document.fire('visibilitychange');
    expect(page.entries()).toHaveLength(1);
    page.store.clear();
    page.document.fire('visibilitychange');
    expect(page.entries()).toHaveLength(0);
    page.window.fire('pageshow', { persisted: true });
    expect(page.entries()).toHaveLength(1);
  });

  it('renders stored titles as text, rejects unsafe IDs and deduplicates corrupt entries', () => {
    const title = '<img src=x onerror=attack()> & "';
    const page = harness({
      hidden: true,
      data: JSON.stringify([
        { id: OTHER, title },
        { id: OTHER, title: 'Duplicate' },
        { id: '//evil.example', title: 'Bad' },
        { id: ID, title: 123 },
      ]),
    });
    page.open();
    expect(page.list.children).toHaveLength(1);
    expect(page.list.children[0]?.children[0]?.textContent).toBe(title);
    expect(page.list.children[0]?.children[0]?.href).toBe('/' + OTHER);
    expect(page.fetch).not.toHaveBeenCalled();
  });

  it('marks the current document and clears only history without recreating it on reopening', () => {
    const page = harness();
    page.store.set('mote:toc:desktop', 'closed');
    page.open();
    expect(page.list.children[0]?.children[0]?.attributes.get('aria-current')).toBe('page');
    page.clear.fire('click');
    expect(page.entries()).toEqual([]);
    expect(page.store.get('mote:toc:desktop')).toBe('closed');
    expect(page.trigger.focus).toHaveBeenCalled();
    page.open();
    expect(page.status.textContent).toBe('No recent documents.');
    expect(page.clear.disabled).toBe(true);
  });

  it('closes with outside click, focus leaving or Escape, without trapping keyboard focus', () => {
    const page = harness();
    page.open();
    page.document.fire('click', { target: page.list });
    expect(page.menu.open).toBe(true);
    page.document.fire('click', { target: new Element() });
    expect(page.menu.open).toBe(false);
    page.open();
    page.document.fire('focusin', { target: new Element() });
    expect(page.menu.open).toBe(false);
    page.open();
    const preventDefault = vi.fn();
    page.document.fire('keydown', { key: 'Escape', preventDefault });
    expect(page.menu.open).toBe(false);
    expect(preventDefault).toHaveBeenCalled();
    expect(page.trigger.focus).toHaveBeenCalled();
  });

  it('refreshes an open list after another tab clears storage', () => {
    const page = harness();
    page.open();
    page.store.clear();
    page.window.fire('storage', { key: KEY });
    expect(page.list.children).toHaveLength(0);
    expect(page.store.size).toBe(0);
  });

  it('recovers malformed history and contains denied or full storage', () => {
    expect(harness({ data: 'broken' }).entries()).toHaveLength(1);
    const page = harness({ blocked: true });
    expect(() => page.open()).not.toThrow();
    expect(page.status.textContent).toContain('unavailable');
    expect(page.clear.disabled).toBe(true);
    expect(() => harness({ quota: true })).not.toThrow();
  });
});
