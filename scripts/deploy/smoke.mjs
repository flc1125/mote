import { Buffer } from 'node:buffer';
import { setTimeout as pause } from 'node:timers/promises';
import { sha256, targetFor, targets } from './lib.mjs';
import { DeployError, isDigest, requireThat } from './policy.mjs';

export const documentId = (value) =>
  typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{16}$/.test(value);
export const assetId = (value) =>
  typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{12}$/.test(value);
export const fixtureMarker = 'Mote deployment smoke v1';

export function sampleFrom(env) {
  requireThat(documentId(env.MOTE_SMOKE_DOCUMENT_ID), 'MISSING_PUBLIC_DOCUMENT_SAMPLE');
  requireThat(
    assetId(env.MOTE_SMOKE_ASSET_ID) && isDigest(env.MOTE_SMOKE_ASSET_SHA256),
    'MISSING_PUBLIC_ASSET_SAMPLE',
  );
  return {
    document: env.MOTE_SMOKE_DOCUMENT_ID,
    asset: env.MOTE_SMOKE_ASSET_ID,
    digest: env.MOTE_SMOKE_ASSET_SHA256,
  };
}

export async function boundedFetch(
  url,
  options = {},
  fetchImpl = globalThis.fetch,
  maxBytes = 2 * 1024 * 1024,
) {
  const response = await fetchImpl(url, {
    ...options,
    redirect: 'manual',
    signal: globalThis.AbortSignal.timeout(15000),
  });
  const reader = response.body?.getReader();
  const chunks = [];
  let size = 0;
  try {
    if (reader)
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        requireThat(size <= maxBytes, 'RESPONSE_TOO_LARGE');
        chunks.push(chunk.value);
      }
  } finally {
    await reader?.cancel();
  }
  const bytes = Buffer.concat(chunks);
  return {
    status: response.status,
    headers: response.headers,
    bytes,
    text: bytes.toString('utf8'),
  };
}

export async function readRetry(operation, wait = pause) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === 2) throw error;
      await wait(250 * (attempt + 1));
    }
  }
}

export function robotsDisallowAll(text) {
  const groups = [];
  let group = { agents: [], rules: [] };
  for (const line of text.split(/\r?\n/)) {
    const match = line
      .replace(/#.*/, '')
      .trim()
      .match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'user-agent') {
      if (group.rules.length) {
        groups.push(group);
        group = { agents: [], rules: [] };
      }
      group.agents.push(value);
    } else group.rules.push({ key, value });
  }
  groups.push(group);
  const rules = groups.filter((item) => item.agents.includes('*')).flatMap((item) => item.rules);
  return (
    rules.some((rule) => rule.key === 'disallow' && rule.value === '/') &&
    !rules.some((rule) => rule.key === 'allow' && rule.value !== '')
  );
}

function safeHeaders(result, document) {
  requireThat(result.headers.get('x-content-type-options') === 'nosniff', 'SMOKE_NOSNIFF');
  requireThat(/noindex/.test(result.headers.get('x-robots-tag') ?? ''), 'SMOKE_NOINDEX');
  // Cloudflare may consume its CDN-only header before returning the response.
  // Edge TTL is tested at Worker level, not inferred from downstream headers.
  const cache = (result.headers.get('cache-control') ?? '').split(',').map((part) => part.trim());
  requireThat(
    cache.includes('public') &&
      cache.includes(document ? 'max-age=300' : 'max-age=31536000') &&
      (document || cache.includes('immutable')),
    'SMOKE_BROWSER_CACHE',
  );
  if (document) {
    const csp = (result.headers.get('content-security-policy') ?? '')
      .split(';')
      .map((part) => part.trim());
    requireThat(
      csp.includes("script-src 'none'") &&
        csp.includes("default-src 'none'") &&
        csp.includes("frame-ancestors 'none'"),
      'SMOKE_CSP',
    );
    requireThat(result.headers.get('referrer-policy') === 'no-referrer', 'SMOKE_REFERRER');
  }
}

export async function checkDocument(
  environment,
  sample,
  fetchImpl = globalThis.fetch,
  marker = fixtureMarker,
) {
  requireThat(
    documentId(sample.document) && assetId(sample.asset) && isDigest(sample.digest),
    'INVALID_SMOKE_SAMPLE',
  );
  const origin = `https://${targetFor(environment).hostname}`;
  const page = await boundedFetch(`${origin}/${sample.document}`, {}, fetchImpl);
  requireThat(
    page.status === 200 &&
      page.headers.get('content-type')?.includes('text/html') &&
      page.text.includes(marker),
    'SMOKE_DOCUMENT',
  );
  requireThat(page.text.includes(`/${sample.document}/a/${sample.asset}`), 'SMOKE_ASSET_LINK');
  safeHeaders(page, true);
  const image = await boundedFetch(`${origin}/${sample.document}/a/${sample.asset}`, {}, fetchImpl);
  requireThat(
    image.status === 200 &&
      image.headers.get('content-type')?.startsWith('image/') &&
      sha256(image.bytes) === sample.digest,
    'SMOKE_ASSET',
  );
  safeHeaders(image, false);
}

export async function readSmoke(environment, sample, fetchImpl = globalThis.fetch) {
  const origin = `https://${targetFor(environment).hostname}`;
  const checks = [];
  let active = 'viewer-health';
  const get = (path) => readRetry(() => boundedFetch(origin + path, {}, fetchImpl));
  try {
    for (const path of ['/health', '/api/health']) {
      active = path === '/health' ? 'viewer-health' : 'api-health';
      const response = await get(path);
      requireThat(
        response.status === 200 && JSON.parse(response.text).status === 'ok',
        'SMOKE_HEALTH',
      );
      checks.push({ name: active, state: 'success' });
    }
    active = 'anonymous-rejected';
    // No writable multipart body and no credentials. Never retry this POST.
    const denied = await boundedFetch(
      `${origin}/api/v1/publish`,
      { method: 'POST', body: 'invalid-smoke-body' },
      fetchImpl,
    );
    requireThat(
      denied.status === 401 && denied.headers.has('www-authenticate'),
      'SMOKE_ANONYMOUS_WRITE',
    );
    checks.push({ name: 'anonymous-rejected', state: 'success' });
    active = 'access-discovery';
    const discovery = await get('/.well-known/cloudflare-access-protected-resource/api/mcp');
    requireThat(discovery.status === 200, 'SMOKE_DISCOVERY');
    const metadata = JSON.parse(discovery.text);
    requireThat(
      metadata.resource === `${origin}/api/mcp` &&
        metadata.authorization_servers?.includes(targets.issuer),
      'SMOKE_DISCOVERY',
    );
    checks.push({ name: 'access-discovery', state: 'success' });
    active = 'robots';
    const robots = await get('/robots.txt');
    requireThat(robots.status === 200 && robotsDisallowAll(robots.text), 'SMOKE_ROBOTS');
    checks.push({ name: 'robots', state: 'success' });
    active = 'public-document-and-image';
    await readRetry(() => checkDocument(environment, sample, fetchImpl));
    checks.push({ name: 'public-document-and-image', state: 'success' });
    return checks;
  } catch (error) {
    const failure = error instanceof DeployError ? error : new DeployError('SMOKE_REQUEST_FAILED');
    failure.checks = [...checks, { name: active, state: 'failed' }];
    throw failure;
  }
}
