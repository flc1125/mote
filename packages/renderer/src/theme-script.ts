/**
 * Reader theme override (plan 012 contract B). Inlined in <head> right after
 * the style element so a saved choice applies before first paint (no FOUC);
 * the banner menu is wired once the DOM exists. Fixed first-party script,
 * authorized by its exact CSP hash; document content never enters it.
 *
 * Contract: localStorage["mote-theme"] is 'light' | 'dark' | absent (auto).
 * Auto removes the attribute and lets the media query follow the system.
 */
export const THEME_SCRIPT = `(function () {
  var KEY = 'mote-theme';
  var root = document.documentElement;
  var saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (error) {}
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

  var LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' };

  function current() {
    return root.dataset.theme === 'light' || root.dataset.theme === 'dark'
      ? root.dataset.theme
      : 'auto';
  }

  function wire() {
    var wrap = document.querySelector('.theme-menu');
    var button = document.querySelector('.theme-toggle');
    var menu = document.querySelector('.theme-menu-list');
    if (!wrap || !button || !menu) return;
    var items = menu.querySelectorAll('[data-theme-value]');
    var icons = button.querySelectorAll('.theme-icon');
    var isOpen = false;

    function sync() {
      var state = current();
      button.setAttribute('aria-label', 'Theme: ' + LABELS[state]);
      button.setAttribute('title', 'Theme: ' + LABELS[state]);
      for (var i = 0; i < icons.length; i++) {
        // SVG elements ignore the hidden property; toggle the attribute so
        // the stylesheet's [hidden] rule can hide them.
        icons[i].toggleAttribute('hidden', !icons[i].classList.contains('theme-icon-' + state));
      }
      for (var j = 0; j < items.length; j++) {
        items[j].setAttribute(
          'aria-checked',
          String(items[j].getAttribute('data-theme-value') === state),
        );
      }
    }

    function setOpen(next, restoreFocus) {
      isOpen = next;
      menu.hidden = !next;
      button.setAttribute('aria-expanded', String(next));
      if (next) {
        var checked = menu.querySelector('[aria-checked="true"]') || items[0];
        if (checked) checked.focus();
      } else if (restoreFocus) {
        button.focus();
      }
    }

    function apply(value) {
      try {
        if (value === 'auto') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, value);
      } catch (error) {}
      if (value === 'auto') delete root.dataset.theme;
      else root.dataset.theme = value;
      sync();
    }

    button.addEventListener('click', function () {
      setOpen(!isOpen, false);
    });

    menu.addEventListener('click', function (event) {
      var item = event.target.closest('[data-theme-value]');
      if (!item) return;
      apply(item.getAttribute('data-theme-value'));
      setOpen(false, true);
    });

    menu.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false, true);
        return;
      }
      if (event.key === 'Tab') {
        setOpen(false, false);
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      var index = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i] === document.activeElement) index = i;
      }
      var step = event.key === 'ArrowDown' ? 1 : -1;
      var next = items[(index + step + items.length) % items.length];
      if (next) next.focus();
    });

    document.addEventListener('click', function (event) {
      if (isOpen && !wrap.contains(event.target)) setOpen(false, false);
    });

    button.hidden = false;
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
`;
