import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { IMAGE_SCRIPT } from './image-script.js';

function setup(
  options: {
    blocked?: boolean;
    size?: number;
    width?: string;
    complete?: boolean;
    count?: number;
    supported?: boolean;
  } = {},
) {
  let active: Element | undefined;
  const setActive = (element: Element) => {
    active = element;
  };
  const windowEvents = new Map<string, () => void>();
  class Element {
    nodeType = 1;
    childNodes: Element[] = [];
    parentElement: Element | null = null;
    attrs = new Map<string, string>();
    events = new Map<string, (event?: unknown) => void>();
    style = { overflow: 'auto', width: '' };
    classes = new Set<string>();
    classList = {
      remove: (name: string) => this.classes.delete(name),
      toggle: (name: string) => {
        if (this.classes.delete(name)) return false;
        this.classes.add(name);
        return true;
      },
    };
    className = '';
    textContent = '';
    innerHTML = '';
    alt = 'Alternative <text>';
    src = '/assets/original.png';
    currentSrc = '/assets/original.png';
    href = '';
    naturalWidth = options.size ?? 1280;
    naturalHeight = 720;
    complete = options.complete ?? true;
    disabled = false;
    hidden = false;
    isConnected = true;
    open = false;
    scrollTop = 0;
    scrollLeft = 0;
    constructor(public tagName: string) {}
    setAttribute(name: string, value: string) {
      this.attrs.set(name, value);
    }
    getAttribute(name: string) {
      return this.attrs.get(name) ?? null;
    }
    hasAttribute(name: string) {
      return this.attrs.has(name);
    }
    removeAttribute(name: string) {
      this.attrs.delete(name);
    }
    closest() {
      return options.blocked ? new Element('A') : null;
    }
    appendChild(child: Element) {
      if (child.parentElement)
        child.parentElement.childNodes = child.parentElement.childNodes.filter(
          (node) => node !== child,
        );
      this.childNodes.push(child);
      child.parentElement = this;
    }
    insertBefore(child: Element, before: Element) {
      this.childNodes.splice(this.childNodes.indexOf(before), 0, child);
      child.parentElement = this;
    }
    querySelector(selector: string): Element | null {
      return selectors.get(selector) ?? null;
    }
    addEventListener(event: string, fn: (event?: unknown) => void) {
      this.events.set(event, fn);
    }
    fire(event: string) {
      this.events.get(event)?.();
    }
    focus() {
      setActive(this);
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.fire('close');
    }
  }
  const selectors = new Map<string, Element>();
  for (const name of [
    '.image-viewer-stage',
    'img',
    '.image-size',
    '.image-original',
    '.image-viewer-caption',
    '.image-viewer-status',
    '.image-close',
  ])
    selectors.set(name, new Element(name === 'img' ? 'IMG' : 'DIV'));
  const figureCaption = new Element('FIGCAPTION');
  figureCaption.textContent = 'Visible <caption>';
  selectors.set('figcaption', figureCaption);
  const images = Array.from({ length: options.count ?? 1 }, () => {
    const parent = new Element('FIGURE');
    const img = new Element('IMG');
    img.attrs.set('src', img.src);
    if (options.width) img.attrs.set('width', options.width);
    parent.appendChild(img);
    parent.appendChild(figureCaption);
    return img;
  });
  const created: Element[] = [];
  const root = new Element('HTML');
  new Script(IMAGE_SCRIPT).runInNewContext({
    HTMLDialogElement: options.supported === false ? undefined : Element,
    document: {
      querySelector: () => ({ querySelectorAll: () => images }),
      createElement: (name: string) => {
        const node = new Element(name.toUpperCase());
        created.push(node);
        return node;
      },
      body: new Element('BODY'),
      documentElement: root,
    },
    window: { addEventListener: (name: string, fn: () => void) => windowEvents.set(name, fn) },
  });
  return {
    created,
    images,
    root,
    selectors,
    windowEvents,
    active: () => active,
    button: () => created.find((node) => node.className === 'image-expand')!,
    dialog: () => created.find((node) => node.tagName === 'DIALOG')!,
  };
}

describe('fixed image viewer', () => {
  it('opens the existing URL with separate alt/caption, toggles size and restores focus/scroll', () => {
    const ui = setup({ width: '50%' });
    expect(ui.images[0]!.parentElement!.style.width).toBe('50%');
    ui.button().fire('click');
    expect(ui.dialog().open).toBe(true);
    expect(ui.selectors.get('img')!.src).toBe('/assets/original.png');
    expect(ui.selectors.get('.image-original')!.href).toBe('/assets/original.png');
    expect(ui.selectors.get('img')!.alt).toBe('Alternative <text>');
    expect(ui.selectors.get('.image-viewer-caption')!.textContent).toBe('Visible <caption>');
    expect(ui.active()).toBe(ui.selectors.get('.image-close'));
    ui.selectors.get('.image-size')!.fire('click');
    expect(ui.dialog().classes.has('is-original')).toBe(true);
    ui.selectors.get('.image-close')!.fire('click');
    expect(ui.dialog().open).toBe(false);
    expect(ui.root.style.overflow).toBe('auto');
    expect(ui.active()).toBe(ui.button());
  });
  it('enhances after load and provides viewer load failure feedback and print cleanup', () => {
    const ui = setup({ complete: false });
    expect(ui.button()).toBeUndefined();
    ui.images[0]!.fire('load');
    ui.button().fire('click');
    ui.selectors.get('img')!.fire('error');
    expect(ui.selectors.get('.image-size')!.disabled).toBe(true);
    expect(ui.selectors.get('.image-viewer-status')!.textContent).toContain('could not be loaded');
    ui.windowEvents.get('beforeprint')!();
    expect(ui.dialog().open).toBe(false);
    ui.images[0]!.fire('error');
    expect(ui.button().hidden).toBe(true);
  });
  it.each([{ blocked: true }, { size: 32 }, { size: 0 }, { width: '32' }, { supported: false }])(
    'preserves excluded images: %j',
    (options) => {
      expect(setup(options).button()).toBeUndefined();
    },
  );
  it('bounds enhancement to 64 candidates', () => {
    expect(
      setup({ count: 80 }).created.filter((node) => node.className === 'image-expand'),
    ).toHaveLength(64);
  });
});
