import { escapeHtml } from './escape.js';
import { PAGE_CSS } from './styles.js';

export interface PageInput {
  title: string;
  tocHtml: string;
  contentHtml: string;
}

/**
 * Wraps rendered Markdown in the page shell (baseline §29): lightweight,
 * static, no JS, CSS inlined so the page completes in a single request.
 * The banner links to `/` so self-hosted instances point at their own home.
 */
export function renderHtmlPage({ title, tocHtml, contentHtml }: PageInput): string {
  const safeTitle = escapeHtml(title);
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
<body>
<header class="mote-banner"><div class="mote-banner-inner">
<a class="mote-brand" href="/"><span class="mote-brand-dot" aria-hidden="true"></span>mote</a>
<span class="mote-doc-title">${safeTitle}</span>
</div></header>
<main>
<article>
${tocHtml}${contentHtml}</article>
</main>
<footer class="mote-colophon"><div class="mote-colophon-inner">
<span>Published with <a href="/">Mote</a></span>
</div></footer>
</body>
</html>
`;
}
