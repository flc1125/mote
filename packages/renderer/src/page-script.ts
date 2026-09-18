/**
 * Page tools: banner copy-link/Markdown buttons and back-to-top.
 * Fixed first-party script, authorized by its exact CSP hash; document
 * content never enters it. Without JS the controls stay hidden.
 *
 * Copy uses the canonical page URL (origin + pathname): any hash or query
 * the reader arrived with is dropped on purpose.
 */
export const PAGE_SCRIPT = String.raw`(() => {
  const copyButton = document.querySelector('.page-copy');
  const toTop = document.querySelector('.to-top');

  const clipboard =
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : null;

  if (copyButton && clipboard) {
    let timer = 0;
    copyButton.addEventListener('click', () => {
      const url = location.origin + location.pathname;
      clipboard(url).then(() => {
        clearTimeout(timer);
        copyButton.classList.add('is-copied');
        timer = setTimeout(() => copyButton.classList.remove('is-copied'), 1600);
      }, () => {});
    });
    copyButton.hidden = false;
  }

  const markdownButton = document.querySelector('.markdown-copy');
  const source = document.querySelector('.markdown-source');
  if (markdownButton && source) {
    const status = document.querySelector('.markdown-copy-status');
    const dialog = document.querySelector('.markdown-source-dialog');
    const text = document.querySelector('.markdown-source-text');
    const close = document.querySelector('.markdown-source-close');
    const canOpen = dialog && text && close && typeof dialog.showModal === 'function';
    let markdown;
    let timer = 0;
    let copying = false;
    const reset = () => {
      markdownButton.classList.remove('is-copied');
      markdownButton.setAttribute('aria-label', 'Copy Markdown source');
      if (status) status.textContent = '';
    };
    const manualCopy = () => {
      if (status) status.textContent = 'Copy failed';
      if (!canOpen) return;
      text.value = markdown;
      if (!dialog.open) dialog.showModal();
      text.focus();
      text.select();
      text.scrollTop = 0;
      text.scrollLeft = 0;
    };
    if (canOpen) {
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => {
        text.value = '';
        reset();
        markdownButton.focus();
      });
    }
    markdownButton.addEventListener('click', async () => {
      if (copying) return;
      clearTimeout(timer);
      reset();
      copying = true;
      markdownButton.setAttribute('aria-disabled', 'true');
      try {
        if (markdown === undefined) {
          const binary = atob(source.value);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          markdown = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
        }
        if (!clipboard) {
          manualCopy();
          return;
        }
        try {
          await clipboard(markdown);
          markdownButton.classList.add('is-copied');
          markdownButton.setAttribute('aria-label', 'Markdown copied');
          if (status) status.textContent = 'Markdown copied';
          timer = setTimeout(reset, 2000);
        } catch {
          manualCopy();
        }
      } catch {
        if (status) status.textContent = 'Could not read Markdown source';
      } finally {
        copying = false;
        markdownButton.setAttribute('aria-disabled', 'false');
      }
    });
    if (clipboard || canOpen) markdownButton.hidden = false;
  }

  if (toTop) {
    const reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const sync = () => {
      frame = 0;
      // Show once the reader is roughly two viewports down the page.
      toTop.hidden = window.scrollY <= window.innerHeight * 2;
    };
    window.addEventListener('scroll', () => {
      if (!frame) frame = requestAnimationFrame(sync);
    }, { passive: true });
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    sync();
  }
})();`;
