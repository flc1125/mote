import type { MarkdownIt } from 'markdown-it';

export const ABBREVIATION_LIMITS = {
  definitions: 64,
  term: 64,
  title: 512,
  definitionUnits: 16384,
  textUnits: 65536,
  candidates: 4096,
  replacements: 512,
} as const;

/** Bounded, document-local abbreviations; definitions are top-level single lines. */
export function abbreviations(md: MarkdownIt): void {
  const documents = new WeakMap<object, { terms: Map<string, string>; units: number }>();
  md.core.ruler.before('block', 'mote_abbreviation_reset', (state) => {
    documents.set(state.env, { terms: new Map(), units: 0 });
  });
  md.block.ruler.before('reference', 'mote_abbreviation_definition', (state, line, end, silent) => {
    if (state.parentType !== 'root' || state.blkIndent !== 0 || state.sCount[line] !== 0)
      return false;
    const start = state.bMarks[line]!;
    const length = state.eMarks[line]! - start;
    if (length > ABBREVIATION_LIMITS.term + ABBREVIATION_LIMITS.title + 6) return false;
    const match = /^\*\[([^[\]\\]+)\]:[ \t]+(.+)$/.exec(state.src.slice(start, state.eMarks[line]));
    if (!match) return false;
    const term = match[1]!;
    const title = match[2]!.trim();
    const document = documents.get(state.env);
    if (
      !document ||
      term.trim() !== term ||
      term.length > ABBREVIATION_LIMITS.term ||
      !title ||
      title.length > ABBREVIATION_LIMITS.title ||
      document.units + length > ABBREVIATION_LIMITS.definitionUnits ||
      (!document.terms.has(term) && document.terms.size >= ABBREVIATION_LIMITS.definitions)
    )
      return false;
    if (silent) return true;
    document.units += length;
    if (!document.terms.has(term)) document.terms.set(term, title);
    state.line = line + 1;
    return true;
  });

  md.core.ruler.push('mote_abbreviations', (state) => {
    const definitions = documents.get(state.env)?.terms;
    if (!definitions?.size) return;
    const terms = [...definitions.keys()].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
      terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
      'gu',
    );
    const word = /[\p{L}\p{N}\p{M}_]/u;
    let units = 0;
    let candidates = 0;
    let replacements = 0;
    for (const inline of state.tokens) {
      // Raw HTML retains its own semantics; never reinterpret its attributes or contents.
      if (
        inline.type !== 'inline' ||
        !inline.children ||
        inline.children.some((t) => t.type === 'html_inline')
      )
        continue;
      const result = [];
      let linkDepth = 0;
      for (const child of inline.children) {
        if (child.type === 'link_open') linkDepth++;
        if (child.type === 'link_close') linkDepth--;
        if (
          child.type !== 'text' ||
          linkDepth ||
          replacements >= ABBREVIATION_LIMITS.replacements ||
          candidates >= ABBREVIATION_LIMITS.candidates
        ) {
          result.push(child);
          continue;
        }
        units += child.content.length;
        if (units > ABBREVIATION_LIMITS.textUnits) {
          result.push(child);
          continue;
        }
        pattern.lastIndex = 0;
        let cursor = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(child.content))) {
          if (
            ++candidates > ABBREVIATION_LIMITS.candidates ||
            replacements >= ABBREVIATION_LIMITS.replacements
          )
            break;
          const start = match.index;
          const end = start + match[0].length;
          // Unicode boundaries also protect adjacent Chinese words and combining marks.
          const before =
            Array.from(child.content.slice(Math.max(0, start - 2), start)).at(-1) ?? '';
          const after = String.fromCodePoint(child.content.codePointAt(end) ?? 32);
          if (word.test(before) || word.test(after)) continue;
          if (start > cursor) {
            const text = new state.Token('text', '', 0);
            text.content = child.content.slice(cursor, start);
            result.push(text);
          }
          const open = new state.Token('abbr_open', 'abbr', 1);
          open.attrSet('title', definitions.get(match[0])!);
          const text = new state.Token('text', '', 0);
          text.content = match[0];
          result.push(open, text, new state.Token('abbr_close', 'abbr', -1));
          cursor = end;
          replacements++;
        }
        if (!cursor) result.push(child);
        else if (cursor < child.content.length) {
          const text = new state.Token('text', '', 0);
          text.content = child.content.slice(cursor);
          result.push(text);
        }
      }
      inline.children = result;
    }
  });
}
