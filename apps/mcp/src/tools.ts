import { buildBundle, CliError, publishBundle, resolveConfig } from '@mote/cli';
import { MAX_MARKDOWN_BYTES } from '@mote/core';
import type { Bundle } from '@mote/cli';

/**
 * Thin adapter over the CLI's publish pipeline (baseline §43): the MCP
 * server never implements its own upload logic — it reuses the exact same
 * buildBundle / publishBundle / resolveConfig the CLI uses.
 */
export interface McpDeps {
  buildBundle: typeof buildBundle;
  publishBundle: typeof publishBundle;
  resolveConfig: typeof resolveConfig;
}

export const realDeps: McpDeps = { buildBundle, publishBundle, resolveConfig };

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

async function requireConfig(deps: McpDeps): Promise<{ apiUrl: string; token: string }> {
  const config = await deps.resolveConfig();
  if (!config.token) {
    throw new CliError(
      'no publish token configured. Set MOTE_TOKEN in the MCP server environment or add "token" to the config file.',
    );
  }
  return { apiUrl: config.apiUrl, token: config.token };
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

  const config = await requireConfig(deps);
  const bundle: Bundle = {
    entryName: name,
    markdownBytes,
    manifest: { version: 1, entry: name, assets: [] },
    assets: [],
    totalBytes: markdownBytes.length,
  };
  return deps.publishBundle({ apiUrl: config.apiUrl, token: config.token }, bundle);
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
  const bundle = await deps.buildBundle(path, { noAssets });
  const config = await requireConfig(deps);
  const result = await deps.publishBundle({ apiUrl: config.apiUrl, token: config.token }, bundle);
  return {
    ...result,
    markdownBytes: bundle.markdownBytes.length,
    assetCount: bundle.assets.length,
    totalBytes: bundle.totalBytes,
  };
}
