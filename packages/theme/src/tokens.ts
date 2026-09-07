/**
 * Mote design tokens, inlined into every HTML surface (home page, rendered
 * documents, CLI OAuth callback). Two complete palettes — light on :root,
 * dark via prefers-color-scheme — derived from the brand red #ef5552.
 *
 * No url() references are allowed here: documents render under a CSP that
 * only permits img-src 'self' https: http: and inline styles, and the OAuth
 * callback serves from 127.0.0.1 with no network access to brand assets.
 */
export const TOKENS_CSS = `
:root {
  --mote-fg: #1f2328;
  --mote-bg: #ffffff;
  --mote-muted: #59636e;
  --mote-border: #d1d9e0;
  --mote-code-bg: #eff1f3;
  --mote-pre-bg: #f6f8fa;
  --mote-toc-bg: #f6f8fa;
  --mote-brand: #ef5552;
  --mote-accent: #c23c39;
  --mote-accent-strong: #a92f2c;
  --mote-on-accent: #ffffff;
  --mote-tint: #fef1f0;
  --mote-tint-border: #f3c8c5;
  --mote-glow-from: rgb(239 85 82 / 0.16);
  --mote-glow-to: rgb(239 85 82 / 0);
}

@media (prefers-color-scheme: dark) {
  :root {
    --mote-fg: #e6edf3;
    --mote-bg: #0d1117;
    --mote-muted: #9198a1;
    --mote-border: #3d444d;
    --mote-code-bg: #2f3742;
    --mote-pre-bg: #161b22;
    --mote-toc-bg: #161b22;
    --mote-brand: #ff6d6a;
    --mote-accent: #ff8582;
    --mote-accent-strong: #ff9d9a;
    --mote-on-accent: #2b0d0c;
    --mote-tint: #2b1617;
    --mote-tint-border: #5a2a29;
    --mote-glow-from: rgb(255 109 106 / 0.14);
    --mote-glow-to: rgb(255 109 106 / 0);
  }
}
`;
