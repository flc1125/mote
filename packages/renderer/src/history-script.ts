/** Fixed browser-local history behavior. Never interpolate document content here. */
export const HISTORY_SCRIPT = String.raw`(() => {
  const menu = document.querySelector('.history-menu');
  if (!menu) return;
  const trigger = menu.querySelector('summary');
  const list = menu.querySelector('ul');
  const status = menu.querySelector('[role="status"]');
  const clear = menu.querySelector('button');
  const recording = menu.querySelector('[role="switch"]');
  const key = 'mote:recent:v1';
  const preferenceKey = 'mote:recent:enabled';
  const isRecording = () => localStorage.getItem(preferenceKey) !== 'off';
  const validId = id => typeof id === 'string' && /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{16}$/.test(id);
  const segments = location.pathname.split('/').filter(Boolean);
  const currentId = segments.length === 1 && validId(segments[0]) ? segments[0] : null;

  function read() {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 65536) return [];
    let entries;
    try { entries = JSON.parse(raw); } catch { return []; }
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    return entries.filter(entry => {
      if (!entry || !validId(entry.id) || typeof entry.title !== 'string' || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    }).slice(0, 20).map(entry => ({ id: entry.id, title: entry.title.slice(0, 300) }));
  }

  function unavailable() {
    list.replaceChildren();
    clear.disabled = true;
    recording.disabled = true;
    status.hidden = false;
    status.textContent = 'History is unavailable in this browser.';
  }

  function show() {
    try {
      const entries = read();
      recording.checked = isRecording();
      recording.disabled = false;
      list.replaceChildren();
      status.hidden = entries.length > 0;
      status.textContent = recording.checked ? 'No recent documents.' : 'History recording is off.';
      clear.disabled = entries.length === 0;
      for (const entry of entries) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = '/' + entry.id;
        link.textContent = entry.title || 'Untitled document';
        link.title = link.textContent;
        if (entry.id === currentId) link.setAttribute('aria-current', 'page');
        item.append(link);
        list.append(item);
      }
    } catch { unavailable(); }
  }

  function record() {
    if (!currentId || document.visibilityState !== 'visible') return;
    try {
      if (!isRecording()) return;
      const entries = [{ id: currentId, title: document.title.slice(0, 300) },
        ...read().filter(entry => entry.id !== currentId)].slice(0, 20);
      localStorage.setItem(key, JSON.stringify(entries));
    } catch { /* Reading must work even if storage is blocked or full. */ }
  }

  function close(returnFocus = false) {
    menu.open = false;
    if (returnFocus) trigger.focus({ preventScroll: true });
  }
  menu.addEventListener('toggle', () => { if (menu.open) show(); });
  document.addEventListener('click', event => { if (!menu.contains(event.target)) close(); });
  document.addEventListener('focusin', event => { if (!menu.contains(event.target)) close(); });
  document.addEventListener('keydown', event => {
    if (menu.open && event.key === 'Escape') { event.preventDefault(); close(true); }
  });
  recording.addEventListener('change', () => {
    try {
      localStorage.setItem(preferenceKey, recording.checked ? 'on' : 'off');
      if (recording.checked) record();
      show();
    } catch { unavailable(); }
  });
  clear.addEventListener('click', () => {
    try {
      localStorage.removeItem(key);
      show();
      trigger.focus({ preventScroll: true });
    } catch { unavailable(); }
  });
  window.addEventListener('storage', event => {
    if (menu.open && (event.key === key || event.key === preferenceKey || event.key === null)) show();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) { record(); show(); } });
  record();
  show();
  // Record a background tab on its first view, without recreating cleared
  // entries when an already-read tab merely regains focus.
  if (document.visibilityState !== 'visible') {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onVisible);
      record();
    };
    document.addEventListener('visibilitychange', onVisible);
  }
})();`;
