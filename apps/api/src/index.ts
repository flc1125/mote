import {
  ERROR_HTTP_STATUS,
  ErrorCode,
  errorResponse,
  PUBLISH_PATH,
  type PublishResponse,
} from '@mote/protocol';

import { authorize } from './auth.js';
import { handleMcp } from './mcp.js';
import { commitBundle, isDefinitelyTooLarge, prepareBundle, PublishError } from './publish.js';

export interface Env {
  DOCUMENTS: R2Bucket;
  /** Secret, set via `wrangler secret put MOTE_TOKEN` (§38). */
  MOTE_TOKEN: string;
  VIEWER_BASE_URL: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function errorJson(code: ErrorCode, message: string): Response {
  return new Response(JSON.stringify(errorResponse(code, message)), {
    status: ERROR_HTTP_STATUS[code],
    headers: JSON_HEADERS,
  });
}

async function handlePublish(request: Request, env: Env): Promise<Response> {
  if (!(await authorize(request, env.MOTE_TOKEN))) {
    return errorJson(ErrorCode.Unauthorized, 'missing or invalid bearer token');
  }

  // Early reject before buffering the body (§14).
  const contentLength = Number(request.headers.get('Content-Length') ?? '0');
  if (isDefinitelyTooLarge(contentLength)) {
    return errorJson(ErrorCode.BundleTooLarge, 'request body exceeds the bundle limit');
  }

  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return errorJson(ErrorCode.UnsupportedMediaType, 'Content-Type must be multipart/form-data');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorJson(ErrorCode.MalformedRequest, 'could not parse multipart body');
  }

  const bundle = await prepareBundle(form, env.DOCUMENTS);
  await commitBundle(env.DOCUMENTS, bundle);

  const assetBytes = bundle.assets.reduce((sum, asset) => sum + asset.bytes.length, 0);
  console.log(
    JSON.stringify({
      event: 'publish',
      documentId: bundle.id,
      markdownBytes: bundle.markdownBytes.length,
      assetCount: bundle.assets.length,
      assetBytes,
    }),
  );

  const body: PublishResponse = {
    id: bundle.id,
    url: `${env.VIEWER_BASE_URL}/${bundle.id}`,
  };
  return new Response(JSON.stringify(body), { status: 201, headers: JSON_HEADERS });
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/health' && request.method === 'GET') {
    // Deliberately does not touch R2 (baseline §47).
    return new Response('{"status":"ok"}', { status: 200, headers: JSON_HEADERS });
  }

  if (pathname === PUBLISH_PATH && request.method === 'POST') {
    return handlePublish(request, env);
  }

  // Stateless remote MCP endpoint (plan 002): POST-only, same Bearer auth.
  if (pathname === '/api/mcp') {
    return handleMcp(request, env);
  }

  return errorJson(ErrorCode.MalformedRequest, 'not found');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      if (error instanceof PublishError) {
        return errorJson(error.code, error.message);
      }
      console.error(
        JSON.stringify({
          event: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return errorJson(ErrorCode.InternalError, 'internal error');
    }
  },
} satisfies ExportedHandler<Env>;
