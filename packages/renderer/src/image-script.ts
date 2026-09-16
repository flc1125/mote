/** Fixed progressive enhancement: user text and URLs are assigned through DOM APIs. */
export const IMAGE_SCRIPT = String.raw`(function () {
  var article = document.querySelector('article');
  if (!article || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  var dialog = document.createElement('dialog');
  dialog.className = 'image-viewer';
  dialog.setAttribute('aria-label', 'Image viewer');
  dialog.innerHTML = '<button type="button" class="image-close" aria-label="Close image viewer"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><div class="image-viewer-stage" tabindex="-1" role="region" aria-label="Enlarged image, scrollable at original size"><img alt=""></div><p class="image-viewer-status" role="status"></p>';
  var stage = dialog.querySelector('.image-viewer-stage');
  var large = stage.querySelector('img');
  var status = dialog.querySelector('.image-viewer-status');
  var close = dialog.querySelector('.image-close');
  var trigger;
  var overflow;
  var zoomable = false;
  // aria-label overrides alt, so the toggle keeps the image description
  // inside its accessible name instead of losing it.
  function sizeLabel(full) {
    var action = full ? 'Fit image to window' : 'View at original size';
    return large.alt ? action + ': ' + large.alt : action;
  }
  function updateZoom() {
    var full = dialog.classList.contains('is-original');
    // Layout dimensions ignore the opening animation's transform.
    zoomable = dialog.open && !large.hidden && large.naturalWidth > 0 &&
      large.clientWidth > 0 && large.clientHeight > 0 &&
      (full || large.naturalWidth > large.clientWidth + 1 || large.naturalHeight > large.clientHeight + 1);
    if (zoomable) {
      large.setAttribute('role', 'button');
      large.setAttribute('tabindex', '0');
      large.setAttribute('aria-pressed', String(full));
      large.setAttribute('aria-label', sizeLabel(full));
    } else {
      ['role', 'tabindex', 'aria-pressed', 'aria-label'].forEach(function (name) { large.removeAttribute(name); });
    }
    stage.setAttribute('tabindex', full && zoomable ? '0' : '-1');
  }
  function resetSize() {
    dialog.classList.remove('is-original');
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    updateZoom();
  }
  function toggleSize() {
    if (!zoomable) return;
    dialog.classList.toggle('is-original');
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    updateZoom();
  }
  large.addEventListener('click', toggleSize);
  large.addEventListener('keydown', function (event) {
    if (zoomable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      toggleSize();
    }
  });
  close.addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog || event.target === stage) dialog.close(); });
  dialog.addEventListener('close', function () {
    document.documentElement.style.overflow = overflow;
    large.removeAttribute('src');
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  });
  large.addEventListener('error', function () {
    if (!dialog.open) return;
    status.textContent = 'Image could not be loaded. Close the viewer and try again.';
    large.hidden = true;
    updateZoom();
  });
  large.addEventListener('load', function () {
    status.textContent = '';
    large.hidden = false;
    updateZoom();
  });
  window.addEventListener('resize', function () { if (dialog.open) resetSize(); });
  window.addEventListener('beforeprint', function () { if (dialog.open) dialog.close(); });
  var count = 0;
  article.querySelectorAll('img').forEach(function (img) {
    var parent = img.parentElement;
    if (!parent || (parent.tagName !== 'P' && parent.tagName !== 'FIGURE')) return;
    if (img.closest('a, picture, figcaption, button') || img.hasAttribute('srcset')) return;
    if (Array.from(parent.childNodes).some(function (node) {
      return node !== img && !(node.nodeType === 3 && !node.textContent.trim()) && !(node.nodeType === 1 && node.tagName === 'FIGCAPTION');
    })) return;
    var width = img.getAttribute('width');
    if (width && /^\d+$/.test(width) && Number(width) < 160) return;
    if (++count > 64) return;
    function enhance() {
      if (!img.naturalWidth || img.naturalWidth < 160 || img.naturalHeight < 100 || !img.getAttribute('src')) return;
      if (img.parentElement !== parent) return;
      var frame = document.createElement('span');
      frame.className = 'image-frame';
      // Percentage widths stay relative to the prose column, not a shrink-wrapped frame.
      frame.style.width = (img.getAttribute('width') || String(img.naturalWidth)).replace(/^(\d+)$/, '$1px');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'image-expand';
      button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      button.setAttribute('aria-label', 'Enlarge image' + (img.alt ? ': ' + img.alt : ''));
      parent.insertBefore(frame, img);
      frame.appendChild(img);
      frame.appendChild(button);
      button.addEventListener('click', function () {
        if (!img.naturalWidth) return;
        if (!dialog.isConnected) document.body.appendChild(dialog);
        trigger = button;
        large.alt = img.alt;
        dialog.setAttribute('aria-label', 'Image viewer' + (img.alt ? ': ' + img.alt : ''));
        status.textContent = '';
        large.hidden = false;
        large.src = img.currentSrc || img.src;
        overflow = document.documentElement.style.overflow;
        dialog.showModal();
        document.documentElement.style.overflow = 'hidden';
        resetSize();
        close.focus();
      });
      img.addEventListener('error', function () { button.hidden = true; });
    }
    if (img.complete) enhance();
    else img.addEventListener('load', enhance, { once: true });
  });
})();`;
