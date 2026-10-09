import { Parser } from 'htmlparser2';

export interface HtmlElement {
  tag: string;
  attributes: Record<string, string>;
}

export interface HtmlScript {
  attributes: Record<string, string>;
  text: string;
}

export interface HtmlInspection {
  elements: HtmlElement[];
  scripts: HtmlScript[];
  text: string;
}

/** Test-only HTML inspection, not a sanitizer or a browser DOM implementation. */
export function inspectHtml(html: string): HtmlInspection {
  const result: HtmlInspection = { elements: [], scripts: [], text: '' };
  let script: HtmlScript | null = null;
  const parser = new Parser(
    {
      onopentag(tag, attributes) {
        result.elements.push({ tag, attributes: { ...attributes } });
        if (tag === 'script') {
          script = { attributes: { ...attributes }, text: '' };
          // Record on opening so empty, external and unclosed scripts survive.
          result.scripts.push(script);
        }
      },
      ontext(text) {
        result.text += text;
        if (script) script.text += text;
      },
      onclosetag(tag) {
        if (tag === 'script') script = null;
      },
    },
    {
      xmlMode: false,
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
      recognizeSelfClosing: false,
    },
  );
  parser.end(html);
  return result;
}
