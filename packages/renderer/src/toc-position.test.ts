import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

import { TOC_SCRIPT } from './toc-script.js';

interface PositionHarness {
  current(): string | null;
  click(id: string, landing: number): void;
  scroll(y: number): void;
  nativeScroll(y: number): void;
  hash(id: string, landing: number): void;
  reflow(): void;
  bottom(): string | null;
  resize(height: number, desktop?: boolean): void;
  visible(): boolean;
  toggle(): void;
  dismiss(): void;
  scrollPosition(): number;
}

/** Minimal layout/event boundary; runs the actual shipped script, not a copy of its selector. */
function harness(
  options: {
    hash?: string;
    scroll?: number;
    tops?: number[];
    footerTop?: number;
    desktop?: boolean;
    storage?: Record<string, string>;
    blockedStorage?: boolean;
  } = {},
): PositionHarness {
  const context = {
    initialHash: options.hash ?? '',
    initialScroll: options.scroll ?? 0,
    tops: options.tops ?? [100, 600, 900],
    footerTop: options.footerTop ?? 1200,
    initialDesktop: options.desktop ?? true,
    stored: options.storage ?? {},
    blockedStorage: options.blockedStorage ?? false,
  };
  return runInNewContext(
    String.raw`
    const callbacks = new Map();
    let queued = [], nextFrame = 0;
    function element() {
      const attributes = new Map(), handlers = new Map(), styles = new Map();
      return {
        attributes, handlers, parentElement: null,
        setAttribute: (name, value) => attributes.set(name, value),
        getAttribute: name => attributes.get(name) ?? null,
        removeAttribute: name => attributes.delete(name),
        toggleAttribute: (name, on) => on ? attributes.set(name, '') : attributes.delete(name),
        addEventListener: (type, fn) => handlers.set(type, fn),
        getBoundingClientRect: () => ({ top: 0, bottom: 600, height: 64 }),
        getClientRects: () => [1],
        closest: () => null,
        focus: () => {},
        style: {
          setProperty: (name, value) => styles.set(name, value),
          getPropertyValue: name => styles.get(name) ?? null,
          removeProperty: name => styles.delete(name)
        }
      };
    }
    const window = {
      scrollY: initialScroll, innerHeight: 800,
      addEventListener: (name, fn) => callbacks.set(name, fn),
      scrollTo: (_x, y) => { window.scrollY = y; }
    };
    const location = { hash: initialHash, pathname: '/doc', search: '' };
    const history = { replaceState() {} };
    const localStorage = {
      getItem(key) { if (blockedStorage) throw new Error('Storage unavailable'); return stored[key] ?? null; },
      setItem(key, value) { if (blockedStorage) throw new Error('Storage unavailable'); stored[key] = value; }
    };
    const body = element(), trigger = element(), close = element(), scrim = element();
    const article = element(), panel = element(), nav = element(), banner = element();
    const footer = element();
    footer.getBoundingClientRect = () => ({ top: footerTop - window.scrollY });
    const links = [], headings = [], items = [];
    for (let i = 0; i < tops.length; i++) {
      const id = ['a', 'b', 'c'][i];
      const item = element(), link = element(), heading = element();
      item.parentElement = element();
      link.setAttribute('href', '#' + id);
      link.closest = selector => selector === 'li' ? item : null;
      heading.id = id;
      heading.parentElement = article;
      heading.getBoundingClientRect = () => ({ top: tops[i] - window.scrollY });
      heading.scrollIntoView = () => { window.scrollY = Math.max(0, tops[i] - 76); };
      links.push(link); headings.push(heading); items.push(item);
    }
    article.contains = target => headings.includes(target);
    nav.contains = () => true;
    nav.querySelectorAll = selector => selector === 'a[href^="#"]' ? links :
      selector === '[data-current-branch]' ? items.filter(item => item.attributes.has('data-current-branch')) : [];
    panel.contains = () => false;
    panel.querySelector = selector => selector === '.toc-nav' ? nav : close;
    const document = {
      body, activeElement: body, documentElement: { scrollHeight: 1200 },
      getElementById: id => id === 'mote-toc' ? panel : headings.find(heading => heading.id === id),
      querySelector: selector => ({ '.toc-trigger': trigger, 'article': article, '.toc-scrim': scrim, '.mote-banner': banner, '.mote-colophon': footer })[selector],
      querySelectorAll: () => [], addEventListener() {}
    };
    const media = { matches: initialDesktop, addEventListener: (_name, fn) => callbacks.set('mediachange', fn) };
    const matchMedia = () => media;
    const requestAnimationFrame = fn => { queued.push(fn); return ++nextFrame; };
    const getComputedStyle = () => ({ scrollMarginTop: '76px' });
    function flush() { while (queued.length) { const batch = queued; queued = []; for (const fn of batch) fn(); } }
    ` +
      TOC_SCRIPT +
      String.raw`
    flush();
    ({
      current: () => links.find(link => link.attributes.has('aria-current'))?.getAttribute('href') ?? null,
      click(id, landing) {
        const link = links.find(link => link.getAttribute('href') === '#' + id);
        link.handlers.get('click')({ button: 0 });
        window.scrollY = landing;
        callbacks.get('scroll')();
        if (location.hash !== '#' + id) { location.hash = '#' + id; callbacks.get('hashchange')(); }
        flush();
      },
      scroll(y) { callbacks.get('wheel')({ target: article }); window.scrollY = y; callbacks.get('scroll')(); flush(); },
      nativeScroll(y) { window.scrollY = y; callbacks.get('scroll')(); flush(); },
      hash(id, landing) { location.hash = '#' + id; window.scrollY = landing; callbacks.get('hashchange')(); flush(); },
      reflow() { callbacks.get('resize')(); flush(); },
      bottom: () => panel.style.getPropertyValue('--toc-bottom'),
      resize(height, desktop = true) {
        window.innerHeight = height;
        const changed = media.matches !== desktop;
        media.matches = desktop;
        if (changed) callbacks.get('mediachange')();
        callbacks.get('resize')(); flush();
      },
      visible: () => trigger.getAttribute('aria-expanded') === 'true',
      scrollPosition: () => window.scrollY,
      toggle() { trigger.handlers.get('click')({ button: 0, preventDefault() {} }); flush(); },
      dismiss() { close.handlers.get('click')({ preventDefault() {} }); flush(); }
    });`,
    context,
  ) as PositionHarness;
}

describe('TOC anchor selection', () => {
  it('keeps the clicked heading when native scrolling is clamped at the page bottom', () => {
    const page = harness();
    page.click('b', 400);
    expect(page.current()).toBe('#b');
    page.reflow();
    expect(page.current()).toBe('#b');
    // Two distinct anchors can have exactly the same physical scroll offset.
    page.click('c', 400);
    expect(page.current()).toBe('#c');
    page.click('b', 400);
    expect(page.current()).toBe('#b');
  });

  it('resumes geometry tracking after scrolling and supports repeated clicks on the same hash', () => {
    const page = harness();
    page.click('b', 400);
    page.scroll(200);
    expect(page.current()).toBe('#a');
    page.click('b', 400);
    expect(page.current()).toBe('#b');
  });

  it('preserves deep-link selection when the browser performs its fragment jump after first paint', () => {
    const page = harness({ hash: '#b' });
    page.nativeScroll(400);
    expect(page.current()).toBe('#b');
    page.reflow();
    expect(page.current()).toBe('#b');
    page.scroll(200);
    expect(page.current()).toBe('#a');
  });

  it('honors initial deep links and back/forward hash navigation', () => {
    const page = harness({ hash: '#b', scroll: 400 });
    expect(page.current()).toBe('#b');
    page.hash('c', 400);
    expect(page.current()).toBe('#c');
    page.hash('b', 400);
    expect(page.current()).toBe('#b');
  });

  it('does not force the last heading merely because the page reached its bottom', () => {
    const page = harness({ scroll: 400 });
    expect(page.current()).toBe('#a');
  });

  it('uses the same reading offset as native heading anchors, with subpixel tolerance', () => {
    const page = harness({ tops: [100, 478, 900], scroll: 400 });
    expect(page.current()).toBe('#b');
  });

  it('can select different headings in a short document that cannot scroll', () => {
    const page = harness({ tops: [100, 200, 300] });
    page.click('b', 0);
    expect(page.current()).toBe('#b');
    page.click('c', 0);
    expect(page.current()).toBe('#c');
  });
});

describe('TOC footer clearance', () => {
  it('stays above the footer and restores its normal inset when scrolling back up', () => {
    const page = harness({ footerTop: 1200 });
    expect(page.bottom()).toBe('32px');
    page.scroll(480);
    expect(page.bottom()).toBe('96px');
    page.scroll(0);
    expect(page.bottom()).toBe('32px');
  });

  it('reserves footer space even while an explicit anchor remains selected', () => {
    const page = harness({ hash: '#c', scroll: 480, footerTop: 1200 });
    expect(page.current()).toBe('#c');
    expect(page.bottom()).toBe('96px');
    page.resize(900);
    expect(page.bottom()).toBe('196px');
    expect(page.current()).toBe('#c');
  });

  it('clears the desktop inset on mobile and restores it on desktop', () => {
    const page = harness({ scroll: 480, footerTop: 1200 });
    page.resize(844, false);
    expect(page.bottom()).toBeNull();
    page.resize(800);
    expect(page.bottom()).toBe('96px');
  });
});

describe('TOC visibility preference', () => {
  it('restores both closed and open desktop preferences after a reload', () => {
    const storage = {};
    const first = harness({ storage });
    expect(first.visible()).toBe(true);
    first.dismiss();
    const second = harness({ storage });
    expect(second.visible()).toBe(false);
    second.toggle();
    expect(harness({ storage }).visible()).toBe(true);
  });

  it('remembers mobile visibility independently and saves automatic closing after navigation', () => {
    const storage = {};
    harness({ storage }).dismiss();
    const mobile = harness({ storage, desktop: false });
    expect(mobile.visible()).toBe(false);
    mobile.toggle();
    const reloaded = harness({ storage, desktop: false });
    expect(reloaded.visible()).toBe(true);
    expect(harness({ storage }).visible()).toBe(false);
    reloaded.click('b', 400);
    expect(harness({ storage, desktop: false }).visible()).toBe(false);
  });

  it('does not overwrite the saved preference merely when crossing a breakpoint', () => {
    const storage = {};
    const page = harness({ storage, desktop: false });
    page.toggle();
    page.resize(800, true);
    expect(harness({ storage, desktop: false }).visible()).toBe(true);
  });

  it('positions a deep link before locking the restored mobile dialog', () => {
    const page = harness({
      desktop: false,
      hash: '#b',
      storage: { 'mote:toc:mobile': 'open' },
    });
    expect(page.visible()).toBe(true);
    expect(page.current()).toBe('#b');
    page.dismiss();
    expect(page.scrollPosition()).toBe(524);
  });

  it('lets an explicit contents fragment reopen a previously closed directory', () => {
    const storage = { 'mote:toc:desktop': 'closed' };
    expect(harness({ storage, hash: '#mote-toc' }).visible()).toBe(true);
    expect(harness({ storage }).visible()).toBe(true);
  });

  it('falls back to the normal defaults for unavailable or invalid storage', () => {
    const page = harness({ blockedStorage: true });
    expect(page.visible()).toBe(true);
    page.toggle();
    expect(page.visible()).toBe(false);
    page.toggle();
    expect(page.visible()).toBe(true);
    expect(harness({ blockedStorage: true, desktop: false }).visible()).toBe(false);
    const storage = { 'mote:toc:desktop': 'invalid', 'mote:toc:mobile': 'invalid' };
    expect(harness({ storage }).visible()).toBe(true);
    expect(harness({ storage, desktop: false }).visible()).toBe(false);
  });
});
