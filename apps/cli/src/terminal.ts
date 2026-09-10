import { stripVTControlCharacters } from 'node:util';
import type { ReadStream } from 'node:tty';
import { copyLink, openBrowser } from './terminal-actions.js';

export type LoginInput = Pick<
  ReadStream,
  | 'isTTY'
  | 'isRaw'
  | 'setRawMode'
  | 'readableFlowing'
  | 'resume'
  | 'pause'
  | 'on'
  | 'removeListener'
>;

// Treat data from identity providers and errors as text, not terminal commands.
export function terminalText(text: string): string {
  // eslint-disable-next-line no-control-regex -- remove terminal control bytes from untrusted text
  return stripVTControlCharacters(text).replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');
}

export function terminalColorEnabled(
  tty: boolean | undefined,
  env: Record<string, string | undefined>,
): boolean {
  return Boolean(tty) && env.NO_COLOR === undefined && env.TERM !== 'dumb';
}

export function terminalTitle(
  text: string,
  tty: boolean | undefined,
  env: Record<string, string | undefined>,
): string {
  return terminalColorEnabled(tty, env) ? `\x1b[1;31m${text}\x1b[0m` : text;
}

export function terminalFields(fields: [string, string][]): string {
  const width = Math.max(...fields.map(([label]) => label.length));
  return fields
    .map(([label, value]) => `${label.padEnd(width)}  ${terminalText(value)}`)
    .join('\n');
}

export interface LoginInteractionOptions {
  input: LoginInput;
  enabled: boolean;
  color?: boolean;
  write: (text: string) => void;
  cancel: () => void;
  open?: typeof openBrowser;
  copy?: typeof copyLink;
}

/** Starts listening without blocking OAuth's callback wait. Stop is idempotent. */
export function loginInteraction(url: string, options: LoginInteractionOptions): () => void {
  const { input, write } = options;
  const displayUrl = options.color ? `\x1b[36m${url}\x1b[0m` : url;
  write(`\nOpen this link to authorize:\n${displayUrl}\n`);
  let active = true;
  let busy = false;
  let listening = false;
  const wasRaw = input.isRaw;
  const wasFlowing = input.readableFlowing === true;
  const actions = new AbortController();
  const stop = () => {
    if (!active) return;
    active = false;
    actions.abort();
    if (listening) {
      input.removeListener('data', onData);
      input.removeListener('end', onEnd);
      input.removeListener('error', onEnd);
      try {
        input.setRawMode(wasRaw);
      } catch {
        write('Could not restore terminal input mode. Run reset if input behaves unexpectedly.');
      } finally {
        if (!wasFlowing) input.pause();
      }
    }
  };
  const onEnd = () => {
    stop();
    options.cancel();
  };
  const act = async (key: string) => {
    busy = true;
    let ok = false;
    try {
      ok = await (key === 'o' ? (options.open ?? openBrowser) : (options.copy ?? copyLink))(
        url,
        actions.signal,
      );
    } catch {
      // A missing desktop helper must not interrupt authorization.
    } finally {
      busy = false;
    }
    if (!active) return;
    write(
      ok
        ? key === 'o'
          ? 'Browser opened. Waiting for authorization…'
          : 'Link copied. Waiting for authorization…'
        : `${key === 'o' ? 'Could not open the browser' : 'Could not copy the link'}. Use the full link above.\nWaiting for authorization…`,
    );
  };
  const onData = (data: Buffer | string) => {
    const key = data.toString();
    if (key.includes('\x03') || key === '\x04') return onEnd();
    // Ignore escape sequences and pasted text; only standalone action keys apply.
    if (!active || busy || !/^[oc]$/i.test(key)) return;
    void act(key.toLowerCase());
  };
  if (options.enabled && input.isTTY && typeof input.setRawMode === 'function') {
    try {
      input.setRawMode(true);
      listening = true;
      input.on('data', onData);
      input.on('end', onEnd);
      input.on('error', onEnd);
      input.resume();
      write('[o] Open browser   [c] Copy link   [Ctrl+C] Cancel\n');
    } catch {
      stop();
      write('Keyboard actions unavailable. Open the full link above manually.\n');
    }
  } else {
    write('Open the link manually. Press Ctrl+C to cancel.\n');
  }
  write('Waiting for authorization…');
  return stop;
}
