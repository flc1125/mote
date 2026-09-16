/** Fixed script: preview only the already-sanitized document, never reparse HTML. */
export const FOOTNOTE_SCRIPT = String.raw`(() => {
  const article = document.querySelector('article');
  if (!article || typeof HTMLElement.prototype.showPopover !== 'function') return;
  const popup = document.createElement('div');
  popup.className = 'footnote-preview';
  popup.setAttribute('popover', 'auto');
  popup.setAttribute('role', 'dialog');
  const header = document.createElement('div');
  header.className = 'footnote-preview-header';
  const title = document.createElement('strong');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close footnote preview');
  header.append(title, close);
  const body = document.createElement('div');
  body.className = 'footnote-preview-body';
  body.tabIndex = 0;
  body.setAttribute('role', 'region');
  body.setAttribute('aria-label', 'Footnote content');
  const full = document.createElement('a');
  full.className = 'footnote-preview-full';
  full.textContent = 'Go to footnote';
  popup.append(header, body, full);
  let active = null;
  let frame = 0;
  const bindings = new Map();

  // Rebuild a static subset without IDs, ID references, runtime state or controls.
  // A complex/oversized note falls back intact to its original document link.
  function content(note) {
    const fragment = document.createDocumentFragment();
    const tags = new Set('P DIV SPAN BR HR WBR STRONG EM B I U S DEL INS SMALL CODE PRE BLOCKQUOTE Q CITE A ABBR MARK SUB SUP KBD UL OL LI DL DT DD TABLE THEAD TBODY TFOOT TR TH TD CAPTION COLGROUP COL FIGURE FIGCAPTION IMG PICTURE SOURCE'.split(' '));
    const attrs = new Set(['href', 'src', 'srcset', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan', 'start', 'align']);
    let nodes = 0, units = 0, images = 0;
    function copy(node, parent, depth) {
      if (++nodes > 1024 || depth > 32) throw new Error('preview budget');
      if (node.nodeType === 3) {
        units += node.textContent.length;
        if (units > 16384) throw new Error('preview budget');
        parent.appendChild(document.createTextNode(node.textContent));
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.tagName === 'BUTTON' || node.classList.contains('footnote-backref') || node.classList.contains('code-line-number') || node.classList.contains('code-copy-status')) return;
      let tag = node.tagName;
      if (tag === 'DETAILS') tag = 'DIV';
      if (tag === 'SUMMARY' || /^H[1-6]$/.test(tag)) tag = 'P';
      if (!tags.has(tag)) throw new Error('complex preview');
      if (tag === 'IMG' && ++images > 8) throw new Error('preview budget');
      const clone = document.createElement(tag.toLowerCase());
      for (const attr of node.attributes) {
        units += attr.value.length;
        if (units > 16384) throw new Error('preview budget');
        if (attrs.has(attr.name)) clone.setAttribute(attr.name, attr.value);
      }
      if (tag === 'A' && node.getAttribute('target') === '_blank') {
        clone.setAttribute('target', '_blank');
        clone.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag === 'IMG') { clone.setAttribute('loading', 'lazy'); clone.setAttribute('decoding', 'async'); }
      for (const child of node.childNodes) copy(child, clone, depth + 1);
      parent.appendChild(clone);
    }
    try { for (const node of note.childNodes) copy(node, fragment, 0); }
    catch { return null; }
    return fragment;
  }
  function isOpen() { return popup.matches(':popover-open'); }
  function clear() {
    if (active) active.setAttribute('aria-expanded', 'false');
    active = null;
    body.replaceChildren();
  }
  function dismiss(restore) {
    const previous = active;
    if (isOpen()) popup.hidePopover();
    clear();
    if (restore && previous && previous.isConnected) previous.focus({ preventScroll: true });
  }
  function position() {
    if (!active || !isOpen()) return;
    const rect = active.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight || !active.getClientRects().length) { dismiss(false); return; }
    const width = popup.offsetWidth, height = popup.offsetHeight;
    const below = innerHeight - rect.bottom - 12;
    const top = below >= height || below >= rect.top ? rect.bottom + 8 : rect.top - height - 8;
    popup.style.left = Math.max(12, Math.min(rect.left, innerWidth - width - 12)) + 'px';
    popup.style.top = Math.max(12, Math.min(top, innerHeight - height - 12)) + 'px';
  }
  function schedule() {
    if (!frame && active) frame = requestAnimationFrame(() => { frame = 0; position(); });
  }
  close.addEventListener('click', () => dismiss(true));
  popup.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dismiss(true); }
  });
  popup.addEventListener('focusout', event => {
    if (event.relatedTarget && !popup.contains(event.relatedTarget)) dismiss(false);
  });
  popup.addEventListener('toggle', () => {
    if (!isOpen()) {
      const restore = popup.contains(document.activeElement);
      const previous = active;
      clear();
      if (restore && previous) previous.focus({ preventScroll: true });
    }
  });
  // Let the existing article anchor handler reveal hidden tabs/details first.
  article.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (popup.contains(link)) { dismiss(false); return; }
    const note = bindings.get(link);
    if (!note) return;
    if (active === link && isOpen()) { event.preventDefault(); dismiss(true); return; }
    const copy = content(note);
    if (!copy) {
      bindings.delete(link);
      link.removeAttribute('aria-haspopup');
      link.removeAttribute('aria-expanded');
      return;
    }
    try {
      if (active) dismiss(false);
      body.replaceChildren(copy);
      title.textContent = 'Footnote ' + link.textContent.replace(/[\[\]]/g, '');
      popup.setAttribute('aria-label', title.textContent);
      full.href = link.href;
      if (!popup.isConnected) article.appendChild(popup);
      popup.showPopover();
      active = link;
      link.setAttribute('aria-expanded', 'true');
      position();
      close.focus({ preventScroll: true });
      event.preventDefault();
    } catch { dismiss(false); }
  });
  let count = 0;
  for (const link of article.querySelectorAll('sup.footnote-ref > a[href]')) {
    if (++count > 64) break;
    const href = link.getAttribute('href');
    if (!/^#fn\d+$/.test(href)) continue;
    const note = document.getElementById(href.slice(1));
    if (!note || !note.matches('section.footnotes > ol > li.footnote-item') || !article.contains(note)) continue;
    bindings.set(link, note);
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-expanded', 'false');
  }
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  popup.addEventListener('load', schedule, true);
  window.addEventListener('hashchange', () => dismiss(false));
  window.addEventListener('beforeprint', () => dismiss(false));
})();`;
