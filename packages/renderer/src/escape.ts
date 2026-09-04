const ESCAPE_RE = /[&<>"']/g;

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(ESCAPE_RE, (char) => ESCAPE_MAP[char] ?? char);
}
