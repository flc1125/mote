/** Trusted, dependency-free enhancement. Never interpolate document content here. */
export const TOC_SCRIPT = String.raw`(() => {
  const panel = document.getElementById('mote-toc');
  const trigger = document.querySelector('.toc-trigger');
  const article = document.querySelector('article');
  if (!panel || !trigger || !article) return;
  const body = document.body;
  const nav = panel.querySelector('.toc-nav');
  const close = panel.querySelector('.toc-close');
  const footer = document.querySelector('.mote-colophon');
  const desktop = matchMedia('(min-width: 1100px)');
  const background = [...document.querySelectorAll('.mote-banner, main, .mote-colophon')];
  const entries = [...nav.querySelectorAll('a[href^="#"]')].map(link => ({
    link, heading: document.getElementById(link.getAttribute('href').slice(1))
  })).filter(entry => entry.heading && article.contains(entry.heading));
  let mobileOpen = false;
  let desktopCollapsed = false;
  let lockedScroll = null;
  let current = null;
  let navigationEntry = null;
  let navigationScroll = null;
  let userScrollPending = false;
  let positions = [];
  let frame = 0;
  let layoutDirty = true;
  let navHovered = false;
  let panelBottom = null;

  function visible() { return desktop.matches ? !desktopCollapsed : mobileOpen; }

  function syncPanel() {
    const modal = !desktop.matches && mobileOpen;
    body.toggleAttribute('data-toc-open', mobileOpen);
    body.toggleAttribute('data-toc-collapsed', desktopCollapsed);
    trigger.setAttribute('aria-expanded', String(visible()));
    trigger.setAttribute('aria-label', visible() ? '收起目录 / Hide table of contents' : '目录 / Open table of contents');
    if (modal) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      if (lockedScroll === null) {
        lockedScroll = window.scrollY;
        body.style.top = '-' + lockedScroll + 'px';
        body.setAttribute('data-toc-modal', '');
      }
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      if (lockedScroll !== null) {
        const y = lockedScroll;
        lockedScroll = null;
        body.removeAttribute('data-toc-modal');
        body.style.removeProperty('top');
        window.scrollTo(0, y);
      }
    }
    for (const element of background) element.inert = modal;
  }

  // Scroll only the navigation region; never move the article to reveal an item.
  function revealCurrent() {
    if (!current || !visible()) return;
    let link = current.link;
    for (let branch = link.closest('.toc-branch'); branch; branch = branch.parentElement.closest('.toc-branch')) {
      if (branch.hidden) link = branch.previousElementSibling.querySelector('a');
    }
    const rect = link.getBoundingClientRect();
    const box = nav.getBoundingClientRect();
    if (rect.top < box.top + 8) nav.scrollTop += rect.top - box.top - 8;
    else if (rect.bottom > box.bottom - 8) nav.scrollTop += rect.bottom - box.bottom + 8;
  }

  function setCurrent(entry) {
    if (!entry || current === entry) return;
    if (current) current.link.removeAttribute('aria-current');
    current = entry;
    entry.link.setAttribute('aria-current', 'location');
    for (const item of nav.querySelectorAll('[data-current-branch]')) item.removeAttribute('data-current-branch');
    for (let item = entry.link.closest('li'); item; item = item.parentElement.closest('li')) {
      item.setAttribute('data-current-branch', '');
    }
    if (desktop.matches && !navHovered && !nav.contains(document.activeElement)) revealCurrent();
  }

  function selectNavigation(entry) {
    navigationEntry = entry;
    navigationScroll = null;
    userScrollPending = false;
    if (entry) setCurrent(entry);
  }

  function update() {
    frame = 0;
    if (lockedScroll !== null) return;
    // Fixed desktop navigation must stop above the footer, including its
    // otherwise empty background. Keep overflow inside the navigation region.
    const bottom = desktop.matches && footer
      ? Math.max(32, Math.ceil(window.innerHeight - footer.getBoundingClientRect().top + 16))
      : null;
    if (bottom !== panelBottom) {
      panelBottom = bottom;
      if (bottom === null) panel.style.removeProperty('--toc-bottom');
      else panel.style.setProperty('--toc-bottom', bottom + 'px');
      if (desktop.matches && !navHovered && !nav.contains(document.activeElement)) revealCurrent();
    }
    if (layoutDirty) {
      positions = entries.filter(entry => entry.heading.getClientRects().length).map(entry => ({
        entry, top: entry.heading.getBoundingClientRect().top + window.scrollY
      }));
      layoutDirty = false;
    }
    if (!positions.length) return;
    // Initial fragment jumps and image/layout changes can scroll after the
    // first paint. Keep explicit navigation selected until the reader actually
    // scrolls, even when several anchors share the same clamped landing point.
    if (navigationEntry) {
      const moved = navigationScroll !== null && Math.abs(window.scrollY - navigationScroll) > 2;
      if (!userScrollPending || !moved) {
        navigationScroll = window.scrollY;
        setCurrent(navigationEntry);
        return;
      }
      navigationEntry = null;
      userScrollPending = false;
    }
    const margin = parseFloat(getComputedStyle(positions[0].entry.heading).scrollMarginTop) || 0;
    const readingLine = Math.max(margin, document.querySelector('.mote-banner').getBoundingClientRect().height + 12);
    const threshold = window.scrollY + readingLine + 2;
    let low = 0, high = positions.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (positions[middle].top <= threshold) low = middle + 1;
      else high = middle;
    }
    setCurrent(positions[Math.max(0, low - 1)].entry);
  }

  function schedule(rebuild = false) {
    layoutDirty = layoutDirty || rebuild;
    if (!frame) frame = requestAnimationFrame(update);
  }

  function openPanel() {
    if (desktop.matches) desktopCollapsed = false;
    else mobileOpen = true;
    syncPanel();
    revealCurrent();
    // Let the responsive panel become focusable before moving keyboard focus.
    requestAnimationFrame(() => { if (visible()) close.focus({ preventScroll: true }); });
  }

  function closePanel(returnFocus = true) {
    mobileOpen = false;
    if (desktop.matches) desktopCollapsed = true;
    syncPanel();
    if (location.hash === '#mote-toc') history.replaceState(null, '', location.pathname + location.search);
    if (returnFocus) trigger.focus({ preventScroll: true });
    schedule(true);
  }

  function plainClick(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  trigger.addEventListener('click', event => {
    if (!plainClick(event)) return;
    event.preventDefault();
    if (visible()) closePanel();
    else openPanel();
  });
  close.addEventListener('click', event => { event.preventDefault(); closePanel(); });
  document.querySelector('.toc-scrim').addEventListener('click', event => {
    event.preventDefault(); closePanel();
  });

  for (const button of nav.querySelectorAll('.toc-toggle')) {
    const branch = document.getElementById(button.getAttribute('aria-controls'));
    button.hidden = false;
    button.addEventListener('click', () => {
      branch.hidden = !branch.hidden;
      button.setAttribute('aria-expanded', String(!branch.hidden));
    });
  }
  for (const entry of entries) {
    entry.link.addEventListener('click', event => {
      if (!plainClick(event)) return;
      // Keep native anchors and history, including repeat clicks on the same hash.
      if (!desktop.matches) {
        closePanel(false);
        entry.heading.setAttribute('tabindex', '-1');
        entry.heading.focus({ preventScroll: true });
      }
      for (let parent = entry.heading.parentElement; parent && parent !== article; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') parent.open = true;
      }
      selectNavigation(entry);
      schedule(true);
    });
  }
  nav.addEventListener('pointerenter', () => { navHovered = true; });
  nav.addEventListener('pointerleave', () => { navHovered = false; });

  document.addEventListener('keydown', event => {
    if (!visible()) return;
    const modal = !desktop.matches && mobileOpen;
    if (event.key === 'Escape' && (modal || panel.contains(document.activeElement))) {
      event.preventDefault(); closePanel();
    } else if (event.key === 'Tab' && modal) {
      const controls = [...panel.querySelectorAll('a[href], button:not([hidden])')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
  });

  function onHashChange() {
    if (location.hash === '#mote-toc') { openPanel(); return; }
    if (mobileOpen) closePanel(false);
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    selectNavigation(entries.find(entry => entry.heading === target) || null);
    if (target && article.contains(target)) {
      let unfolded = false;
      for (let parent = target.parentElement; parent && parent !== article; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS' && !parent.open) { parent.open = true; unfolded = true; }
      }
      if (unfolded) target.scrollIntoView();
    }
    schedule(true);
  }

  desktop.addEventListener('change', () => {
    const focusInside = panel.contains(document.activeElement);
    mobileOpen = false;
    syncPanel();
    if (focusInside && !visible()) trigger.focus({ preventScroll: true });
    schedule(true);
  });
  function markUserScroll(event) {
    if (!panel.contains(event.target)) userScrollPending = true;
  }
  window.addEventListener('wheel', markUserScroll, { passive: true });
  window.addEventListener('touchmove', markUserScroll, { passive: true });
  // Includes scrollbar dragging; merely clicking without scrolling keeps the selection.
  window.addEventListener('pointerdown', markUserScroll, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) markUserScroll(event);
  });
  window.addEventListener('scroll', () => schedule(), { passive: true });
  window.addEventListener('resize', () => schedule(true), { passive: true });
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('pageshow', () => { syncPanel(); schedule(true); });
  article.addEventListener('toggle', () => schedule(true), true);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => schedule(true));
    observer.observe(article);
    if (footer) observer.observe(footer);
  }
  body.setAttribute('data-toc-enhanced', '');
  syncPanel();
  onHashChange();
  schedule(true);
})();`;
