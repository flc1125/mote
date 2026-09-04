import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  PUBLISH_MARKDOWN_TOOL_DESCRIPTION,
  PUBLISH_MARKDOWN_TOOL_NAME,
  publishMarkdownInputShape,
  publishMarkdownOutputShape,
} from '@mote/protocol';

import { publishMarkdown, publishMarkdownFile, realDeps, type McpDeps } from './tools.js';

const SERVER_NAME = 'mote';
const SERVER_VERSION = '0.0.0';

function errorResult(error: unknown): {
  isError: true;
  content: { type: 'text'; text: string }[];
} {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  };
}

/**
 * Creates the Mote MCP server (baseline §43). Two tools only, per the
 * agreed spec: publish_markdown and publish_markdown_file.
 */
export function createMoteMcpServer(deps: McpDeps = realDeps): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Mote publishes Markdown as immutable, unguessable web pages. ' +
        'Use publish_markdown for content you have in memory and ' +
        'publish_markdown_file for local Markdown files (local images are ' +
        'uploaded automatically). Always return the resulting URL to the user.',
    },
  );

  // Tool definition shared with the remote endpoint (@mote/protocol), see plan 002.
  server.registerTool(
    PUBLISH_MARKDOWN_TOOL_NAME,
    {
      description: PUBLISH_MARKDOWN_TOOL_DESCRIPTION,
      inputSchema: publishMarkdownInputShape,
      outputSchema: publishMarkdownOutputShape,
    },
    async ({ markdown, name }) => {
      try {
        const result = await publishMarkdown(markdown, name ?? 'document.md', deps);
        return {
          content: [{ type: 'text', text: result.url }],
          structuredContent: result,
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'publish_markdown_file',
    {
      description:
        'Publish a local Markdown file as an immutable, unguessable web page and return its shareable URL. ' +
        'Local images referenced by the Markdown are uploaded automatically (deduplicated by content).',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe(
            'Path to the Markdown file (absolute, or relative to the server working directory)',
          ),
        noAssets: z
          .boolean()
          .optional()
          .describe('Publish without uploading local images (default: false)'),
      },
      outputSchema: {
        id: z.string().describe('Document ID'),
        url: z.string().describe('Public URL of the published page'),
        markdownBytes: z.number().describe('Size of the Markdown in bytes'),
        assetCount: z.number().describe('Number of local images uploaded'),
        totalBytes: z.number().describe('Total bundle size in bytes'),
      },
    },
    async ({ path, noAssets }) => {
      try {
        const result = await publishMarkdownFile(path, noAssets === true, deps);
        return {
          content: [{ type: 'text', text: result.url }],
          structuredContent: result,
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
