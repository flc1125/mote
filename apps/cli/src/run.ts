import { parseArgs } from 'node:util';

import { buildBundle } from './bundle.js';
import { publishBundle } from './client.js';
import { resolveConfig } from './config.js';
import { CliError } from './errors.js';

export const CLI_VERSION = '0.1.0';

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface RunDeps {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  configPath?: string;
}

const USAGE = `mote — Markdown in, URL out.

Usage:
  mote <markdown-file> [options]
  mote publish <markdown-file> [options]

Options:
  --api <url>       Publish API URL      (env: MOTE_API_URL, default: https://mote.flc.io)
  --token <token>   Publish token        (env: MOTE_TOKEN)
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

    const file = extractMarkdownFile(positionals);
    const json = values.json;
    const verbose = values.verbose && !json;

    const config = await resolveConfig({
      api: values.api,
      token: values.token,
      env: deps.env,
      configPath: deps.configPath,
    });
    if (config.token === undefined || config.token === '') {
      throw new CliError(
        'no publish token configured. Set MOTE_TOKEN, pass --token, or add "token" to the config file.',
      );
    }

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
      { apiUrl: config.apiUrl, token: config.token, fetchImpl: deps.fetchImpl },
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
