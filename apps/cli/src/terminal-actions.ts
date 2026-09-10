import { spawn } from 'node:child_process';

/** Desktop helpers are optional conveniences, never a prerequisite for login. */
export function desktopCommand(
  command: string,
  args: string[],
  input?: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'], shell: false });
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      resolve(ok);
    };
    const cancel = () => {
      child.kill();
      finish(false);
    };
    const timer = setTimeout(cancel, 5000);
    timer.unref();
    signal?.addEventListener('abort', cancel, { once: true });
    child.once('error', () => finish(false));
    child.once('exit', (code) => finish(code === 0));
    child.stdin.on('error', cancel);
    child.stdin.end(input);
    if (signal?.aborted) cancel();
  });
}

export function openBrowser(url: string, signal?: AbortSignal): Promise<boolean> {
  if (process.platform === 'darwin') return desktopCommand('open', [url], undefined, signal);
  if (process.platform === 'win32')
    return desktopCommand('rundll32.exe', ['url.dll,FileProtocolHandler', url], undefined, signal);
  return desktopCommand('xdg-open', [url], undefined, signal);
}

export async function copyLink(url: string, signal?: AbortSignal): Promise<boolean> {
  if (process.platform === 'darwin') return desktopCommand('pbcopy', [], url, signal);
  if (process.platform === 'win32') return desktopCommand('clip.exe', [], url, signal);
  for (const [command, args] of [
    ['wl-copy', []],
    ['xclip', ['-selection', 'clipboard']],
    ['xsel', ['--clipboard', '--input']],
  ] as const) {
    if (signal?.aborted) return false;
    if (await desktopCommand(command, [...args], url, signal)) return true;
  }
  return false;
}
