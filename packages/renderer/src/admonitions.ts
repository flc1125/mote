import type { MarkdownIt } from 'markdown-it';

import type { ContainerMeta } from '@mote/core';

import { renderAlertTitle } from './alert-presentation.js';

/** Present shared tokens without changing which body content the CLI scans. */
export function admonitions(md: MarkdownIt): void {
  md.core.ruler.after('mote_headings', 'mote_admonitions', (state) => {
    const used = new Set(state.tokens.map((token) => String(token.attrGet('id') ?? '')));
    const stack: ContainerMeta[] = [];
    let nextId = 1;
    for (const token of state.tokens) {
      if (token.type === 'mote_container_open') {
        const meta = token.meta as unknown as ContainerMeta;
        stack.push(meta);
        let id;
        do {
          id = `mote-admonition-${nextId++}`;
        } while (used.has(id));
        used.add(id);
        token.attrSet('id', id);
        token.attrSet('class', `markdown-alert markdown-alert-${meta.type}`);
        token.tag = meta.mode === 'static' ? 'div' : 'details';
        if (meta.mode === 'open') token.attrSet('open', '');
      } else if (token.type === 'mote_container_title') {
        token.meta = { ...stack[stack.length - 1]! };
      } else if (token.type === 'mote_container_close') {
        token.tag = stack.pop()!.mode === 'static' ? 'div' : 'details';
      }
    }
  });
  md.renderer.rules.mote_container_title = (tokens, index) => {
    const token = tokens[index]!;
    const meta = token.meta as unknown as ContainerMeta;
    return renderAlertTitle(meta.type, token.content, meta.mode === 'static' ? 'p' : 'summary');
  };
}
