import { Buffer } from 'node:buffer';
import { setTimeout as pause } from 'node:timers/promises';
import { requireThat } from './policy.mjs';

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
