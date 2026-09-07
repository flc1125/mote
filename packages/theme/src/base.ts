/**
 * Baseline element styles shared by every Mote HTML surface: system font
 * stack, brand selection color, and an always-visible keyboard focus ring.
 * Surface-specific rules (headings, tables, cards, tabs) live with the
 * surface — this file only sets what must never diverge.
 */
export const BASE_CSS = `
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

::selection {
  background: var(--mote-brand);
  color: var(--mote-on-accent);
}

a { color: var(--mote-accent); }
a:hover { color: var(--mote-accent-strong); }
a:focus-visible {
  outline: 2px solid var(--mote-accent);
  outline-offset: 3px;
  border-radius: 2px;
}

code, kbd, pre {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
}
`;
