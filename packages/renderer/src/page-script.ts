/**
 * Page tools (plan 012 phase 4): banner copy-link button and back-to-top.
 * Fixed first-party script, authorized by its exact CSP hash; document
 * content never enters it. Without JS both controls stay hidden.
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
