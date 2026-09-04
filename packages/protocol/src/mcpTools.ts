import { z } from 'zod';

/**
 * Single source of truth for MCP tool definitions (plan 002): both the
 * stdio server (apps/mcp) and the remote endpoint (apps/api, POST /api/mcp)
 * import from here so schemas and descriptions never drift apart.
 */

/** MCP protocol revision this server speaks. */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

export const MCP_SERVER_INFO = { name: 'mote', version: '0.0.0' } as const;

export const PUBLISH_MARKDOWN_TOOL_NAME = 'publish_markdown';

export const PUBLISH_MARKDOWN_TOOL_DESCRIPTION =
  'Publish Markdown content as an immutable, unguessable web page and return its shareable URL. ' +
  'Use this when you have Markdown in memory (e.g. a report you just wrote).';

const MARKDOWN_DESCRIPTION = 'Markdown content to publish (max 2 MB; remote images only)';
const NAME_DESCRIPTION = 'Logical file name, e.g. "report.md" (default: "document.md")';
const ID_DESCRIPTION = 'Document ID';
const URL_DESCRIPTION = 'Public URL of the published page';

/** Zod shape — used by the stdio server (SDK registerTool) and for
 * argument validation in the remote endpoint. */
export const publishMarkdownInputShape = {
  markdown: z.string().min(1).describe(MARKDOWN_DESCRIPTION),
  name: z.string().optional().describe(NAME_DESCRIPTION),
};

export const publishMarkdownInputSchema = z.object(publishMarkdownInputShape);

/** JSON Schema — returned by tools/list on the remote endpoint. */
export const publishMarkdownInputJsonSchema = {
  type: 'object',
  properties: {
    markdown: { type: 'string', minLength: 1, description: MARKDOWN_DESCRIPTION },
    name: { type: 'string', description: NAME_DESCRIPTION },
  },
  required: ['markdown'],
  additionalProperties: false,
} as const;

export const publishMarkdownOutputShape = {
  id: z.string().describe(ID_DESCRIPTION),
  url: z.string().describe(URL_DESCRIPTION),
};

export const publishMarkdownOutputJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: ID_DESCRIPTION },
    url: { type: 'string', description: URL_DESCRIPTION },
  },
  required: ['id', 'url'],
  additionalProperties: false,
} as const;

/** The tool descriptor served by tools/list (remote endpoint). */
export const PUBLISH_MARKDOWN_TOOL_DESCRIPTOR = {
  name: PUBLISH_MARKDOWN_TOOL_NAME,
  description: PUBLISH_MARKDOWN_TOOL_DESCRIPTION,
  inputSchema: publishMarkdownInputJsonSchema,
  outputSchema: publishMarkdownOutputJsonSchema,
} as const;
