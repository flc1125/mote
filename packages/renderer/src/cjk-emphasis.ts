import type { MarkdownIt } from 'markdown-it';

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const CJK_PUNCTUATION = /[\u2018-\u201f\u3001-\u303f\uff01-\uff65]/u;

/** Extend punctuation boundaries for **strong** without rewriting source text. */
export function cjkEmphasis(md: MarkdownIt): void {
  md.inline.ruler.before('emphasis', 'mote_cjk_emphasis', (state, silent) => {
    if (silent || state.src[state.pos] !== '*' || state.src[state.pos + 1] !== '*') {
      return false;
    }

    const scanned = state.scanDelims(state.pos, true);
    // Read whole Unicode characters on either side, including supplementary Han.
    const before = Array.from(state.src.slice(Math.max(0, state.pos - 2), state.pos)).at(-1) ?? ' ';
    const after = String.fromCodePoint(state.src.codePointAt(state.pos + scanned.length) ?? 32);
    const beforePunct = md.utils.isPunctChar(before);
    const afterPunct = md.utils.isPunctChar(after);
    const open =
      scanned.can_open ||
      (afterPunct && !/\s/u.test(before) && (CJK_PUNCTUATION.test(after) || CJK.test(before)));
    const close =
      scanned.can_close ||
      (beforePunct && !/\s/u.test(after) && (CJK_PUNCTUATION.test(before) || CJK.test(after)));
    if (open === scanned.can_open && close === scanned.can_close) return false;

    // Emit the same delimiter entries as native emphasis. Its balance_pairs and
    // post-processing still own matching, nesting, and the rule of three.
    for (let i = 0; i < scanned.length; i++) {
      state.push('text', '', 0).content = '*';
      state.delimiters.push({
        marker: 42,
        length: scanned.length,
        token: state.tokens.length - 1,
        end: -1,
        open,
        close,
      });
    }
    state.pos += scanned.length;
    return true;
  });
}
