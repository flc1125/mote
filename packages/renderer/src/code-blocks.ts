import { Parser } from 'htmlparser2';
import type { MarkdownIt } from 'markdown-it';

import { escapeHtml } from './escape.js';
import { parseFenceMeta } from './fence-meta.js';

/** Reopen highlighter spans at line boundaries, preserving decoded text exactly. */
function linesOf(html: string): string[] | null {
  const lines = [''];
  const stack: string[] = [];
  let valid = true;
  const append = (text: string) => {
    lines[lines.length - 1] += text;
  };
  new Parser({
    onopentag(tag, attrs) {
      if (tag !== 'span' || Object.keys(attrs).some((key) => key !== 'class')) valid = false;
      const open = `<span class="${escapeHtml(attrs.class ?? '')}">`;
      stack.push(open);
      append(open);
    },
    onclosetag(tag) {
      if (tag !== 'span' || !stack.length) valid = false;
      stack.pop();
      append('</span>');
    },
    ontext(text) {
      text.split('\n').forEach((part, index) => {
        if (index) {
          append('</span>'.repeat(stack.length));
          lines.push(stack.join(''));
        }
        append(escapeHtml(part));
      });
    },
  }).end(html);
  return valid ? lines : null;
}

export function codeBlocks(md: MarkdownIt): void {
  const fence = md.renderer.rules.fence!;
  let blocks = 0;
  let units = 0;
  let lineCount = 0;
  let addedBytes = 0;
  const encoder = new TextEncoder();
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]!;
    const original = fence(tokens, index, options, env, self);
    const info = token.info.trimStart();
    const language = /^\S+/.exec(info)?.[0] ?? '';
    // Special renderers retain their own source/fallback UI.
    if (language.toLowerCase() === 'mermaid') return original;
    const source = token.content;
    if (source.length > 16384 || blocks >= 64 || units + source.length > 65536) return original;
    const count = source === '' ? 0 : source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
    if (count > 512 || lineCount + count > 4096) return original;
    const meta =
      language && !/^(?:title|linenums|hl_lines)=/.test(language)
        ? parseFenceMeta(info.slice(language.length))
        : {};
    if (source === '' && !meta.title) return original;
    const match = /^<pre><code([^>]*)>([\s\S]*)<\/code><\/pre>\n$/.exec(original);
    if (!match) return original;
    // Charge attempts too: repeated output-budget fallbacks must not bypass
    // the document's parsing/decoration work limit.
    blocks++;
    units += source.length;
    lineCount += count;
    let code = match[2]!;
    if (count && (meta.start !== undefined || meta.ranges?.length)) {
      const lines = linesOf(code);
      if (!lines) return original;
      if (source.endsWith('\n')) lines.pop();
      if (lines.length !== count) return original;
      code = lines
        .map((line, i) => {
          const marked = meta.ranges?.some(([start, end]) => i + 1 >= start && i + 1 <= end);
          const number =
            meta.start === undefined
              ? ''
              : `<span class="code-line-number" aria-hidden="true" data-line="${meta.start + i}"></span>`;
          return (
            `<span class="code-line${marked ? ' is-highlighted' : ''}">${number}${line}</span>` +
            (i < lines.length - 1 || source.endsWith('\n') ? '\n' : '')
          );
        })
        .join('');
    }
    const title = meta.title ? `<span class="code-title">${escapeHtml(meta.title)}</span>` : '';
    // Icon-only button (standalone-button spec: 18px, viewBox 24, stroke 1.8).
    // The script swaps .code-icon-copy for .code-icon-copied via .is-copied.
    const copy =
      source === ''
        ? ''
        : '<button type="button" class="code-copy" aria-label="Copy code" title="Copy code" hidden>' +
          '<svg class="code-icon-copy" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          '<svg class="code-icon-copied" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>' +
          '</button><span class="code-copy-status" role="status"></span>';
    const toolbar = title ? `<div class="code-toolbar">${title}${copy}</div>` : '';
    const lineDigits =
      meta.start !== undefined && count ? String(meta.start + count - 1).length : 0;
    const result = `<div class="code-block${title ? '' : ' is-compact'}${count && (meta.start !== undefined || meta.ranges?.length) ? ' has-code-lines' : ''}${lineDigits ? ' has-line-numbers' : ''}"${lineDigits ? ` data-line-digits="${lineDigits}"` : ''}>${toolbar}<pre tabindex="0" aria-label="Code"><code${match[1]}>${code}</code></pre>${title ? '' : copy}</div>\n`;
    const extra = Math.max(0, encoder.encode(result).length - encoder.encode(original).length);
    if (extra > 32768 || addedBytes + extra > 262144) return original;
    addedBytes += extra;
    if (copy && env) env.codeCopy = true;
    return result;
  };
}
