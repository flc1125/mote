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
});
