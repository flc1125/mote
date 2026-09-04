export interface Heading {
  level: number;
  text: string;
  slug: string;
}

/**
 * GitHub-style slug: lowercase, strip everything except letters, numbers,
 * underscores, hyphens and spaces (CJK characters are kept), then replace
 * whitespace with hyphens. Duplicates get -1, -2, ... suffixes.
 */
export function slugify(text: string, used: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .replace(/\s+/g, '-');
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}
