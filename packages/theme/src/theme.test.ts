import { describe, expect, it } from 'vitest';

import { BASE_CSS, TOKENS_CSS } from './index.js';

describe('TOKENS_CSS', () => {
  const light = TOKENS_CSS.split('@media')[0]!;

  it('defines a complete light palette on :root', () => {
    for (const token of [
      '--mote-fg',
      '--mote-bg',
      '--mote-muted',
      '--mote-border',
      '--mote-code-bg',
      '--mote-pre-bg',
      '--mote-toc-bg',
      '--mote-brand',
      '--mote-accent',
      '--mote-accent-strong',
      '--mote-on-accent',
      '--mote-tint',
      '--mote-tint-border',
      '--mote-glow-from',
      '--mote-glow-to',
    ]) {
      expect(light).toContain(`${token}:`);
    }
  });

  it('redefines every theme-dependent light token under prefers-color-scheme: dark', () => {
    expect(TOKENS_CSS).toContain('@media (prefers-color-scheme: dark)');
    const dark = TOKENS_CSS.slice(TOKENS_CSS.indexOf('@media'));
    // Shape, motion and the fixed overlay shadow look identical in both
    // palettes; only palette colors and night-adjusted shadows are redefined.
    const themeInvariant = new Set([
      '--mote-radius-xs',
      '--mote-radius-sm',
      '--mote-radius-md',
      '--mote-radius-lg',
      '--mote-radius-xl',
      '--mote-radius-pill',
      '--mote-shadow-overlay',
      '--mote-duration-fast',
      '--mote-duration-base',
      '--mote-duration-slow',
      '--mote-ease-standard',
      '--mote-ease-out',
    ]);
    const tokenNames = [...light.matchAll(/(--mote-[a-z-]+):/g)].map((match) => match[1]!);
    expect(tokenNames.length).toBeGreaterThan(0);
    for (const name of new Set(tokenNames)) {
      if (themeInvariant.has(name)) {
        expect(dark).not.toContain(`${name}:`);
        continue;
      }
      expect(dark).toContain(`${name}:`);
    }
  });
  it('lets an explicit reader choice override the media query', () => {
    expect(TOKENS_CSS).toContain(':root[data-theme="dark"]');
    expect(TOKENS_CSS).toContain('@media (prefers-color-scheme: dark)');
    expect(TOKENS_CSS).toContain(':root:not([data-theme="light"])');
  });

  it('forces the light palette for print', () => {
    const print = TOKENS_CSS.slice(TOKENS_CSS.indexOf('@media print'));
    expect(print).toContain('--mote-bg: #ffffff');
    expect(print).toContain('--mote-fg: #1f2328');
  });

  it('anchors the brand palette to the logo red', () => {
    expect(TOKENS_CSS).toContain('--mote-brand: #ef5552');
  });

  it('references no external resources (CSP-safe inlining)', () => {
    expect(TOKENS_CSS).not.toMatch(/url\(/);
    expect(TOKENS_CSS).not.toContain('@import');
    expect(TOKENS_CSS).not.toContain('@font-face');
  });
});

describe('BASE_CSS', () => {
  it('uses only system fonts', () => {
    expect(BASE_CSS).toContain('-apple-system');
    expect(BASE_CSS).not.toContain('@font-face');
  });

  it('keeps a visible keyboard focus ring in the accent color', () => {
    expect(BASE_CSS).toContain(':focus-visible');
    expect(BASE_CSS).toContain('outline: 2px solid var(--mote-accent)');
  });

  it('references no external resources (CSP-safe inlining)', () => {
    expect(BASE_CSS).not.toMatch(/url\(/);
    expect(BASE_CSS).not.toContain('@import');
  });
});
