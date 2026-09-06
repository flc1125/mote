import { parseArgs } from 'node:util';

import packageJson from '../package.json' with { type: 'json' };

import { buildBundle } from './bundle.js';
import { publishBundle } from './client.js';
import { resolveConfig } from './config.js';
import { CliError } from './errors.js';
import { authStatus, defaultCredentialStore, prepareAuth } from './auth/manager.js';
import { login, openBrowser } from './auth/oauth.js';
import type { CredentialStore } from './auth/store.js';
import { apiOrigin } from './auth/urls.js';

export const CLI_VERSION = packageJson.version;

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface RunDeps {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  configPath?: string;
  store?: CredentialStore;
  interactive?: boolean;
  openBrowser?: (url: string) => Promise<boolean>;
  loginImpl?: typeof login;
}

const USAGE = `mote — Markdown in, URL out.

Usage:
  mote <markdown-file> [options]
  mote publish <markdown-file> [options]
  mote auth login [--no-browser] [--client-id <id>] [--credential-store keyring|file]
  mote auth status [--offline] [--json]
  mote auth logout [--json]

Options:
  --api <url>       Publish API URL      (env: MOTE_API_URL, default: https://mote.flc.io)
  --token <token>   Publish token        (env: MOTE_TOKEN)
  --auth-mode <mode> token | oauth | service (env: MOTE_AUTH_MODE)
  --no-browser      Login: print URL instead of opening browser (interactive only)
  --client-id <id>   Login: existing public OAuth client; otherwise register one
  --callback-port <port> Login: registered loopback port (default: temporary port)
  --credential-store <store> Login: keyring (default) or explicit private file
  --offline         Auth status: cached state only, not online verification
  Machine mode requires MOTE_SERVICE_API_URL, MOTE_SERVICE_CLIENT_ID,
  and MOTE_SERVICE_CLIENT_SECRET. Credentials are never sent across redirects.
  --json            Print only {"id","url"} as JSON (for agents/CI)
  --no-assets       Do not upload local images
  --verbose         Verbose progress on stderr
  -h, --help        Show this help
  -v, --version     Show version
`;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 'B';
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(1)} ${unit}`;
}

function extractMarkdownFile(positionals: string[]): string {
  const [first, second, ...rest] = positionals;
  if (first === 'publish') {
    if (second !== undefined && rest.length === 0) return second;
    throw new CliError('usage: mote publish <markdown-file>');
  }
  if (first !== undefined && second === undefined) return first;
  throw new CliError('usage: mote <markdown-file> (try --help)');
}

/**
 * Runs the CLI. Returns the exit code instead of calling process.exit so it
 * stays testable; the entry point maps it to process.exitCode.
 */
export async function run(argv: string[], io: CliIO, deps: RunDeps = {}): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        api: { type: 'string' },
        token: { type: 'string' },
        'auth-mode': { type: 'string' },
        'client-id': { type: 'string' },
        'callback-port': { type: 'string' },
        'credential-store': { type: 'string' },
        'no-browser': { type: 'boolean', default: false },
        offline: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        verbose: { type: 'boolean', default: false },
        'no-assets': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });

    if (values.help) {
      io.stdout(USAGE);
      return 0;
    }
    if (values.version) {
      io.stdout(CLI_VERSION);
      return 0;
    }

    const json = values.json;
    const verbose = values.verbose && !json;

    const config = await resolveConfig({
      api: values.api,
      token: values.token,
      authMode: values['auth-mode'],
      env: deps.env,
      configPath: deps.configPath,
    });
    const store = deps.store ?? defaultCredentialStore(deps.env, deps.configPath);
    if (positionals[0] === 'auth') {
      const command = positionals[1];
      if (positionals.length !== 2 || !['login', 'status', 'logout'].includes(command ?? ''))
        throw new CliError('usage: mote auth login|status|logout');
      if (command === 'login') {
        if (json || !(deps.interactive ?? process.stdin.isTTY))
          throw new CliError(
            'mote auth login requires an interactive terminal and does not support --json',
          );
        if (config.authMode && config.authMode !== 'oauth')
          throw new CliError('login requires OAuth mode; use --auth-mode oauth');
        const callbackPort =
          values['callback-port'] === undefined ? undefined : Number(values['callback-port']);
        if (
          callbackPort !== undefined &&
          (!/^\d+$/.test(values['callback-port']!) ||
            !Number.isInteger(callbackPort) ||
            callbackPort < 1 ||
            callbackPort > 65535)
        )
          throw new CliError('callback port must be an integer from 1 to 65535');
        const backend = values['credential-store'] ?? 'keyring';
        if (backend !== 'file' && backend !== 'keyring')
          throw new CliError('credential store must be keyring or file');
        if (backend === 'file')
          io.stderr(
            'Warning: explicitly using private plaintext credential storage, not a system credential store.',
          );
        const abort = new AbortController();
        const cancel = () => abort.abort();
        process.once('SIGINT', cancel);
        process.once('SIGTERM', cancel);
        try {
          await store.locked(apiOrigin(config.apiUrl, true), async () => {
            const credential = await (deps.loginImpl ?? login)(config.apiUrl, {
              fetchImpl: deps.fetchImpl,
              clientId: values['client-id'],
              callbackPort,
              signal: abort.signal,
              onUrl: async (url) => {
                if (values['no-browser'] || !(await (deps.openBrowser ?? openBrowser)(url)))
                  io.stderr(`Open this URL to log in:\n${url}`);
                else io.stderr('Complete login in your browser. Waiting for authorization...');
              },
            });
            await store.save(credential, backend);
            io.stdout(
              `Logged in to ${credential.apiUrl} as ${credential.identity.email ?? credential.identity.subject}. Credentials: ${backend}.`,
            );
          });
        } finally {
          process.removeListener('SIGINT', cancel);
          process.removeListener('SIGTERM', cancel);
        }
      } else if (command === 'status') {
        const result = await authStatus(config, store, !values.offline, deps.fetchImpl);
        io.stdout(json ? JSON.stringify(result) : JSON.stringify(result, null, 2));
      } else {
        await store.locked(config.apiUrl, () => store.remove(config.apiUrl));
        const result = {
          api: apiOrigin(config.apiUrl),
          loggedOut: true,
          remoteRevoked: false,
          note: 'Local OAuth credentials removed. Remote authorization and token/service configuration are unchanged.',
        };
        io.stdout(json ? JSON.stringify(result) : result.note);
      }
      return 0;
    }
    const file = extractMarkdownFile(positionals);
    const auth = await prepareAuth(config, store, deps.fetchImpl);

    const progress = (text: string): void => {
      if (verbose) io.stderr(text);
    };

    progress(`Scanning ${file}...`);
    const bundle = await buildBundle(file, { noAssets: values['no-assets'] });

    if (json === false) {
      progress('');
      progress(`Markdown    ${formatBytes(bundle.markdownBytes.length)}`);
      progress(`Assets      ${bundle.assets.length}`);
      progress(`Total       ${formatBytes(bundle.totalBytes)}`);
      progress('');
    }

    const result = await publishBundle(
      {
        apiUrl: config.apiUrl,
        headers: auth.headers,
        authMode: auth.mode,
        fetchImpl: deps.fetchImpl,
      },
      bundle,
    );

    if (json) {
      io.stdout(JSON.stringify({ id: result.id, url: result.url }));
    } else {
      io.stdout(`Published:\n${result.url}`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`error: ${message}`);
    return 1;
  }
}
