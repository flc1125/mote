import {
  ERROR_HTTP_STATUS,
  ErrorCode,
  errorResponse,
  PUBLISH_PATH,
  type PublishResponse,
} from '@mote/protocol';

import { authenticate, type AuthConfig } from './auth.js';
import { handleMcp } from './mcp.js';
import { commitBundle, isDefinitelyTooLarge, prepareBundle, PublishError } from './publish.js';

// Shared with Node-hosted CLI/MCP integration adapters. Keep generated Worker
// globals out of their type graph (notably NodeJS.ProcessEnv augmentation).
export interface Env extends AuthConfig {
  DOCUMENTS: Parameters<typeof prepareBundle>[1];
  VIEWER_BASE_URL: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function errorJson(code: ErrorCode, message: string): Response {
  return new Response(JSON.stringify(errorResponse(code, message)), {
    status: ERROR_HTTP_STATUS[code],
    headers: JSON_HEADERS,
  });
}

async function handlePublish(request: Request, env: Env): Promise<Response> {
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

async function handleRequest(
  request: Request,
  env: Env,
  verify: typeof authenticate,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/health' && request.method === 'GET') {
    // Deliberately does not touch R2 (baseline §47).
    return new Response('{"status":"ok"}', { status: 200, headers: JSON_HEADERS });
  }

  if (pathname !== PUBLISH_PATH && pathname !== '/api/mcp' && pathname !== '/api/auth/session') {
    return errorJson(ErrorCode.MalformedRequest, 'not found');
  }

  // One trust boundary for all protected routes, before body parsing or R2 access.
  const publisher = await verify(request, env);
  if (!publisher) return errorJson(ErrorCode.Unauthorized, 'missing or invalid credentials');

  if (pathname === '/api/auth/session') {
    if (request.method !== 'GET') {
      return new Response(null, { status: 405, headers: { ...JSON_HEADERS, Allow: 'GET' } });
    }
    return new Response(JSON.stringify({ authenticated: true, publisher }), {
      headers: JSON_HEADERS,
    });
  }

  if (pathname === PUBLISH_PATH && request.method === 'POST') {
    return handlePublish(request, env);
  }

  // Stateless remote MCP endpoint (plan 002), protected by the same boundary.
  if (pathname === '/api/mcp') {
    return handleMcp(request, env);
  }

  return errorJson(ErrorCode.MalformedRequest, 'not found');
}

export function createApiWorker(verify = authenticate) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      try {
        return await handleRequest(request, env, verify);
      } catch (error) {
        if (error instanceof PublishError) {
          return errorJson(error.code, error.message);
        }
        console.error(
          JSON.stringify({
            event: 'error',
          }),
        );
        return errorJson(ErrorCode.InternalError, 'internal error');
      }
    },
  } satisfies ExportedHandler<Env>;
}

export default createApiWorker();
