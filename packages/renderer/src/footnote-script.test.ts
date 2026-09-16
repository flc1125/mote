import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { FOOTNOTE_SCRIPT } from './footnote-script.js';

function setup(options: { supported?: boolean; fail?: boolean; refs?: number } = {}) {
  let focused: Element | null = null;
  const windows = new Map<string, () => void>();
  class Element {
    attrs = new Map<string, string>();
    childNodes: Element[] = [];
    parentElement: Element | null = null;
    events = new Map<string, (e: Record<string, unknown>) => void>();
    style: Record<string, string> = {};
    value = '';
    className = '';
    open = false;
    offsetWidth = 300;
    offsetHeight = 200;
    classList = { contains: (name: string) => this.className.split(' ').includes(name) };
    constructor(
      public tagName: string,
      public nodeType = 1,
    ) {}
    get attributes() {
      return [...this.attrs].map(([name, value]) => ({ name, value }));
    }
    get textContent(): string {
      return this.value + this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(value: string) {
      this.replaceChildren();
      if (this.nodeType === 3) this.value = value;
      else if (value) {
        const text = new Element('', 3);
        text.value = value;
        this.appendChild(text);
      }
    }
    get href() {
      return new URL(this.getAttribute('href') ?? '', 'https://example.com/doc').href;
    }
    set href(value: string) {
      this.setAttribute('href', value);
    }
    get isConnected(): boolean {
      return this === article || !!this.parentElement?.isConnected;
    }
    setAttribute(name: string, value: string) {
      this.attrs.set(name, value);
    }
    removeAttribute(name: string) {
      this.attrs.delete(name);
    }
    getAttribute(name: string) {
      return this.attrs.get(name) ?? null;
    }
    append(...nodes: Element[]) {
      nodes.forEach((n) => this.appendChild(n));
    }
    appendChild(node: Element) {
      if (node.nodeType === 11) {
        [...node.childNodes].forEach((n) => this.appendChild(n));
        return;
      }
      if (node.parentElement)
        node.parentElement.childNodes = node.parentElement.childNodes.filter((n) => n !== node);
      node.parentElement = this;
      this.childNodes.push(node);
    }
    replaceChildren(...nodes: Element[]) {
      this.value = '';
      this.childNodes.forEach((n) => (n.parentElement = null));
      this.childNodes = [];
      this.append(...nodes);
    }
    contains(node: Element | null): boolean {
      return !!node && (node === this || this.childNodes.some((n) => n.contains(node)));
    }
    closest(): Element | null {
      return this.tagName === 'A' && this.attrs.has('href')
        ? this
        : (this.parentElement?.closest() ?? null);
    }
    matches(selector: string) {
      return selector === ':popover-open' ? this.open : this === note;
    }
    querySelectorAll() {
      return refs;
    }
    addEventListener(name: string, fn: (e: Record<string, unknown>) => void) {
      this.events.set(name, fn);
    }
    fire(name: string, e: Record<string, unknown> = {}) {
      this.events.get(name)?.(e);
    }
    focus() {
      // Track the element receiving focus in this DOM test double.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      focused = this;
    }
    getBoundingClientRect() {
      return { left: 100, top: 100, bottom: 120 };
    }
    getClientRects() {
      return [this.getBoundingClientRect()];
    }
    showPopover() {
      if (options.fail) throw Error('failed');
      this.open = true;
    }
    hidePopover() {
      this.open = false;
    }
  }
  const article = new Element('ARTICLE');
  const note = new Element('LI');
  note.className = 'footnote-item';
  note.setAttribute('id', 'fn1');
  const paragraph = new Element('P');
  paragraph.setAttribute('id', 'duplicate');
  paragraph.textContent = 'Footnote body';
  const back = new Element('A');
  back.className = 'footnote-backref';
  back.href = '#fnref1';
  back.textContent = '↩';
  note.append(paragraph, back);
  article.append(note);
  const refs = Array.from({ length: options.refs ?? 2 }, (_, i) => {
    const link = new Element('A');
    link.href = '#fn1';
    link.textContent = `[1${i ? ':' + i : ''}]`;
    article.append(link);
    return link;
  });
  const created: Element[] = [];
  new Script(FOOTNOTE_SCRIPT).runInNewContext({
    HTMLElement: options.supported === false ? function () {} : Element,
    document: {
      querySelector: () => article,
      createElement: (tag: string) => {
        const n = new Element(tag.toUpperCase());
        created.push(n);
        return n;
      },
      createTextNode: (text: string) => {
        const n = new Element('', 3);
        n.textContent = text;
        return n;
      },
      createDocumentFragment: () => new Element('', 11),
      getElementById: (id: string) => (id === 'fn1' ? note : null),
      get activeElement() {
        return focused;
      },
    },
    innerWidth: 800,
    innerHeight: 600,
    window: { addEventListener: (name: string, fn: () => void) => windows.set(name, fn) },
    requestAnimationFrame: (fn: () => void) => {
      fn();
      return 1;
    },
  });
  function click(target: Element, extras: Record<string, unknown> = {}) {
    let prevented = false;
    article.fire('click', {
      target,
      button: 0,
      defaultPrevented: false,
      preventDefault: () => {
        prevented = true;
      },
      ...extras,
    });
    return prevented;
  }
  const popup = created.find((n) => n.className === 'footnote-preview');
  return {
    article,
    note,
    paragraph,
    back,
    refs,
    created,
    popup,
    click,
    windows,
    Element,
    focused: () => focused,
  };
}

describe('footnote preview', () => {
  it('preserves native links when unsupported or initialization fails', () => {
    const absent = setup({ supported: false });
    expect(absent.popup).toBeUndefined();
    expect(absent.refs[0]!.getAttribute('aria-haspopup')).toBeNull();
    const failed = setup({ fail: true });
    expect(failed.click(failed.refs[0]!)).toBe(false);
    expect(failed.popup!.open).toBe(false);
  });
  it('copies static content without IDs, ID references or return controls', () => {
    const s = setup();
    s.paragraph.setAttribute('aria-labelledby', 'duplicate');
    expect(s.click(s.refs[0]!)).toBe(true);
    const body = s.created.find((n) => n.className === 'footnote-preview-body')!;
    expect(body.textContent).toBe('Footnote body');
    expect(body.childNodes[0]!.attributes).toEqual([]);
    expect(s.note.getAttribute('id')).toBe('fn1');
    expect(s.back.parentElement).toBe(s.note);
    expect(s.refs[0]!.getAttribute('href')).toBe('#fn1');
  });
  it('restores the correct reference on Escape for repeated references', () => {
    const s = setup();
    s.click(s.refs[1]!);
    expect(s.refs[1]!.getAttribute('aria-expanded')).toBe('true');
    s.popup!.fire('keydown', { key: 'Escape', preventDefault: () => {} });
    expect(s.focused()).toBe(s.refs[1]);
    expect(s.refs[1]!.getAttribute('aria-expanded')).toBe('false');
    expect(s.popup!.open).toBe(false);
  });
  it('preserves modified clicks and supports full-note navigation, outside dismissal and printing', () => {
    const s = setup();
    expect(s.click(s.refs[0]!, { ctrlKey: true })).toBe(false);
    s.click(s.refs[0]!);
    const full = s.created.find((n) => n.className === 'footnote-preview-full')!;
    expect(full.href).toBe('https://example.com/doc#fn1');
    expect(s.click(full)).toBe(false);
    expect(s.popup!.open).toBe(false);
    s.click(s.refs[0]!);
    s.popup!.hidePopover();
    s.popup!.fire('toggle');
    expect(s.refs[0]!.getAttribute('aria-expanded')).toBe('false');
    s.click(s.refs[0]!);
    s.windows.get('beforeprint')!();
    expect(s.popup!.open).toBe(false);
  });
  it('falls back for complex content and oversized notes without changing the original', () => {
    const s = setup();
    const math = new s.Element('MATH');
    s.note.append(math);
    expect(s.click(s.refs[0]!)).toBe(false);
    expect(s.refs[0]!.getAttribute('aria-haspopup')).toBeNull();
    s.note.replaceChildren(s.paragraph);
    s.paragraph.replaceChildren(new s.Element('', 3));
    s.paragraph.childNodes[0]!.textContent = 'x'.repeat(16385);
    expect(s.click(s.refs[0]!)).toBe(false);
    expect(s.click(s.refs[1]!)).toBe(false);
    expect(s.refs[1]!.getAttribute('aria-haspopup')).toBeNull();
    expect(s.paragraph.textContent).toHaveLength(16385);
  });
  it.each(['nodes', 'depth', 'images', 'attributes'])('falls back on the %s budget', (budget) => {
    const s = setup();
    if (budget === 'nodes')
      s.note.append(...Array.from({ length: 1025 }, () => new s.Element('BR')));
    if (budget === 'images')
      s.note.append(...Array.from({ length: 9 }, () => new s.Element('IMG')));
    if (budget === 'attributes') s.paragraph.setAttribute('title', 'x'.repeat(16385));
    if (budget === 'depth') {
      let parent = s.paragraph;
      for (let i = 0; i < 34; i++) {
        const child = new s.Element('SPAN');
        parent.append(child);
        parent = child;
      }
    }
    expect(s.click(s.refs[0]!)).toBe(false);
    expect(s.popup!.open).toBe(false);
    expect(s.refs[0]!.getAttribute('aria-haspopup')).toBeNull();
  });
  it('limits enhanced references and preserves image URLs and safe links', () => {
    const s = setup({ refs: 65 });
    const img = new s.Element('IMG');
    img.setAttribute('src', '/doc/a/image');
    img.setAttribute('alt', 'Picture');
    s.note.append(img);
    expect(s.refs[63]!.getAttribute('aria-haspopup')).toBe('dialog');
    expect(s.refs[64]!.getAttribute('aria-haspopup')).toBeNull();
    s.click(s.refs[0]!);
    const copied = s.created.find((n) => n.tagName === 'IMG')!;
    expect(copied.getAttribute('src')).toBe('/doc/a/image');
    expect(copied.getAttribute('alt')).toBe('Picture');
  });
});
