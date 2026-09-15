import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { COPY_SCRIPT } from './copy-script.js';

function setup(writeText?: (text: string) => Promise<void>) {
  let click: (() => Promise<void>) | undefined;
  let reset: (() => void) | undefined;
  const button = {
    hidden: true,
    disabled: false,
    textContent: 'Copy',
    addEventListener: (_: string, fn: () => Promise<void>) => {
      click = fn;
    },
  };
  const toolbar = { hidden: true };
  const status = { textContent: '', classList: { add: vi.fn() } };
  const code = { textContent: '<script>literal</script>\n\n' };
  const elements: Record<string, unknown> = {
    '.code-copy': button,
    '.code-toolbar': toolbar,
    '.code-copy-status': status,
    'pre > code': code,
  };
  new Script(COPY_SCRIPT).runInNewContext({
    document: {
      querySelector: () => ({
        querySelectorAll: () => [{ querySelector: (name: string) => elements[name] }],
      }),
    },
    navigator: { clipboard: writeText ? { writeText } : undefined },
    clearTimeout: vi.fn(),
    setTimeout: (fn: () => void) => {
      reset = fn;
      return 1;
    },
  });
  return { button, toolbar, status, code, click: () => click?.(), reset: () => reset?.() };
}
describe('fixed copy enhancement', () => {
  it('writes only on activation, preserving exact code text and restoring feedback', async () => {
    const write = vi.fn(async () => {});
    const ui = setup(write);
    expect(write).not.toHaveBeenCalled();
    expect(ui.button.hidden).toBe(false);
    expect(ui.toolbar.hidden).toBe(false);
    await ui.click();
    expect(write).toHaveBeenCalledExactlyOnceWith(ui.code.textContent);
    expect(ui.button.textContent).toBe('Copied');
    expect(ui.status.textContent).toBe('Code copied to clipboard.');
    ui.reset();
    expect(ui.button.textContent).toBe('Copy');
  });
  it('keeps the button hidden and explains manual copying without Clipboard API', () => {
    const ui = setup();
    expect(ui.button.hidden).toBe(true);
    expect(ui.toolbar.hidden).toBe(false);
    expect(ui.status.textContent).toContain('Clipboard unavailable');
    expect(ui.status.classList.add).toHaveBeenCalledWith('is-unavailable');
  });
  it('announces rejection and preserves manual copying', async () => {
    const ui = setup(async () => {
      throw new Error('Permission denied');
    });
    await ui.click();
    expect(ui.button.textContent).toBe('Copy failed');
    expect(ui.status.textContent).toContain('Select the code');
    expect(ui.button.disabled).toBe(false);
    expect(ui.code.textContent).toBe('<script>literal</script>\n\n');
  });
  it('prevents overlapping clipboard writes', async () => {
    let finish!: () => void;
    const write = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const ui = setup(write);
    const pending = ui.click();
    await ui.click();
    expect(write).toHaveBeenCalledTimes(1);
    expect(ui.button.disabled).toBe(true);
    finish();
    await pending;
    expect(ui.button.disabled).toBe(false);
  });
});
