import {
  buildBundle,
  CliError,
  publishBundle,
  resolveConfig,
  prepareAuth,
  defaultCredentialStore,
} from '@mote/cli';
import { MAX_MARKDOWN_BYTES } from '@mote/core';
import type { Bundle, CliConfig, AuthHeaders, PublishClientOptions } from '@mote/cli';

/**
 * Thin adapter over the CLI's publish pipeline (baseline §43): the MCP
 * server never implements its own upload logic — it reuses the exact same
 * buildBundle / publishBundle / resolveConfig the CLI uses.
 */
export interface McpDeps {
  buildBundle: typeof buildBundle;
  publishBundle: typeof publishBundle;
  resolveConfig: typeof resolveConfig;
  prepareAuth: (config: CliConfig) => Promise<AuthHeaders>;
}

export const realDeps: McpDeps = {
  buildBundle,
  publishBundle,
  resolveConfig,
  prepareAuth: (config) => prepareAuth(config, defaultCredentialStore()),
};

// Type aliases (not interfaces) so results get implicit index signatures and
// stay assignable to the MCP SDK's structuredContent: { [x: string]: unknown }.
export type PublishMarkdownResult = {
  id: string;
  url: string;
};

export type PublishFileResult = PublishMarkdownResult & {
  markdownBytes: number;
  assetCount: number;
  totalBytes: number;
};

async function publishOptions(deps: McpDeps): Promise<PublishClientOptions> {
  const config = await deps.resolveConfig();
  // This is the same noninteractive path as CLI publish: never opens a browser.
  const auth = await deps.prepareAuth(config);
  return { apiUrl: config.apiUrl, authMode: auth.mode, headers: auth.headers };
}

/**
 * Publishes raw Markdown content (no local files; remote images only).
 * `name` becomes the entry name in the manifest and the page-title fallback.
 */
export async function publishMarkdown(
  markdown: string,
  name: string,
  deps: McpDeps,
): Promise<PublishMarkdownResult> {
  const markdownBytes = new TextEncoder().encode(markdown);
  if (markdownBytes.length > MAX_MARKDOWN_BYTES) {
    throw new CliError(
      `markdown is ${markdownBytes.length} bytes, limit is ${MAX_MARKDOWN_BYTES} (2 MB)`,
    );
  }

  const options = await publishOptions(deps);
  const bundle: Bundle = {
    entryName: name,
    markdownBytes,
    manifest: { version: 1, entry: name, assets: [] },
    assets: [],
    totalBytes: markdownBytes.length,
  };
  return deps.publishBundle(options, bundle);
}

/**
 * Publishes a local Markdown file through the CLI's AST asset scanning
 * chain: local images are collected, validated, deduped and uploaded.
 */
export async function publishMarkdownFile(
  path: string,
  noAssets: boolean,
  deps: McpDeps,
): Promise<PublishFileResult> {
  const options = await publishOptions(deps);
  const bundle = await deps.buildBundle(path, { noAssets });
  const result = await deps.publishBundle(options, bundle);
  return {
    ...result,
    markdownBytes: bundle.markdownBytes.length,
    assetCount: bundle.assets.length,
    totalBytes: bundle.totalBytes,
  };
}
