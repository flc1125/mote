// Trusted homepage behavior only. Published documents never include this script.
export const HOME_SCRIPT = String.raw`(() => {
  for (const button of document.querySelectorAll('[data-copy-command]')) {
    const box = button.closest('.command-box');
    const code = box.querySelector('code');
    const status = box.querySelector('[role="status"]');
    let resetTimer;
    button.hidden = false;
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      clearTimeout(resetTimer);
      button.disabled = true;
      status.textContent = '';
      const content = code.cloneNode(true);
      for (const prompt of content.querySelectorAll('.prompt')) prompt.remove();
      const text = content.textContent.split(/\r?\n/).map(line => line.trim()).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
        status.textContent = 'Commands copied to clipboard.';
      } catch {
        button.textContent = 'Copy failed';
        status.textContent = 'Copy failed. Select the commands and copy them manually.';
      } finally {
        button.disabled = false;
        resetTimer = setTimeout(() => {
          button.textContent = 'Copy';
          status.textContent = '';
        }, 2500);
      }
    });
  }
})();`;
