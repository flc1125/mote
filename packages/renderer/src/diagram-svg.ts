import { Parser } from 'htmlparser2';

import { escapeHtml } from './escape.js';

const TAGS = new Set([
  'svg',
  'g',
  'defs',
  'marker',
  'clipPath',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
]);
const NUMBERS = new Set([
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'dx',
  'dy',
  'refX',
  'refY',
  'markerWidth',
  'markerHeight',
  'font-size',
  'stroke-width',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
]);
const PAINT =
  /^(?:none|currentColor|#[\da-f]{3,8}|var\(--(?:bg|fg|_text|_text-sec|_text-muted|_text-faint|_line|_arrow|_node-fill|_node-stroke|_group-fill|_group-hdr|_inner-stroke|_key-badge)\))$/i;
const ENUMS: Record<string, RegExp> = {
  'text-anchor': /^(start|middle|end)$/,
  'font-weight': /^(normal|bold|[1-9]00)$/,
  'font-style': /^(normal|italic|oblique)$/,
  'stroke-linecap': /^(butt|round|square)$/,
  'stroke-linejoin': /^(miter|round|bevel)$/,
  'fill-rule': /^(nonzero|evenodd)$/,
  orient: /^(auto|auto-start-reverse)$/,
  markerUnits: /^(strokeWidth|userSpaceOnUse)$/,
  clipPathUnits: /^(objectBoundingBox|userSpaceOnUse)$/,
  'dominant-baseline': /^(auto|middle|central|hanging|alphabetic)$/,
};

/** Separate allowlist for generated SVG. Raw Markdown SVG remains forbidden. */
export function sanitizeDiagramSvg(svg: string, prefix: string): string | null {
  if (svg.length > 262_144) return null;
  let out = '';
  let dropped = 0;
  let invalid = false;
  let roots = 0;
  const stack: string[] = [];
  const parser = new Parser(
    {
      onopentag(tag, attrs) {
        if (dropped) {
          dropped++;
          return;
        }
        // The renderer's stylesheet includes a web-font import. Use our scoped
        // stylesheet instead; never pass generated CSS or user styles through.
        if (tag === 'style') {
          dropped = 1;
          return;
        }
        if (!TAGS.has(tag) || (tag === 'svg' && stack.length > 0)) {
          invalid = true;
          dropped = 1;
          return;
        }
        if (tag === 'svg') roots++;
        if (!stack.length && tag !== 'svg') invalid = true;
        stack.push(tag);
        out += `<${tag}`;
        if (tag === 'svg')
          out += ' xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mermaid diagram"';
        for (const [name, value] of Object.entries(attrs)) {
          let safe: string | null = null;
          if (name === 'id' && /^[\w-]+$/.test(value)) safe = prefix + value;
          else if (name === 'class') {
            const classes = value.split(/\s+/).flatMap((part) => {
              if (/^xychart-(?:grid|bar|line|line-shadow|dot|label|axis-title|title)$/.test(part))
                return [`mote-${part}`];
              const color = /^xychart-color-(\d{1,3})$/.exec(part);
              return color ? [`mote-xychart-color-${Number(color[1]) % 8}`] : [];
            });
            if (classes.length) safe = classes.join(' ');
          } else if (['marker-start', 'marker-end', 'clip-path'].includes(name)) {
            const match = /^url\(#([\w-]+)\)$/.exec(value);
            if (match) safe = `url(#${prefix}${match[1]})`;
          } else if (
            NUMBERS.has(name) &&
            /^-?\d+(?:\.\d+)?(?:em|px|%)?$/.test(value) &&
            Math.abs(parseFloat(value)) <= 5000
          )
            safe = value;
          else if ((name === 'fill' || name === 'stroke') && PAINT.test(value)) safe = value;
          else if (ENUMS[name]?.test(value)) safe = value;
          else if (['points', 'stroke-dasharray'].includes(name) && /^[\d., +eE-]+$/.test(value))
            safe = value;
          else if (name === 'd' && /^[MmLlHhVvCcSsQqTtAaZz\d., +eE-]+$/.test(value)) safe = value;
          else if (
            name === 'transform' &&
            /^(?:(?:translate|rotate|scale|matrix)\([\d., +eE-]+\)\s*)+$/.test(value)
          )
            safe = value;
          else if (name === 'viewBox') {
            const values = value.trim().split(/[ ,]+/).map(Number);
            if (
              values.length === 4 &&
              values.every(Number.isFinite) &&
              values[2]! > 0 &&
              values[3]! > 0 &&
              values[2]! <= 5000 &&
              values[3]! <= 5000
            )
              safe = value;
            else invalid = true;
          }
          if (safe !== null) out += ` ${name}="${escapeHtml(safe)}"`;
        }
        out += '>';
      },
      ontext(text) {
        if (!dropped) out += escapeHtml(text);
      },
      onclosetag() {
        if (dropped) {
          dropped--;
          return;
        }
        const tag = stack.pop();
        if (tag) out += `</${tag}>`;
      },
    },
    { xmlMode: true },
  );
  parser.end(svg);
  return invalid || roots !== 1 ? null : out;
}
