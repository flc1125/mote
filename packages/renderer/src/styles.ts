import { BASE_CSS, TOKENS_CSS } from '@mote/theme';

/**
 * Document CSS, inlined into every rendered document (baseline §29, §30):
 * a clean, reading-first page on the shared Mote tokens — 760px prose
 * column, 17px/1.75 body text, rule-free headings, softly framed tables,
 * accent-red used only for links, quotes and the brand mark. The slim
 * banner is sticky and blurred; dark mode follows the token palette with an
 * optional reader override (data-theme) applied by the fixed theme script.
 */
const DOCUMENT_CSS = `
/* Document-layer tokens: stacking order and shared control sizing (plan 012
   contract A). Color, shape and motion tokens live in @mote/theme. */
:root {
  --mote-z-toc-rail: 9;
  --mote-z-banner: 10;
  --mote-z-scrim: 38;
  --mote-z-drawer: 40;
  --mote-control-size: 40px;
}

::selection { background: var(--mote-accent); color: var(--mote-on-accent); }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

.mote-banner {
  position: sticky;
  top: 0;
  z-index: var(--mote-z-banner);
  border-bottom: 1px solid var(--mote-border);
  background: color-mix(in srgb, var(--mote-bg) 82%, transparent);
  backdrop-filter: saturate(1.5) blur(14px);
  -webkit-backdrop-filter: saturate(1.5) blur(14px);
}

.mote-banner-inner {
  max-width: 760px;
  min-height: var(--mote-control-size);
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.mote-brand {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--mote-fg);
  text-decoration: none;
}

.mote-brand:hover { color: var(--mote-fg); text-decoration: none; }

.mote-brand-dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  background: var(--mote-brand);
}

main {
  max-width: 760px;
  margin: 0 auto;
  padding: 3rem 20px 4rem;
}

/* ── Prose ─────────────────────────────────────────────────────────── */
article { font-size: 17px; line-height: 1.75; }

h1, h2, h3, h4, h5, h6 {
  margin: 1.8em 0 0.7em;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -0.015em;
  scroll-margin-top: 76px;
}

h1 { font-size: 2em; margin-top: 0; }
h2 { font-size: 1.5em; margin-top: 2.2em; }
h3 { font-size: 1.22em; }
h4 { font-size: 1.05em; }
h5, h6 { font-size: 1em; color: var(--mote-muted); }

/* Section-link anchors: parked in the left gutter where one exists, quiet
   until the heading is hovered or focused; touch devices keep them visible
   (no hover), just quieter. */
:is(h1, h2, h3, h4, h5, h6) { position: relative; }
.heading-anchor {
  position: absolute;
  inset-inline-start: -28px;
  top: 0;
  bottom: 0;
  display: inline-flex;
  align-items: center;
  color: var(--mote-muted);
  opacity: 0;
  transition: opacity var(--mote-duration-fast) var(--mote-ease-standard), color var(--mote-duration-fast) var(--mote-ease-standard);
}
/* Anchors are actions, not prose links: no underline bar from article a. */
article a.heading-anchor { border-bottom: 0; }
.heading-anchor svg { width: 16px; height: 16px; }
.heading-anchor:hover { color: var(--mote-accent); }
.heading-anchor:focus-visible { opacity: 1; outline: 2px solid var(--mote-accent); outline-offset: 2px; border-radius: var(--mote-radius-xs); }
:is(h1, h2, h3, h4, h5, h6):hover .heading-anchor,
:is(h1, h2, h3, h4, h5, h6):focus-within .heading-anchor { opacity: 1; }
.anchor-icon-copied { display: none; }
.heading-anchor.is-copied { opacity: 1; color: var(--mote-accent); }
.heading-anchor.is-copied .anchor-icon-link { display: none; }
.heading-anchor.is-copied .anchor-icon-copied { display: inline; }
@media (hover: none), (pointer: coarse) { .heading-anchor { opacity: 0.55; } }
/* No gutter on narrow screens or inside padded containers: inline-end. */
@media (max-width: 839px) {
  .heading-anchor { position: static; vertical-align: middle; margin-inline-start: 0.35em; }
}
.markdown-alert .heading-anchor,
.content-panel .heading-anchor,
blockquote .heading-anchor {
  position: static;
  vertical-align: middle;
  margin-inline-start: 0.35em;
}

p, ul, ol, blockquote, table, pre { margin: 0 0 1.15em; }
ul, ol { padding-left: 1.5em; }
li { margin: 0.5em 0; }
li > ul, li > ol { margin-top: 0.35em; margin-bottom: 0; }
li > :last-child { margin-bottom: 0; }

/* Footnote jumps (ref → definition and backref → ref) must clear the
   sticky banner like headings do. The targets are the inline <a id="fnref*">
   and the <li id="fn*">, so the margin lives on the id, not the wrapper. */
article [id^="fn"] { scroll-margin-top: 76px; }

article a {
  color: var(--mote-accent);
  text-decoration: none;
  border-bottom: 1px solid var(--mote-tint-border);
  transition: border-color var(--mote-duration-fast) var(--mote-ease-standard);
}
article a:hover { text-decoration: none; border-bottom-color: var(--mote-accent); }
/* Linked images (badges, logos): no underline under the picture. */
article a:has(img) { border-bottom: 0; }

code {
  background: var(--mote-code-bg);
  padding: 0.15em 0.4em;
  border-radius: var(--mote-radius-sm);
  font-size: 0.86em;
}

pre {
  background: var(--mote-pre-bg);
  border: 1px solid var(--mote-border);
  padding: 1rem 1.15rem;
  border-radius: var(--mote-radius-lg);
  overflow-x: auto;
  font-size: 0.87em;
  line-height: 1.6;
}

pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
}

/* Generated code controls; user HTML cannot opt into these classes. */
.code-block { margin: 1.25em 0; border: 1px solid var(--mote-border); border-radius: var(--mote-radius-lg); background: var(--mote-pre-bg); overflow: hidden; }
.code-block pre { margin: 0; border: 0; border-radius: 0; }
.code-block pre:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: -3px; }
.code-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 0.5rem 0.75rem; padding: 0.5rem 1.15rem; border-bottom: 1px solid var(--mote-border); min-width: 0; }
.code-toolbar[hidden], .code-copy[hidden] { display: none; }
.code-title { grid-column: 1; grid-row: 1; align-self: center; min-width: 0; overflow-wrap: anywhere; font-family: monospace; font-size: 0.8em; color: var(--mote-muted); }
.code-copy { grid-column: 2; grid-row: 1; margin-left: auto; display: inline-flex; align-items: center; justify-content: center; padding: 0.3em; border: 1px solid var(--mote-border); border-radius: var(--mote-radius-sm); color: var(--mote-fg); background: var(--mote-bg); font: inherit; font-size: 0.75em; cursor: pointer; transition: border-color var(--mote-duration-fast) var(--mote-ease-standard), background-color var(--mote-duration-fast) var(--mote-ease-standard), color var(--mote-duration-fast) var(--mote-ease-standard); }
.code-copy:hover { border-color: var(--mote-accent); color: var(--mote-accent); }
.code-copy:active { background: var(--mote-tint); }
.code-copy:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: 2px; }
.code-copy:disabled { opacity: 0.6; cursor: wait; }
.code-copy .code-icon-copied { display: none; }
.code-copy.is-copied { color: var(--mote-accent); border-color: var(--mote-accent); }
.code-copy.is-copied .code-icon-copy { display: none; }
.code-copy.is-copied .code-icon-copied { display: inline; }
.code-copy-status { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.code-copy-status.is-error { grid-column: 1 / -1; position: static; width: auto; height: auto; clip-path: none; white-space: normal; font-size: 0.75em; color: var(--mote-muted); }
.code-block.is-compact { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
.code-block.is-compact pre { grid-column: 1; grid-row: 1; min-width: 0; }
.code-block.is-compact > .code-copy { margin: 0.75rem 1.15rem 0.75rem 0; }
.code-block.is-compact > .code-copy-status.is-error { grid-row: 2; padding: 0.5rem 1.15rem 0.75rem; border-top: 1px solid var(--mote-border); }
.has-code-lines pre { padding: 1rem 0; }
.has-code-lines code { display: block; width: max-content; min-width: 100%; }
.code-line { display: inline-block; position: relative; box-sizing: border-box; min-width: 100%; min-height: 1.6em; padding: 0 1.15rem; vertical-align: top; }
.code-line.is-highlighted { background: var(--mote-tint); box-shadow: inset 3px 0 var(--mote-accent); }
.has-line-numbers { --code-line-width: 1ch; }
.has-line-numbers[data-line-digits="2"] { --code-line-width: 2ch; }
.has-line-numbers[data-line-digits="3"] { --code-line-width: 3ch; }
.has-line-numbers[data-line-digits="4"] { --code-line-width: 4ch; }
.has-line-numbers[data-line-digits="5"] { --code-line-width: 5ch; }
.has-line-numbers[data-line-digits="6"] { --code-line-width: 6ch; }
.has-line-numbers[data-line-digits="7"] { --code-line-width: 7ch; }
.has-line-numbers .code-line { padding-left: calc(1.15rem + var(--code-line-width) + 0.75rem); }
.code-line-number { position: absolute; left: 1.15rem; width: var(--code-line-width); text-align: right; color: var(--mote-muted); user-select: none; }
.code-line-number::before { content: attr(data-line); }
/* Static sections remain visible until the entire group is initialized. */
.content-tabs {
  margin: 1.2em 0;
  border: 1px solid var(--mote-border);
  border-radius: var(--mote-radius-md);
  min-width: 0;
}
.content-panel { padding: 1em; min-width: 0; }
.content-panel, .content-panel [id^="fnref"] { scroll-margin-top: 76px; }
.content-panel + .content-panel { border-top: 1px solid var(--mote-border); }
.content-panel > :first-child { margin-top: 0; }
.content-panel > :last-child { margin-bottom: 0; }
.content-panel-title { font-weight: 600; margin: 0 0 .85em; overflow-wrap: anywhere; }
.content-panel > .content-panel-title + * { margin-top: 0; }
.content-tab-list {
  display: flex;
  overflow-x: auto;
  /* Paint the divider inside the row so the active underline covers it. */
  box-shadow: inset 0 -1px var(--mote-border);
  border-radius: calc(var(--mote-radius-md) - 1px) calc(var(--mote-radius-md) - 1px) 0 0;
  background: var(--mote-code-bg);
  padding: 0 .5em;
  gap: .25em;
}
.content-tab-list > button {
  flex: 0 0 auto;
  max-width: min(24em, 80vw);
  white-space: normal;
  overflow-wrap: anywhere;
  padding: .7em .85em;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--mote-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--mote-duration-fast) var(--mote-ease-standard), border-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.content-tab-list > button[aria-selected="true"] {
  color: var(--mote-accent);
  border-bottom-color: currentColor;
}
.content-tab-list > button[aria-selected="false"]:hover { color: var(--mote-fg); }
.content-tab-list > button:focus-visible,
.content-panel:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: -3px; }
.content-tabs[data-tabs-enhanced] > .content-panel { border-top: 0; }
.content-tabs[data-tabs-enhanced] > .content-panel > .content-panel-title { display: none; }
.content-tabs[data-tabs-enhanced] > .content-panel[hidden] { display: none; }

@media print {
  .content-tabs > .content-tab-list { display: none !important; }
  .content-tabs[data-tabs-enhanced] > .content-panel,
  .content-tabs[data-tabs-enhanced] > .content-panel > .content-panel-title { display: block !important; }
  .content-tabs[data-tabs-enhanced] > .content-panel + .content-panel { border-top: 1px solid var(--mote-border); }

  .code-copy, .code-copy-status { display: none !important; }
  .code-block { overflow: visible; }
  .code-block pre { overflow: visible; white-space: pre-wrap; }
  .has-code-lines code { width: auto; }
  .code-line { white-space: pre-wrap; overflow-wrap: anywhere; }
  .code-line.is-highlighted { print-color-adjust: exact; }
}

/* Server-generated syntax tokens only; source HTML cannot supply classes.
   Colors come from the shared --mote-hl-* tokens (both palettes). */
pre .hljs-comment, pre .hljs-quote { color: var(--mote-hl-comment); }
pre .hljs-keyword, pre .hljs-selector-tag, pre .hljs-literal, pre .hljs-doctag { color: var(--mote-hl-keyword); }
pre .hljs-string, pre .hljs-regexp, pre .hljs-addition { color: var(--mote-hl-string); }
pre .hljs-number, pre .hljs-built_in, pre .hljs-type, pre .hljs-attr, pre .hljs-variable { color: var(--mote-hl-number); }
pre .hljs-title, pre .hljs-section, pre .hljs-selector-class, pre .hljs-selector-id { color: var(--mote-hl-title); }
pre .hljs-name, pre .hljs-symbol, pre .hljs-bullet, pre .hljs-link { color: var(--mote-hl-name); }
pre .hljs-meta { color: var(--mote-hl-meta); }
pre .hljs-deletion { color: var(--mote-hl-deletion); }
pre .hljs-emphasis { font-style: italic; }
pre .hljs-strong { font-weight: 700; }

blockquote {
  margin-left: 0;
  padding: 0.1em 1.1em;
  color: var(--mote-muted);
  border-left: 3px solid var(--mote-brand);
}
blockquote > :first-child { margin-top: 0; }
blockquote > :last-child { margin-bottom: 0; }

/* Shared presentation for GitHub-style alerts and extended admonitions. */
.markdown-alert, article details {
  --alert-color: var(--mote-alert-note);
  --alert-padding-x: 1.1em;
  --alert-padding-y: 0.85em;
  margin: 0 0 1.15em;
  padding: var(--alert-padding-y) var(--alert-padding-x);
  border: 1px solid color-mix(in srgb, var(--alert-color) 35%, var(--mote-bg));
  border-radius: var(--mote-radius-md);
  background: var(--mote-bg);
  color: var(--mote-fg);
  overflow-wrap: anywhere;
}
.markdown-alert-tip, .markdown-alert-success { --alert-color: var(--mote-alert-tip); }
.markdown-alert-important { --alert-color: var(--mote-alert-important); }
.markdown-alert-warning { --alert-color: var(--mote-alert-warning); }
.markdown-alert-caution { --alert-color: var(--mote-alert-caution); }
/* Examples are neutral supplementary content, not notes. */
.markdown-alert-example { --alert-color: var(--mote-muted); }
/* A tinted title band keeps long bodies on the normal reading surface. */
.markdown-alert > .markdown-alert-title, article details > summary {
  position: relative;
  margin: calc(-1 * var(--alert-padding-y)) calc(-1 * var(--alert-padding-x)) 0.85em;
  padding: 0.65em var(--alert-padding-x);
  border-radius: calc(var(--mote-radius-md) - 1px) calc(var(--mote-radius-md) - 1px) 0 0;
  background: color-mix(in srgb, var(--alert-color) 7%, var(--mote-bg));
  color: var(--alert-color);
  font-weight: 600;
}
.markdown-alert > .markdown-alert-title {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
.markdown-alert-title svg { flex-shrink: 0; }
.markdown-alert-title > span { min-width: 0; }
.markdown-alert[id] { scroll-margin-top: 88px; }
.markdown-alert > :first-child:not(.markdown-alert-title) { margin-top: 0; }
/* Only a heading that starts the body loses its section-leading space. */
.markdown-alert > .markdown-alert-title:first-child + :is(h1, h2, h3, h4, h5, h6),
article details > summary:first-child + :is(h1, h2, h3, h4, h5, h6) { margin-top: 0; }
.markdown-alert > :last-child, article details > :last-child { margin-bottom: 0; }

/* Quiet table chrome. Raw HTML tables retain a compact scroll fallback;
   Markdown tables fill their separate scroll container below. */
table {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  border: 1px solid var(--mote-border);
  border-radius: var(--mote-radius-md);
  font-size: 0.95em;
  font-variant-numeric: tabular-nums;
}

th, td { padding: 12px 16px; text-align: left; vertical-align: top; }
/* Author CSS otherwise overrides the vetted HTML alignment hints. */
th[align="center"], td[align="center"] { text-align: center; }
th[align="right"], td[align="right"] { text-align: right; }
th { font-weight: 600; background: var(--mote-pre-bg); border-bottom: 1px solid var(--mote-border); }
td { border-bottom: 1px solid color-mix(in srgb, var(--mote-border) 65%, transparent); }
tr:last-child td { border-bottom: 0; }

/* Keep native table layout inside a keyboard-scrollable region. Short
   tables fill the column; wide tables keep readable cells and scroll. */
.table-scroll {
  max-width: 100%;
  overflow-x: auto;
  margin: 0 0 1.15em;
  border: 1px solid var(--mote-border);
  border-radius: var(--mote-radius-md);
  scrollbar-width: thin;
  scrollbar-color: var(--mote-muted) var(--mote-pre-bg);
  /* Local covers hide the edge shadows at each scroll boundary. A short
     table covers both shadows, so it never suggests hidden columns. */
  background:
    linear-gradient(to right, var(--mote-bg) 40%, transparent) left / 32px 100% local no-repeat,
    linear-gradient(to left, var(--mote-bg) 40%, transparent) right / 32px 100% local no-repeat,
    linear-gradient(to right, color-mix(in srgb, var(--mote-fg) 14%, transparent), transparent) left / 12px 100% scroll no-repeat,
    linear-gradient(to left, color-mix(in srgb, var(--mote-fg) 14%, transparent), transparent) right / 12px 100% scroll no-repeat;
}
.table-scroll:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: 3px; }
.table-scroll table {
  display: table;
  width: max-content;
  min-width: 100%;
  max-width: none;
  margin: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
}
.table-scroll th, .table-scroll td { min-width: 4em; max-width: 24em; overflow-wrap: anywhere; }

img { max-width: 100%; height: auto; box-sizing: border-box; border-radius: var(--mote-radius-md); }
article figure:has(> img), article figure:has(> .image-frame) { margin: 1.5em 0; }
article figure:has(> img) > figcaption, article figure:has(> .image-frame) > figcaption { margin-top: 0.6em; color: var(--mote-muted); font-size: 0.85em; text-align: center; overflow-wrap: anywhere; }
.image-frame { display: block; position: relative; max-width: 100%; }
.image-frame > img { display: block; width: 100%; }
.image-expand, .image-close, .image-nav { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: var(--mote-radius-pill); cursor: pointer; }
/* The magnifier stays quiet until the image is hovered or focused; touch
   devices keep it visible via the coarse-pointer media query below. */
.image-expand {
  position: absolute;
  right: 4px;
  bottom: 4px;
  border-radius: var(--mote-radius-sm);
  background: transparent;
  isolation: isolate;
  color: var(--mote-fg);
  opacity: 0;
  transform: scale(0.9);
  pointer-events: none;
  transition: opacity var(--mote-duration-fast) var(--mote-ease-standard), transform var(--mote-duration-fast) var(--mote-ease-standard), background-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.image-frame:hover > .image-expand, .image-frame:focus-within > .image-expand { opacity: 1; transform: none; pointer-events: auto; }
.image-expand[hidden], .image-viewer-stage img[hidden] { display: none; }
.image-expand::before { content: ""; position: absolute; inset: 7px; z-index: -1; border-radius: calc(var(--mote-radius-sm) - 1px); background: color-mix(in srgb, var(--mote-bg) 90%, transparent); }
.image-expand:hover::before { background: var(--mote-bg); }
.image-expand:focus-visible, .image-viewer :focus-visible { outline: 2px solid var(--mote-accent); outline-offset: 3px; }
/* Frameless viewer: a dimmed page, the picture and one close button. */
.image-viewer { box-sizing: border-box; position: fixed; inset: 0; width: 100%; max-width: none; height: 100%; max-height: none; margin: 0; padding: 0; color: white; background: transparent; border: 0; border-radius: 0; overflow: hidden; }
.image-viewer[open] { display: flex; flex-direction: column; }
.image-viewer::backdrop { background: rgb(0 0 0 / 85%); backdrop-filter: blur(2px); }
.image-viewer[open]::backdrop { animation: image-viewer-fade var(--mote-duration-fast) var(--mote-ease-out); }
.image-close, .image-nav {
  position: absolute;
  z-index: 1;
  color: white;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: background-color var(--mote-duration-fast) var(--mote-ease-standard), box-shadow var(--mote-duration-fast) var(--mote-ease-standard);
}
.image-close {
  top: max(14px, env(safe-area-inset-top));
  right: max(14px, env(safe-area-inset-right));
  background: rgb(0 0 0 / 45%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 22%);
}
.image-close:hover { background: rgb(0 0 0 / 62%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 38%); }
/* Quiet chevrons: a soft drop shadow keeps them readable over any image;
   the circular base only appears on hover/focus. */
.image-nav {
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.image-nav svg { filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.65)); }
.image-nav:hover, .image-nav:focus-visible {
  background: rgb(0 0 0 / 45%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 22%);
}
.image-nav:hover svg, .image-nav:focus-visible svg { filter: none; }
.image-prev { left: max(14px, env(safe-area-inset-left)); }
.image-next { right: max(14px, env(safe-area-inset-right)); }
.image-nav[hidden], .image-viewer-count[hidden] { display: none; }
.image-viewer-count {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(14px, env(safe-area-inset-bottom));
  margin: 0;
  text-align: center;
  color: rgb(255 255 255 / 88%);
  font-size: 13px;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.65);
  pointer-events: none;
}
.image-viewer-stage { box-sizing: border-box; display: flex; align-items: center; justify-content: center; flex: 1; min-height: 0; overflow: auto; padding: 68px 24px 24px; text-align: center; overscroll-behavior: contain; }
/* The enlarged image keeps the document's corner radius and floats on the
   dimmed page; clicking it toggles the original size. */
.image-viewer-stage img { width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: var(--mote-shadow-overlay); cursor: default; }
.image-viewer-stage img[role="button"] { cursor: zoom-in; }
.image-viewer[open] .image-viewer-stage img { animation: image-viewer-in var(--mote-duration-base) var(--mote-ease-out); }
.image-viewer.is-original .image-viewer-stage { display: block; text-align: left; }
.image-viewer.is-original img { max-width: none; max-height: none; cursor: zoom-out; }
.image-viewer-status { position: absolute; left: 24px; right: 24px; top: 50%; margin: 0; text-align: center; color: rgb(255 255 255 / 88%); pointer-events: none; }
.image-viewer-status:empty { display: none; }
@keyframes image-viewer-fade { from { opacity: 0; } }
@keyframes image-viewer-in { from { opacity: 0; transform: scale(0.97); } }
@media (hover: none), (pointer: coarse) { .image-expand { opacity: 1; transform: none; pointer-events: auto; } }
@media (max-width: 600px) { .image-viewer-stage { padding: 68px 12px 12px; } }
@media print { .image-expand, .image-viewer { display: none !important; } }


hr {
  height: 1px;
  border: 0;
  background: var(--mote-border);
  margin: 2.5em 0;
}

kbd {
  border: 1px solid var(--mote-border);
  border-bottom-width: 2px;
  border-radius: var(--mote-radius-sm);
  padding: 0.1em 0.4em;
  background: var(--mote-pre-bg);
  font-size: 0.85em;
}

mark {
  background: var(--mote-tint);
  color: inherit;
  /* Balance the background around the text's baseline without changing line height. */
  padding: 0.08em 0.2em 0.16em;
  border-radius: var(--mote-radius-xs);
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
mark code { padding: 0 0.2em; border-radius: calc(var(--mote-radius-xs) - 1px); }

article dl { margin: 0 0 1.4em; }
article dt { font-weight: 600; margin-top: 1em; overflow-wrap: anywhere; }
article dt:first-child { margin-top: 0; }
article dd { margin: 0.35em 0 0.85em 1.5em; min-width: 0; overflow-wrap: anywhere; }
article dd > :first-child { margin-top: 0; }
article dd > :last-child { margin-bottom: 0; }

/* Static formulas and diagrams */
.math-inline { display: inline-block; max-width: 100%; overflow-x: auto; vertical-align: middle; }
.math-display { overflow-x: auto; margin: 1.4em 0; padding: 0.5em 0; }
.math-display math { min-width: max-content; }
.mermaid-diagram { margin: 0 0 1.4em; }
.mermaid-diagram figcaption { margin-bottom: 0.5em; color: var(--mote-muted); font-size: 0.85em; }
.diagram-scroll { overflow: auto; max-height: 640px; padding: 0.5em; border: 1px solid var(--mote-border); border-radius: var(--mote-radius-lg); }
.diagram-scroll svg {
  display: block; margin: auto; max-width: 100%; height: auto;
  --bg: var(--mote-bg); --fg: var(--mote-fg);
  --_text: var(--mote-fg); --_text-sec: var(--mote-muted);
  --_text-muted: var(--mote-muted); --_text-faint: var(--mote-muted);
  --_line: var(--mote-muted); --_arrow: var(--mote-fg);
  --_node-fill: var(--mote-pre-bg); --_node-stroke: var(--mote-border);
  --_group-fill: var(--mote-bg); --_group-hdr: var(--mote-pre-bg);
  --_inner-stroke: var(--mote-border); --_key-badge: var(--mote-pre-bg);
}
.diagram-scroll text, .diagram-scroll tspan { font-family: inherit; }
@media (max-width: 600px) { .diagram-scroll svg { max-width: none; } }
.diagram-scroll .mote-xychart-grid { fill: var(--mote-border); stroke: none; opacity: 0.65; }
.diagram-scroll .mote-xychart-label, .diagram-scroll .mote-xychart-axis-title { fill: var(--mote-muted); }
.diagram-scroll .mote-xychart-title { fill: var(--mote-fg); }
.diagram-scroll .mote-xychart-color-0 { --chart-color: var(--mote-accent); }
.diagram-scroll .mote-xychart-color-1 { --chart-color: #588ee6; }
.diagram-scroll .mote-xychart-color-2 { --chart-color: #399e70; }
.diagram-scroll .mote-xychart-color-3 { --chart-color: #a176ce; }
.diagram-scroll .mote-xychart-color-4 { --chart-color: #cb9038; }
.diagram-scroll .mote-xychart-color-5 { --chart-color: #36a0b0; }
.diagram-scroll .mote-xychart-color-6 { --chart-color: #c9759a; }
.diagram-scroll .mote-xychart-color-7 { --chart-color: var(--mote-muted); }
.diagram-scroll line[class*="mote-xychart-color-"] { stroke: var(--chart-color); }
.diagram-scroll .mote-xychart-bar { stroke: var(--chart-color); fill: color-mix(in srgb, var(--mote-bg) 75%, var(--chart-color)); stroke-width: 1.5; }
.diagram-scroll .mote-xychart-line, .diagram-scroll .mote-xychart-line-shadow { fill: none; stroke: var(--chart-color); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.diagram-scroll .mote-xychart-line-shadow { stroke-width: 5; opacity: 0.12; }
.diagram-scroll .mote-xychart-dot { fill: var(--chart-color); stroke: var(--mote-bg); stroke-width: 2; }
.math-display:focus-visible, .diagram-scroll:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: 3px; }

/* Diagram source disclosure: an icon-only toggle parked on the diagram frame's
   top-right corner (the figure's border gives it an anchor), quiet until the
   figure is hovered or focused — touch keeps it visible, quieter, same
   contract as the heading anchors. The open panel reuses the code-block
   chrome and stays in flow below the figure. */
.mermaid-diagram { position: relative; }
.mermaid-diagram details.diagram-source { margin-top: 0; padding: 0; border: 0; background: none; }
.mermaid-diagram details.diagram-source > summary {
  position: absolute;
  top: 0.45em;
  inset-inline-end: 0.45em;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75em;
  height: 1.75em;
  margin: 0;
  padding: 0;
  border: 1px solid var(--mote-border);
  border-radius: var(--mote-radius-sm);
  background: var(--mote-bg);
  color: var(--mote-muted);
  opacity: 0;
  cursor: pointer;
  transition: opacity var(--mote-duration-fast) var(--mote-ease-standard), color var(--mote-duration-fast) var(--mote-ease-standard), border-color var(--mote-duration-fast) var(--mote-ease-standard);
}
/* The generic disclosure chevron and the tinted title band stay with raw
   HTML details; this toggle renders its own icon instead. */
.mermaid-diagram details.diagram-source > summary::after { content: none; }
.mermaid-diagram details.diagram-source > summary:hover { color: var(--mote-accent); border-color: var(--mote-accent); }
.mermaid-diagram details.diagram-source > summary:focus-visible { opacity: 1; outline: 2px solid var(--mote-accent); outline-offset: 2px; }
.mermaid-diagram:hover details.diagram-source:not([open]) > summary,
.mermaid-diagram:focus-within details.diagram-source:not([open]) > summary,
.mermaid-diagram details.diagram-source[open] > summary { opacity: 1; }
@media (hover: none), (pointer: coarse) { .mermaid-diagram details.diagram-source > summary { opacity: 0.55; } }
.diagram-source-icon { transition: transform var(--mote-duration-fast) var(--mote-ease-standard); }
.mermaid-diagram details.diagram-source[open] > summary .diagram-source-icon { transform: rotate(180deg); }
.mermaid-diagram details.diagram-source > .code-block { margin: 0.5em 0 0; }

/* Raw HTML and generated disclosures share the same title/body treatment. */
.markdown-alert .markdown-alert, .markdown-alert details,
article details .markdown-alert, article details details { --alert-padding-x: 0.65em; }
article details > summary {
  cursor: pointer;
  list-style: none;
  padding-right: calc(var(--alert-padding-x) + 1.4em);
}
/* Match the shared title selector so closed blocks have no trailing gap. */
article details:not([open]) > summary, article details.markdown-alert:not([open]) > summary {
  margin-bottom: calc(-1 * var(--alert-padding-y));
  border-bottom-left-radius: calc(var(--mote-radius-md) - 1px);
  border-bottom-right-radius: calc(var(--mote-radius-md) - 1px);
}
article details > summary::-webkit-details-marker { display: none; }
article details > summary::marker { content: ''; }
article details > summary::after {
  content: '';
  position: absolute;
  right: var(--alert-padding-x);
  top: 50%;
  width: 0.4em;
  height: 0.4em;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-50%) rotate(-45deg);
}
article details[open] > summary::after { transform: translateY(-50%) rotate(45deg); }
article details > summary:focus-visible { outline: 2px solid var(--alert-color); outline-offset: -3px; }
@media print {
  article details::details-content { display: contents; content-visibility: visible; }
  article details:not([open]) > summary, article details.markdown-alert:not([open]) > summary { margin-bottom: 0.85em; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  article details > summary::after { display: none; }
  .markdown-alert, article details { print-color-adjust: exact; }
}


/* Static anchors work without JavaScript. Enhancement adds state, focus
   management and scroll position; it never changes the rendered article. */
/* Banner theme menu (plan 012 control spec): pill button + popover list. */
.banner-spacer { flex: 1; }
.theme-menu { position: relative; }
.theme-toggle,
.page-copy,
.markdown-copy,
.markdown-source-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: var(--mote-control-size);
  min-height: var(--mote-control-size);
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: var(--mote-radius-pill);
  background: transparent;
  color: var(--mote-muted);
  cursor: pointer;
  transition: color var(--mote-duration-fast) var(--mote-ease-standard), background-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.theme-toggle[hidden], .page-copy[hidden], .markdown-copy[hidden] { display: none; }
.theme-toggle:hover, .page-copy:hover, .markdown-copy:hover, .markdown-source-close:hover { color: var(--mote-accent); background: var(--mote-tint); }
.theme-toggle:focus-visible, .page-copy:focus-visible, .markdown-copy:focus-visible, .markdown-source-close:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: 2px; }
.page-copy .page-icon-copied, .markdown-copy .page-icon-copied { display: none; }
.page-copy.is-copied, .markdown-copy.is-copied { color: var(--mote-accent); }
.page-copy.is-copied .page-icon-link { display: none; }
.page-copy.is-copied .page-icon-copied, .markdown-copy.is-copied .page-icon-copied { display: inline; }
.markdown-copy.is-copied .markdown-copy-icon { display: none; }
.markdown-copy[aria-disabled="true"] { cursor: wait; }
.markdown-tools { position: relative; display: inline-flex; flex-shrink: 0; }
.markdown-copy-hint, .markdown-copy-status:not(:empty) {
  position: absolute;
  top: calc(100% + 6px);
  right: 50%;
  transform: translateX(50%);
  width: max-content;
  max-width: min(240px, calc(100vw - 40px));
  padding: 5px 8px;
  border-radius: var(--mote-radius-sm);
  background: var(--mote-fg);
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.12);
  color: var(--mote-bg);
  font-size: 11px;
  line-height: 1.5;
  pointer-events: none;
}
.markdown-copy-hint { visibility: hidden; }
@media (hover: hover) {
  .markdown-tools:hover .markdown-copy-hint { visibility: visible; transition: visibility 0s 180ms; }
}
.markdown-tools:has(.markdown-copy:focus-visible) .markdown-copy-hint { visibility: visible; transition: none; }
.markdown-tools:has(.markdown-copy-status:not(:empty)) .markdown-copy-hint { visibility: hidden; }
.markdown-source-dialog {
  box-sizing: border-box;
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  padding: 20px;
  border: 1px solid var(--mote-border);
  border-radius: var(--mote-radius-lg);
  background: var(--mote-bg);
  color: var(--mote-fg);
  box-shadow: var(--mote-shadow-pop);
  overflow: auto;
}
.markdown-source-dialog::backdrop { background: var(--mote-scrim); }
.markdown-source-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.markdown-source-heading h2 { margin: 0; font-size: 18px; }
.markdown-source-dialog p { margin: 8px 0 16px; color: var(--mote-muted); font-size: 14px; }
.markdown-source-text {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 45vh;
  height: 45dvh;
  min-height: 80px;
  padding: 12px;
  border: 1px solid var(--mote-border);
  border-radius: var(--mote-radius-sm);
  background: var(--mote-code-bg);
  color: var(--mote-fg);
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  resize: none;
}
.markdown-source-text:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: 2px; }
@media (max-width: 480px) {
  .mote-banner-inner { gap: 6px; padding-left: 16px; padding-right: 16px; }
}

/* Back to top: quiet floating action, clear of the desktop contents rail. */
.to-top {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--mote-control-size);
  height: var(--mote-control-size);
  padding: 0;
  border: 1px solid var(--mote-border);
  border-radius: var(--mote-radius-pill);
  background: color-mix(in srgb, var(--mote-bg) 92%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--mote-muted);
  cursor: pointer;
  box-shadow: var(--mote-shadow-pop);
  transition: color var(--mote-duration-fast) var(--mote-ease-standard), border-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.to-top[hidden] { display: none; }
.to-top:hover { color: var(--mote-accent); border-color: var(--mote-accent); }
.to-top:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: 2px; }
@media (min-width: 1140px) {
  .has-toc:not([data-toc-collapsed]) .to-top { bottom: 88px; }
}
.theme-toggle[aria-expanded="true"] { color: var(--mote-fg); }
.theme-chevron { flex-shrink: 0; }
/* SVG ignores the hidden attribute without an explicit rule. */
.theme-icon[hidden] { display: none; }

.theme-menu-list {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: max-content;
  min-width: 9rem;
  box-sizing: border-box;
  padding: 4px;
  border: 1px solid var(--mote-border);
  border-radius: var(--mote-radius-md);
  background: var(--mote-bg);
  box-shadow: var(--mote-shadow-pop);
  animation: theme-menu-in var(--mote-duration-fast) var(--mote-ease-out);
}
.theme-menu-list[hidden] { display: none; }
@keyframes theme-menu-in { from { opacity: 0; transform: translateY(-3px); } }
.theme-menu-list button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 0;
  border-radius: var(--mote-radius-sm);
  background: transparent;
  color: var(--mote-fg);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: color var(--mote-duration-fast) var(--mote-ease-standard), background-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.theme-menu-list button:hover { color: var(--mote-accent); background: var(--mote-tint); }
.theme-menu-list button:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: -2px; }
.theme-menu-list button[aria-checked="true"] { color: var(--mote-accent); font-weight: 600; }
.theme-menu-list button[aria-checked="true"]::after { content: "✓"; margin-left: auto; font-size: 12px; }
.theme-item-icon { flex-shrink: 0; color: var(--mote-muted); }
.theme-menu-list button:hover .theme-item-icon,
.theme-menu-list button[aria-checked="true"] .theme-item-icon { color: inherit; }

.toc-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--mote-control-size);
  min-height: var(--mote-control-size);
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid transparent;
  border-radius: var(--mote-radius-pill);
  color: var(--mote-muted);
  text-decoration: none;
  transition: color var(--mote-duration-fast) var(--mote-ease-standard), background-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.toc-trigger:hover { color: var(--mote-accent); background: var(--mote-tint); }
.toc-trigger[aria-expanded="true"] { color: var(--mote-fg); }

/* Compact banner tools; larger touch targets do not enlarge the artwork. */
.banner-actions {
  --mote-control-size: 36px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
}
.banner-actions :is(.page-copy, .markdown-copy, .theme-toggle, .toc-trigger) {
  padding: 6px;
  gap: 2px;
  flex-shrink: 0;
}
.banner-actions :is(.page-copy, .markdown-copy, .theme-toggle, .toc-trigger) > svg {
  width: 16px;
  height: 16px;
}
.banner-actions .theme-toggle > .theme-chevron { width: 10px; height: 10px; }
@media (any-pointer: coarse) {
  .banner-actions { --mote-control-size: 40px; }
}

.toc-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--mote-z-scrim);
  background: var(--mote-scrim);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--mote-duration-base) var(--mote-ease-standard), visibility var(--mote-duration-base);
}
.toc-drawer {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--mote-z-drawer);
  width: min(360px, 90vw);
  padding: 12px 16px 0;
  background: var(--mote-bg);
  border-left: 1px solid var(--mote-border);
  transform: translateX(105%);
  visibility: hidden;
  transition: transform var(--mote-duration-slow) var(--mote-ease-standard), visibility 0s var(--mote-duration-slow);
}
body:not([data-toc-enhanced]) .toc-drawer:target,
body[data-toc-open] .toc-drawer {
  transform: none;
  visibility: visible;
  box-shadow: var(--mote-shadow-drawer);
  transition: transform var(--mote-duration-slow) var(--mote-ease-standard), visibility 0s;
}
body:not([data-toc-enhanced]) .toc-drawer:target + .toc-scrim,
body[data-toc-open] .toc-scrim { opacity: 1; visibility: visible; }
body[data-toc-modal] { position: fixed; left: 0; right: 0; }

.toc-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  min-height: 44px;
  padding: 4px 4px 12px;
  border-bottom: 1px solid var(--mote-border);
  margin-bottom: 8px;
}
.toc-title { font-size: 12px; font-weight: 600; color: var(--mote-muted); }
.toc-close {
  --mote-control-size: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: var(--mote-control-size);
  min-height: var(--mote-control-size);
  border-radius: var(--mote-radius-sm);
  color: var(--mote-muted);
  text-decoration: none;
  transition: color var(--mote-duration-fast) var(--mote-ease-standard), background-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.toc-close > svg { width: 16px; height: 16px; }
.toc-close:hover { color: var(--mote-fg); background: var(--mote-pre-bg); }
@media (any-pointer: coarse) {
  .toc-close { --mote-control-size: 40px; }
}
.toc-nav {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--mote-border) transparent;
  padding: 0 4px max(24px, env(safe-area-inset-bottom));
}
.toc-nav ul { list-style: none; margin: 0; padding: 0; }
.toc-nav li { margin: 2px 0; }
.toc-nav [hidden] { display: none !important; }
.toc-row { display: flex; align-items: flex-start; padding-left: calc(var(--toc-depth) * 16px); position: relative; }
.toc-row > a {
  display: block;
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  min-height: 36px;
  padding: 8px;
  border-radius: var(--mote-radius-sm);
  color: var(--mote-muted);
  font-size: 13px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
}
.toc-row > a:only-child, .toc-toggle[hidden] + a { margin-left: 24px; }
.toc-nav > ul > li > .toc-row > a { color: var(--mote-fg); font-weight: 550; }
.toc-nav > ul > li > ul > li > .toc-row > a { font-weight: 500; }
.toc-row > a:hover { color: var(--mote-fg); background: var(--mote-pre-bg); }
.toc-row > a[aria-current] { color: var(--mote-accent); font-weight: 600; }
.toc-row:has(> a[aria-current])::before {
  content: ""; position: absolute; left: 0; top: 10px; bottom: 10px;
  width: 2px; min-height: 14px; border-radius: 2px; background: var(--mote-accent);
}
.toc-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 24px;
  min-height: 36px;
  border: 0;
  padding: 0;
  border-radius: var(--mote-radius-sm);
  color: var(--mote-muted);
  background: transparent;
  cursor: pointer;
  transition: color var(--mote-duration-fast) var(--mote-ease-standard), background-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.toc-toggle[aria-expanded="true"] svg { transform: rotate(90deg); }
.toc-toggle:hover { color: var(--mote-fg); background: var(--mote-pre-bg); }
.toc-toggle:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: -2px; }
li[data-current-branch] > .toc-row > .toc-toggle[aria-expanded="false"] { color: var(--mote-accent); }

@media (min-width: 1140px) {
  .has-toc:not([data-toc-collapsed]) main,
  .has-toc:not([data-toc-collapsed]) .mote-colophon-inner { margin-left: calc((100% - 1092px) / 2); margin-right: 0; }
  .has-toc:not([data-toc-collapsed]) .mote-banner-inner { max-width: 1052px; }
  .toc-drawer {
    left: calc(50% + 286px);
    top: 88px;
    bottom: var(--toc-bottom, 32px);
    width: 260px;
    padding: 0;
    border: 0;
    background: transparent;
    transform: none;
    visibility: visible;
    z-index: var(--mote-z-toc-rail);
    transition: none;
  }
  .toc-drawer-head { padding: 0 8px; border-bottom: 0; margin-bottom: 4px; }
  /* Native momentum scrolling can paint before the scroll handler runs.
     Keep the footer above the rail and links during that transient overlap. */
  .has-toc .mote-colophon { position: relative; z-index: var(--mote-z-banner); background: var(--mote-bg); }
  /* Center the 2px marker over the 1px rail at x = 1.5px. Keep both
     inside the scrollable area to avoid clipping their outer edges. */
  .toc-nav {
    padding-left: 0;
    background: linear-gradient(var(--mote-border), var(--mote-border)) 1px top / 1px 100% no-repeat;
  }
  .toc-row { padding-left: calc(5px + var(--toc-depth) * 16px); }
  .toc-row > a { min-height: 32px; padding-top: 6px; padding-bottom: 6px; }
  .toc-toggle { min-height: 32px; }
  .toc-row:has(> a[aria-current])::before { left: 0.5px; top: 8px; bottom: 8px; }
  body .toc-scrim { display: none; }
  body[data-toc-open] .toc-drawer, body:not([data-toc-enhanced]) .toc-drawer:target { box-shadow: none; }
  body[data-toc-collapsed] .toc-drawer { visibility: hidden; }
  body:not([data-toc-enhanced]) .toc-trigger, body:not([data-toc-enhanced]) .toc-close { display: none; }
}
@media (min-width: 1440px) {
  .has-toc:not([data-toc-collapsed]) main,
  .has-toc:not([data-toc-collapsed]) .mote-colophon-inner { margin-left: auto; margin-right: auto; }
  .has-toc:not([data-toc-collapsed]) .mote-banner-inner { max-width: 760px; }
  .toc-drawer { left: calc(50% + 432px); }
}
@media (min-width: 1600px) {
  .toc-drawer { width: 300px; }
}
@media (max-width: 767px) {
  :root { --mote-control-size: 44px; }
  .toc-drawer {
    top: auto; left: 0; right: 0; bottom: 0;
    width: 100%; height: min(80vh, 680px); height: min(80dvh, 680px);
    padding-top: 8px;
    border: 1px solid var(--mote-border); border-bottom: 0;
    border-radius: var(--mote-radius-xl) var(--mote-radius-xl) 0 0;
    transform: translateY(105%);
  }
  .toc-trigger, .toc-close, .toc-row > a, .toc-toggle { min-height: 44px; }
  .toc-trigger, .toc-close { min-width: 44px; }
  .toc-row > a { font-size: 14px; padding-top: 11px; padding-bottom: 11px; }
  .toc-toggle { flex-basis: 44px; }
  .toc-row > a:only-child, .toc-toggle[hidden] + a { margin-left: 44px; }
}

/* GFM task lists (markdown-it-task-lists): static disabled checkboxes. */
.task-list-item { list-style-type: none; }
.task-list-item .task-list-item-checkbox {
  margin: 0 0.45em 0.2em -1.4em;
  vertical-align: middle;
  accent-color: var(--mote-accent);
}

/* Footnotes (markdown-it-footnote). */
hr.footnotes-sep { display: none; }
.footnotes {
  border-top: 1px solid var(--mote-border);
  margin-top: 2.5em;
  padding-top: 1em;
  font-size: 0.88em;
  color: var(--mote-muted);
}
.footnotes ol { padding-left: 1.4em; }
/* A block-ending footnote keeps its return links on a compact separate line. */
.footnote-item > dl:has(+ a.footnote-backref) { margin-bottom: 0.35em; }
.footnote-item > dl:has(+ a.footnote-backref) > dd:last-child { margin-bottom: 0; }
a.footnote-ref, a.footnote-backref { border-bottom: 0; }
abbr[title] { text-decoration: underline dotted; text-underline-offset: 0.18em; cursor: help; }
.footnote-preview {
  position: fixed; inset: auto; margin: 0; padding: 0;
  width: min(28rem, calc(100vw - 24px)); max-height: min(28rem, calc(100vh - 24px));
  max-height: min(28rem, calc(100dvh - 24px));
  border: 1px solid var(--mote-border); border-radius: var(--mote-radius-lg);
  background: var(--mote-bg); color: var(--mote-fg);
  box-shadow: var(--mote-shadow-pop); font-size: 0.9em; line-height: 1.65;
  overflow: hidden;
}
.footnote-preview:popover-open { display: flex; flex-direction: column; }
.footnote-preview-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.45rem 0.75rem 0.45rem 1rem; border-bottom: 1px solid var(--mote-border);
}
.footnote-preview-header strong { font-size: 0.9em; color: var(--mote-muted); }
.footnote-preview-header button {
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; background: transparent; color: var(--mote-muted); cursor: pointer;
  width: 36px; height: 36px; border-radius: var(--mote-radius-sm); padding: 0;
  transition: color var(--mote-duration-fast) var(--mote-ease-standard), background-color var(--mote-duration-fast) var(--mote-ease-standard);
}
.footnote-preview-header button:hover { background: var(--mote-tint); color: var(--mote-accent); }
.footnote-preview :focus-visible { outline: 2px solid var(--mote-accent); outline-offset: -2px; }
.footnote-preview-body { overflow: auto; min-height: 0; padding: 0.85rem 1rem; overscroll-behavior: contain; overflow-wrap: anywhere; }
.footnote-preview-body > :first-child { margin-top: 0; }
.footnote-preview-body > :last-child { margin-bottom: 0; }
.footnote-preview-body img { max-width: 100%; height: auto; }
.footnote-preview-body table { display: block; overflow-x: auto; }
.footnote-preview-full { align-self: flex-start; margin: 0 1rem 0.8rem; font-size: 0.9em; }
@media print { .footnote-preview { display: none !important; } }

/* Colophon */
.mote-colophon { border-top: 1px solid var(--mote-border); }

.mote-colophon-inner {
  max-width: 760px;
  margin: 0 auto;
  padding: 22px 20px 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--mote-muted);
}

.mote-colophon-mark {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--mote-brand);
}

.mote-colophon a {
  color: var(--mote-muted);
  text-decoration: none;
  border-bottom: 1px solid var(--mote-border);
}
.mote-colophon a:hover { color: var(--mote-accent); border-bottom-color: var(--mote-accent); }

@media (max-width: 600px) {
  main { padding-top: 30px; padding-bottom: 48px; }
  h1 { font-size: 1.7em; letter-spacing: 0; }
  h2 { font-size: 1.35em; margin-top: 40px; }
  h3 { font-size: 1.15em; }
  .mote-banner-inner { padding-top: 6px; padding-bottom: 6px; }
  th, td { padding: 10px 12px; }
}

@media print {
  .mote-banner { position: static; background: none; backdrop-filter: none; }
  .theme-menu, .toc-trigger, .toc-scrim, .toc-drawer, .heading-anchor, .page-copy, .markdown-tools, .markdown-source-dialog, .to-top, .diagram-source > summary { display: none; }
  .has-toc:not([data-toc-collapsed]) main,
  .has-toc:not([data-toc-collapsed]) .mote-colophon-inner { margin: 0 auto; }
  body[data-toc-modal] { position: static; }
  .table-scroll { overflow: visible; background: none; border-radius: 0; }
  .table-scroll table { width: 100%; min-width: 0; table-layout: fixed; }
}

@media (prefers-reduced-motion: reduce) {
  .toc-drawer, .toc-scrim { transition: none; }
  .image-expand, .image-close { transition: none; }
  .image-viewer[open]::backdrop, .image-viewer[open] .image-viewer-stage img { animation: none; }
  .theme-menu-list { animation: none; }
}
`;

export const PAGE_CSS = `${TOKENS_CSS}${BASE_CSS}${DOCUMENT_CSS}`;
