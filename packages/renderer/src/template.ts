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
 */
export function renderHtmlPage({ title, tocHtml, contentHtml }: PageInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${PAGE_CSS}</style>
</head>
<body>
<main>
<article>
${tocHtml}${contentHtml}</article>
</main>
</body>
</html>
`;
}
