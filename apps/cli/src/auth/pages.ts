import { BASE_CSS, ICON_SVG, TOKENS_CSS } from '@mote/theme';

/**
 * Branded pages for the loopback OAuth callback (mote login). They are
 * fully static: no request parameter (state, code, error) is ever echoed
 * into the markup, so no escaping concerns and no information disclosure.
 * Everything is inlined — the listener runs on 127.0.0.1 and cannot load
 * external assets.
 */

const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 12.5l3.2 3.2L17 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CROSS_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const PAGE_CSS = `
body { min-height: 100vh; box-sizing: border-box; margin: 0; padding: 24px; display: grid; place-items: center; }
.card { max-width: 400px; text-align: center; }
.brand { display: block; width: 44px; margin: 0 auto 30px; }
.brand svg { display: block; width: 100%; height: auto; }
.badge { display: grid; place-items: center; width: 64px; height: 64px; margin: 0 auto 22px; border-radius: 50%; }
.badge svg { width: 34px; height: 34px; }
.badge-success { background: var(--mote-accent); color: var(--mote-on-accent); }
.badge-error { background: var(--mote-tint); border: 1px solid var(--mote-tint-border); color: var(--mote-accent); }
h1 { font-size: 24px; letter-spacing: -0.02em; margin: 0 0 10px; text-wrap: balance; }
.lead { font-size: 15px; margin: 0; }
.hint { color: var(--mote-muted); font-size: 13px; margin: 14px 0 0; }
`;

interface CallbackPageInput {
  title: string;
  heading: string;
  lead: string;
  hint: string;
  tone: 'success' | 'error';
}

function callbackPage({ title, heading, lead, hint, tone }: CallbackPageInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${title}</title>
<style>${TOKENS_CSS}${BASE_CSS}${PAGE_CSS}</style>
</head>
<body>
<main class="card">
<span class="brand">${ICON_SVG}</span>
<span class="badge badge-${tone}">${tone === 'success' ? CHECK_SVG : CROSS_SVG}</span>
<h1>${heading}</h1>
<p class="lead">${lead}</p>
<p class="hint">${hint}</p>
</main>
</body>
</html>
`;
}

export const CALLBACK_SUCCESS_HTML = callbackPage({
  title: 'Authorization received · Mote',
  heading: 'Authorization received.',
  lead: 'Return to the terminal to check the result.',
  hint: 'You can close this tab.',
  tone: 'success',
});

export const CALLBACK_DENIED_HTML = callbackPage({
  title: 'Authorization not completed · Mote',
  heading: 'Authorization was not completed.',
  lead: 'Return to the terminal to try again.',
  hint: 'You can close this tab.',
  tone: 'error',
});

export const CALLBACK_INVALID_HTML = callbackPage({
  title: 'Invalid callback · Mote',
  heading: 'Invalid callback.',
  lead: 'This link does not match an in-progress sign-in.',
  hint: 'Run mote login again from the terminal.',
  tone: 'error',
});

export const CALLBACK_MISSING_CODE_HTML = callbackPage({
  title: 'Missing authorization code · Mote',
  heading: 'Missing authorization code.',
  lead: 'The authorization response carried no code.',
  hint: 'Return to the terminal and try again.',
  tone: 'error',
});
