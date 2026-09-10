import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { loginInteraction, terminalFields, terminalText, terminalTitle } from '../src/terminal.js';
import type { LoginInput } from '../src/terminal.js';
import { desktopCommand } from '../src/terminal-actions.js';

class Input extends PassThrough {
  isTTY = true;
  isRaw = false;
  setRawMode(value: boolean) {
    this.isRaw = value;
    return this;
  }
}
const url =
  'https://auth.example.com/authorize?state=fake&redirect_uri=http%3A%2F%2F127.0.0.1%2Fcallback';
function setup(
  overrides: {
    enabled?: boolean;
    color?: boolean;
    open?: () => Promise<boolean>;
    copy?: () => Promise<boolean>;
  } = {},
) {
  const input = new Input();
  const output: string[] = [];
  const cancel = vi.fn();
  const open = vi.fn<(url: string, signal?: AbortSignal) => Promise<boolean>>(
    overrides.open ?? (async () => true),
  );
  const copy = vi.fn<(url: string, signal?: AbortSignal) => Promise<boolean>>(
    overrides.copy ?? (async () => true),
  );
  const start = () =>
    loginInteraction(url, {
      input: input as unknown as LoginInput,
      enabled: overrides.enabled ?? true,
      color: overrides.color,
      write: (text) => output.push(text),
      cancel,
      open,
      copy,
    });
  return { input, output, cancel, open, copy, start };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('login keyboard interaction', () => {
  it('colors the displayed link without changing the opened or copied URL', async () => {
    const s = setup({ color: true });
    const stop = s.start();
    try {
      expect(s.output.join('\n')).toContain(`\x1b[36m${url}\x1b[0m`);
      s.input.emit('data', 'o');
      await tick();
      s.input.emit('data', 'c');
      await tick();
      expect(s.open).toHaveBeenCalledWith(url, expect.any(AbortSignal));
      expect(s.copy).toHaveBeenCalledWith(url, expect.any(AbortSignal));
    } finally {
      stop();
    }
  });
  it('prints the complete URL, waits without opening, and responds to o and c', async () => {
    const s = setup();
    const stop = s.start();
    expect(s.output.join('\n').split('\n')).toContain(url);
    expect(s.open).not.toHaveBeenCalled();
    expect(s.copy).not.toHaveBeenCalled();
    s.input.emit('data', Buffer.from('o'));
    await tick();
    expect(s.open).toHaveBeenCalledWith(url, expect.any(AbortSignal));
    expect(s.output.join()).toContain('Browser opened');
    s.input.emit('data', 'c');
    await tick();
    expect(s.copy).toHaveBeenCalledWith(url, expect.any(AbortSignal));
    expect(s.output.join()).toContain('Link copied');
    stop();
    stop();
    expect(s.input.isRaw).toBe(false);
    expect(s.input.isPaused()).toBe(true);
    expect(s.input.listenerCount('data')).toBe(0);
    expect(s.input.listenerCount('end')).toBe(0);
    expect(s.input.listenerCount('error')).toBe(0);
  });
  it.each(['o', 'c'])('keeps waiting when %s fails and permits another action', async (key) => {
    const s = setup({
      open: async () => {
        throw new Error('unavailable');
      },
      copy: async () => false,
    });
    const stop = s.start();
    s.input.emit('data', key);
    await tick();
    expect(s.output.join()).toContain('Use the full link above');
    expect(s.cancel).not.toHaveBeenCalled();
    expect(s.input.isRaw).toBe(true);
    s.input.emit('data', key);
    await tick();
    expect(key === 'o' ? s.open : s.copy).toHaveBeenCalledTimes(2);
    stop();
  });
  it('ignores pasted strings, arrows, and repeated keys during an action; suppresses late feedback', async () => {
    let resolve!: (value: boolean) => void;
    const s = setup({
      open: () =>
        new Promise((ok) => {
          resolve = ok;
        }),
    });
    const stop = s.start();
    for (const text of ['copied text', '\x1b[C', 'oo']) s.input.emit('data', text);
    expect(s.open).not.toHaveBeenCalled();
    expect(s.copy).not.toHaveBeenCalled();
    s.input.emit('data', 'o');
    s.input.emit('data', 'o');
    s.input.emit('data', 'c');
    expect(s.open).toHaveBeenCalledOnce();
    expect(s.copy).not.toHaveBeenCalled();
    const signal = s.open.mock.calls[0]![1] as AbortSignal;
    stop();
    expect(signal.aborted).toBe(true);
    const before = [...s.output];
    resolve(true);
    await tick();
    expect(s.output).toEqual(before);
  });
  it.each(['\x03', '\x04'])('cancels and restores input on control input %j', (key) => {
    const s = setup();
    const stop = s.start();
    s.input.emit('data', key);
    expect(s.cancel).toHaveBeenCalledOnce();
    expect(s.input.isRaw).toBe(false);
    expect(s.input.listenerCount('data')).toBe(0);
    stop();
  });
  it.each(['end', 'error'])('cancels on stream %s', (event) => {
    const s = setup();
    s.start();
    s.input.emit(event, new Error('input closed'));
    expect(s.cancel).toHaveBeenCalledOnce();
    expect(s.input.isRaw).toBe(false);
  });
  it('preserves previously raw and flowing input and unrelated listeners', () => {
    const s = setup();
    s.input.setRawMode(true);
    s.input.resume();
    const other = vi.fn();
    s.input.on('data', other);
    const stop = s.start();
    stop();
    expect(s.input.isRaw).toBe(true);
    expect(s.input.readableFlowing).toBe(true);
    expect(s.input.listeners('data')).toEqual([other]);
    s.input.destroy();
  });
  it.each(['manual', 'pipe', 'raw-unavailable'])(
    'falls back to the full link for %s input',
    (mode) => {
      const s = setup({ enabled: mode !== 'manual' });
      if (mode === 'pipe') s.input.isTTY = false;
      if (mode === 'raw-unavailable')
        vi.spyOn(s.input, 'setRawMode').mockImplementation(() => {
          throw new Error('unsupported');
        });
      const stop = s.start();
      s.input.emit('data', 'o');
      expect(s.output.join()).toContain(url);
      expect(s.output.join()).not.toContain('[o]');
      expect(s.open).not.toHaveBeenCalled();
      expect(s.input.isRaw).toBe(false);
      stop();
    },
  );
});

describe('terminal text', () => {
  it('only colors TTY titles when color is allowed', () => {
    expect(terminalTitle('Mote', true, {})).toContain('\x1b[');
    for (const env of [{ NO_COLOR: '' }, { NO_COLOR: '1' }, { TERM: 'dumb' }])
      expect(terminalTitle('Mote', true, env)).toBe('Mote');
    expect(terminalTitle('Mote', false, {})).toBe('Mote');
  });
  it('keeps long values intact while neutralizing terminal escape sequences', () => {
    expect(terminalFields([['Instance', url]])).toContain(url);
    expect(terminalText('\x1b[31mexample\x1b[0m\n\x07')).toBe('example  ');
    expect(terminalText('\x1b]52;c;ZmFrZQ==\x07identity')).toBe('identity');
  });
});

describe('desktop command lifecycle', () => {
  it('passes clipboard content through stdin verbatim without a shell', async () => {
    const input = 'https://example.com/?q=$(echo bad)&name=中文';
    expect(
      await desktopCommand(
        process.execPath,
        [
          '-e',
          'let s="";process.stdin.setEncoding("utf8");process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>process.exit(s===process.argv[1]?0:1));',
          input,
        ],
        input,
      ),
    ).toBe(true);
  });
  it('reports missing executables and failed commands without throwing', async () => {
    expect(await desktopCommand('mote-nonexistent-command-for-test', [], url)).toBe(false);
    expect(await desktopCommand(process.execPath, ['-e', 'process.exit(1)'], url)).toBe(false);
  });
  it('cancels an in-flight helper and skips already-aborted requests', async () => {
    const abort = new AbortController();
    const result = desktopCommand(
      process.execPath,
      ['-e', 'setInterval(()=>{},1000)'],
      undefined,
      abort.signal,
    );
    abort.abort();
    expect(await result).toBe(false);
    expect(
      await desktopCommand(process.execPath, ['-e', 'process.exit(0)'], undefined, abort.signal),
    ).toBe(false);
  });
});
