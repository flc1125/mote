import type { MarkdownIt } from 'markdown-it';

/** Stable, linkable sections first. The fixed navigation script adds tab controls. */
export function tabs(md: MarkdownIt): void {
  md.core.ruler.after('mote_headings', 'mote_tabs', (state) => {
    const used = new Set(state.tokens.map((token) => String(token.attrGet('id') ?? '')));
    let next = 1;
    let panelId = '';
    for (const token of state.tokens) {
      if (token.type === 'mote_tabs_open') token.attrSet('class', 'content-tabs');
      if (token.type === 'mote_panel_open') {
        do {
          panelId = `mote-tab-${next++}`;
        } while (
          used.has(panelId) ||
          used.has(`${panelId}-label`) ||
          used.has(`${panelId}-control`)
        );
        used.add(panelId);
        used.add(`${panelId}-label`);
        used.add(`${panelId}-control`);
        token.attrSet('class', 'content-panel');
        token.attrSet('id', panelId);
      }
      if (token.type === 'mote_panel_title') token.attrSet('id', `${panelId}-label`);
    }
  });
  md.renderer.rules.mote_panel_title = (tokens, index) => {
    const token = tokens[index]!;
    const id = String(token.attrGet('id'));
    return `<p class="content-panel-title" id="${id}"><a href="#${id.slice(0, -6)}">${md.utils.escapeHtml(token.content)}</a></p>\n`;
  };
}
