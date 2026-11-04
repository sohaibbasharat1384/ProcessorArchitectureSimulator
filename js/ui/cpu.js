(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  const COMPS = {
    muxPc: [20, 60, 50, 60, 'MUX', 'PC'],
    pc: [20, 190, 60, 50, 'PC'],
    pcadd: [110, 60, 70, 40, 'PC + 1'],
    imem: [110, 170, 120, 90, 'حافظهٔ دستور'],
    ir: [260, 190, 60, 50, 'IR'],
    ctrl: [360, 15, 140, 50, 'واحد کنترل'],
    regs: [370, 150, 130, 140, 'بانک ثبات'],
    imm: [370, 325, 130, 45, 'گسترش علامت'],
    muxB: [550, 230, 36, 70, 'MUX'],
    alu: [620, 170, 90, 110, 'ALU'],
    dmem: [760, 170, 120, 100, 'حافظهٔ داده'],
    muxWb: [910, 200, 36, 70, 'MUX'],
  };
  const WIRES = {
    'w-pc-imem': 'M80,215 H110',
    'w-pc-pcadd': 'M80,200 H95 V80 H110',
    'w-pcadd-muxPc': 'M145,60 V40 H45 V60',
    'w-imm-muxPc': 'M435,370 V410 H8 V100 H20',
    'w-muxPc-pc': 'M45,120 V190',
    'w-imem-ir': 'M230,215 H260',
    'w-ir-ctrl': 'M290,190 V40 H360',
    'w-ir-regs': 'M320,215 H370',
    'w-ir-imm': 'M305,240 V347 H370',
    'w-regs-alu': 'M500,195 H620',
    'w-regs-muxB': 'M500,250 H550',
    'w-imm-muxB': 'M500,347 H525 V285 H550',
    'w-muxB-alu': 'M586,265 H620',
    'w-alu-dmem': 'M710,225 H760',
    'w-regs-dmem': 'M500,280 H515 V310 H735 V250 H760',
    'w-dmem-muxWb': 'M880,220 H910',
    'w-alu-muxWb': 'M665,170 V140 H895 V255 H910',
    'w-muxWb-regs': 'M946,235 H975 V125 H435 V150',
  };

  function svg() {
    let s = '<svg viewBox="0 0 1000 425" role="img" aria-label="مسیر داده پردازنده">';
    for (const id in WIRES) s += `<path class="wire" id="${id}" d="${WIRES[id]}"/>`;
    for (const id in COMPS) {
      const [x, y, w, h, label] = COMPS[id];
      s += `<g class="comp" id="c-${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>
        <text x="${x + w / 2}" y="${y + (h > 60 ? h / 2 - 10 : h / 2 - (h > 45 ? 7 : 0))}">${label}</text>
        <text class="v" id="v-${id}" x="${x + w / 2}" y="${y + (h > 60 ? h / 2 + 12 : h / 2 + 12)}"></text></g>`;
    }
    s += '<text class="lbl" x="510" y="190">A</text><text class="lbl" x="510" y="245">B</text><text class="lbl" x="720" y="218">addr</text>' +
      '<text class="lbl" x="600" y="305">store data</text><text class="lbl" x="150" y="405">branch / jump target</text></svg>';
    return s;
  }

  UI.register({
    id: 'cpu', title: 'پردازندهٔ کامل (مسیر داده)',
    desc: 'اجرای برنامهٔ اسمبلی فاز به فاز: واکشی، رمزگشایی، اجرا، حافظه و بازنویسی',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p>اکنون همهٔ اجزا کنار هم قرار می‌گیرند. هر دستور از پنج فاز می‌گذرد: <b>واکشی</b> دستور از حافظه با PC،
        <b>رمزگشایی</b> و خواندن ثبات‌ها، <b>اجرا</b> در ALU، <b>دسترسی به حافظه</b> و <b>بازنویسی</b> نتیجه و به‌روزرسانی PC.
        در نمودار، اجزا و سیم‌های فعال در هر فاز روشن می‌شوند.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="btn-row">
            <button class="btn primary sp">فاز بعدی ▶</button>
            <button class="btn si">دستور بعدی ⏭</button>
            <button class="btn run">اجرای خودکار ⏵</button>
            <button class="btn rst">بازنشانی ⟲</button>
            <label class="inline small" style="display:flex;align-items:center;gap:6px;margin-inline-start:10px">سرعت <input type="range" class="speed" min="50" max="1500" value="600" style="direction:ltr"></label>
          </div>
        </div>
        <div class="grid side">
          <div class="card ed"><h3>برنامه</h3></div>
          <div class="card">
            <div class="phases"></div>
            <div class="datapath">${svg()}</div>
            <div class="explain" style="margin-top:8px"></div>
          </div>
        </div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>وضعیت</h3><dl class="kv state"></dl><h3 style="margin-top:12px">ثبات‌ها</h3><div class="regview"></div></div>
          <div class="card"><h3>فهرست برنامه</h3><div class="table-wrap listing" style="max-height:380px;overflow-y:auto"></div></div>
        </div>
        <div class="card" style="margin-top:16px"><h3>حافظه</h3><p class="muted small">کادر آبی: PC · آبی کم‌رنگ: خواندن داده · سبز: نوشتن</p><div class="memwrap memview"></div></div>`;
      const q = (s) => UI.$(s, el);
      const cpu = new S.CPU();
      let asm = null, last = null, lastWrite = null, memMarks = {};

      const runner = UI.runner(() => doPhase(), () => cpu.halted, () => 1550 - +q('.speed').value, () => { q('.run').textContent = 'اجرای خودکار ⏵'; });

      UI.programEditor(q('.ed'), (r) => {
        runner.stop();
        asm = r; cpu.load(r.words); last = null; lastWrite = null; memMarks = {};
        render();
      }, 'sum').assemble();

      function doPhase() {
        const i = cpu.stepPhase();
        if (!i) return;
        last = i;
        memMarks = {};
        i.memLog.forEach((m) => { if (i.phase !== 'FETCH') memMarks[m.addr] = m.type === 'R' ? 'r' : 'w'; });
        lastWrite = i.phase === 'WRITEBACK' && cpu.regs.lastWrite && !cpu.regs.lastWrite.ignored ? cpu.regs.lastWrite.reg : (i.phase === 'FETCH' ? null : lastWrite);
        render();
      }
      function render() {
        const cur = last ? last.phase : null;
        const idx = cur ? S.PHASES.indexOf(cur) : -1;
        q('.phases').innerHTML = S.PHASES.map((p, i) => `<span class="${i === idx ? 'cur' : i < idx ? 'done' : ''}">${S.PHASE_FA[p]}</span>`).join('');
        q('.explain').textContent = cpu.halted ? '⏹ پردازنده متوقف شد (HALT). برای اجرای دوباره «بازنشانی» را بزنید.' : last ? last.text : 'برای شروع «فاز بعدی» را بزنید.';
        UI.$$('.comp', el).forEach((c) => c.classList.toggle('on', !!(last && last.active.includes(c.id.slice(2)))));
        UI.$$('.wire', el).forEach((w) => w.classList.toggle('on', !!(last && last.wires.includes(w.id))));
        const l = cpu.l || {};
        const setV = (id, t) => { const n = UI.$('#v-' + id, el); if (n) n.textContent = t; };
        setV('pc', String(cpu.pc));
        setV('ir', UI.hex(cpu.ir));
        setV('imem', idx >= 0 ? `[${l.pc}]` : '');
        setV('pcadd', l.pcPlus1 !== undefined ? String(l.pcPlus1) : '');
        setV('alu', idx >= 2 && l.alu !== undefined ? String(S.toSigned(l.alu, 16)) : '');
        setV('imm', idx >= 1 && l.d ? String(l.imm) : '');
        setV('ctrl', idx >= 1 && l.c ? l.c.aluOp : '');
        setV('regs', idx >= 1 && l.d ? `A=${S.toSigned(l.a, 16)} B=${S.toSigned(l.b, 16)}` : '');
        setV('dmem', idx >= 3 && l.c && (l.c.memRead || l.c.memWrite) ? `[${l.alu & 0xFF}]` : '');

        const c = l.c;
        q('.state').innerHTML = `<dt>PC</dt><dd>${cpu.pc}</dd><dt>IR</dt><dd>${UI.hex(cpu.ir)}  ${idx >= 0 ? S.disassemble(cpu.ir) : ''}</dd>
          <dt>پرچم‌های ALU</dt><dd>Z=${cpu.flags.Z} N=${cpu.flags.N} C=${cpu.flags.C} V=${cpu.flags.V}</dd>
          <dt>سیگنال‌های کنترل</dt><dd class="small">${c && idx >= 1 ? S.CONTROL_SIGNALS.filter((s) => s.key !== 'aluOp' && c[s.key]).map((s) => s.key).join(' ') || '—' : '—'}</dd>
          <dt>دستورهای اجراشده</dt><dd>${cpu.instructions}</dd><dt>فازها (چرخه در چندچرخه‌ای)</dt><dd>${cpu.phaseCount}</dd>`;
        const rd1 = idx >= 1 && c && c.useA ? l.d.rs : null, rd2 = idx >= 1 && c && c.useB ? l.p2 : null;
        q('.regview').innerHTML = UI.regsHTML(cpu.regs.values, { written: lastWrite, read1: idx === 1 ? rd1 : null, read2: idx === 1 ? rd2 : null });

        if (asm) {
          const execPc = idx >= 0 && !cpu.halted ? l.pc : cpu.pc;
          q('.listing').innerHTML = `<table class="data ltr"><thead><tr><th>addr</th><th>hex</th><th style="text-align:left">source</th></tr></thead><tbody>${asm.listing.map((x) =>
            `<tr style="${x.addr === execPc && !x.isData ? 'background:var(--accent-soft);font-weight:700' : ''}"><td>${x.addr}</td><td>${UI.hex(x.word)}</td><td style="text-align:left;white-space:pre">${UI.esc(x.src)}</td></tr>`).join('')}</tbody></table>`;
          const marks = Object.assign({}, memMarks);
          marks[cpu.pc] = (marks[cpu.pc] ? marks[cpu.pc] + ' ' : '') + 'pc';
          q('.memview').innerHTML = UI.memHTML(cpu.mem.data, marks, UI.labelsByAddr(asm.labels));
        }
        q('.sp').disabled = q('.si').disabled = cpu.halted;
      }
      q('.sp').addEventListener('click', () => { runner.stop(); doPhase(); });
      q('.si').addEventListener('click', () => {
        runner.stop();
        do { doPhase(); } while (cpu.phaseIndex !== 0 && !cpu.halted);
      });
      q('.run').addEventListener('click', () => {
        if (runner.running) runner.stop();
        else { runner.start(); q('.run').textContent = 'توقف ⏸'; }
      });
      q('.rst').addEventListener('click', () => { runner.stop(); cpu.reset(); last = null; lastWrite = null; memMarks = {}; render(); });
      render();
    },
  });
})();
