import { isAssetId, isDocumentId } from '@mote/core';
import { isDocumentManifest, type DocumentManifest } from '@mote/protocol';
import { documentSecurityHeaders, render } from '@mote/renderer';

export interface Env {
  DOCUMENTS: R2Bucket;
}

/**
 * Cache headers (baseline §35): browsers revalidate documents after 5 min
 * while the edge keeps them for a year; assets are immutable everywhere.
 */
const DOCUMENT_CACHE_HEADERS: Record<string, string> = {
  'Cache-Control': 'public, max-age=300',
  'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000',
};

const ASSET_CACHE_HEADERS: Record<string, string> = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000',
};

const NOT_FOUND_HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

/**
 * Uniform 404 (baseline §24): malformed IDs, unknown IDs, unknown routes,
 * and unsupported methods all return the exact same response so nothing
 * enumerable leaks.
 */
function notFound(): Response {
  return new Response('404 Not Found', { status: 404, headers: NOT_FOUND_HEADERS });
}

function internalError(): Response {
  return new Response('500 Internal Server Error', {
    status: 500,
    headers: NOT_FOUND_HEADERS,
  });
}

function documentHeaders(): Record<string, string> {
  return { ...documentSecurityHeaders(), ...DOCUMENT_CACHE_HEADERS };
}

function assetHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    ...ASSET_CACHE_HEADERS,
  };
}

const MANIFEST_KEY = (id: string) => `documents/${id}/manifest.json`;
const DOCUMENT_KEY = (id: string) => `documents/${id}/document.md`;
const ASSET_KEY = (id: string, assetId: string) => `documents/${id}/assets/${assetId}`;

/**
 * Reads and validates the manifest, the document commit marker
 * (baseline §54): a document exists if and only if its manifest exists
 * and is well-formed.
 */
async function readManifest(env: Env, id: string): Promise<DocumentManifest | null> {
  const object = await env.DOCUMENTS.get(MANIFEST_KEY(id));
  if (object === null) return null;

  let value: unknown;
  try {
    // text() + JSON.parse instead of object.json(): keeps the viewer free of
    // R2ObjectBody.json() which some local R2 implementations do not type.
    value = JSON.parse(await object.text());
  } catch {
    return null;
  }
  if (!isDocumentManifest(value)) {
    console.error(JSON.stringify({ event: 'invalid_manifest', documentId: id }));
    return null;
  }
  return value;
}

async function handleDocument(env: Env, id: string, method: string): Promise<Response> {
  const manifest = await readManifest(env, id);
  if (manifest === null) return notFound();

  // HEAD answers with the document headers only; no render, no R2 re-read.
  if (method === 'HEAD') {
    return new Response(null, { status: 200, headers: documentHeaders() });
  }

  const object = await env.DOCUMENTS.get(DOCUMENT_KEY(id));
  if (object === null) {
    // Manifest exists but the Markdown is gone: a broken bundle.
    console.error(JSON.stringify({ event: 'missing_document_md', documentId: id }));
    return notFound();
  }

  const markdown = await object.text();
  const html = render(markdown, manifest, id);

  console.log(
    JSON.stringify({
      event: 'render',
      documentId: id,
      markdownBytes: markdown.length,
      assetCount: manifest.assets.length,
    }),
  );

  return new Response(html, { status: 200, headers: documentHeaders() });
}

async function handleAsset(
  env: Env,
  id: string,
  assetId: string,
  method: string,
): Promise<Response> {
  // The manifest is the commit marker (§54): assets of an unpublished or
  // broken bundle are not served, even if their bytes exist in R2.
  const manifest = await readManifest(env, id);
  if (manifest === null) return notFound();

  const asset = manifest.assets.find((entry) => entry.id === assetId);
  if (!asset) return notFound();

  if (method === 'HEAD') {
    const head = await env.DOCUMENTS.head(ASSET_KEY(id, assetId));
    if (head === null) return notFound();
    return new Response(null, { status: 200, headers: assetHeaders(asset.contentType) });
  }

  const object = await env.DOCUMENTS.get(ASSET_KEY(id, assetId));
  if (object === null) return notFound();

  return new Response(object.body, { status: 200, headers: assetHeaders(asset.contentType) });
}

function route(
  pathname: string,
): { kind: 'document'; id: string } | { kind: 'asset'; id: string; assetId: string } | null {
  const segments = pathname.split('/').filter((segment) => segment !== '');

  if (segments.length === 1 && isDocumentId(segments[0])) {
    return { kind: 'document', id: segments[0] };
  }
  if (
    segments.length === 3 &&
    segments[1] === 'a' &&
    isDocumentId(segments[0]) &&
    isAssetId(segments[2])
  ) {
    return { kind: 'asset', id: segments[0], assetId: segments[2] };
  }
  return null;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const method = request.method.toUpperCase();
  const { pathname } = new URL(request.url);

  if (method !== 'GET' && method !== 'HEAD') return notFound();

  if (pathname === '/health') {
    // Deliberately does not touch R2 (baseline §47).
    return new Response('{"status":"ok"}', {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  if (pathname === '/robots.txt') {
    // Not an access control mechanism, just polite no-index (baseline §34).
    return new Response('User-agent: *\nDisallow: /\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const target = route(pathname);
  if (target === null) return notFound();

  return target.kind === 'document'
    ? handleDocument(env, target.id, method)
    : handleAsset(env, target.id, target.assetId, method);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return internalError();
    }
  },
} satisfies ExportedHandler<Env>;
