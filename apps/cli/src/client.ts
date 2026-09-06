import { PUBLISH_PATH } from '@mote/protocol';

import type { Bundle } from './bundle.js';
import { CliError } from './errors.js';
import { apiOrigin } from './auth/urls.js';

export interface PublishResponse {
  id: string;
  url: string;
}

export interface PublishClientOptions {
  apiUrl: string;
  token?: string;
  headers?: Record<string, string>;
  authMode?: 'token' | 'oauth' | 'service';
  /** fetch override, for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Uploads the bundle to the publish API (baseline §15–§17). The token is
 * sent only in the Authorization header — never in the URL, body, logs, or
 * error messages (baseline §21).
 */
export async function publishBundle(
  options: PublishClientOptions,
  bundle: Bundle,
): Promise<PublishResponse> {
  const form = new FormData();
  form.append(
    'document',
    new File([bundle.markdownBytes as Uint8Array<ArrayBuffer>], bundle.entryName, {
      type: 'text/markdown',
    }),
  );
  form.append('manifest', JSON.stringify(bundle.manifest));
  for (const asset of bundle.assets) {
    form.append(
      asset.field,
      new File([asset.bytes as Uint8Array<ArrayBuffer>], asset.field, {
        type: asset.contentType,
      }),
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const api = apiOrigin(
    options.apiUrl,
    options.authMode === 'oauth' || options.authMode === 'service',
  );
  const url = `${api}${PUBLISH_PATH}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: options.headers ?? { Authorization: `Bearer ${options.token ?? ''}` },
      body: form,
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new CliError('network error while publishing; outcome unknown, upload was not retried');
  }

  if (response.status !== 201) {
    // Never echo untrusted server errors that may reflect authentication headers.
    if (response.status === 401)
      throw new CliError(
        options.authMode === 'oauth'
          ? 'UNAUTHORIZED: run mote auth login; upload was not retried'
          : 'UNAUTHORIZED: check the configured publishing credentials',
      );
    throw new CliError(`publish failed: HTTP ${response.status}; upload was not retried`);
  }

  try {
    const result = (await response.json()) as PublishResponse;
    const url = new URL(result.url);
    if (
      !/^[A-Za-z0-9_-]{16}$/.test(result.id) ||
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return { id: result.id, url: result.url };
  } catch {
    throw new CliError('invalid publish response; outcome unknown, upload was not retried');
  }
}
