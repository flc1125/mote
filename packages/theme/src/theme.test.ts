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

  it('redefines every light token under prefers-color-scheme: dark', () => {
    expect(TOKENS_CSS).toContain('@media (prefers-color-scheme: dark)');
    const dark = TOKENS_CSS.slice(TOKENS_CSS.indexOf('@media'));
    const tokenNames = [...light.matchAll(/(--mote-[a-z-]+):/g)].map((match) => match[1]!);
    expect(tokenNames.length).toBeGreaterThan(0);
    for (const name of new Set(tokenNames)) {
      expect(dark).toContain(`${name}:`);
    }
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
