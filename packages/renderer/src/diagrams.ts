import { parseMermaid, renderMermaidSVG } from 'beautiful-mermaid';
import type { MarkdownIt } from 'markdown-it';

import { sanitizeDiagramSvg } from './diagram-svg.js';
import { escapeHtml } from './escape.js';
import { normalizeFlowchart } from './flowchart.js';

/** ELK expects a Node-style global and briefly changes self/timers on init. */
function renderSvg(source: string): string {
  const keys = ['global', 'self', 'setTimeout'] as const;
  const before = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const stackLimit = Object.getOwnPropertyDescriptor(Error, 'stackTraceLimit');
  try {
    if (!('global' in globalThis))
      Object.defineProperty(globalThis, 'global', { value: globalThis, configurable: true });
    // Entirely synchronous: restore every touched global before returning.
    return renderMermaidSVG(source, { font: 'sans-serif', transparent: true, interactive: false });
  } finally {
    keys.forEach((key, index) => {
      const descriptor = before[index];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
    if (stackLimit) Object.defineProperty(Error, 'stackTraceLimit', stackLimit);
    else Reflect.deleteProperty(Error, 'stackTraceLimit');
  }
}

export function diagrams(md: MarkdownIt): void {
  const fence = md.renderer.rules.fence!;
  let count = 0;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]!;
    if (token.info.trim().toLowerCase() !== 'mermaid')
      return fence(tokens, index, options, env, self);
    const fallback = () =>
      `<figure class="mermaid-diagram"><figcaption>Mermaid · 暂以源码显示</figcaption>${fence(tokens, index, options, env, self)}</figure>\n`;
    const source = token.content;
    if (
      count >= 4 ||
      source.length > 4096 ||
      source.split('\n').length > 64 ||
      (source.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0) > 256
    )
      return fallback();
    count++;
    // Interactive links, arbitrary styling and config directives are outside
    // this static subset. Preserve the source rather than silently applying it.
    if (
      /(?:^|;)\s*(?:click|style|classDef|linkStyle|class\s+\w+\s+\w+)\b/m.test(source) ||
      source.includes('%%{') ||
      source.includes(':::')
    )
      return fallback();
    const header =
      source
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith('%%')) ?? '';
    const layoutSource = /^(graph|flowchart)\s/.test(header) ? normalizeFlowchart(source) : source;
    if (
      !/^(?:graph\s|flowchart\s|stateDiagram(?:-v2)?\b|sequenceDiagram\b|classDiagram\b|erDiagram\b|xychart-beta\b)/.test(
        header,
      )
    )
      return fallback();
    if ((source.match(/--|==|\.\./g)?.length ?? 0) > 64) return fallback();
    if (header.startsWith('xychart')) {
      // The chart engine advances tick values by floating-point addition.
      // Bound magnitude and precision before layout so tiny increments cannot
      // stop making progress at large values (or overflow to Infinity).
      const numbers = source.match(/[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) ?? [];
      if (
        numbers.some(
          (number) =>
            !/^[-+]?\d{1,7}(?:\.\d{1,6})?$/.test(number) || Math.abs(Number(number)) > 1_000_000,
        )
      )
        return fallback();
    }
    try {
      if (/^(graph|flowchart|stateDiagram)/.test(header)) {
        const graph = parseMermaid(layoutSource);
        if (
          graph.nodes.size === 0 ||
          graph.nodes.size > 32 ||
          graph.edges.length > 48 ||
          graph.subgraphs.length > 8
        )
          return fallback();
      }
      const svg = sanitizeDiagramSvg(renderSvg(layoutSource), `mote-diagram:${count}:`);
      if (!svg) return fallback();
      return `<figure class="mermaid-diagram"><div class="diagram-scroll" role="region" aria-label="图表 / Diagram" tabindex="0">${svg}</div><details><summary>查看 Mermaid 源码</summary><pre><code class="language-mermaid">${escapeHtml(source)}</code></pre></details></figure>\n`;
    } catch {
      return fallback();
    }
  };
}
