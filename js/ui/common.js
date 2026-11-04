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

    labelsByAddr(labels) {
      const m = {};
      for (const k in labels) m[labels[k]] = m[labels[k]] ? m[labels[k]] + ',' + k : k;
      return m;
    },
  };

  window.UI = UI;
})();
