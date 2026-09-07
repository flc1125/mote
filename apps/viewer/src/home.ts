import { PAGE_CSS } from '@mote/renderer';

import { LOGO_SVG } from './brand.generated.js';

const REPO = 'https://github.com/flc1125/mote';
const DOCS = `${REPO}/blob/main/docs`;

// Static content only: never interpolate request data or published document IDs.
export const HOME_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="description" content="Mote — publish local Markdown as immutable, browser-readable pages.">
<title>Mote — Markdown in, URL out.</title>
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${PAGE_CSS}
:root { --mote-brand: #ef5552; --home-link: #c23c39; }
@media (prefers-color-scheme: dark) { :root { --home-link: #ff8582; } }
.home-header, .home-footer, .features { max-width: 1152px; margin: 0 auto; }
.home-header { display: flex; justify-content: space-between; align-items: center; padding: 30px 24px; }
.home-header svg { display: block; width: 164px; height: auto; }
.header-rule { border-bottom: 1px solid var(--mote-border); }
a { color: var(--home-link); text-decoration: underline; text-underline-offset: 4px; }
a:hover { text-decoration-thickness: 2px; }
a:focus-visible { outline: 2px solid var(--home-link); outline-offset: 6px; border-radius: 2px; }
.home-header a, .home-footer a { color: var(--mote-fg); }
.home-main { max-width: 792px; padding: 62px 24px 0; }
.hero h1 { font-size: clamp(42px, 7.3vw, 100px); line-height: 1.04; letter-spacing: -0.025em; font-weight: 700; border: 0; margin: 0 0 26px; padding: 0; }
.hero h1 span { color: var(--mote-brand); }
.hero p { font-size: 22px; margin-bottom: 28px; }
.hero nav { display: flex; gap: 40px; font-size: 20px; }
.quickstart { padding-top: 62px; scroll-margin-top: 24px; }
.quickstart h2 { border: 0; margin: 0 0 14px; padding: 0; font-size: 34px; letter-spacing: -0.03em; }
.quickstart pre { border: 1px solid var(--mote-border); padding: 18px; font-size: 16px; line-height: 1.65; margin-bottom: 14px; }
.quickstart p { color: var(--mote-muted); font-size: 15px; }
.features { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; padding: 48px 24px; }
.features h2 { font-size: 22px; border: 0; padding: 0; margin: 0 0 8px; }
.features p { font-size: 18px; color: var(--mote-muted); margin: 0; }
.home-footer { border-top: 1px solid var(--mote-border); display: flex; justify-content: space-between; gap: 24px; padding: 28px 0 36px; }
.home-footer nav { display: flex; flex-wrap: wrap; gap: 16px 30px; }
.footer-wrap { padding: 0 24px; }
@media (max-width: 640px) {
  .home-header { padding: 20px 24px; }
  .home-header svg { width: 120px; }
  .home-main { padding-top: 40px; }
  .hero p { font-size: 18px; }
  .hero nav { font-size: 18px; gap: 32px; }
  .quickstart { padding-top: 42px; }
  .quickstart h2 { font-size: 26px; }
  .features { grid-template-columns: repeat(2, 1fr); gap: 28px 20px; padding-top: 36px; }
  .features h2 { font-size: 20px; }
  .features p { font-size: 16px; }
  .home-footer { flex-direction: column; }
}
</style>
</head>
<body>
<div class="header-rule"><header class="home-header">
${LOGO_SVG}
<a href="${REPO}">GitHub</a>
</header></div>
<main class="home-main">
<section class="hero" aria-labelledby="intro">
<h1 id="intro">Markdown in.<br><span>URL out.</span></h1>
<p>Publish local Markdown as immutable, browser-readable pages.</p>
<nav aria-label="Get started"><a href="#quickstart">Get started</a><a href="${REPO}#readme">Read the docs</a></nav>
</section>
<section class="quickstart" id="quickstart" aria-labelledby="quickstart-title">
<h2 id="quickstart-title">From file to link.</h2>
<pre tabindex="0" role="region" aria-label="Quick start commands"><code>npm install -g mote-cli
mote login --api https://mote.example.com
mote README.md</code></pre>
<p>Log in to your Access-enabled Mote instance. Your instance is remembered for future publishes. For other authentication modes, see the <a href="${DOCS}/authentication.md">authentication guide</a>.</p>
</section>
</main>
<section class="features" aria-label="Features">
<div><h2>Immutable</h2><p>Every publish is a new page.</p></div>
<div><h2>Capability URLs</h2><p>Share the link, share access.</p></div>
<div><h2>Fast</h2><p>Served from the edge.</p></div>
<div><h2>No JavaScript</h2><p>Just the document.</p></div>
</section>
<div class="footer-wrap"><footer class="home-footer">
<nav aria-label="Documentation">
<a href="${DOCS}/self-hosting.md">Self-hosting</a>
<a href="${DOCS}/architecture.md">Architecture</a>
<a href="${DOCS}/protocol.md">Protocol</a>
<a href="${DOCS}/security.md">Security</a>
<a href="${DOCS}/mcp.md">MCP</a>
</nav>
<a href="${REPO}/blob/main/LICENSE">MIT License</a>
</footer></div>
</body>
</html>
`;
