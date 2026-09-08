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
::selection { background: var(--mote-accent); color: #ffffff; }

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

.mote-doc-title {
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  color: var(--mote-muted);
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
}

h1 { font-size: 2em; margin-top: 0; }
h2 { font-size: 1.5em; margin-top: 2.2em; }
h3 { font-size: 1.22em; }
h4 { font-size: 1.05em; }
h5, h6 { font-size: 1em; color: var(--mote-muted); }

p, ul, ol, blockquote, table, pre { margin: 0 0 1.15em; }
ul, ol { padding-left: 1.5em; }
li { margin: 0.25em 0; }

article a {
  color: var(--mote-accent);
  text-decoration: none;
  border-bottom: 1px solid var(--mote-tint-border);
  transition: border-color 0.15s ease;
}
article a:hover { text-decoration: none; border-bottom-color: var(--mote-accent); }

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

/* Booktabs-style tables: horizontal rules only */
table {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  border-top: 2px solid var(--mote-border);
  border-bottom: 2px solid var(--mote-border);
  font-size: 0.95em;
}

th, td { padding: 0.5em 0.9em; text-align: left; }
th { font-weight: 650; border-bottom: 1px solid var(--mote-border); }
td { border-bottom: 1px solid var(--mote-border); }
tr:last-child td { border-bottom: 0; }

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

/* Table of contents */
.toc {
  border: 1px solid var(--mote-border);
  border-radius: 10px;
  padding: 0.7em 1em;
  margin: 0 0 2.5em;
  font-size: 0.92em;
}

.toc summary { font-weight: 650; font-size: 0.95em; }
.toc nav { margin-top: 0.7em; }
.toc ul { margin: 0; padding-left: 1.2em; }
.toc li { margin: 0.2em 0; }
.toc a { color: var(--mote-muted); border-bottom: 0; }
.toc a:hover { color: var(--mote-accent); }

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

@media print {
  .mote-banner { position: static; background: none; backdrop-filter: none; }
}
`;

export const PAGE_CSS = `${TOKENS_CSS}${BASE_CSS}${DOCUMENT_CSS}`;
