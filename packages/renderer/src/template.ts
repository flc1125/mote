import { escapeHtml } from './escape.js';
import { PAGE_CSS } from './styles.js';
import { TOC_SCRIPT } from './toc-script.js';
import { IMAGE_SCRIPT } from './image-script.js';
import { COPY_SCRIPT } from './copy-script.js';
import { FOOTNOTE_SCRIPT } from './footnote-script.js';
import { THEME_SCRIPT } from './theme-script.js';
import { PAGE_SCRIPT } from './page-script.js';
import { encodeMarkdownSource } from './markdown-source.js';

export interface PageInput {
  title: string;
  tocHtml: string;
  contentHtml: string;
  codeCopy?: boolean;
  markdown?: string;
}

/** Static document content with a responsive, progressively enhanced outline. */
export function renderHtmlPage({
  title,
  tocHtml,
  contentHtml,
  codeCopy = false,
  markdown,
}: PageInput): string {
  const safeTitle = escapeHtml(title);
  const tocIcon =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><g fill="currentColor"><circle cx="4" cy="6" r="1.3"/><circle cx="4" cy="12" r="1.3"/><circle cx="4" cy="18" r="1.3"/></g></svg>';
  const closeIcon =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  // Theme menu icons follow the standalone-button spec: 18px, viewBox 24,
  // stroke 1.8. The button shows the current state; the script reveals it.
  const themeShapes: Record<string, string> = {
    auto: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
    light:
      '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.3 4.3l1.4 1.4M18.3 18.3l1.4 1.4M2.5 12h2M19.5 12h2M4.3 19.7l1.4-1.4M18.3 5.7l1.4-1.4"/>',
    dark: '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a7 7 0 0 0 10 10z"/>',
  };
  const themeIcon = (name: string, item: boolean, hidden: boolean) =>
    `<svg class="theme-icon${item ? ' theme-item-icon' : ''} theme-icon-${name}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${hidden ? ' hidden' : ''}>${themeShapes[name]}</svg>`;
  const themeItem = (value: string, label: string, checked: boolean) =>
    `<button type="button" role="menuitemradio" aria-checked="${checked}" data-theme-value="${value}">${themeIcon(value, true, false)}${label}</button>`;
  const themeToggle = `<span class="theme-menu"><button type="button" class="theme-toggle" aria-haspopup="menu" aria-expanded="false" aria-label="Theme: Auto" title="Theme: Auto" hidden>${themeIcon('auto', false, false)}${themeIcon('light', false, true)}${themeIcon('dark', false, true)}<svg class="theme-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 10 6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="theme-menu-list" role="menu" aria-label="Theme" hidden>${themeItem('auto', 'Auto', true)}${themeItem('light', 'Light', false)}${themeItem('dark', 'Dark', false)}</span></span>`;
  const linkIcon =
    '<svg class="page-icon-link" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  const checkIcon =
    '<svg class="page-icon-copied" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  const pageCopy = `<button type="button" class="page-copy" aria-label="Copy page link" title="Copy page link" hidden>${linkIcon}${checkIcon}</button>`;
  const markdownCopy =
    markdown === undefined
      ? ''
      : `<span class="markdown-tools"><button type="button" class="markdown-copy" aria-label="Copy Markdown source" hidden><svg class="markdown-copy-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17V7l4 5 4-5v10M18 7v10m-3-3 3 3 3-3"/></svg>${checkIcon}</button><span class="markdown-copy-hint" aria-hidden="true">Copy Markdown source</span><span class="markdown-copy-status" role="status" aria-live="polite"></span></span>`;
  const markdownSource =
    markdown === undefined
      ? ''
      : `<input type="hidden" class="markdown-source" value="${encodeMarkdownSource(markdown)}">
<dialog class="markdown-source-dialog" aria-label="Markdown source"><div class="markdown-source-heading"><h2>Markdown source</h2><button type="button" class="markdown-source-close" aria-label="Close Markdown source">${closeIcon}</button></div><p>Automatic copying is unavailable. Select the source below and copy it manually.</p><textarea class="markdown-source-text" aria-label="Markdown source text" readonly spellcheck="false"></textarea></dialog>`;
  const toTop = `<button type="button" class="to-top" aria-label="Back to top" title="Back to top" hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>`;
  const tocTrigger =
    tocHtml === ''
      ? ''
      : `<a class="toc-trigger" href="#mote-toc" aria-controls="mote-toc" aria-label="Open table of contents" title="Show contents">${tocIcon}</a>`;
  const tocDrawer =
    tocHtml === ''
      ? ''
      : `<aside class="toc-drawer" id="mote-toc" aria-label="Table of contents" tabindex="-1">
<div class="toc-drawer-head"><span class="toc-title">Contents</span><a class="toc-close" href="#!" tabindex="0" aria-label="Close table of contents" title="Hide contents">${closeIcon}</a></div>
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
<script>${THEME_SCRIPT}</script>
</head>
<body${tocHtml === '' ? '' : ' class="has-toc"'}>
${tocDrawer}<header class="mote-banner"><div class="mote-banner-inner">
<a class="mote-brand" href="/" target="_blank" rel="noopener noreferrer"><span class="mote-brand-dot" aria-hidden="true"></span>mote</a>
<span class="banner-spacer"></span><div class="banner-actions">${pageCopy}${markdownCopy}${themeToggle}${tocTrigger}</div></div></header>
<main>
<article>
${contentHtml}</article>
</main>
<footer class="mote-colophon"><div class="mote-colophon-inner">
<span class="mote-colophon-mark" aria-hidden="true"></span><span>Published with <a href="/" target="_blank" rel="noopener noreferrer">Mote</a></span>
</div></footer>
${tocHtml !== '' || contentHtml.includes('<details') || contentHtml.includes('class="content-tabs"') ? `<script>${TOC_SCRIPT}</script>` : ''}
${codeCopy ? `<script>${COPY_SCRIPT}</script>` : ''}
${contentHtml.includes('<img ') ? `<script>${IMAGE_SCRIPT}</script>` : ''}
${contentHtml.includes('class="footnote-ref"') ? `<script>${FOOTNOTE_SCRIPT}</script>` : ''}
${toTop}
${markdownSource}
<script>${PAGE_SCRIPT}</script>
</body>
</html>
`;
}
