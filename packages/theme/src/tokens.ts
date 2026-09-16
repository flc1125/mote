/**
 * Mote design tokens, inlined into every HTML surface (home page, rendered
 * documents, CLI OAuth callback). Two complete palettes — light on :root,
 * dark via prefers-color-scheme — derived from the brand red #ef5552.
 *
 * Readers can override the scheme per browser: the theme toggle persists
 * `light`/`dark` to localStorage and a fixed first-party script sets
 * <html data-theme> before first paint. Auto (no attribute) follows the
 * media query; an explicit choice wins via the :not() guard. Print always
 * uses the light palette so dark-mode readers get legible paper output.
 *
 * No url() references are allowed here: documents render under a CSP that
 * only permits img-src 'self' https: http: and inline styles, and the OAuth
 * callback serves from 127.0.0.1 with no network access to brand assets.
 */
const LIGHT_TOKENS = `
  --mote-fg: #1f2328;
  --mote-bg: #ffffff;
  --mote-muted: #59636e;
  --mote-border: #d1d9e0;
  --mote-code-bg: #eff1f3;
  --mote-pre-bg: #f6f8fa;
  --mote-toc-bg: #f6f8fa;
  --mote-brand: #ef5552;
  --mote-accent: #d43f3c;
  --mote-accent-strong: #b93331;
  --mote-on-accent: #ffffff;
  --mote-tint: #fef1f0;
  --mote-tint-border: #f3c8c5;
  --mote-glow-from: rgb(239 85 82 / 0.16);
  --mote-glow-to: rgb(239 85 82 / 0);
  --mote-shadow-pop: 0 8px 32px rgb(0 0 0 / 0.13);
  --mote-shadow-drawer: -16px 0 48px rgb(15 17 21 / 0.1);
  --mote-scrim: rgb(15 17 21 / 0.32);
`;

const DARK_TOKENS = `
  --mote-fg: #e6edf3;
  --mote-bg: #0d1117;
  --mote-muted: #9198a1;
  --mote-border: #3d444d;
  --mote-code-bg: #2f3742;
  --mote-pre-bg: #161b22;
  --mote-toc-bg: #161b22;
  --mote-brand: #ff6d6a;
  --mote-accent: #ff7a76;
  --mote-accent-strong: #ff948f;
  --mote-on-accent: #2b0d0c;
  --mote-tint: #2b1617;
  --mote-tint-border: #5a2a29;
  --mote-glow-from: rgb(255 109 106 / 0.14);
  --mote-glow-to: rgb(255 109 106 / 0);
  /* Shadows and scrims must deepen at night to stay visible on dark surfaces. */
  --mote-shadow-pop: 0 8px 32px rgb(0 0 0 / 0.5);
  --mote-shadow-drawer: -16px 0 48px rgb(0 0 0 / 0.45);
  --mote-scrim: rgb(0 0 0 / 0.55);
`;

export const TOKENS_CSS = `
:root {${LIGHT_TOKENS}
  /* Shape and motion tokens are theme-invariant. */
  --mote-radius-xs: 4px;
  --mote-radius-sm: 6px;
  --mote-radius-md: 8px;
  --mote-radius-lg: 10px;
  --mote-radius-xl: 18px;
  --mote-radius-pill: 999px;
  --mote-shadow-overlay: 0 12px 48px rgb(0 0 0 / 0.55);
  --mote-duration-fast: 0.15s;
  --mote-duration-base: 0.18s;
  --mote-duration-slow: 0.2s;
  --mote-ease-standard: ease;
  --mote-ease-out: ease-out;
}

/* Auto (no data-theme) follows the system; explicit light wins over it. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${DARK_TOKENS}
  }
}

/* An explicit reader choice beats the media query. */
:root[data-theme="dark"] {${DARK_TOKENS}
}

/* Paper is always light, whatever the reader picked. The selectors keep
   parity with the dark rules above so this later block wins every tie. */
@media print {
  :root:not([data-theme="light"]),
  :root[data-theme="dark"] {${LIGHT_TOKENS}
  }
}
`;
