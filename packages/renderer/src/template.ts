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
    '<svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const tocTrigger =
    tocHtml === ''
      ? ''
      : `<a class="toc-trigger" href="#mote-toc" aria-controls="mote-toc" aria-label="目录 / Open table of contents">${tocIcon}<span>目录 / Contents</span></a>`;
  const tocDrawer =
    tocHtml === ''
      ? ''
      : `<aside class="toc-drawer" id="mote-toc" aria-label="目录 / Table of contents" tabindex="-1">
<div class="toc-drawer-head"><span class="toc-title">目录 / Contents</span><a class="toc-close" href="#!" tabindex="0" aria-label="关闭目录 / Close table of contents">×</a></div>
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
<a class="mote-brand" href="/"><span class="mote-brand-dot" aria-hidden="true"></span>mote</a>
${tocTrigger}</div></header>
<main>
<article>
${contentHtml}</article>
</main>
<footer class="mote-colophon"><div class="mote-colophon-inner">
<span class="mote-colophon-mark" aria-hidden="true"></span><span>Published with <a href="/">Mote</a></span>
</div></footer>
${tocHtml === '' ? '' : `<script>${TOC_SCRIPT}</script>`}
</body>
</html>
`;
}
