import type { MarkdownIt, Token } from 'markdown-it';

const ALERTS: Record<string, { title: string; icon: string }> = {
  NOTE: { title: 'Note', icon: '<circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.5v.5"/>' },
  TIP: {
    title: 'Tip',
    icon: '<path d="M5.5 11C5.5 9 3 9 3 6a5 5 0 0 1 10 0c0 3-2.5 3-2.5 5M5.5 12h5M6 14h4"/>',
  },
  IMPORTANT: { title: 'Important', icon: '<path d="M3 2h10v9H8l-4 3v-3H3zM8 4v3M8 8.5v.5"/>' },
  WARNING: { title: 'Warning', icon: '<path d="m8 2 7 12H1zM8 6v3M8 10.5v.5"/>' },
  CAUTION: { title: 'Caution', icon: '<path d="m5 1-4 4v6l4 4h6l4-4V5l-4-4zM8 4v5M8 11v1"/>' },
};

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

  md.renderer.rules.mote_alert_title = (tokens, index) => {
    const alert = ALERTS[tokens[index]!.content]!;
    return `<p class="markdown-alert-title"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${alert.icon}</svg>${alert.title}</p>\n`;
  };
}
