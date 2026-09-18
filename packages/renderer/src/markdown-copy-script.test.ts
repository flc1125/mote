import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

import { encodeMarkdownSource } from './markdown-source.js';
import { PAGE_SCRIPT } from './page-script.js';

function harness(
  writeText?: (text: string) => Promise<void>,
  source = '\ufeff# 中文 📝\r\n\r\n![图](../a.png)\r\n',
) {
  function element() {
    return {
      hidden: true,
      disabled: false,
      open: false,
      value: '',
      textContent: '',
      listeners: new Map<string, () => void | Promise<void>>(),
      classList: { add: vi.fn(), remove: vi.fn() },
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      addEventListener(type: string, callback: () => void | Promise<void>) {
        this.listeners.set(type, callback);
      },
      showModal: vi.fn(function (this: { open: boolean }) {
        this.open = true;
      }),
      close: vi.fn(function (this: {
        open: boolean;
        listeners: Map<string, () => void | Promise<void>>;
      }) {
        this.open = false;
        this.listeners.get('close')?.();
      }),
    };
  }
  const button = element();
  const status = element();
  const dialog = element();
  const text = element();
  const close = element();
  const encoded = { value: encodeMarkdownSource(source) };
  const nodes = new Map<string, unknown>([
    ['.markdown-copy', button],
    ['.markdown-source', encoded],
    ['.markdown-copy-status', status],
    ['.markdown-source-dialog', dialog],
    ['.markdown-source-text', text],
    ['.markdown-source-close', close],
  ]);
  const timers: Array<() => void> = [];
  new Script(PAGE_SCRIPT).runInNewContext({
    document: { querySelector: (selector: string) => nodes.get(selector) ?? null },
    navigator: writeText ? { clipboard: { writeText } } : {},
    atob,
    TextDecoder,
    Uint8Array,
    setTimeout: (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout: vi.fn(),
  });
  return {
    button,
    status,
    dialog,
    text,
    close,
    encoded,
    timers,
    source,
    click: () => button.listeners.get('click')!(),
  };
}

describe('Markdown copying', () => {
  it('writes the exact source on the click, announces success and resets its feedback', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const ui = harness(write);
    expect(ui.button.hidden).toBe(false);
    const pending = ui.click();
    expect(write).toHaveBeenCalledWith(ui.source);
    expect(ui.button.setAttribute).toHaveBeenCalledWith('aria-disabled', 'true');
    expect(ui.button.disabled).toBe(false);
    await pending;
    expect(ui.button.disabled).toBe(false);
    expect(ui.button.setAttribute).toHaveBeenCalledWith('aria-disabled', 'false');
    expect(ui.status.textContent).toBe('Markdown copied');
    expect(ui.button.classList.add).toHaveBeenCalledWith('is-copied');
    expect(ui.dialog.showModal).not.toHaveBeenCalled();
    ui.timers[0]!();
    expect(ui.status.textContent).toBe('');
    expect(ui.button.setAttribute).toHaveBeenLastCalledWith('aria-label', 'Copy Markdown source');
  });

  it('prevents overlapping clipboard writes while a request is pending', async () => {
    let resolve!: () => void;
    const write = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const ui = harness(write);
    const pending = ui.click();
    await ui.click();
    expect(write).toHaveBeenCalledTimes(1);
    resolve();
    await pending;
    expect(ui.button.disabled).toBe(false);
  });

  it.each(['rejected', 'unavailable'] as const)(
    'offers selected source when copying is %s and restores focus on close',
    async (mode) => {
      const ui = harness(
        mode === 'rejected' ? vi.fn().mockRejectedValue(new Error('denied')) : undefined,
      );
      expect(ui.button.hidden).toBe(false);
      await ui.click();
      expect(ui.dialog.open).toBe(true);
      expect(ui.text.value).toBe(ui.source);
      expect(ui.text.focus).toHaveBeenCalled();
      expect(ui.text.select).toHaveBeenCalled();
      expect(ui.button.disabled).toBe(false);
      ui.close.listeners.get('click')!();
      expect(ui.dialog.open).toBe(false);
      expect(ui.text.value).toBe('');
      expect(ui.button.focus).toHaveBeenCalled();
      expect(ui.status.textContent).toBe('');
    },
  );

  it('does not copy corrupted source or leave the control disabled', async () => {
    const write = vi.fn();
    const ui = harness(write);
    ui.encoded.value = 'invalid base64!';
    await ui.click();
    expect(write).not.toHaveBeenCalled();
    expect(ui.status.textContent).toBe('Could not read Markdown source');
    expect(ui.button.disabled).toBe(false);
  });
});
