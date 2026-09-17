import { Script } from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

import { PAGE_SCRIPT } from './page-script.js';

/** Minimal DOM stubs for the page-tools script. */
function harness({ clipboard = true } = {}) {
  const written: string[] = [];
  const copyButton = {
    hidden: true,
    listeners: new Map<string, () => void>(),
    classList: { add: vi.fn(), remove: vi.fn() },
    addEventListener(type: string, handler: () => void) {
      this.listeners.set(type, handler);
    },
  };
  const toTop = {
    hidden: true,
    listeners: new Map<string, () => void>(),
    addEventListener(type: string, handler: () => void) {
      this.listeners.set(type, handler);
    },
  };
  const windowStub = {
    scrollY: 0,
    innerHeight: 800,
    listeners: new Map<string, () => void>(),
    addEventListener(type: string, handler: () => void) {
      this.listeners.set(type, handler);
    },
    scrollTo: vi.fn(),
  };
  new Script(PAGE_SCRIPT).runInNewContext({
    document: {
      querySelector: (selector: string) =>
        selector === '.page-copy' ? copyButton : selector === '.to-top' ? toTop : null,
    },
    location: new URL('https://mote.pub/7Vk3mQ9x2NFaP4Ls#frag?x=1'),
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
    window: windowStub,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (fn: () => void) => {
      fn();
      return 1;
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  return { copyButton, toTop, written, windowStub };
}

describe('page tools script', () => {
  it('is valid standalone JavaScript and safely does nothing without the controls', () => {
    expect(() =>
      new Script(PAGE_SCRIPT).runInNewContext({
        document: { querySelector: () => null },
        location: new URL('https://mote.pub/x'),
      }),
    ).not.toThrow();
  });

  it('copies the canonical page URL without hash or query', async () => {
    const { copyButton, written } = harness();
    expect(copyButton.hidden).toBe(false);
    copyButton.listeners.get('click')!();
    await Promise.resolve();
    expect(written).toEqual(['https://mote.pub/7Vk3mQ9x2NFaP4Ls']);
    expect(copyButton.classList.add).toHaveBeenCalledWith('is-copied');
  });

  it('keeps the copy button hidden without clipboard access', () => {
    const { copyButton } = harness({ clipboard: false });
    expect(copyButton.hidden).toBe(true);
  });

  it('reveals back-to-top past two viewports and scrolls up on click', () => {
    const { toTop, windowStub } = harness();
    expect(toTop.hidden).toBe(true);
    windowStub.scrollY = 2000;
    windowStub.listeners.get('scroll')!();
    expect(toTop.hidden).toBe(false);
    toTop.listeners.get('click')!();
    expect(windowStub.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps without smooth scrolling under reduced motion', () => {
    const reduce = new Script(PAGE_SCRIPT);
    const toTop = {
      hidden: true,
      listeners: new Map<string, () => void>(),
      addEventListener(type: string, handler: () => void) {
        this.listeners.set(type, handler);
      },
    };
    const scrollTo = vi.fn();
    reduce.runInNewContext({
      document: {
        querySelector: (selector: string) => (selector === '.to-top' ? toTop : null),
      },
      location: new URL('https://mote.pub/x'),
      window: {
        scrollY: 0,
        innerHeight: 800,
        addEventListener: () => {},
        scrollTo,
      },
      matchMedia: () => ({ matches: true }),
      requestAnimationFrame: (fn: () => void) => {
        fn();
        return 1;
      },
    });
    toTop.listeners.get('click')!();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
