import type { MarkdownIt } from 'markdown-it';

/** A deliberately small attribute subset; never reinterpret the image URL. */
export function imageSyntax(md: MarkdownIt): void {
  md.inline.ruler.before('text', 'mote_image_width', (state, silent) => {
    const image = state.tokens.at(-1);
    if (silent || state.pending !== '' || image?.type !== 'image' || image.attrGet('width'))
      return false;
    if (state.src[state.pos] !== '{') return false;
    const tail = state.src.slice(state.pos, Math.min(state.posMax, state.pos + 64));
    const match = /^\{ *width="([1-9]\d{0,3})(%?)" *\}/.exec(tail);
    if (!match || Number(match[1]) > (match[2] ? 100 : 4096)) return false;
    image.attrSet('width', match[1]! + match[2]!);
    state.pos += match[0].length;
    return true;
  });

  // Reuse parsed inline tokens, including sanitized HTML in the renderer.
  // Never parse a candidate twice: inline parsing can allocate footnote references.
  md.core.ruler.after('inline', 'mote_image_caption', (state) => {
    let attempts = 0;
    let units = 0;
    for (let i = 0; i < state.tokens.length - 2; i++) {
      const open = state.tokens[i]!;
      const inline = state.tokens[i + 1]!;
      const close = state.tokens[i + 2]!;
      if (
        open.type !== 'paragraph_open' ||
        inline.type !== 'inline' ||
        close.type !== 'paragraph_close'
      )
        continue;
      const source = inline.content;
      if (!source.includes('\n/// caption\n')) continue;
      if (++attempts > 64 || (units += source.length) > 65536) break;
      if (source.length > 8192) continue;
      const lines = source.split('\n');
      if (
        lines.length < 4 ||
        lines.length > 35 ||
        lines[1] !== '/// caption' ||
        lines.at(-1) !== '///'
      )
        continue;
      const first = lines[0]!;
      const caption = lines.slice(2, -1).join('\n');
      if (first.length > 4096 || caption.length > 4096 || !caption.trim()) continue;
      const children = inline.children;
      if (
        !children ||
        children[0]?.type !== 'image' ||
        children[1]?.type !== 'softbreak' ||
        children[2]?.type !== 'text' ||
        children[2].content !== '/// caption' ||
        children[3]?.type !== 'softbreak' ||
        children.at(-2)?.type !== 'softbreak' ||
        children.at(-1)?.type !== 'text' ||
        children.at(-1)?.content !== '///'
      )
        continue;
      open.type = 'mote_figure_open';
      open.tag = 'figure';
      open.hidden = false;
      open.attrSet('class', 'mote-figure');
      close.type = 'mote_figure_close';
      close.tag = 'figure';
      close.hidden = false;
      inline.content = first;
      inline.children = [children[0]];
      const captionOpen = new state.Token('mote_caption_open', 'figcaption', 1);
      const body = new state.Token('inline', '', 0);
      body.content = caption;
      body.children = children.slice(4, -2);
      const captionClose = new state.Token('mote_caption_close', 'figcaption', -1);
      state.tokens.splice(i + 2, 0, captionOpen, body, captionClose);
      i += 5;
    }
  });
}
