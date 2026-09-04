/**
 * Page CSS, inlined into every rendered document (baseline §29, §30).
 * GitHub-flavored typography, 860px centered column, horizontal scrolling
 * for code blocks and tables, dark mode via prefers-color-scheme. No JS.
 */
export const PAGE_CSS = `
:root {
  --mote-fg: #1f2328;
  --mote-bg: #ffffff;
  --mote-muted: #59636e;
  --mote-border: #d1d9e0;
  --mote-link: #0969da;
  --mote-code-bg: #eff1f3;
  --mote-pre-bg: #f6f8fa;
  --mote-toc-bg: #f6f8fa;
}

@media (prefers-color-scheme: dark) {
  :root {
    --mote-fg: #e6edf3;
    --mote-bg: #0d1117;
    --mote-muted: #9198a1;
    --mote-border: #3d444d;
    --mote-link: #4493f8;
    --mote-code-bg: #2f3742;
    --mote-pre-bg: #161b22;
    --mote-toc-bg: #161b22;
  }
}

body {
  margin: 0;
  background: var(--mote-bg);
  color: var(--mote-fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
    Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  word-wrap: break-word;
}

main {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
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

a { color: var(--mote-link); text-decoration: none; }
a:hover { text-decoration: underline; }

code, kbd, pre {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
}

code {
  background: var(--mote-code-bg);
  padding: 0.15em 0.35em;
  border-radius: 6px;
  font-size: 0.85em;
}

pre {
  background: var(--mote-pre-bg);
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
  border-left: 0.25em solid var(--mote-border);
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

th { font-weight: 600; }

img { max-width: 100%; height: auto; box-sizing: border-box; }

hr {
  height: 1px;
  border: 0;
  background: var(--mote-border);
  margin: 1.5em 0;
}

.toc {
  background: var(--mote-toc-bg);
  border: 1px solid var(--mote-border);
  border-radius: 8px;
  padding: 0.8rem 1.2rem;
  margin: 0 0 1.5em;
  font-size: 0.9em;
}

.toc ul { margin: 0; padding-left: 1.2em; }
.toc li { margin: 0.15em 0; }
`;
