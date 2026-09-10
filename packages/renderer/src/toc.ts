import { escapeHtml } from './escape.js';
import type { Heading } from './headings.js';

/** Preserve all Markdown heading levels; visual indentation is capped in CSS. */
const MAX_TOC_LEVEL = 6;

interface TocNode {
  heading: Heading;
  children: TocNode[];
}

export function buildTocTree(headings: Heading[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const heading of headings) {
    if (heading.level < 1 || heading.level > MAX_TOC_LEVEL) continue;
    const node: TocNode = { heading, children: [] };

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top && top.heading.level >= heading.level) {
        stack.pop();
      } else {
        break;
      }
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }

  return roots;
}

function renderNodes(nodes: TocNode[], depth = 0, counter = { value: 0 }): string {
  const items = nodes.map((node) => {
    const text = escapeHtml(node.heading.text);
    const slug = escapeHtml(node.heading.slug);
    const groupId = `mote-toc-group-${counter.value++}`;
    const toggle = node.children.length
      ? `<button class="toc-toggle" type="button" aria-expanded="true" aria-controls="${groupId}" aria-label="Toggle subheadings: ${text}" hidden><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
      : '';
    const children = node.children.length
      ? `<ul class="toc-branch" id="${groupId}">${renderNodes(node.children, depth + 1, counter)}</ul>`
      : '';
    return `<li><div class="toc-row" title="${text}" style="--toc-depth:${Math.min(depth, 3)}">${toggle}<a href="#${slug}">${text}</a></div>${children}</li>`;
  });
  return items.join('');
}

/** Static links remain usable without the optional trusted enhancement. */
export function renderToc(headings: Heading[]): string {
  const tree = buildTocTree(headings);
  if (tree.length === 0) return '';
  return `<nav class="toc-nav" aria-label="Table of contents"><ul>${renderNodes(tree)}</ul></nav>\n`;
}
