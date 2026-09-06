import { CliError } from '../errors.js';

export function apiOrigin(input: string, httpsOnly = false): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CliError('invalid API URL');
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      (httpsOnly ||
        url.protocol !== 'http:' ||
        !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)))
  ) {
    throw new CliError(
      'API must be an HTTPS origin (HTTP loopback is allowed only for static token development)',
    );
  }
  return url.origin;
}

export function trustedIssuer(input: string): string {
  const origin = apiOrigin(input, true);
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(origin)) {
    throw new CliError('OAuth issuer must be a Cloudflare Access team origin');
  }
  return origin;
}

export function sameOriginEndpoint(input: unknown, origin: string): string {
  if (typeof input !== 'string') throw new CliError('missing OAuth endpoint');
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CliError('invalid OAuth endpoint');
  }
  if (url.origin !== origin || url.username || url.password || url.hash || url.search) {
    throw new CliError('OAuth endpoint origin mismatch');
  }
  return url.href;
}
