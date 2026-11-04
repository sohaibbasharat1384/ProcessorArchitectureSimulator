/* Animation engine shared by every section */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  const Anim = {
    speed: 1,
    gen: 0,
    _sleepers: new Set(),

    setSpeed(v) {
      Anim.speed = v;
      document.documentElement.style.setProperty('--anim-ms', Math.round(450 / v) + 'ms');
    },
    dur(ms) { return ms / Anim.speed; },

    /** Finish every running animation immediately. */
    skip() {
      Anim.gen++;
      Anim._sleepers.forEach((f) => f());
      Anim._sleepers.clear();
    },

    sleep(ms) {
      const gen = Anim.gen;
      return new Promise((res) => {
        if (gen !== Anim.gen) return res();
        const done = () => { clearTimeout(t); Anim._sleepers.delete(done); res(); };
        const t = setTimeout(done, Anim.dur(ms));
        Anim._sleepers.add(done);
      });
    },

    /** Animate f(k) for k in 0..1 with ease-in-out. */
    tween(ms, f) {
      const gen = Anim.gen, d = Anim.dur(ms);
      return new Promise((res) => {
        const t0 = performance.now();
        const frame = (t) => {
          let k = d <= 0 ? 1 : Math.min(1, (t - t0) / d);
          if (gen !== Anim.gen) k = 1;
          f(k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
          if (k < 1) requestAnimationFrame(frame); else res();
        };
        requestAnimationFrame(frame);
      });
    },

    svgEl(tag, attrs, parent) {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(e);
      return e;
    },

    layer(svg) {
      let l = svg.querySelector(':scope > g.tokens');
      if (!l) l = Anim.svgEl('g', { class: 'tokens' }, svg);
      return l;
    },

    /** A labelled value that travels along an SVG path. */
    token(svg, path, label, opts) {
      opts = opts || {};
      if (typeof path === 'string') path = svg.querySelector('#' + path);
      if (!path) return Promise.resolve();
      const len = path.getTotalLength();
      const g = Anim.svgEl('g', { class: 'token ' + (opts.cls || '') }, Anim.layer(svg));
      const text = String(label);
      const w = Math.max(20, text.length * 6.8 + 12);
      Anim.svgEl('rect', { x: -w / 2, y: -10, width: w, height: 20, rx: 10 }, g);
      const t = Anim.svgEl('text', { x: 0, y: 1 }, g);
      t.textContent = text;
      return Anim.tween(opts.duration || 800, (e) => {
        const p = path.getPointAtLength((opts.reverse ? 1 - e : e) * len);
        g.setAttribute('transform', `translate(${p.x},${p.y})`);
      }).then(() => { if (!opts.keep) g.remove(); return g; });
    },

    /** Briefly flash an element (HTML or SVG). */
    flash(el, cls) {
      if (!el) return;
      cls = cls || 'flash';
      el.classList.remove(cls);
      void el.getBoundingClientRect();
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), Anim.dur(900));
    },

    /** Draw a path progressively (stroke-dash animation). */
    draw(path, ms) {
      if (!path) return Promise.resolve();
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      return Anim.tween(ms || 600, (e) => { path.style.strokeDashoffset = len * (1 - e); }).then(() => { path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; });
    },
  };

  window.Anim = Anim;
  let saved = 1;
  try { saved = parseFloat(localStorage.getItem('pas-speed')) || 1; } catch (e) { /* ignore */ }
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) saved = Math.max(saved, 3);
  Anim.setSpeed(saved);
})();
