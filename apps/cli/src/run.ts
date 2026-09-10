import { parseArgs } from 'node:util';

import packageJson from '../package.json' with { type: 'json' };

import { buildBundle } from './bundle.js';
import { publishBundle } from './client.js';
import { resolveConfig } from './config.js';
import { CliError } from './errors.js';
import { authStatus, defaultCredentialStore, prepareAuth } from './auth/manager.js';
import { login } from './auth/oauth.js';
import type { copyLink, openBrowser } from './terminal-actions.js';
import {
  loginInteraction,
  terminalColorEnabled,
  terminalFields,
  terminalText,
  terminalTitle,
} from './terminal.js';
import type { LoginInput } from './terminal.js';
import type { CredentialStore } from './auth/store.js';
import { apiOrigin } from './auth/urls.js';

export const CLI_VERSION = packageJson.version;

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  stdoutIsTTY?: boolean;
  stderrIsTTY?: boolean;
}

export interface RunDeps {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  configPath?: string;
  store?: CredentialStore;
  interactive?: boolean;
  openBrowser?: typeof openBrowser;
  copyLink?: typeof copyLink;
  input?: LoginInput;
  loginImpl?: typeof login;
}

const USAGE = `mote — Markdown in, URL out.

Usage:
  mote <markdown-file> [options]
  mote publish <markdown-file> [options]
  mote login [--api <url>] [login options]
  mote auth login [--no-browser] [--client-id <id>] [--credential-store keyring|file]
  mote auth status [--offline] [--json]
  mote auth logout [--json]

Options:
  --api <url>                 API origin (overrides environment and configuration)
  --token <token>             Publish token (env: MOTE_TOKEN)
  --auth-mode <mode>          token | oauth | service (env: MOTE_AUTH_MODE)
  --json                      Machine-readable output (publish: {"id","url"})
  --no-assets                 Do not upload local images
  --verbose                   Verbose progress on stderr
  -h, --help                  Show this help
  -v, --version               Show version

Login options (interactive terminal required):
  --no-browser                Manual link mode without keyboard actions
  --client-id <id>            Existing public OAuth client; otherwise register one
  --callback-port <port>      Registered loopback port (default: temporary port)
  --credential-store <store>  keyring (default) or explicit private file

Status options:
  --offline                   Cached state only, not online verification

Machine mode requires MOTE_SERVICE_API_URL, MOTE_SERVICE_CLIENT_ID,
and MOTE_SERVICE_CLIENT_SECRET. Credentials are never sent across redirects.

Login displays an authorization link. Press o to open it or c to copy it.
The instance is remembered after credentials are saved.
API priority: --api > MOTE_API_URL > config apiUrl > remembered instance > https://mote.pub.
Explicit auth-mode settings still apply. Use --auth-mode oauth for OAuth login.
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
  const env = deps.env ?? process.env;
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

    const store = deps.store ?? defaultCredentialStore(deps.env, deps.configPath);
    const config = await resolveConfig({
      api: values.api,
      token: values.token,
      authMode: values['auth-mode'],
      env: deps.env,
      configPath: deps.configPath,
      store,
    });
    const loginAlias = positionals[0] === 'login';
    if (loginAlias || positionals[0] === 'auth') {
      const command = loginAlias ? 'login' : positionals[1];
      if (
        positionals.length !== (loginAlias ? 1 : 2) ||
        !['login', 'status', 'logout'].includes(command ?? '')
      )
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
        io.stderr(terminalTitle('Mote · Sign in', io.stderrIsTTY, env));
        io.stderr(`\n${terminalFields([['Instance', config.apiUrl]])}`);
        const abort = new AbortController();
        let stopInteraction = () => {};
        const cancel = () => {
          stopInteraction();
          abort.abort();
        };
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
                abort.signal.throwIfAborted();
                stopInteraction = loginInteraction(url, {
                  input: deps.input ?? process.stdin,
                  enabled: Boolean(io.stderrIsTTY) && env.TERM !== 'dumb' && !values['no-browser'],
                  color: terminalColorEnabled(io.stderrIsTTY, env),
                  write: io.stderr,
                  cancel,
                  open: deps.openBrowser,
                  copy: deps.copyLink,
                });
              },
              onAuthorized: () => {
                stopInteraction();
                io.stderr('Authorization received. Verifying identity and saving credentials…');
              },
            });
            stopInteraction();
            abort.signal.throwIfAborted();
            if (credential.apiUrl !== apiOrigin(config.apiUrl, true))
              throw new CliError('login credential API does not match requested instance');
            await store.save(credential, backend);
            abort.signal.throwIfAborted();
            try {
              await store.rememberApi(credential.apiUrl);
            } catch {
              throw new CliError(
                `Credentials saved, but the default instance could not be saved. Use --api ${credential.apiUrl}; do not repeat login just to retry publishing.`,
              );
            }
            io.stdout(`\n${terminalTitle('Logged in', io.stdoutIsTTY, env)}\n`);
            io.stdout(
              terminalFields([
                ['Instance', credential.apiUrl],
                ['Identity', credential.identity.email ?? credential.identity.subject ?? 'Unknown'],
                ['Credentials', backend],
              ]),
            );
            io.stdout(`Default instance saved: ${credential.apiUrl}.`);
            const next = await resolveConfig({ env: deps.env, configPath: deps.configPath, store });
            if (apiOrigin(next.apiUrl) !== credential.apiUrl)
              io.stderr(
                `Notice: MOTE_API_URL or config apiUrl still selects ${apiOrigin(next.apiUrl)}. Remove that override or use --api ${credential.apiUrl} when publishing.`,
              );
            if (next.authMode && next.authMode !== 'oauth')
              io.stderr(
                `Notice: your configured auth mode is ${next.authMode}. Use --auth-mode oauth or update that setting to publish with this login.`,
              );
          });
        } catch (error) {
          if (abort.signal.aborted) throw new CliError('OAuth login cancelled');
          throw error;
        } finally {
          stopInteraction();
          process.removeListener('SIGINT', cancel);
          process.removeListener('SIGTERM', cancel);
        }
      } else if (command === 'status') {
        const result = await authStatus(config, store, !values.offline, deps.fetchImpl);
        if (json) io.stdout(JSON.stringify(result));
        else {
          io.stdout(`${terminalTitle('Mote · Authentication', io.stdoutIsTTY, env)}\n`);
          io.stdout(
            terminalFields([
              ['Instance', result.api],
              ['Mode', result.mode],
              ['Check', result.source === 'online' ? 'Online' : 'Offline (not verified)'],
              ['Status', result.state],
              ['Identity', result.identity?.email ?? result.identity?.subject ?? 'Unknown'],
              ['Storage', result.storage ?? 'Not applicable'],
              ['Token expires', result.accessTokenExpiresAt ?? 'Unknown'],
              ['Session expires', result.authorizationSessionExpiresAt ?? 'Unknown'],
            ]),
          );
        }
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
    io.stderr(`error: ${terminalText(message)}`);
    return 1;
  }
}
