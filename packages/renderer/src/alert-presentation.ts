import { ADMONITION_LABELS, type ContainerMeta } from '@mote/core';

import { escapeHtml } from './escape.js';

const ICONS: Record<ContainerMeta['type'], string> = {
  note: '<circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.5v.5"/>',
  tip: '<path d="M5.5 11C5.5 9 3 9 3 6a5 5 0 0 1 10 0c0 3-2.5 3-2.5 5M5.5 12h5M6 14h4"/>',
  important: '<path d="M3 2h10v9H8l-4 3v-3H3zM8 4v3M8 8.5v.5"/>',
  warning: '<path d="m8 2 7 12H1zM8 6v3M8 10.5v.5"/>',
  caution: '<path d="m5 1-4 4v6l4 4h6l4-4V5l-4-4zM8 4v5M8 11v1"/>',
  example:
    '<rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="m6 6-2 2 2 2m4-4 2 2-2 2"/>',
  success: '<circle cx="8" cy="8" r="6"/><path d="m4.5 8 2.5 2.5 4.5-5"/>',
};

/** One title/icon treatment for GitHub alerts and extended admonitions. */
export function renderAlertTitle(
  type: ContainerMeta['type'],
  title: string = ADMONITION_LABELS[type],
  tag: 'p' | 'summary' = 'p',
): string {
  return `<${tag} class="markdown-alert-title"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[type]}</svg><span>${escapeHtml(title)}</span></${tag}>\n`;
}
