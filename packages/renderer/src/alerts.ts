import type { MarkdownIt, Token } from 'markdown-it';

import { renderAlertTitle } from './alert-presentation.js';
import type { ContainerMeta } from '@mote/core';

/** Recognize a standalone alert marker before inline links consume it. */
export function alerts(md: MarkdownIt): void {
  md.core.ruler.after('block', 'mote_alerts', (state) => {
    const output: Token[] = [];
    const quotes: boolean[] = [];
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i]!;
      if (token.type === 'blockquote_close') {
        if (quotes.pop()) token.tag = 'div';
      } else if (token.type === 'blockquote_open') {
        const paragraph = state.tokens[i + 1];
        const inline = state.tokens[i + 2];
        const match =
          token.level === 0 && paragraph?.type === 'paragraph_open' && inline?.type === 'inline'
            ? /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i.exec(inline.content)
            : null;
        quotes.push(Boolean(match));
        if (match && inline) {
          const kind = match[1]!.toUpperCase();
          token.tag = 'div';
          token.attrSet('class', `markdown-alert markdown-alert-${kind.toLowerCase()}`);
          output.push(token);
          const title = new state.Token('mote_alert_title', 'p', 0);
          title.content = kind;
          title.block = true;
          output.push(title);
          inline.content = inline.content.slice(match[0].length);
          // A marker-only paragraph must not leave an empty line above lists/code.
          if (inline.content === '') i += 3;
          continue;
        }
      }
      output.push(token);
    }
    state.tokens = output;
  });

  md.renderer.rules.mote_alert_title = (tokens, index) =>
    renderAlertTitle(tokens[index]!.content.toLowerCase() as ContainerMeta['type']);
}
