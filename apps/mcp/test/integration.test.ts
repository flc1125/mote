import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import apiWorker from '../../api/src/index.js';
import viewerWorker from '../../viewer/src/index.js';

import { createMoteMcpServer } from '../src/server.js';
import { realDeps, type McpDeps } from '../src/tools.js';

const TOKEN = 'mcp-e2e-token';
const VIEWER_BASE = 'http://viewer.local';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

let mf: Miniflare;
let bucket: R2Bucket;
let server: Server;
let apiUrl: string;
let workDir: string;
let client: Client;
let mcpServer: ReturnType<typeof createMoteMcpServer>;

function nodeHeadersToInit(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const init: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    init[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return init;
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'mote-mcp-e2e-'));

  // Real R2 implementation shared by both workers.
  mf = new Miniflare({
    modules: true,
    script: 'export default {}',
    r2Buckets: ['DOCUMENTS'],
  });
  bucket = (await mf.getR2Bucket('DOCUMENTS')) as unknown as R2Bucket;

  // Serve the API worker over real HTTP so the MCP tools exercise the CLI's
  // actual network path (multipart encoding included).
  const apiEnv = { DOCUMENTS: bucket, MOTE_TOKEN: TOKEN, VIEWER_BASE_URL: VIEWER_BASE };
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        const body = Buffer.concat(chunks);
        const request = new Request(`http://api.local${req.url ?? '/'}`, {
          method: req.method,
          headers: nodeHeadersToInit(req.headers),
          body: body.length > 0 ? body : undefined,
        });
        const response = await apiWorker.fetch(request, apiEnv);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      })().catch((error: unknown) => {
        res.writeHead(500);
        res.end(String(error));
      });
    });
  });
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // MCP server wired to the local API through the real build/publish chain.
  const deps: McpDeps = {
    ...realDeps,
    resolveConfig: async () => ({ apiUrl, token: TOKEN }),
  };
  mcpServer = createMoteMcpServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'integration-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)]);
});

afterAll(async () => {
  await client.close();
  await mcpServer.close();
  await new Promise((resolveClose) => server.close(resolveClose));
  await mf.dispose();
  await rm(workDir, { recursive: true, force: true });
});

describe('MCP integration (publish -> view)', () => {
  it('publish_markdown_file publishes a Markdown file with a local PNG end to end', async () => {
    const dir = await mkdtemp(join(workDir, 'doc-'));
    await writeFile(join(dir, 'demo.png'), PNG);
    const markdownPath = join(dir, 'README.md');
    await writeFile(markdownPath, '# MCP E2E\n\n![demo](./demo.png)\n');

    const result = await client.callTool({
      name: 'publish_markdown_file',
      arguments: { path: markdownPath },
    });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      id: string;
      url: string;
      markdownBytes: number;
      assetCount: number;
      totalBytes: number;
    };
    expect(structured.url).toBe(`${VIEWER_BASE}/${structured.id}`);
    expect(structured.assetCount).toBe(1);

    const page = await viewerWorker.fetch(new Request(structured.url), { DOCUMENTS: bucket });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<h1 id="mcp-e2e">MCP E2E</h1>');
    expect(html).not.toContain('demo.png'); // original file name never leaks
    const assetPath = /src="(\/[^"]+\/a\/[^"]+)"/.exec(html)?.[1];
    expect(assetPath).toBeDefined();

    const asset = await viewerWorker.fetch(new Request(`${VIEWER_BASE}${assetPath}`), {
      DOCUMENTS: bucket,
    });
    expect(asset.status).toBe(200);
    expect(asset.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await asset.arrayBuffer())).toEqual(PNG);
  });
});
