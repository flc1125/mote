// highlight.js types include DOM; also retain iterable Web API definitions.
/// <reference lib="dom.iterable" />

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const highlighter = hljs.newInstance();
for (const [name, grammar] of Object.entries({
  bash,
  c,
  cpp,
  css,
  diff,
  go,
  java,
  javascript,
  json,
  markdown,
  python,
  rust,
  sql,
  typescript,
  xml,
  yaml,
})) {
  highlighter.registerLanguage(name, grammar);
}

/** Per-document budgets; empty output asks markdown-it to escape plain code. */
export function createCodeHighlighter(): (code: string, language: string) => string {
  let remainingInput = 65_536;
  let remainingOutput = 524_288;
  let remainingBlocks = 64;
  return (code, language) => {
    const name = language.toLowerCase();
    if (
      !highlighter.getLanguage(name) ||
      code.length > 16_384 ||
      code.length > remainingInput ||
      remainingBlocks === 0 ||
      code.split('\n').some((line) => line.length > 4096)
    )
      return '';
    remainingBlocks--;
    remainingInput -= code.length;
    try {
      // Never auto-detect: only the explicitly registered grammar may run.
      const result = highlighter.highlight(code, { language: name, ignoreIllegals: true });
      if (result.value.length > 262_144 || result.value.length > remainingOutput) return '';
      remainingOutput -= result.value.length;
      return result.value;
    } catch {
      return '';
    }
  };
}
