/** Publish endpoint contract (baseline §15–§17). */

/**
 * The API Worker is attached to the route mote.flc.io/api/* (most specific
 * route wins over the Viewer's mote.flc.io/*), so the publish path carries
 * the /api prefix. There is no api subdomain.
 */
export const PUBLISH_PATH = '/api/v1/publish';

/** Multipart field names in the publish request (baseline §16). */
export const FIELD_DOCUMENT = 'document';
export const FIELD_MANIFEST = 'manifest';
export const ASSET_FIELD_PREFIX = 'asset_';

export function assetFieldName(index: number): string {
  return `${ASSET_FIELD_PREFIX}${index}`;
}

/** Parses "asset_12" -> 12. Returns null for any other field name. */
export function parseAssetFieldIndex(field: string): number | null {
  if (!field.startsWith(ASSET_FIELD_PREFIX)) return null;
  const rest = field.slice(ASSET_FIELD_PREFIX.length);
  if (!/^\d+$/.test(rest)) return null;
  return Number.parseInt(rest, 10);
}

/** 201 Created response body (baseline §17). */
export interface PublishResponse {
  id: string;
  url: string;
}
