import { BASE_CSS, TOKENS_CSS } from '@mote/theme';

/**
 * Document CSS, inlined into every rendered document (baseline §29, §30):
 * a clean, reading-first page on the shared Mote tokens — 720px prose
 * column, 17px/1.75 body text, rule-free headings, hairline tables,
 * accent-red used only for links, quotes and the brand mark. The slim
 * banner is sticky and blurred; dark mode comes from the token palette,
 * no JS.
 */
const DOCUMENT_CSS = `
::selection { background: var(--mote-accent); color: var(--mote-on-accent); }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

.mote-banner {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--mote-border);
  background: color-mix(in srgb, var(--mote-bg) 82%, transparent);
  backdrop-filter: saturate(1.5) blur(14px);
  -webkit-backdrop-filter: saturate(1.5) blur(14px);
}

.mote-banner-inner {
  max-width: 720px;
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
  max-width: 720px;
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

p, ul, ol, blockquote, table, pre { margin: 0 0 1.15em; }
ul, ol { padding-left: 1.5em; }
li { margin: 0.5em 0; }
li > ul, li > ol { margin-top: 0.35em; margin-bottom: 0; }
li > :last-child { margin-bottom: 0; }

article a {
  color: var(--mote-accent);
  text-decoration: none;
  border-bottom: 1px solid var(--mote-tint-border);
  transition: border-color 0.15s ease;
}
article a:hover { text-decoration: none; border-bottom-color: var(--mote-accent); }
/* Linked images (badges, logos): no underline under the picture. */
article a:has(img) { border-bottom: 0; }

code {
  background: var(--mote-code-bg);
  padding: 0.15em 0.4em;
  border-radius: 6px;
  font-size: 0.86em;
}

pre {
  background: var(--mote-pre-bg);
  border: 1px solid var(--mote-border);
  padding: 1rem 1.15rem;
  border-radius: 10px;
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

blockquote {
  margin-left: 0;
  padding: 0.1em 1.1em;
  color: var(--mote-muted);
  border-left: 3px solid var(--mote-brand);
}
blockquote > :first-child { margin-top: 0; }
blockquote > :last-child { margin-bottom: 0; }

/* Booktabs-style tables: horizontal rules only */
table {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  border-top: 2px solid var(--mote-border);
  border-bottom: 2px solid var(--mote-border);
  font-size: 0.95em;
}

th, td { padding: 0.6em 0.75em; text-align: left; vertical-align: top; }
th { font-weight: 650; border-bottom: 1px solid var(--mote-border); }
td { border-bottom: 1px solid var(--mote-border); }
tr:last-child td { border-bottom: 0; }

/* Keep native table layout inside a keyboard-scrollable region. Short
   tables fill the column; wide tables keep readable cells and scroll. */
.table-scroll { max-width: 100%; overflow-x: auto; margin: 0 0 1.15em; }
.table-scroll:focus-visible { outline: 2px solid var(--mote-accent); outline-offset: 3px; }
.table-scroll table {
  display: table;
  width: max-content;
  min-width: 100%;
  max-width: none;
  margin: 0;
  overflow: visible;
}
.table-scroll th, .table-scroll td { max-width: 24em; overflow-wrap: anywhere; }

img { max-width: 100%; height: auto; box-sizing: border-box; border-radius: 8px; }

hr {
  height: 1px;
  border: 0;
  background: var(--mote-border);
  margin: 2.5em 0;
}

kbd {
  border: 1px solid var(--mote-border);
  border-bottom-width: 2px;
  border-radius: 6px;
  padding: 0.1em 0.4em;
  background: var(--mote-pre-bg);
  font-size: 0.85em;
}

mark { background: var(--mote-tint); color: inherit; padding: 0.05em 0.2em; border-radius: 4px; }

/* Content <details> blocks */
article details {
  border: 1px solid var(--mote-border);
  border-radius: 10px;
  padding: 0.7em 1em;
  margin: 0 0 1.15em;
}
article summary { cursor: pointer; font-weight: 600; }
article summary:hover { color: var(--mote-accent); }
article details[open] > summary { margin-bottom: 0.6em; }

/* Table of contents: :target-driven slide-in drawer, zero layout cost.
   Opening points :target at #mote-toc; any TOC navigation moves :target
   to the heading, so the drawer closes itself. While closed it is also
   visibility:hidden — out of the tab order and the a11y tree. */
.toc-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  gap: 7px;
  min-height: 40px;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--mote-muted);
  text-decoration: none;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.toc-trigger:hover { color: var(--mote-accent); border-color: var(--mote-accent); }

.toc-scrim {
  position: fixed;
  inset: 0;
  z-index: 38;
  background: rgb(15 17 21 / 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.toc-drawer {
  box-sizing: border-box;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  width: min(300px, 86vw);
  overflow-y: auto;
  padding: 20px 22px 28px;
  background: var(--mote-bg);
  border-left: 1px solid var(--mote-border);
  transform: translateX(105%);
  visibility: hidden;
  transition: transform 0.25s ease, visibility 0s 0.25s;
}
.toc-drawer:target {
  transform: none;
  visibility: visible;
  box-shadow: -24px 0 48px -24px rgb(15 17 21 / 0.3);
  transition: transform 0.25s ease, visibility 0s;
}
.toc-drawer:target + .toc-scrim { opacity: 1; pointer-events: auto; }

.toc-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.toc-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mote-muted);
}
.toc-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 40px;
  min-height: 40px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 20px;
  line-height: 1;
  color: var(--mote-muted);
  text-decoration: none;
}
.toc-close:hover { color: var(--mote-accent); background: var(--mote-tint); }

.toc-nav ul { list-style: none; margin: 0; padding: 0; }
.toc-nav ul ul { padding-left: 14px; }
.toc-nav li { margin: 2px 0; }
.toc-nav a {
  display: block;
  box-sizing: border-box;
  min-height: 40px;
  padding: 10px 8px;
  border-radius: 6px;
  border-bottom: 0;
  color: var(--mote-muted);
  font-size: 14px;
  line-height: 1.4;
  text-decoration: none;
}
.toc-nav a:hover { color: var(--mote-accent); background: var(--mote-tint); }

/* GFM task lists (markdown-it-task-lists): static disabled checkboxes. */
.task-list-item { list-style-type: none; }
.task-list-item .task-list-item-checkbox {
  margin: 0 0.45em 0.2em -1.4em;
  vertical-align: middle;
  accent-color: var(--mote-accent);
}

/* Footnotes (markdown-it-footnote). */
.footnotes {
  border-top: 1px solid var(--mote-border);
  margin-top: 2.5em;
  padding-top: 1em;
  font-size: 0.88em;
  color: var(--mote-muted);
}
.footnotes ol { padding-left: 1.4em; }
a.footnote-ref, a.footnote-backref { border-bottom: 0; }

/* Colophon */
.mote-colophon { border-top: 1px solid var(--mote-border); }

.mote-colophon-inner {
  max-width: 720px;
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
  .toc-trigger, .toc-close, .toc-nav a { min-height: 44px; }
  .toc-close { min-width: 44px; }
}

@media print {
  .mote-banner { position: static; background: none; backdrop-filter: none; }
  .toc-trigger, .toc-scrim, .toc-drawer { display: none; }
  .table-scroll { overflow: visible; }
  .table-scroll table { width: 100%; min-width: 0; table-layout: fixed; }
}

@media (prefers-reduced-motion: reduce) {
  .toc-drawer, .toc-scrim, .toc-fab { transition: none; }
}
`;

export const PAGE_CSS = `${TOKENS_CSS}${BASE_CSS}${DOCUMENT_CSS}`;
