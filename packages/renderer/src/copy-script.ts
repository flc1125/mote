/** Fixed first-party code. No document text is interpolated into this script. */
export const COPY_SCRIPT = String.raw`(() => {
  const article = document.querySelector('article');
  if (!article) return;
  const available = navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
  for (const block of article.querySelectorAll('.code-block')) {
    const button = block.querySelector('.code-copy');
    const code = block.querySelector('pre > code');
    const status = block.querySelector('.code-copy-status');
    if (!button || !code || !status) continue;
    if (!available) {
      status.textContent = 'Clipboard unavailable. Select the code and copy it manually.';
      status.classList.add('is-error');
      continue;
    }
    let timer;
    // The icon-only button has no text to flip: state lives in the
    // .is-copied class (icon swap + accent color) and the aria-label/title,
    // mirroring the banner page-copy tool.
    const setLabel = (label) => {
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    };
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      clearTimeout(timer);
      button.disabled = true;
      button.classList.remove('is-copied');
      setLabel('Copy code');
      status.textContent = '';
      status.classList.remove('is-error');
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.classList.add('is-copied');
        setLabel('Code copied');
        status.textContent = 'Code copied to clipboard.';
        timer = setTimeout(() => {
          button.classList.remove('is-copied');
          setLabel('Copy code');
          status.textContent = '';
        }, 2500);
      } catch {
        setLabel('Copy failed');
        status.textContent = 'Could not copy. Select the code and copy it manually.';
        status.classList.add('is-error');
      } finally {
        button.disabled = false;
      }
    });
    button.hidden = false;
  }
})();`;
