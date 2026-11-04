/* Shared UI helpers */
(function () {
  'use strict';
  const S = window.Sim;
  const sections = [];

  const UI = {
    sections,
    register(def) { sections.push(def); },

    el(html) {
      const t = document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
    esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

    hex(v, digits) { return '0x' + (v >>> 0).toString(16).toUpperCase().padStart(digits || 4, '0'); },
    bin(v, w) { return (v >>> 0).toString(2).padStart(w, '0').slice(-w); },
    sdec(v, w) { return S.toSigned(v, w || 16); },

    /** Render bits MSB→LSB as boxes. */
    bitsHTML(v, w, groupBy) {
      groupBy = groupBy || 4;
      let out = '<span class="bits">';
      for (let i = w - 1; i >= 0; i--) {
        const b = (v >> i) & 1;
        const gap = i !== w - 1 && (i + 1) % groupBy === 0 ? ' gap' : '';
        out += `<span class="bit${b ? ' one' : ''}${gap}" title="bit ${i}">${b}</span>`;
      }
      return out + '</span>';
    },

    fieldsHTML(word) {
      const d = S.decode(word);
      return '<span class="fields">' + S.fieldsOf(d).map((f) =>
        `<span class="fld ${f.name}"><span class="b">${f.bits}</span><span class="n">${f.name} [${f.hi}:${f.lo}]</span></span>`).join('') + '</span>';
    },

    /** Register cards. opts: {written, read1, read2} */
    regsHTML(values, opts) {
      opts = opts || {};
      return '<div class="regs">' + values.map((v, i) => {
        const cls = ['reg'];
        if (i === 0) cls.push('zero');
        if (opts.written === i) cls.push('written');
        if (opts.read1 === i) cls.push('read1');
        if (opts.read2 === i) cls.push('read2');
        return `<div class="${cls.join(' ')}"><span class="name">R${i}</span><span class="val">${S.toSigned(v, 16)}</span><span class="sub">${UI.hex(v)} · ${UI.bin(v, 16).replace(/(.{4})(?=.)/g, '$1 ')}</span></div>`;
      }).join('') + '</div>';
    },

    /** Memory grid 16×16. marks: {addr: 'r'|'w'|'pc'|'sel'} (space-separated allowed) */
    memHTML(data, marks, labelsByAddr) {
      marks = marks || {};
      let out = '<div class="memgrid"><span class="hdr"></span>';
      for (let c = 0; c < 16; c++) out += `<span class="hdr">${c.toString(16).toUpperCase()}</span>`;
      for (let r = 0; r < data.length / 16; r++) {
        out += `<span class="hdr">${(r * 16).toString(16).toUpperCase().padStart(2, '0')}</span>`;
        for (let c = 0; c < 16; c++) {
          const a = r * 16 + c, v = data[a];
          const cls = ['cell', v ? 'nz' : 'z'];
          if (marks[a]) cls.push(marks[a]);
          const lab = labelsByAddr && labelsByAddr[a] ? ` [${labelsByAddr[a]}]` : '';
          out += `<span class="${cls.join(' ')}" data-addr="${a}" title="MEM[${a}] = ${S.toSigned(v, 16)} (${UI.hex(v)})${UI.esc(lab)}">${v.toString(16).toUpperCase().padStart(4, '0')}</span>`;
        }
      }
      return out + '</div>';
    },

    parseInput(s, fallback) {
      const n = S.parseNumber(String(s).trim());
      return n === null ? (fallback || 0) : n;
    },

    /** Program editor with sample selector. Returns {textarea, select, errors, assemble()} */
    programEditor(container, onAssemble, defaultId) {
      const box = UI.el(`<div>
        <div class="controls">
          <label>برنامهٔ نمونه
            <select class="sample">${S.SAMPLE_PROGRAMS.map((p) => `<option value="${p.id}">${p.fa}</option>`).join('')}</select>
          </label>
          <button class="btn primary asm">اسمبل و بارگذاری</button>
        </div>
        <textarea spellcheck="false" aria-label="کد اسمبلی"></textarea>
        <div class="err errors"></div>
      </div>`);
      container.appendChild(box);
      const ta = UI.$('textarea', box), sel = UI.$('.sample', box), errs = UI.$('.errors', box);
      const setSample = (id) => { const p = S.SAMPLE_PROGRAMS.find((x) => x.id === id); ta.value = p.src; };
      sel.value = defaultId || S.SAMPLE_PROGRAMS[0].id;
      setSample(sel.value);
      const assemble = () => {
        const r = S.assemble(ta.value);
        errs.innerHTML = r.errors.map((e) => `خط ${e.line}: ${UI.esc(e.msg)}`).join('<br>');
        if (r.ok) onAssemble(r);
        return r;
      };
      sel.addEventListener('change', () => { setSample(sel.value); assemble(); });
      UI.$('.asm', box).addEventListener('click', assemble);
      return { textarea: ta, select: sel, assemble };
    },

    /** Simple run loop with play/pause. */
    runner(stepFn, isDone, getDelay, onStop) {
      let timer = null;
      const api = {
        get running() { return timer !== null; },
        start() {
          if (timer) return;
          const tick = () => {
            if (isDone()) { api.stop(); return; }
            stepFn();
            timer = setTimeout(tick, getDelay());
          };
          timer = setTimeout(tick, 0);
        },
        stop() { if (timer) clearTimeout(timer); timer = null; if (onStop) onStop(); },
      };
      return api;
    },

    /**
     * Step-by-step controller: first / previous / next / play.
     * opts.pull(): optional generator called at the end of the list for more steps (disables "previous").
     * render(step, index, animate) may return a promise that resolves when its animation ends.
     */
    stepper(container, opts) {
      opts = opts || {};
      const box = UI.el(`<div class="stepper">
        <div class="btn-row">
          ${opts.pull ? '' : '<button class="btn s-first" title="بازگشت به ابتدا">⏮</button><button class="btn s-prev">◀ گام قبلی</button>'}
          <button class="btn primary s-next">گام بعدی ▶</button>
          <button class="btn s-play">پخش خودکار ⏵</button>
          ${opts.extraButtons || ''}
        </div>
        <div class="s-prog"><div class="bar"><i></i></div><span class="s-count small muted"></span></div>
        <div class="explain s-text"></div>
      </div>`);
      container.appendChild(box);
      const q = (s) => UI.$(s, box);
      let steps = [], idx = -1, render = () => {}, playing = false, intro = '';

      function update() {
        const n = steps.length;
        q('.s-count').textContent = idx < 0 ? (opts.pull ? '' : `${n} گام`) : opts.pull ? `گام ${idx + 1}` : `گام ${idx + 1} از ${n}`;
        q('.bar i').style.width = opts.pull || !n ? '0' : ((idx + 1) / n) * 100 + '%';
        const s = steps[idx];
        q('.s-text').innerHTML = s ? (s.title ? `<b>${s.title}</b> — ` : '') + s.text : intro;
        if (q('.s-prev')) { q('.s-prev').disabled = idx < 0; q('.s-first').disabled = idx < 0; }
        q('.s-next').disabled = !hasNext();
        if (!playing) q('.s-play').textContent = 'پخش خودکار ⏵';
      }
      function hasNext() { return idx < steps.length - 1 || (opts.pull && opts.canPull && opts.canPull()); }
      function go(i, animate) {
        Anim.skip();
        idx = i;
        update();
        return Promise.resolve(render(steps[idx] || null, idx, !!animate));
      }
      const api = {
        el: box,
        get index() { return idx; },
        get steps() { return steps; },
        get playing() { return playing; },
        set(list, renderFn, introText) {
          api.stop();
          steps = list || [];
          if (renderFn) render = renderFn;
          if (introText !== undefined) intro = introText;
          return go(-1, false);
        },
        async next() {
          if (idx >= steps.length - 1) {
            if (!opts.pull) return false;
            const more = opts.pull();
            if (!more || !more.length) { update(); return false; }
            steps.push(...more);
          }
          await go(idx + 1, true);
          return true;
        },
        prev() { if (idx >= 0) go(idx - 1, false); },
        first() { go(-1, false); },
        last() { api.stop(); if (steps.length) go(steps.length - 1, false); },
        push(more) { steps.push(...more); update(); },
        async play() {
          if (playing) { api.stop(); return; }
          playing = true;
          q('.s-play').textContent = 'توقف ⏸';
          while (playing) {
            const ok = await api.next();
            if (!ok || !playing) break;
            await Anim.sleep(opts.pause || 700);
          }
          playing = false;
          update();
        },
        stop() { playing = false; update(); },
        refresh: update,
      };
      q('.s-next').addEventListener('click', () => { api.stop(); api.next(); });
      q('.s-play').addEventListener('click', () => api.play());
      if (q('.s-prev')) {
        q('.s-prev').addEventListener('click', () => { api.stop(); api.prev(); });
        q('.s-first').addEventListener('click', () => { api.stop(); api.first(); });
      }
      return api;
    },

    labelsByAddr(labels) {
      const m = {};
      for (const k in labels) m[labels[k]] = m[labels[k]] ? m[labels[k]] + ',' + k : k;
      return m;
    },
  };

  window.UI = UI;
})();
