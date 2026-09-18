/** Keep source text inert in HTML, including closing tags and control characters. */
export function encodeMarkdownSource(markdown: string): string {
  const bytes = new TextEncoder().encode(markdown);
  const chunks: string[] = [];
  // Avoid an unbounded argument list or a per-byte string array for large documents.
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return btoa(chunks.join(''));
}
