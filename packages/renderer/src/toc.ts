import { escapeHtml } from './escape.js';
import type { Heading } from './headings.js';

/** Only h1–h3 appear in the table of contents. */
const MAX_TOC_LEVEL = 3;

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

function renderNodes(nodes: TocNode[]): string {
  const items = nodes.map((node) => {
    const children = node.children.length > 0 ? renderNodes(node.children) : '';
    return `<li><a href="#${node.heading.slug}">${escapeHtml(node.heading.text)}</a>${children}</li>`;
  });
  return `<ul>${items.join('')}</ul>`;
}

/** Renders the TOC nav block, or an empty string when there is nothing to show. */
export function renderToc(headings: Heading[]): string {
  const tree = buildTocTree(headings);
  if (tree.length === 0) return '';
  return `<nav class="toc" aria-label="Table of contents">${renderNodes(tree)}</nav>\n`;
}
