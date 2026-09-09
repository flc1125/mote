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
body { min-height: 100vh; min-height: 100svh; box-sizing: border-box; margin: 0; padding: 32px 24px calc(32px + 10svh); display: grid; place-items: center; }
.card { width: min(440px, 100%); min-width: 0; text-align: center; }
.brand { display: inline-flex; align-items: center; gap: 9px; margin: 0 0 40px; font-size: 18px; font-weight: 650; letter-spacing: -0.02em; }
.brand svg { display: block; width: 28px; height: auto; }
.badge { display: grid; place-items: center; box-sizing: border-box; width: 64px; height: 64px; margin: 0 auto 24px; border-radius: 50%; }
.badge svg { width: 34px; height: 34px; }
.badge-success { background: #eaf8ef; border: 1px solid #bce3ca; color: #217344; }
.badge-error { background: var(--mote-tint); border: 1px solid var(--mote-tint-border); color: var(--mote-accent); }
h1 { font-size: 28px; line-height: 1.25; letter-spacing: -0.025em; margin: 0 0 16px; text-wrap: balance; }
.detail { color: var(--mote-muted); font-size: 16px; margin: 0 0 12px; }
.lead { font-size: 16px; margin: 0; text-wrap: pretty; }
.lead code { padding: 2px 5px; border-radius: 5px; background: var(--mote-code-bg); font-size: 0.9em; white-space: nowrap; }
.hint { color: var(--mote-muted); font-size: 14px; margin: 20px 0 0; }
.home-link { margin: 24px 0 0; font-size: 14px; }
.home-link a { display: inline-block; padding: 6px 4px; text-decoration: underline; text-underline-offset: 4px; }
@media (prefers-color-scheme: dark) {
  .badge-success { background: #122f22; border-color: #28583c; color: #7bdba0; }
}
@media (max-height: 500px) {
  body { padding: 24px; }
  .brand { margin-bottom: 24px; }
}
`;

interface CallbackPageInput {
  title: string;
  heading: string;
  detail?: string;
  lead: string;
  hint: string;
  tone: 'success' | 'error';
}

function callbackPage({ title, heading, detail, lead, hint, tone }: CallbackPageInput): string {
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
<span class="brand"><span aria-hidden="true">${ICON_SVG}</span><span>Mote</span></span>
<span class="badge badge-${tone}">${tone === 'success' ? CHECK_SVG : CROSS_SVG}</span>
<h1>${heading}</h1>
${detail ? `<p class="detail">${detail}</p>` : ''}
<p class="lead">${lead}</p>
<p class="hint">${hint}</p>
<p class="home-link"><a href="https://mote.pub/" target="_blank" rel="noopener noreferrer" aria-label="Visit Mote homepage (opens in a new tab)">Visit Mote homepage</a></p>
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
  heading: 'Authorization not completed.',
  lead: 'Return to the terminal and run <code>mote login</code> again.',
  hint: 'You can close this tab.',
  tone: 'error',
});

export const CALLBACK_INVALID_HTML = callbackPage({
  title: 'Unable to verify sign-in · Mote',
  heading: 'Unable to verify sign-in.',
  detail: 'This link does not match an in-progress sign-in.',
  lead: 'Return to the terminal and run <code>mote login</code> again.',
  hint: 'You can close this tab.',
  tone: 'error',
});

export const CALLBACK_MISSING_CODE_HTML = callbackPage({
  title: 'Missing authorization code · Mote',
  heading: 'Missing authorization code.',
  lead: 'Return to the terminal and run <code>mote login</code> again.',
  hint: 'You can close this tab.',
  tone: 'error',
});
