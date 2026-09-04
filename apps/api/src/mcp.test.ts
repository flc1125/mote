import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { isDocumentId } from '@mote/core';
import { isDocumentManifest } from '@mote/protocol';

import { TEST_PUBLISH_TOKEN } from './test-token.js';

const MCP_URL = 'http://localhost/api/mcp';

function mcpPost(body: unknown, token = TEST_PUBLISH_TOKEN): Promise<Response> {
  return exports.default.fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function rpc(method: string, params?: unknown, id: unknown = 1): Record<string, unknown> {
  return { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) };
}

async function resultOf(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json()) as { result?: Record<string, unknown> };
  expect(body.result).toBeDefined();
  return body.result!;
}

describe('POST /api/mcp — protocol', () => {
  it('answers initialize with protocol version and server info', async () => {
    const response = await mcpPost(rpc('initialize', { protocolVersion: '2025-06-18' }));
    expect(response.status).toBe(200);

    const result = await resultOf(response);
    expect(result.protocolVersion).toBe('2025-06-18');
    expect(result.serverInfo).toEqual({ name: 'mote', version: '0.0.0' });
    expect(result.capabilities).toEqual({ tools: { listChanged: false } });
  });

  it('returns 202 for notifications (no response body)', async () => {
    const response = await mcpPost({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(response.status).toBe(202);
    expect(await response.text()).toBe('');
  });

  it('lists exactly the publish_markdown tool', async () => {
    const response = await mcpPost(rpc('tools/list'));
    const result = await resultOf(response);

    const tools = result.tools as { name: string; inputSchema: unknown; outputSchema: unknown }[];
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('publish_markdown');
    expect(tools[0]?.inputSchema).toMatchObject({ required: ['markdown'] });
  });

  it('rejects GET with 405 (stateless, no SSE)', async () => {
    const response = await exports.default.fetch(MCP_URL, {
      headers: { Authorization: `Bearer ${TEST_PUBLISH_TOKEN}` },
    });
    expect(response.status).toBe(405);
  });
});

describe('POST /api/mcp — tools/call publish_markdown', () => {
  it('publishes markdown and returns a working document URL', async () => {
    const response = await mcpPost(
      rpc('tools/call', {
        name: 'publish_markdown',
        arguments: { markdown: '# MCP 远程发布', name: 'note.md' },
      }),
    );
    expect(response.status).toBe(200);

    const result = await resultOf(response);
    const structured = result.structuredContent as { id: string; url: string };
    expect(isDocumentId(structured.id)).toBe(true);
    expect(structured.url).toBe(`https://mote.flc.io/${structured.id}`);

    const content = result.content as { type: string; text: string }[];
    expect(content[0]?.text).toBe(structured.url);

    // The bundle landed in R2 through the normal pipeline.
    const manifestObject = await env.DOCUMENTS.get(`documents/${structured.id}/manifest.json`);
    expect(manifestObject).not.toBeNull();
    const manifest: unknown = JSON.parse(await manifestObject!.text());
    expect(isDocumentManifest(manifest)).toBe(true);
    if (isDocumentManifest(manifest)) {
      expect(manifest.source.name).toBe('note.md');
      expect(manifest.assets).toEqual([]);
    }
  });

  it('returns INVALID_PARAMS for bad arguments', async () => {
    const response = await mcpPost(
      rpc('tools/call', { name: 'publish_markdown', arguments: { name: 'x.md' } }),
    );
    const body = (await response.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32602);
  });

  it('returns INVALID_PARAMS for an unknown tool', async () => {
    const response = await mcpPost(rpc('tools/call', { name: 'nope', arguments: {} }));
    const body = (await response.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32602);
  });

  it('returns isError (not a JSON-RPC error) when the bundle is too large', async () => {
    const big = 'x'.repeat(2 * 1024 * 1024 + 1);
    const response = await mcpPost(
      rpc('tools/call', { name: 'publish_markdown', arguments: { markdown: big } }),
    );
    const result = await resultOf(response);
    expect(result.isError).toBe(true);
    const content = result.content as { text: string }[];
    expect(content[0]?.text).toContain('BUNDLE_TOO_LARGE');
  });
});

describe('POST /api/mcp — error matrix', () => {
  it('rejects a missing token with 401', async () => {
    const response = await mcpPost(rpc('initialize'), 'wrong-token');
    expect(response.status).toBe(401);
  });

  it('rejects invalid JSON with 400 and a parse error', async () => {
    const response = await mcpPost('{not json');
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32700);
  });

  it('rejects batch requests', async () => {
    const response = await mcpPost([rpc('initialize')]);
    expect(response.status).toBe(400);
  });

  it('rejects non-JSON content type', async () => {
    const response = await exports.default.fetch(MCP_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_PUBLISH_TOKEN}`, 'Content-Type': 'text/plain' },
      body: '{}',
    });
    expect(response.status).toBe(400);
  });

  it('returns METHOD_NOT_FOUND for unknown methods', async () => {
    const response = await mcpPost(rpc('resources/list'));
    const body = (await response.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32601);
  });
});
