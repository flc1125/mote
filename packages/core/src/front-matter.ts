import { isMap, isScalar, parseDocument, visit } from 'yaml';

const MAX_FRONT_MATTER_LENGTH = 16_384;
const METADATA_KEYS = new Set([
  'title',
  'description',
  'summary',
  'author',
  'authors',
  'date',
  'created',
  'updated',
  'published',
  'draft',
  'tags',
  'categories',
  'keywords',
  'layout',
  'slug',
  'permalink',
  'aliases',
  'lang',
  'language',
  'cover',
  'image',
]);

/**
 * Hide a bounded, valid YAML metadata mapping at the start of a document.
 * Ambiguous prose, unknown-only mappings and malformed blocks remain intact.
 * Only inspect the AST: no alias expansion, object conversion, templates or
 * metadata overrides. CLI scanning and rendering must use the same body.
 */
export function stripFrontMatter(source: string): string {
  const opening = /^\uFEFF?---[ \t]*\r?\n/.exec(source);
  if (!opening) return source;
  const prefix = source.slice(opening[0].length, MAX_FRONT_MATTER_LENGTH);
  const closing = /^---[ \t]*\r?$/m.exec(prefix);
  if (!closing) return source;
  const end = opening[0].length + closing.index + closing[0].length;
  // A truncated prefix must never manufacture a closing delimiter.
  if (end < source.length && source[end] !== '\n') return source;
  try {
    const document = parseDocument(prefix.slice(0, closing.index), {
      strict: true,
      uniqueKeys: true,
      prettyErrors: false,
      schema: 'core',
    });
    if (document.errors.length || document.warnings.length || !isMap(document.contents))
      return source;
    let hasAlias = false;
    visit(document, {
      Alias: () => {
        hasAlias = true;
        return visit.BREAK;
      },
    });
    if (hasAlias) return source;
    const keys = document.contents.items.map(({ key }) => (isScalar(key) ? key.value : null));
    if (
      !keys.every((key) => typeof key === 'string') ||
      !keys.some((key) => typeof key === 'string' && METADATA_KEYS.has(key))
    )
      return source;
    return source.slice(end + (source[end] === '\n' ? 1 : 0));
  } catch {
    return source;
  }
}
