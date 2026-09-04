import {
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  PUBLISH_MARKDOWN_TOOL_DESCRIPTOR,
  PUBLISH_MARKDOWN_TOOL_NAME,
  publishMarkdownInputSchema,
} from '@mote/protocol';

import { authorize } from './auth.js';
import { commitBundle, prepareBundle, PublishError } from './publish.js';

interface McpEnv {
  DOCUMENTS: R2Bucket;
  MOTE_TOKEN: string;
  VIEWER_BASE_URL: string;
}

/**
 * Stateless Streamable HTTP MCP endpoint (plan 002):
 * POST-only JSON-RPC, no sessions, no SSE. Methods: initialize,
 * notifications/initialized (202), tools/list, tools/call.
 *
 * Hand-rolled minimal dispatch: the official SDK's StreamableHTTP transport
 * is bound to Node's req/res, and a stateless four-method dispatch is
 * smaller and safer than a fetch adapter.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rpcResult(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

function rpcError(id: unknown, code: number, message: string, httpStatus = 200): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }),
    { status: httpStatus, headers: JSON_HEADERS },
  );
}

async function handleToolCall(id: unknown, params: unknown, env: McpEnv): Promise<Response> {
  if (!isRecord(params) || params.name !== PUBLISH_MARKDOWN_TOOL_NAME) {
    return rpcError(
      id,
      INVALID_PARAMS,
      `unknown tool: ${isRecord(params) ? String(params.name) : 'none'}`,
    );
  }

  const parsed = publishMarkdownInputSchema.safeParse(params.arguments);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return rpcError(id, INVALID_PARAMS, issues.join('; '));
  }

  const name = parsed.data.name ?? 'document.md';
  const markdownBytes = new TextEncoder().encode(parsed.data.markdown);

  // Wrap the raw markdown into the same multipart shape the publish API
  // accepts, so the existing prepareBundle/commitBundle pipeline is reused
  // verbatim — no parallel publish logic (baseline §43/§45).
  const form = new FormData();
  form.append('document', new File([markdownBytes], name, { type: 'text/markdown' }));
  form.append('manifest', JSON.stringify({ version: 1, entry: name, assets: [] }));

  try {
    const bundle = await prepareBundle(form, env.DOCUMENTS);
    await commitBundle(env.DOCUMENTS, bundle);

    console.log(
      JSON.stringify({
        event: 'publish',
        source: 'mcp-http',
        documentId: bundle.id,
        markdownBytes: bundle.markdownBytes.length,
        assetCount: 0,
        assetBytes: 0,
      }),
    );

    const result = { id: bundle.id, url: `${env.VIEWER_BASE_URL}/${bundle.id}` };
    return rpcResult(id, {
      content: [{ type: 'text', text: result.url }],
      structuredContent: result,
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return rpcResult(id, {
        isError: true,
        content: [{ type: 'text', text: `${error.code}: ${error.message}` }],
      });
    }
    throw error;
  }
}

export async function handleMcp(request: Request, env: McpEnv): Promise<Response> {
  if (request.method !== 'POST') {
    // Stateless mode: no SSE stream (baseline plan 002 §Phase 1).
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST', ...JSON_HEADERS },
    });
  }

  if (!(await authorize(request, env.MOTE_TOKEN))) {
    return new Response(
      JSON.stringify({
        error: { code: 'UNAUTHORIZED', message: 'missing or invalid bearer token' },
      }),
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return rpcError(null, INVALID_REQUEST, 'Content-Type must be application/json', 400);
  }

  let message: JsonRpcMessage;
  try {
    const parsed: unknown = await request.json();
    if (Array.isArray(parsed) || !isRecord(parsed)) {
      return rpcError(null, INVALID_REQUEST, 'expected a single JSON-RPC request object', 400);
    }
    message = parsed;
  } catch {
    return rpcError(null, PARSE_ERROR, 'invalid JSON', 400);
  }

  const method = typeof message.method === 'string' ? message.method : null;
  const isNotification = message.id === undefined;

  // Notifications never receive a response body (JSON-RPC semantics).
  if (isNotification) {
    return new Response(null, { status: 202 });
  }

  switch (method) {
    case 'initialize':
      return rpcResult(message.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
      });

    case 'tools/list':
      return rpcResult(message.id, { tools: [PUBLISH_MARKDOWN_TOOL_DESCRIPTOR] });

    case 'tools/call':
      return handleToolCall(message.id, message.params, env);

    default:
      return rpcError(message.id, METHOD_NOT_FOUND, `method not found: ${String(method)}`);
  }
}
