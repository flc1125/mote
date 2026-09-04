import { PUBLISH_PATH, type ErrorResponse } from '@mote/protocol';

import type { Bundle } from './bundle.js';
import { CliError } from './errors.js';

export interface PublishResponse {
  id: string;
  url: string;
}

export interface PublishClientOptions {
  apiUrl: string;
  token: string;
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
  const url = `${options.apiUrl}${PUBLISH_PATH}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.token}` },
      body: form,
    });
  } catch (error) {
    throw new CliError(
      `network error while publishing to ${options.apiUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (response.status !== 201) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as ErrorResponse;
      detail = `${body.error.code}: ${body.error.message}`;
    } catch {
      // Non-JSON error body; keep the HTTP status.
    }
    throw new CliError(`publish failed: ${detail}`);
  }

  return (await response.json()) as PublishResponse;
}
