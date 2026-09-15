export interface FenceMeta {
  title?: string;
  start?: number;
  ranges?: [number, number][];
}

/** Deliberately smaller than attribute-list syntax; invalid tails are atomic. */
export function parseFenceMeta(tail: string): FenceMeta {
  if (tail.length > 1024) return {};
  const values = new Map<string, string>();
  let pos = 0;
  while (pos < tail.length) {
    while (/\s/.test(tail[pos] ?? '') && pos < tail.length) pos++;
    if (pos === tail.length) break;
    const match = /^(title|linenums|hl_lines)="/.exec(tail.slice(pos));
    if (!match || values.has(match[1]!)) return {};
    pos += match[0].length;
    let value = '';
    let closed = false;
    while (pos < tail.length) {
      const char = tail[pos++]!;
      if (char === '"') {
        closed = true;
        break;
      }
      if (char === '\\') {
        const escaped = tail[pos++];
        if (escaped !== '\\' && escaped !== '"') return {};
        value += escaped;
      } else {
        if (char === '\n' || char === '\r') return {};
        value += char;
      }
    }
    if (!closed || (pos < tail.length && !/\s/.test(tail[pos]!))) return {};
    values.set(match[1]!, value);
  }
  const number = (value: string): number | null =>
    /^[1-9]\d{0,6}$/.test(value) && Number(value) <= 1_000_000 ? Number(value) : null;
  const meta: FenceMeta = {};
  if (values.has('title')) {
    if (values.get('title')!.length > 240) return {};
    meta.title = values.get('title');
  }
  if (values.has('linenums')) {
    const start = number(values.get('linenums')!);
    if (start === null) return {};
    meta.start = start;
  }
  if (values.has('hl_lines')) {
    const parts = values.get('hl_lines')!.trim().split(/ +/);
    if (parts.length > 64) return {};
    const ranges: [number, number][] = [];
    for (const part of parts) {
      const match = /^([0-9]+)(?:-([0-9]+))?$/.exec(part);
      if (!match) return {};
      const start = number(match[1]!);
      const end = number(match[2] ?? match[1]!);
      if (start === null || end === null || end < start) return {};
      ranges.push([start, end]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    meta.ranges = [];
    for (const range of ranges) {
      const previous = meta.ranges.at(-1);
      if (previous && range[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], range[1]);
      else meta.ranges.push(range);
    }
  }
  return meta;
}
