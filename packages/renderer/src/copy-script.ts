/** Fixed first-party code. No document text is interpolated into this script. */
export const COPY_SCRIPT = String.raw`(() => {
  const article = document.querySelector('article');
  if (!article) return;
  const available = navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
  for (const block of article.querySelectorAll('.code-block')) {
    const button = block.querySelector('.code-copy');
    const code = block.querySelector('pre > code');
    const toolbar = block.querySelector('.code-toolbar');
    const status = block.querySelector('.code-copy-status');
    if (!button || !code || !toolbar || !status) continue;
    if (!available) {
      status.textContent = 'Clipboard unavailable. Select the code and copy it manually.';
      status.classList.add('is-error');
      toolbar.hidden = false;
      continue;
    }
    let timer;
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      clearTimeout(timer);
      button.disabled = true;
      button.textContent = 'Copy';
      status.textContent = '';
      status.classList.remove('is-error');
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = 'Copied';
        status.textContent = 'Code copied to clipboard.';
        timer = setTimeout(() => { button.textContent = 'Copy'; status.textContent = ''; }, 2500);
      } catch {
        button.textContent = 'Copy failed';
        status.textContent = 'Could not copy. Select the code and copy it manually.';
        status.classList.add('is-error');
      } finally {
        button.disabled = false;
      }
    });
    button.hidden = false;
    toolbar.hidden = false;
  }
})();`;
