import type { MarkdownIt, StateBlock } from 'markdown-it';

export const CONTAINER_LIMITS = {
  opener: 512,
  title: 160,
  depth: 8,
  components: 256,
  source: 128 * 1024,
  panels: 16,
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
  tabs: number;
  rejectedUntil: number;
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
 * Shared structural tokens for admonitions and content tabs. Default rendering is static
 * and readable; presentation may override these rules without reparsing text.
 */
export function containerSyntax(md: MarkdownIt): void {
  // StateBlock is new for each parse, even if a caller reuses the parser or env.
  const budgets = new WeakMap<StateBlock, Budget>();
  md.block.ruler.before('fence', 'mote_container', (state, startLine, endLine, silent) => {
    if (!['root', 'mote_container', 'mote_panel'].includes(state.parentType)) return false;
    if (
      state.sCount[startLine] !== state.blkIndent ||
      !hasIndent(state, startLine, state.blkIndent)
    )
      return false;
    const start = state.bMarks[startLine]! + state.blkIndent;
    if (state.eMarks[startLine]! - start > CONTAINER_LIMITS.opener) return false;
    const meta = opener(state.src.slice(start, state.eMarks[startLine]));
    if (!meta || startLine + 1 >= endLine || !state.isEmpty(startLine + 1)) return false;

    const budget = budgets.get(state) ?? {
      depth: 0,
      components: 0,
      units: 0,
      coveredEnd: 0,
      tabs: 0,
      rejectedUntil: 0,
    };
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
  md.block.ruler.before('fence', 'mote_tabs', (state, startLine, endLine, silent) => {
    if (!['root', 'mote_container', 'mote_panel'].includes(state.parentType)) return false;
    const budget = budgets.get(state) ?? {
      depth: 0,
      components: 0,
      units: 0,
      coveredEnd: 0,
      tabs: 0,
      rejectedUntil: 0,
    };
    if (budget.tabs || startLine < budget.rejectedUntil) return false;
    const panels: { label: string; start: number; bodyStart: number; end: number }[] = [];
    const indent = state.blkIndent + 4;
    let line = startLine,
      panelCount = 0,
      groupEnd = startLine;
    // Scan once before emitting or charging anything. Rejected groups remember
    // their end so a later member cannot accidentally become a smaller group.
    while (line < endLine) {
      if (state.sCount[line] !== state.blkIndent || !hasIndent(state, line, state.blkIndent)) break;
      const start = state.bMarks[line]! + state.blkIndent;
      if (state.eMarks[line]! - start > CONTAINER_LIMITS.opener) break;
      const match = /^=== +"((?:[^"\\]|\\["\\])*)" *$/.exec(
        state.src.slice(start, state.eMarks[line]),
      );
      if (!match) break;
      const label = match[1]!.replace(/\\(["\\])/g, '$1');
      if (
        !label.trim() ||
        label.length > CONTAINER_LIMITS.title ||
        line + 1 >= endLine ||
        !state.isEmpty(line + 1)
      )
        break;
      let bodyStart = line + 2;
      while (bodyStart < endLine && state.isEmpty(bodyStart)) bodyStart++;
      if (bodyStart >= endLine || !hasIndent(state, bodyStart, indent)) break;
      let bodyEnd = bodyStart;
      for (let next = bodyStart; next < endLine; next++) {
        if (state.isEmpty(next)) continue;
        if (!hasIndent(state, next, indent)) break;
        bodyEnd = next + 1;
      }
      panelCount++;
      groupEnd = bodyEnd;
      if (panelCount <= CONTAINER_LIMITS.panels)
        panels.push({ label, start: line, bodyStart, end: bodyEnd });
      line = bodyEnd;
      while (line < endLine && state.isEmpty(line)) line++;
    }
    if (!panels.length) return false;
    const sourceEnd = state.bMarks[groupEnd]!;
    const extra = Math.max(0, sourceEnd - Math.max(state.bMarks[startLine]!, budget.coveredEnd));
    if (
      panelCount > CONTAINER_LIMITS.panels ||
      budget.depth + 2 > CONTAINER_LIMITS.depth ||
      budget.components + 1 + panels.length > CONTAINER_LIMITS.components ||
      budget.units + extra > CONTAINER_LIMITS.source
    ) {
      if (!silent) {
        budget.rejectedUntil = groupEnd;
        budgets.set(state, budget);
      }
      return false;
    }
    if (silent) return true;
    budgets.set(state, budget);
    // Reserve all panels now; nested components may only spend what remains.
    budget.components += 1 + panels.length;
    budget.units += extra;
    budget.coveredEnd = Math.max(budget.coveredEnd, sourceEnd);
    budget.depth += 2;
    budget.tabs++;
    const open = state.push('mote_tabs_open', 'div', 1);
    open.map = [startLine, groupEnd];
    const oldIndent = state.blkIndent,
      oldParent = state.parentType,
      oldLineMax = state.lineMax;
    try {
      for (const panel of panels) {
        const token = state.push('mote_panel_open', 'section', 1);
        token.map = [panel.start, panel.end];
        const title = state.push('mote_panel_title', '', 0);
        title.content = panel.label;
        state.blkIndent = indent;
        state.parentType = 'mote_panel';
        state.lineMax = panel.end;
        state.md.block.tokenize(state, panel.bodyStart, panel.end);
        state.push('mote_panel_close', 'section', -1);
      }
    } finally {
      state.blkIndent = oldIndent;
      state.parentType = oldParent;
      state.lineMax = oldLineMax;
      budget.depth -= 2;
      budget.tabs--;
    }
    state.push('mote_tabs_close', 'div', -1);
    state.line = groupEnd;
    return true;
  });
  md.renderer.rules.mote_panel_title = (tokens, index) =>
    `<p>${md.utils.escapeHtml(tokens[index]!.content)}</p>\n`;
  // No paragraph interruption: candidate markers in an existing paragraph are text.
  md.renderer.rules.mote_container_title = (tokens, index) =>
    `<p>${md.utils.escapeHtml(tokens[index]!.content)}</p>\n`;
}
