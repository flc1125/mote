import { BASE_CSS, TOKENS_CSS } from '@mote/theme';

import { LOGO_BLACK_SVG } from './brand.generated.js';

const REPO = 'https://github.com/flc1125/mote';
const DOCS = `${REPO}/blob/main/docs`;
// Published showcase; editable source lives in docs/examples/weekly-report.md.
const SAMPLE_URL = 'https://mote.flc.io/MxNfTmvTNxMnrbkU';

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
<style>${TOKENS_CSS}${BASE_CSS}
:root { --home-max: 1080px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
code { background: var(--mote-code-bg); padding: 0.15em 0.35em; border-radius: 6px; font-size: 0.85em; }
::selection { background: var(--mote-accent); color: var(--mote-on-accent); }

/* ── Cinematic dark hero (identical in light & dark mode) ─────────── */
.hero-zone { position: relative; overflow: hidden; background: #0b0e14; color: #e6edf3; }
.aurora { position: absolute; inset: 0; }
.aurora span { position: absolute; border-radius: 50%; filter: blur(90px); }
.aurora span:nth-child(1) { width: 55vw; height: 55vw; left: -15vw; top: -28vw; background: radial-gradient(circle, rgb(239 85 82 / 0.5), transparent 65%); animation: drift-a 18s ease-in-out infinite alternate; }
.aurora span:nth-child(2) { width: 45vw; height: 45vw; right: -12vw; top: -8vw; background: radial-gradient(circle, rgb(255 109 106 / 0.38), transparent 65%); animation: drift-b 24s ease-in-out infinite alternate; }
.aurora span:nth-child(3) { width: 42vw; height: 30vw; left: 28vw; bottom: -22vw; background: radial-gradient(circle, rgb(194 60 57 / 0.32), transparent 65%); animation: drift-c 28s ease-in-out infinite alternate; }
@keyframes drift-a { to { transform: translate(6vw, 5vw) scale(1.15); } }
@keyframes drift-b { to { transform: translate(-5vw, 6vw) scale(1.12); } }
@keyframes drift-c { to { transform: translate(-7vw, -5vw) scale(1.2); } }
.hero-grid { position: absolute; inset: 0; background-image: linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px); background-size: 56px 56px; -webkit-mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, #000 20%, transparent 78%); mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, #000 20%, transparent 78%); }

.home-header { position: relative; z-index: 2; max-width: var(--home-max); margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 22px 24px; }
.home-header svg { display: block; width: 120px; height: auto; }
.home-header [data-wordmark] { fill: #e6edf3; }
.home-header nav { display: flex; align-items: center; gap: 26px; font-size: 15px; }
.home-header nav a { color: #9aa4b0; text-decoration: none; }
.home-header nav a:hover { color: #ffffff; text-decoration: none; }

.hero { position: relative; z-index: 2; max-width: var(--home-max); margin: 0 auto; min-height: 82svh; padding: 72px 24px 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.hero-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #9aa4b0; margin: 0 0 30px; }
.hero-eyebrow::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #ef5552; box-shadow: 0 0 12px 2px rgb(239 85 82 / 0.7); }
.hero h1 { font-size: clamp(56px, 9.5vw, 148px); line-height: 0.95; letter-spacing: -0.04em; font-weight: 750; margin: 0 0 30px; color: #f0f3f6; }
.hero h1 .grad { background: linear-gradient(100deg, #ff6d6a 5%, #ef5552 48%, #ff9d9a 95%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 30px rgb(239 85 82 / 0.35)); }
.hero-sub { font-size: 19px; line-height: 1.6; color: #9aa4b0; margin: 0 0 42px; max-width: 52ch; }
.hero-sub a { color: #ff8582; text-decoration: none; border-bottom: 1px solid rgb(255 133 130 / 0.4); }
.hero-sub a:hover { color: #ffb3b1; border-bottom-color: #ffb3b1; }
.hero-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin: 0; }
.button { display: inline-block; padding: 13px 28px; border-radius: 12px; font-size: 16px; font-weight: 600; text-decoration: none; transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease; }
.button:hover { transform: translateY(-1px); }
.button-primary { background: #ef5552; color: #ffffff; box-shadow: 0 10px 30px -8px rgb(239 85 82 / 0.55); }
.button-primary:hover { background: #f46764; color: #ffffff; text-decoration: none; box-shadow: 0 14px 36px -8px rgb(239 85 82 / 0.65); }
.button-ghost { border: 1px solid rgb(255 255 255 / 0.18); color: #e6edf3; }
.button-ghost:hover { border-color: rgb(255 255 255 / 0.45); color: #ffffff; text-decoration: none; }

/* Self-typing terminal — pure CSS, no JavaScript */
.terminal { width: min(660px, 100%); margin-top: 68px; text-align: left; background: rgb(13 17 23 / 0.85); border: 1px solid rgb(255 255 255 / 0.1); border-radius: 14px; box-shadow: 0 40px 90px -30px rgb(239 85 82 / 0.35), 0 20px 40px rgb(0 0 0 / 0.45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); overflow: hidden; font-size: 15px; }
.terminal-bar { display: flex; gap: 8px; padding: 13px 16px; border-bottom: 1px solid rgb(255 255 255 / 0.07); }
.terminal-dot { width: 12px; height: 12px; border-radius: 50%; background: #3d444d; }
.terminal-dot:nth-child(1) { background: #ef5552; }
.terminal-dot:nth-child(2) { background: #e3b341; }
.terminal-dot:nth-child(3) { background: #3fb950; }
.terminal pre { margin: 0; padding: 20px 22px 24px; color: #e6edf3; line-height: 1.85; overflow-x: auto; }
.terminal pre code { background: transparent; padding: 0; font-size: inherit; }
.terminal .row, .terminal .fade { display: block; }
.terminal .prompt { color: #ff8582; font-weight: 600; }
.terminal .type { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; width: 0; animation: type-in 1.1s steps(14, end) 0.6s forwards; }
@keyframes type-in { to { width: 14ch; } }
.terminal .cursor { color: #ff8582; animation: blink 1.06s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.terminal .fade { opacity: 0; animation: rise 0.5s ease forwards; }
.terminal .l1 { animation-delay: 1.9s; }
.terminal .l2 { animation-delay: 2.15s; }
.terminal .l3 { animation-delay: 2.55s; }
.terminal .l4 { animation-delay: 2.75s; }
@keyframes rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.terminal .dim { color: #8b949e; }
.terminal a { color: #ff8582; text-decoration: underline; text-underline-offset: 3px; }
.terminal a:hover { color: #ffb3b1; }

/* ── Content (token-driven, light & dark) ─────────────────────────── */
.section { max-width: var(--home-max); margin: 0 auto; padding: 76px 24px; }
.section-title { font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--mote-accent); margin: 0 0 14px; padding: 0; border: 0; }
.section-heading { font-size: clamp(30px, 4.4vw, 46px); letter-spacing: -0.03em; font-weight: 750; margin: 0 0 36px; padding: 0; border: 0; }

/* Full-bleed red statement band */
.stmt-band { position: relative; overflow: hidden; background: linear-gradient(135deg, #ef5552 0%, #d43f3c 75%); color: #ffffff; }
.stmt-band::before { content: ''; position: absolute; inset: 0; background: radial-gradient(640px 320px at 18% -30%, rgb(255 255 255 / 0.16), transparent 70%); }
.stmt { position: relative; }
.statement-line { font-size: clamp(36px, 6vw, 68px); line-height: 1.06; letter-spacing: -0.035em; font-weight: 750; margin: 0 0 22px; color: #ffffff; }
.statement-line .accent { color: rgb(255 255 255 / 0.55); }
.statement-sub { font-size: 18px; line-height: 1.6; color: rgb(255 255 255 / 0.84); margin: 0; max-width: 56ch; }

.method { padding: 34px 0; border-top: 1px solid var(--mote-border); }
.method-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 18px; }
.method-num { font-size: 34px; font-weight: 750; letter-spacing: -0.02em; line-height: 1; color: var(--mote-tint-border); }
.method-head h3 { margin: 0; font-size: 20px; letter-spacing: -0.01em; }
.method-desc { margin: 0; color: var(--mote-muted); font-size: 15px; }
.method pre { background: #161b22; color: #e6edf3; border: 1px solid rgb(255 255 255 / 0.08); border-radius: 14px; padding: 18px 20px; font-size: 14.5px; line-height: 1.9; overflow-x: auto; margin: 0 0 12px; box-shadow: 0 16px 32px -18px rgb(15 17 21 / 0.35); transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.method pre:hover { border-color: rgb(239 85 82 / 0.45); box-shadow: 0 16px 36px -16px rgb(239 85 82 / 0.3); }
.method pre code { background: transparent; padding: 0; font-size: inherit; }
.method .prompt { color: #ff8582; font-weight: 600; user-select: none; }
.method-note { color: var(--mote-muted); font-size: 14px; margin: 0; }
.method-note a { color: var(--mote-accent); text-decoration: none; border-bottom: 1px solid var(--mote-tint-border); }
.method-note a:hover { border-bottom-color: var(--mote-accent); }

/* Why Mote: dark keyword wall, echoing the hero */
.why-band { background: #0b0e14; color: #e6edf3; }
.why-band .section-title { color: #ff8582; }
.words { list-style: none; margin: 0; padding: 0; }
.word-row { display: grid; grid-template-columns: minmax(0, auto) 1fr; align-items: baseline; gap: 12px 48px; padding: 26px 4px; border-bottom: 1px solid rgb(255 255 255 / 0.08); transition: border-color 0.2s ease; }
.word-row:first-child { border-top: 1px solid rgb(255 255 255 / 0.08); }
.word-row:hover { border-bottom-color: rgb(239 85 82 / 0.5); }
.word { font-size: clamp(38px, 5.6vw, 72px); line-height: 1; letter-spacing: -0.035em; font-weight: 750; color: #f0f3f6; white-space: nowrap; transition: color 0.2s ease, transform 0.2s ease; }
.word-row:hover .word { color: #ff6d6a; transform: translateX(6px); }
.word-note { color: #9aa4b0; font-size: 15px; line-height: 1.6; max-width: 44ch; justify-self: end; text-align: right; }
.word-note code { background: rgb(255 255 255 / 0.08); color: #e6edf3; }

.home-footer { max-width: var(--home-max); margin: 0 auto; padding: 30px 24px 44px; border-top: 1px solid var(--mote-border); display: flex; flex-wrap: wrap; gap: 10px 20px; justify-content: space-between; align-items: center; font-size: 14px; color: var(--mote-muted); }
.footer-group { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; }
.footer-brand { display: inline-flex; align-items: center; gap: 10px; }
.footer-mark { display: inline-block; width: 12px; height: 12px; border-radius: 4px; background: var(--mote-brand); }
.footer-divider { width: 1px; height: 14px; background: var(--mote-border); }
.footer-by a { color: var(--mote-muted); text-decoration: none; }
.footer-by a:hover { color: var(--mote-accent); text-decoration: none; }
.home-footer nav { display: flex; gap: 22px; }
.home-footer a { color: var(--mote-muted); text-decoration: none; }
.home-footer a:hover { color: var(--mote-accent); text-decoration: none; }

@media (max-width: 640px) {
  .home-header { padding: 18px 20px; }
  .home-header svg { width: 104px; }
  .hero { padding: 56px 20px 88px; min-height: 76svh; }
  .hero-sub { font-size: 17px; }
  .terminal { margin-top: 48px; font-size: 13.5px; }
  .section { padding: 56px 20px; }
  .word-row { grid-template-columns: 1fr; gap: 10px; }
  .word-note { justify-self: start; text-align: left; }
}

@media (prefers-reduced-motion: reduce) {
  .aurora span, .terminal .type, .terminal .cursor, .terminal .fade { animation: none; }
  .terminal .type { width: auto; }
  .terminal .fade { opacity: 1; }
}
@media print {
  .hero-zone { background: #ffffff; color: #1f2328; }
  .home-header [data-wordmark] { fill: #20252b; }
  .home-header nav a, .hero-sub, .hero-eyebrow { color: #59636e; }
  .hero h1 { color: #1f2328; }
  .method pre { background: #f6f8fa; color: #1f2328; }
  .method .prompt { color: #c23c39; }
  .why-band { background: #ffffff; color: #1f2328; }
  .word { color: #1f2328; }
  .word-note { color: #59636e; }
  .terminal .type { width: auto; }
  .terminal .fade { opacity: 1; }
}
</style>
</head>
<body>
<div class="hero-zone">
<div class="aurora" aria-hidden="true"><span></span><span></span><span></span></div>
<div class="hero-grid" aria-hidden="true"></div>
<header class="home-header">
${LOGO_BLACK_SVG}
<nav aria-label="Project"><a href="${DOCS}/cli.md">Docs</a><a href="${REPO}">GitHub</a></nav>
</header>
<main>
<section class="hero" aria-labelledby="intro">
<p class="hero-eyebrow">Markdown publishing</p>
<h1 id="intro">Markdown in.<br><span class="grad">URL out.</span></h1>
<p class="hero-sub">Publish a local Markdown file as an immutable, browser-readable page. The link is the credential — <a href="${SAMPLE_URL}">see a live demo</a>.</p>
<p class="hero-actions"><a class="button button-primary" href="#use">Get started</a><a class="button button-ghost" href="${REPO}">GitHub</a></p>
<div class="terminal">
<div class="terminal-bar" aria-hidden="true"><span class="terminal-dot"></span><span class="terminal-dot"></span><span class="terminal-dot"></span></div>
<pre tabindex="0" role="region" aria-label="Publishing a document with the Mote CLI"><code><span class="row"><span class="prompt">$</span> <span class="type">mote README.md</span><span class="cursor">▍</span></span><span class="fade l1 dim">Scanning README.md…</span><span class="fade l2 dim">Markdown 47.1 KB · Assets 3 · Total 1.84 MB</span><span class="fade l3">Published:</span><span class="fade l4"><a href="${SAMPLE_URL}">${SAMPLE_URL}</a></span></code></pre>
</div>
</section>
</main>
</div>
<div class="stmt-band"><section class="section stmt" aria-labelledby="stmt-title">
<h2 class="visually-hidden" id="stmt-title">Capability URLs</h2>
<p class="statement-line">The URL is the credential<span class="accent">.</span></p>
<p class="statement-sub">94-bit unguessable IDs. No accounts, no ACLs — anyone with the link can read, and no one else can find it.</p>
</section></div>
<section class="section" id="use" aria-labelledby="use-title">
<h2 class="section-title" id="use-title">Use Mote</h2>
<p class="section-heading">Three ways to publish.</p>
<div class="method">
<div class="method-head"><span class="method-num">01</span><h3>CLI</h3><p class="method-desc">Publish from your terminal.</p></div>
<pre tabindex="0" role="region" aria-label="CLI quick start commands"><code><span class="prompt">$</span> npm install -g mote-cli
<span class="prompt">$</span> mote login
<span class="prompt">$</span> mote README.md</code></pre>
<p class="method-note">Log in to your Access-enabled Mote instance — it is remembered for future publishes. For other authentication modes, see the <a href="${DOCS}/authentication.md">authentication guide</a>.</p>
</div>
<div class="method">
<div class="method-head"><span class="method-num">02</span><h3>MCP</h3><p class="method-desc">Connect your AI assistant. For example, with Codex:</p></div>
<pre tabindex="0" role="region" aria-label="Codex MCP setup commands"><code><span class="prompt">$</span> codex mcp add mote --url https://mote.flc.io/api/mcp
<span class="prompt">$</span> codex mcp login mote</code></pre>
<p class="method-note">Use your own instance URL. Setup, tools, and verified clients: <a href="${DOCS}/mcp.md">MCP guide</a>.</p>
</div>
<div class="method">
<div class="method-head"><span class="method-num">03</span><h3>Skill</h3><p class="method-desc">Teach your agent when and how to publish.</p></div>
<pre tabindex="0" role="region" aria-label="Skill installation command"><code><span class="prompt">$</span> npx skills add flc1125/mote --skill mote</code></pre>
<p class="method-note">The skill uses your configured CLI or MCP tools; set up one of them first. See the <a href="${DOCS}/skill.md">Skill guide</a>.</p>
</div>
</section>
<div class="why-band"><section class="section why" aria-labelledby="why-title">
<h2 class="section-title" id="why-title">Why Mote</h2>
<ul class="words">
<li class="word-row"><span class="word">Immutable</span><span class="word-note">Every publish creates a new URL; old links keep their content forever.</span></li>
<li class="word-row"><span class="word">Self-contained</span><span class="word-note">Local images upload automatically, deduplicated, served from opaque URLs.</span></li>
<li class="word-row"><span class="word">Instant</span><span class="word-note">Cloudflare Workers + R2 + CDN cache. No database to slow anything down.</span></li>
<li class="word-row"><span class="word">Silent</span><span class="word-note">Published pages run zero JavaScript under a maximally strict CSP.</span></li>
<li class="word-row"><span class="word">Agent-ready</span><span class="word-note">CLI <code>--json</code> output, remote and local MCP servers, and an agent Skill.</span></li>
</ul>
</section></div>
<footer class="home-footer">
<span class="footer-brand"><span class="footer-mark" aria-hidden="true"></span>Mote — Markdown in, URL out.</span>
<span class="footer-group">
<nav aria-label="Project links">
<a href="${REPO}">GitHub</a>
<a href="${DOCS}/cli.md">Docs</a>
<a href="${REPO}/blob/main/LICENSE">MIT License</a>
</nav>
<span class="footer-divider" aria-hidden="true"></span>
<span class="footer-by">Created by <a href="https://flc.io/">Flc</a></span>
</span>
</footer>
</body>
</html>
`;
