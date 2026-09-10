export interface Heading {
  level: number;
  text: string;
  slug: string;
}

/**
 * GitHub-style slug: lowercase, strip everything except letters, numbers,
 * underscores, hyphens and spaces (CJK characters are kept), then replace
 * whitespace with hyphens. All emitted IDs share one namespace; suffixes
 * must also avoid naturally occurring headings and generated page controls.
 */
export function slugify(text: string, used: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}_\- ]/gu, '')
      .replace(/\s+/g, '-') || 'section';
  let count = used.get(base) ?? 0;
  let slug = count === 0 ? base : `${base}-${count}`;
  while (
    used.has(slug) ||
    slug === 'mote-toc' ||
    /^mote-toc-group-\d+$/.test(slug) ||
    /^(?:fn(?:ref)?\d+|task-item--?\d+)$/.test(slug)
  ) {
    count++;
    slug = `${base}-${count}`;
  }
  used.set(base, count + 1);
  used.set(slug, Math.max(used.get(slug) ?? 0, 1));
  return slug;
}
