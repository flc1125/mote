import { describe, expect, it } from 'vitest';

import { PAGE_CSS } from './styles.js';

/**
 * Plan 012 contract A: shared tokens carry shape, elevation, motion and
 * stacking; components reference tokens instead of literal values.
 */
describe('PAGE_CSS design tokens', () => {
  it('defines the document-layer tokens', () => {
    for (const token of [
      '--mote-z-toc-rail',
      '--mote-z-banner',
      '--mote-z-scrim',
      '--mote-z-drawer',
      '--mote-control-size',
    ]) {
      expect(PAGE_CSS).toContain(`${token}:`);
    }
  });

  it('routes overlay surfaces through the shared shadow and scrim tokens', () => {
    expect(PAGE_CSS).toContain('box-shadow: var(--mote-shadow-pop)');
    expect(PAGE_CSS).toContain('box-shadow: var(--mote-shadow-overlay)');
    expect(PAGE_CSS).toContain('box-shadow: var(--mote-shadow-drawer)');
    expect(PAGE_CSS).toContain('background: var(--mote-scrim)');
  });

  it('leaves no pre-token literal shadows, scrims or transitions behind', () => {
    expect(PAGE_CSS).not.toContain('#0002');
    // The literals survive only inside their token definitions, never as usage.
    expect(PAGE_CSS).not.toContain('background: rgb(15 17 21');
    expect(PAGE_CSS).not.toContain('box-shadow: -16px 0 48px rgb(15 17 21');
    expect(PAGE_CSS).not.toMatch(/0\.1[56]s ease/);
    expect(PAGE_CSS).not.toMatch(/0\.2s ease/);
  });

  it('sizes shared controls from the control-size token', () => {
    expect(PAGE_CSS).toContain('min-width: var(--mote-control-size)');
    expect(PAGE_CSS).toContain('min-height: var(--mote-control-size)');
  });

  it('clears the sticky banner for footnote jumps in both directions', () => {
    expect(PAGE_CSS).toContain('article [id^="fn"] { scroll-margin-top: 76px; }');
  });

  it('routes alert semantics and syntax colors through shared tokens', () => {
    expect(PAGE_CSS).toContain('--alert-color: var(--mote-alert-note)');
    expect(PAGE_CSS).toContain('--alert-color: var(--mote-alert-tip)');
    expect(PAGE_CSS).toContain('--alert-color: var(--mote-alert-important)');
    expect(PAGE_CSS).toContain('--alert-color: var(--mote-alert-warning)');
    expect(PAGE_CSS).toContain('--alert-color: var(--mote-alert-caution)');
    // Example admonitions are neutral, not note-blue.
    expect(PAGE_CSS).toContain('.markdown-alert-example { --alert-color: var(--mote-muted); }');
    // No per-palette alert/hljs override blocks remain in the document layer.
    expect(PAGE_CSS).not.toMatch(/\.markdown-alert-\w+ \{ --alert-color: #/);
    expect(PAGE_CSS).not.toMatch(/pre \.hljs-\w+[^;]*\{ color: #/);
    // Blockquote uses the muted token in both palettes.
    expect(PAGE_CSS).not.toContain('color: #6b7280;\n  border-left');
  });
});
