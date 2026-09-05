import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { CliError } from './errors.js';

export const DEFAULT_API_URL = 'https://mote.flc.io';

export interface CliConfig {
  apiUrl: string;
  token?: string;
  authMode?: 'token' | 'oauth' | 'service';
  serviceToken?: { apiUrl: string; clientId: string; clientSecret: string };
}

interface ConfigFile {
  apiUrl?: string;
  token?: string;
  authMode?: CliConfig['authMode'];
  serviceToken?: CliConfig['serviceToken'];
}

export interface ResolveConfigOptions {
  /** `--api` flag. */
  api?: string | undefined;
  /** `--token` flag. */
  token?: string | undefined;
  authMode?: string;
  /** Environment override (defaults to process.env), for tests. */
  env?: Record<string, string | undefined>;
  /** Config file path override, for tests. */
  configPath?: string;
}

export function defaultConfigPath(env: Record<string, string | undefined>): string {
  const base = env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(base, 'mote', 'config.json');
}

async function readConfigFile(path: string): Promise<ConfigFile> {
  let text: string;
  try {
    text = await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new CliError('cannot read config file');
  }
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('not an object');
    }
    return value as ConfigFile;
  } catch {
    throw new CliError(`invalid config file: ${path} (must be a JSON object)`);
  }
}

/**
 * Configuration priority (baseline §21):
 * CLI arguments > environment (MOTE_API_URL, MOTE_TOKEN) > config file > defaults.
 */
export async function resolveConfig(options: ResolveConfigOptions = {}): Promise<CliConfig> {
  const env = options.env ?? process.env;
  const file = await readConfigFile(options.configPath ?? defaultConfigPath(env));
  const authMode = options.authMode ?? env.MOTE_AUTH_MODE ?? file.authMode;
  if (authMode !== undefined && !['token', 'oauth', 'service'].includes(authMode)) {
    throw new CliError('auth mode must be token, oauth or service');
  }
  const serviceEnv = [
    'MOTE_SERVICE_API_URL',
    'MOTE_SERVICE_CLIENT_ID',
    'MOTE_SERVICE_CLIENT_SECRET',
  ];
  const serviceToken = serviceEnv.some((key) => env[key] !== undefined)
    ? {
        apiUrl: env.MOTE_SERVICE_API_URL ?? '',
        clientId: env.MOTE_SERVICE_CLIENT_ID ?? '',
        clientSecret: env.MOTE_SERVICE_CLIENT_SECRET ?? '',
      }
    : file.serviceToken;
  return {
    apiUrl: options.api ?? env.MOTE_API_URL ?? file.apiUrl ?? DEFAULT_API_URL,
    token: options.token ?? env.MOTE_TOKEN ?? file.token,
    authMode: authMode as CliConfig['authMode'],
    serviceToken,
  };
}
