import type { MarkdownIt, StateBlock } from 'markdown-it';

export const CONTAINER_LIMITS = {
  opener: 512,
  title: 160,
  depth: 8,
  components: 256,
  source: 128 * 1024,
} as const;

export const ADMONITION_LABELS = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
  example: 'Example',
  success: 'Success',
} as const;

export interface ContainerMeta {
  type: keyof typeof ADMONITION_LABELS;
  mode: 'static' | 'closed' | 'open';
  title: string;
}

interface Budget {
  depth: number;
  components: number;
  units: number;
  coveredEnd: number;
}

function opener(line: string): ContainerMeta | null {
  const match =
    /^(!!!|\?\?\?\+?) +(note|tip|important|warning|caution|example|success)(?: +"((?:[^"\\]|\\["\\])*)")? *$/.exec(
      line,
    );
  if (!match) return null;
  const type = match[2] as ContainerMeta['type'];
  const mode = match[1] === '!!!' ? 'static' : match[1] === '???' ? 'closed' : 'open';
  let title =
    match[3] === undefined ? ADMONITION_LABELS[type] : match[3].replace(/\\(["\\])/g, '$1');
  if (title.length > CONTAINER_LIMITS.title) return null;
  if (mode !== 'static' && title.trim() === '') title = ADMONITION_LABELS[type];
  return { type, mode, title };
}

/** Four literal spaces per structural level; Markdown handles any remaining indent. */
function hasIndent(state: StateBlock, line: number, indent: number): boolean {
  const start = state.bMarks[line]!;
  if (state.eMarks[line]! - start < indent) return false;
  for (let i = 0; i < indent; i++) if (state.src.charCodeAt(start + i) !== 32) return false;
  return true;
}

/**
 * Shared structural tokens for admonitions. Default rendering is static
 * and readable; presentation may override these rules without reparsing text.
 * Tab groups belong to the subsequent phase and are not recognized here.
 */
export function containerSyntax(md: MarkdownIt): void {
  // StateBlock is new for each parse, even if a caller reuses the parser or env.
  const budgets = new WeakMap<StateBlock, Budget>();
  md.block.ruler.before('fence', 'mote_container', (state, startLine, endLine, silent) => {
    if (state.parentType !== 'root' && state.parentType !== 'mote_container') return false;
    if (
      state.sCount[startLine] !== state.blkIndent ||
      !hasIndent(state, startLine, state.blkIndent)
    )
      return false;
    const start = state.bMarks[startLine]! + state.blkIndent;
    if (state.eMarks[startLine]! - start > CONTAINER_LIMITS.opener) return false;
    const meta = opener(state.src.slice(start, state.eMarks[startLine]));
    if (!meta || startLine + 1 >= endLine || !state.isEmpty(startLine + 1)) return false;

    const budget = budgets.get(state) ?? { depth: 0, components: 0, units: 0, coveredEnd: 0 };
    if (budget.depth >= CONTAINER_LIMITS.depth || budget.components >= CONTAINER_LIMITS.components)
      return false;
    let bodyStart = startLine + 2;
    while (bodyStart < endLine && state.isEmpty(bodyStart)) bodyStart++;
    const indent = state.blkIndent + 4;
    if (bodyStart >= endLine || !hasIndent(state, bodyStart, indent)) return false;
    let bodyEnd = bodyStart;
    for (let line = bodyStart; line < endLine; line++) {
      if (state.isEmpty(line)) continue;
      if (!hasIndent(state, line, indent)) break;
      bodyEnd = line + 1;
    }
    // Accepted source intervals are nested or disjoint in source order. A high
    // water mark counts their union, including headers and intervening blanks.
    const sourceStart = state.bMarks[startLine]!;
    const sourceEnd = state.bMarks[bodyEnd]!;
    const extra = Math.max(0, sourceEnd - Math.max(sourceStart, budget.coveredEnd));
    if (budget.units + extra > CONTAINER_LIMITS.source) return false;
    if (silent) return true;

    budgets.set(state, budget);
    budget.components++;
    budget.units += extra;
    budget.coveredEnd = Math.max(budget.coveredEnd, sourceEnd);
    budget.depth++;
    const oldIndent = state.blkIndent;
    const oldParent = state.parentType;
    const oldLineMax = state.lineMax;
    const open = state.push('mote_container_open', 'div', 1);
    open.meta = { ...meta };
    open.map = [startLine, bodyEnd];
    if (meta.title !== '') {
      const title = state.push('mote_container_title', '', 0);
      title.content = meta.title;
    }
    state.blkIndent = indent;
    state.parentType = 'mote_container';
    // Reference definitions and block rules must not look past this body.
    state.lineMax = bodyEnd;
    try {
      state.md.block.tokenize(state, bodyStart, bodyEnd);
    } finally {
      state.blkIndent = oldIndent;
      state.parentType = oldParent;
      state.lineMax = oldLineMax;
      budget.depth--;
    }
    state.push('mote_container_close', 'div', -1);
    state.line = bodyEnd;
    return true;
  });
  // No paragraph interruption: candidate markers in an existing paragraph are text.
  md.renderer.rules.mote_container_title = (tokens, index) =>
    `<p>${md.utils.escapeHtml(tokens[index]!.content)}</p>\n`;
}
