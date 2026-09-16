/** Fixed progressive enhancement: user text and URLs are assigned through DOM APIs. */
export const IMAGE_SCRIPT = String.raw`(function () {
  var article = document.querySelector('article');
  if (!article || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  var dialog = document.createElement('dialog');
  dialog.className = 'image-viewer';
  dialog.setAttribute('aria-label', 'Image viewer');
  dialog.innerHTML = '<div class="image-viewer-toolbar"><span>Image viewer</span><button type="button" class="image-size" aria-pressed="false">Original size</button><a class="image-original" target="_blank" rel="noopener noreferrer">Open original</a><button type="button" class="image-close" aria-label="Close image viewer">Close</button></div><div class="image-viewer-stage" tabindex="0" role="region" aria-label="Image; scroll when enlarged"><img alt=""></div><p class="image-viewer-caption"></p><p class="image-viewer-status" role="status"></p>';
  var stage = dialog.querySelector('.image-viewer-stage');
  var large = stage.querySelector('img');
  var size = dialog.querySelector('.image-size');
  var original = dialog.querySelector('.image-original');
  var caption = dialog.querySelector('.image-viewer-caption');
  var status = dialog.querySelector('.image-viewer-status');
  var close = dialog.querySelector('.image-close');
  var trigger;
  var overflow;
  function resetSize() {
    dialog.classList.remove('is-original');
    size.setAttribute('aria-pressed', 'false');
    size.textContent = 'Original size';
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  }
  size.addEventListener('click', function () {
    var full = dialog.classList.toggle('is-original');
    size.setAttribute('aria-pressed', String(full));
    size.textContent = full ? 'Fit to window' : 'Original size';
  });
  close.addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', function () {
    document.documentElement.style.overflow = overflow;
    large.removeAttribute('src');
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  });
  large.addEventListener('error', function () {
    if (!dialog.open) return;
    status.textContent = 'Image could not be loaded. Try opening the original.';
    size.disabled = true;
  });
  large.addEventListener('load', function () {
    status.textContent = '';
    size.disabled = false;
  });
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
      button.textContent = 'Enlarge';
      button.setAttribute('aria-label', 'Enlarge image' + (img.alt ? ': ' + img.alt : ''));
      parent.insertBefore(frame, img);
      frame.appendChild(img);
      frame.appendChild(button);
      button.addEventListener('click', function () {
        if (!img.naturalWidth) return;
        if (!dialog.isConnected) document.body.appendChild(dialog);
        trigger = button;
        resetSize();
        status.textContent = '';
        size.disabled = false;
        large.alt = img.alt;
        large.src = img.currentSrc || img.src;
        original.href = img.currentSrc || img.src;
        var text = parent.querySelector('figcaption');
        caption.textContent = text ? text.textContent : '';
        caption.hidden = !caption.textContent;
        overflow = document.documentElement.style.overflow;
        dialog.showModal();
        document.documentElement.style.overflow = 'hidden';
        close.focus();
      });
      img.addEventListener('error', function () { button.hidden = true; });
    }
    if (img.complete) enhance();
    else img.addEventListener('load', enhance, { once: true });
  });
})();`;
