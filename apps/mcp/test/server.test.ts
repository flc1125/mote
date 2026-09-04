import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';

import type { Bundle } from '@mote/cli';

import { createMoteMcpServer } from '../src/server.js';
import type { McpDeps } from '../src/tools.js';

const TOKEN = 'server-test-token';
const DOC_ID = '7Vk3mQ9x2NFaP4Ls';
const DOC_URL = `https://mote.flc.io/${DOC_ID}`;

// The SDK's callTool resolves content through a loose index-signature type,
// so narrow it to the shape our server actually returns.
interface ToolResult {
  isError?: boolean | undefined;
  content: { type: string; text?: string | undefined }[];
  structuredContent?: Record<string, unknown> | undefined;
}

const closers: (() => Promise<unknown>)[] = [];

async function connect(deps: McpDeps): Promise<Client> {
  const server = createMoteMcpServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  closers.push(async () => {
    await client.close();
    await server.close();
  });
  return client;
}

afterEach(async () => {
  while (closers.length > 0) await closers.pop()?.();
});

const okDeps: McpDeps = {
  buildBundle: async () => {
    throw new Error('buildBundle must not be called by publish_markdown');
  },
  publishBundle: async () => ({ id: DOC_ID, url: DOC_URL }),
  resolveConfig: async () => ({ apiUrl: 'https://api.test', token: TOKEN }),
};

describe('MCP server (protocol level)', () => {
  it('lists exactly the two publish tools', async () => {
    const client = await connect(okDeps);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'publish_markdown',
      'publish_markdown_file',
    ]);
  });

  it('publish_markdown returns the URL in text and structured content', async () => {
    const client = await connect(okDeps);
    const result = (await client.callTool({
      name: 'publish_markdown',
      arguments: { markdown: '# Hi' },
    })) as ToolResult;

    expect(result.isError).toBeUndefined();
    const first = result.content[0];
    expect(first?.type).toBe('text');
    if (first?.type === 'text') {
      expect(first.text).toContain(DOC_URL);
    }
    expect(result.structuredContent).toEqual({ id: DOC_ID, url: DOC_URL });
  });

  it('publish_markdown_file surfaces a missing token as an error result', async () => {
    const markdownBytes = new TextEncoder().encode('# Hi');
    const bundle: Bundle = {
      entryName: 'README.md',
      markdownBytes,
      manifest: { version: 1, entry: 'README.md', assets: [] },
      assets: [],
      totalBytes: markdownBytes.length,
    };
    const deps: McpDeps = {
      buildBundle: async () => bundle,
      publishBundle: async () => {
        throw new Error('publishBundle must not be called without a token');
      },
      resolveConfig: async () => ({ apiUrl: 'https://api.test' }),
    };

    const client = await connect(deps);
    const result = (await client.callTool({
      name: 'publish_markdown_file',
      arguments: { path: '/tmp/doc/README.md' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    const first = result.content[0];
    expect(first?.type).toBe('text');
    if (first?.type === 'text') {
      expect(first.text).toContain('no publish token');
    }
  });
});
