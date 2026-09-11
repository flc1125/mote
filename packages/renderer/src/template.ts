import { escapeHtml } from './escape.js';
import { PAGE_CSS } from './styles.js';
import { TOC_SCRIPT } from './toc-script.js';

export interface PageInput {
  title: string;
  tocHtml: string;
  contentHtml: string;
}

/** Static document content with a responsive, progressively enhanced outline. */
export function renderHtmlPage({ title, tocHtml, contentHtml }: PageInput): string {
  const safeTitle = escapeHtml(title);
  const tocIcon =
    '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M7 4.5h8M7 9h8M7 13.5h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><g fill="currentColor"><circle cx="3" cy="4.5" r="1"/><circle cx="3" cy="9" r="1"/><circle cx="3" cy="13.5" r="1"/></g></svg>';
  const tocTrigger =
    tocHtml === ''
      ? ''
      : `<a class="toc-trigger" href="#mote-toc" aria-controls="mote-toc" aria-label="Open table of contents" title="Show contents">${tocIcon}</a>`;
  const tocDrawer =
    tocHtml === ''
      ? ''
      : `<aside class="toc-drawer" id="mote-toc" aria-label="Table of contents" tabindex="-1">
<div class="toc-drawer-head"><span class="toc-title">Contents</span><a class="toc-close" href="#!" tabindex="0" aria-label="Close table of contents" title="Hide contents">×</a></div>
${tocHtml}</aside>
<a class="toc-scrim" href="#!" aria-hidden="true" tabindex="-1"></a>
`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${safeTitle}</title>
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${PAGE_CSS}</style>
</head>
<body${tocHtml === '' ? '' : ' class="has-toc"'}>
${tocDrawer}<header class="mote-banner"><div class="mote-banner-inner">
<a class="mote-brand" href="/" target="_blank" rel="noopener noreferrer"><span class="mote-brand-dot" aria-hidden="true"></span>mote</a>
${tocTrigger}</div></header>
<main>
<article>
${contentHtml}</article>
</main>
<footer class="mote-colophon"><div class="mote-colophon-inner">
<span class="mote-colophon-mark" aria-hidden="true"></span><span>Published with <a href="/" target="_blank" rel="noopener noreferrer">Mote</a></span>
</div></footer>
${tocHtml === '' ? '' : `<script>${TOC_SCRIPT}</script>`}
</body>
</html>
`;
}
