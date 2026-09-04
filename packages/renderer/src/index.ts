import { isDocumentId } from '@mote/core';
import type { DocumentManifest } from '@mote/protocol';

import { buildAssetUrlMap } from './assets.js';
import { renderMarkdown } from './markdown.js';
import { renderHtmlPage } from './template.js';
import { renderToc } from './toc.js';

/**
 * Renders a document bundle into a complete HTML page.
 * Pure and deterministic (baseline §42): same input, same output.
 */
export function render(markdown: string, manifest: DocumentManifest, documentId: string): string {
  if (!isDocumentId(documentId)) {
    throw new Error(`Invalid document ID: ${JSON.stringify(documentId)}`);
  }

  const assetUrls = buildAssetUrlMap(manifest, documentId);
  const { html, headings } = renderMarkdown(markdown, assetUrls);
  const title = headings.find((heading) => heading.level === 1)?.text ?? manifest.source.name;

  return renderHtmlPage({ title, tocHtml: renderToc(headings), contentHtml: html });
}

export * from './assets.js';
export * from './escape.js';
export * from './headers.js';
export * from './headings.js';
export * from './markdown.js';
export * from './styles.js';
export * from './template.js';
export * from './toc.js';
