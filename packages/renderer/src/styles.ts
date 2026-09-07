import { BASE_CSS, TOKENS_CSS } from '@mote/theme';

/**
 * Document CSS, inlined into every rendered document (baseline §29, §30):
 * GitHub-flavored typography on the shared Mote tokens, a slim brand
 * banner/colophon, 860px centered column, horizontal scrolling for code
 * blocks and tables. Dark mode comes from the token palette, no JS.
 */
const DOCUMENT_CSS = `
.mote-banner {
  border-bottom: 1px solid var(--mote-border);
}

.mote-banner-inner {
  max-width: 860px;
  margin: 0 auto;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.mote-brand {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  font-size: 17px;
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
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  color: var(--mote-muted);
}

main {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
}

h1, h2, h3, h4, h5, h6 {
  margin: 1.5em 0 0.6em;
  line-height: 1.25;
  font-weight: 600;
}

h1 { font-size: 1.9em; padding-bottom: 0.3em; border-bottom: 1px solid var(--mote-border); }
h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--mote-border); }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }

p, ul, ol, blockquote, table, pre { margin: 0 0 1em; }

article a { text-decoration: none; }
article a:hover { text-decoration: underline; }

code {
  background: var(--mote-code-bg);
  padding: 0.15em 0.35em;
  border-radius: 6px;
  font-size: 0.85em;
}

pre {
  background: var(--mote-pre-bg);
  border: 1px solid var(--mote-border);
  padding: 0.8rem 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.5;
}

pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
}

blockquote {
  margin-left: 0;
  padding: 0 1em;
  color: var(--mote-muted);
  border-left: 0.25em solid var(--mote-brand);
}

table {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

th, td {
  padding: 0.4em 0.8em;
  border: 1px solid var(--mote-border);
}

th { font-weight: 600; background: var(--mote-pre-bg); }

img { max-width: 100%; height: auto; box-sizing: border-box; }

hr {
  height: 1px;
  border: 0;
  background: var(--mote-border);
  margin: 1.5em 0;
}

.toc {
  background: var(--mote-tint);
  border: 1px solid var(--mote-tint-border);
  border-radius: 8px;
  padding: 0.55rem 1rem;
  margin: 0 0 1.5em;
  font-size: 0.9em;
}

.toc summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--mote-accent);
}

.toc summary:hover { color: var(--mote-accent-strong); }
.toc nav { margin-top: 0.55rem; }
.toc ul { margin: 0; padding-left: 1.2em; }
.toc li { margin: 0.15em 0; }

.mote-colophon {
  border-top: 1px solid var(--mote-border);
}

.mote-colophon-inner {
  max-width: 860px;
  margin: 0 auto;
  padding: 18px 16px 28px;
  text-align: center;
  font-size: 13px;
  color: var(--mote-muted);
}

.mote-colophon a { text-decoration: none; }
.mote-colophon a:hover { text-decoration: underline; }
`;

export const PAGE_CSS = `${TOKENS_CSS}${BASE_CSS}${DOCUMENT_CSS}`;
