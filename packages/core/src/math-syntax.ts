import type { MarkdownIt } from 'markdown-it';

function closingIndex(source: string, delimiter: string, start: number): number {
  let index = source.indexOf(delimiter, start);
  while (index !== -1) {
    let slashes = 0;
    for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) slashes++;
    if (slashes % 2 === 0) return index;
    index = source.indexOf(delimiter, index + delimiter.length);
  }
  return -1;
}

/** Shared tokenization keeps CLI image scanning out of TeX source. */
export function mathSyntax(md: MarkdownIt): void {
  const inlineAsText = md.renderer.renderInlineAsText;
  md.renderer.renderInlineAsText = function (tokens, options, env) {
    return tokens
      .map((token) =>
        token.type === 'mote_math_inline'
          ? token.content
          : inlineAsText.call(this, [token], options, env),
      )
      .join('');
  };
  md.inline.ruler.before('escape', 'mote_math_inline', (state, silent) => {
    const start = state.pos;
    const dollar = state.src[start] === '$';
    if (!dollar && !state.src.startsWith('\\(', start)) return false;
    const length = dollar ? 1 : 2;
    if (
      dollar &&
      (/[\s$]/u.test(state.src[start + 1] ?? ' ') || /[\w$]/u.test(state.src[start - 1] ?? ' '))
    )
      return false;
    const end = closingIndex(state.src, dollar ? '$' : '\\)', start + length);
    if (end === -1 || end >= state.posMax || state.src.slice(start, end).includes('\n'))
      return false;
    if (dollar && (/\s/u.test(state.src[end - 1] ?? ' ') || /\d/.test(state.src[end + 1] ?? '')))
      return false;
    if (!silent) {
      const token = state.push('mote_math_inline', 'math', 0);
      token.content = state.src.slice(start + length, end);
      token.markup = dollar ? '$' : '\\(';
    }
    state.pos = end + length;
    return true;
  });

  md.block.ruler.before(
    'fence',
    'mote_math_block',
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
      const first = state.src.slice(
        state.bMarks[startLine]! + state.tShift[startLine]!,
        state.eMarks[startLine],
      );
      const delimiter = first.startsWith('$$') ? '$$' : first.startsWith('\\[') ? '\\[' : null;
      if (!delimiter) return false;
      const close = delimiter === '$$' ? '$$' : '\\]';
      const parts: string[] = [];
      for (let line = startLine; line < endLine; line++) {
        if (line > startLine && state.sCount[line]! < state.blkIndent && !state.isEmpty(line))
          return false;
        const content =
          line === startLine
            ? first.slice(2)
            : state.src.slice(state.bMarks[line]! + state.tShift[line]!, state.eMarks[line]);
        const end = closingIndex(content, close, 0);
        if (end !== -1) {
          if (content.slice(end + 2).trim() !== '') return false;
          if (silent) return true;
          parts.push(content.slice(0, end));
          const token = state.push('mote_math_block', 'math', 0);
          token.block = true;
          token.content = parts.join('\n');
          token.markup = delimiter;
          token.map = [startLine, line + 1];
          state.line = line + 1;
          return true;
        }
        parts.push(content);
      }
      return false;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

  // A scanner can use the plugin without a TeX rendering dependency.
  md.renderer.rules.mote_math_inline = (tokens, index) => {
    const token = tokens[index]!;
    return md.utils.escapeHtml(token.markup + token.content + (token.markup === '$' ? '$' : '\\)'));
  };
  md.renderer.rules.mote_math_block = (tokens, index) => {
    const token = tokens[index]!;
    return `<pre><code>${md.utils.escapeHtml(token.markup + token.content + (token.markup === '$$' ? '$$' : '\\]'))}</code></pre>\n`;
  };
}
