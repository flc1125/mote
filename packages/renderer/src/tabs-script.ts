/** Embedded into the fixed navigation script, sharing its fragment navigation. */
export const TABS_INIT_SCRIPT = String.raw`
  const tabPanels = new Map();
  const tabDefaults = [];
  let contentChanged = () => {};
  for (const group of article.querySelectorAll('.content-tabs')) {
    const panels = [...group.children];
    if (panels.length < 2 || panels.length > 16) continue;
    let bar;
    const buttons = [];
    try {
      const titles = panels.map(panel => panel.firstElementChild);
      if (panels.some((panel, i) => !panel.matches('section.content-panel[id]') ||
          !titles[i] || !titles[i].matches('.content-panel-title[id]') ||
          !titles[i].firstElementChild || titles[i].firstElementChild.getAttribute('href') !== '#' + panel.id)) continue;
      bar = document.createElement('div');
      bar.className = 'content-tab-list';
      bar.setAttribute('role', 'tablist');
      bar.setAttribute('aria-label', 'Content options');
      let selected = -1;
      function activate(index, focus = false) {
        const changed = selected !== index;
        const stranded = panels.some((panel, i) => i !== index && panel.contains(document.activeElement));
        for (let i = 0; i < panels.length; i++) {
          buttons[i].setAttribute('aria-selected', String(i === index));
          buttons[i].tabIndex = i === index ? 0 : -1;
          panels[i].hidden = i !== index;
        }
        selected = index;
        if (focus || stranded) buttons[index].focus({ preventScroll: true });
        if (focus) buttons[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (changed) contentChanged();
        return changed;
      }
      function choose(index) {
        activate(index, true);
        const hash = '#' + panels[index].id;
        if (location.hash !== hash) {
          try { history.pushState(null, '', hash); } catch {}
        }
      }
      for (let i = 0; i < panels.length; i++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = panels[i].id + '-control';
        button.textContent = titles[i].textContent;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', panels[i].id);
        button.addEventListener('click', () => choose(i));
        button.addEventListener('keydown', event => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          let next;
          if (event.key === 'ArrowRight') next = (i + 1) % panels.length;
          else if (event.key === 'ArrowLeft') next = (i + panels.length - 1) % panels.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = panels.length - 1;
          else return;
          event.preventDefault();
          choose(next);
        });
        buttons.push(button);
        bar.append(button);
      }
      for (let i = 0; i < panels.length; i++) {
        panels[i].setAttribute('role', 'tabpanel');
        panels[i].setAttribute('aria-labelledby', buttons[i].id);
        panels[i].tabIndex = 0;
      }
      group.prepend(bar);
      activate(0);
      group.setAttribute('data-tabs-enhanced', '');
      for (let i = 0; i < panels.length; i++) tabPanels.set(panels[i], () => activate(i));
      tabDefaults.push(() => activate(0));
    } catch {
      // A failed group is still a complete document with linkable section labels.
      if (bar) bar.remove();
      group.removeAttribute('data-tabs-enhanced');
      for (const panel of panels) {
        panel.hidden = false;
        for (const attr of ['role', 'aria-labelledby', 'tabindex']) panel.removeAttribute(attr);
        tabPanels.delete(panel);
      }
    }
  }
`;
