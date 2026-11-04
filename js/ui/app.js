/* Tab navigation & theme */
(function () {
  'use strict';
  const UI = window.UI;
  const nav = document.getElementById('tabs');
  const main = document.getElementById('main');
  const inited = {};

  UI.sections.forEach((s, i) => {
    const b = document.createElement('button');
    b.dataset.tab = s.id;
    b.innerHTML = (i ? `<span class="num">${i}.</span> ` : '') + s.title;
    b.addEventListener('click', () => show(s.id));
    nav.appendChild(b);
    const sec = document.createElement('section');
    sec.className = 'tab';
    sec.id = 'tab-' + s.id;
    main.appendChild(sec);
  });

  function show(id) {
    const s = UI.sections.find((x) => x.id === id) || UI.sections[0];
    UI.$$('nav.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === s.id));
    UI.$$('section.tab').forEach((x) => x.classList.toggle('active', x.id === 'tab-' + s.id));
    const el = document.getElementById('tab-' + s.id);
    if (!inited[s.id]) {
      inited[s.id] = true;
      try { s.init(el); } catch (e) { el.innerHTML = '<p class="err">خطا در بارگذاری این بخش: ' + UI.esc(e.message) + '</p>'; console.error(e); }
    }
    if (location.hash !== '#' + s.id) history.replaceState(null, '', '#' + s.id);
    window.scrollTo(0, 0);
  }
  window.App = { show };
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1) || 'intro');

  // Theme toggle
  const root = document.documentElement;
  const tbtn = document.getElementById('theme');
  try { const t = localStorage.getItem('pas-theme'); if (t) root.dataset.theme = t; } catch (e) { /* ignore */ }
  tbtn.addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('pas-theme', root.dataset.theme); } catch (e) { /* ignore */ }
  });
})();
