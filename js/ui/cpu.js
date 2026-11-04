(function () {
  'use strict';
  const S = window.Sim, UI = window.UI, A = window.Anim;

  const COMPS = {
    muxPc: [20, 60, 50, 60, 'MUX'],
    pc: [20, 190, 60, 50, 'PC'],
    pcadd: [110, 60, 70, 40, 'PC + 1'],
    imem: [110, 170, 120, 90, 'حافظهٔ دستور'],
    ir: [260, 190, 60, 50, 'IR'],
    ctrl: [360, 10, 140, 60, 'واحد کنترل'],
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
  const CTRL = {
    'c-ctrl-muxB': ['M500,58 H568 V230', 'aluSrc', 572, 120],
    'c-ctrl-alu': ['M500,48 H650 V170', 'aluOp', 654, 120],
    'c-ctrl-dmem': ['M500,38 H820 V170', 'memRead/Write', 824, 120],
    'c-ctrl-muxWb': ['M500,28 H928 V200', 'memToReg', 932, 120],
    'c-ctrl-regs': ['M470,70 V150', 'regWrite', 474, 110],
    'c-ctrl-muxPc': ['M360,62 H200 V90 H70', 'branch/jump', 212, 55],
  };

  function svg() {
    let s = '<svg viewBox="0 0 1000 425" role="img" aria-label="مسیر داده پردازنده">';
    for (const id in CTRL) s += `<path class="wire ctl" id="${id}" d="${CTRL[id][0]}"/><text class="lbl" x="${CTRL[id][2]}" y="${CTRL[id][3]}" style="text-anchor:start">${CTRL[id][1]}</text>`;
    for (const id in WIRES) s += `<path class="wire" id="${id}" d="${WIRES[id]}"/>`;
    for (const id in COMPS) {
      const [x, y, w, h, label] = COMPS[id];
      s += `<g class="comp" id="c-${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>
        <text x="${x + w / 2}" y="${y + (h > 60 ? h / 2 - 10 : h / 2 - (h > 45 ? 7 : 0))}">${label}</text>
        <text class="v" id="v-${id}" x="${x + w / 2}" y="${y + h / 2 + 12}"></text></g>`;
    }
    s += '<text class="lbl" x="510" y="190">A</text><text class="lbl" x="510" y="245">B</text><text class="lbl" x="720" y="218">addr</text>' +
      '<text class="lbl" x="600" y="305">store data</text><text class="lbl" x="150" y="405">branch / jump target</text></svg>';
    return s;
  }

  UI.register({
    id: 'cpu', title: 'پردازندهٔ کامل (مسیر داده)',
    desc: 'اجرای برنامه به‌صورت ریزگام: حرکت داده روی سیم‌ها، سیگنال‌های کنترل و به‌روزرسانی ثبات‌ها',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p>همهٔ اجزا کنار هم: هر دستور از پنج فاز <b>واکشی، رمزگشایی، اجرا، حافظه و بازنویسی</b> می‌گذرد و هر فاز چند <b>ریزگام</b> دارد.
        در هر ریزگام، مقدارهایی که روی سیم‌ها جابه‌جا می‌شوند به‌صورت برچسب متحرک نمایش داده می‌شوند. خط‌چین‌ها سیگنال‌های کنترلی‌اند که از واحد کنترل به اجزا می‌روند.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="st"></div>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn ph">پایان فاز ⏭</button>
            <button class="btn si">پایان دستور ⏭⏭</button>
            <button class="btn runall">اجرای فوری تا HALT</button>
            <button class="btn rst">بازنشانی ⟲</button>
          </div>
        </div>
        <div class="grid side">
          <div class="card ed"><h3>برنامه</h3></div>
          <div class="card">
            <div class="phases"></div>
            <div class="fig datapath">${svg()}</div>
          </div>
        </div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>ریزگام‌های دستور جاری</h3><ol class="ulog"></ol></div>
          <div class="card"><h3>وضعیت</h3><dl class="kv state"></dl><h3 style="margin-top:12px">ثبات‌ها</h3><div class="regview"></div></div>
        </div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>فهرست برنامه</h3><div class="table-wrap listing" style="max-height:380px;overflow-y:auto"></div></div>
          <div class="card"><h3>حافظه</h3><p class="muted small">کادر آبی: PC · آبی کم‌رنگ: خواندن داده · سبز: نوشتن</p><div class="memwrap memview"></div></div>
        </div>`;
      const q = (s) => UI.$(s, el);
      const cpu = new S.CPU();
      const dsvg = UI.$('.datapath svg', el);
      let asm = null;

      const snap = () => ({ pc: cpu.pc, ir: cpu.ir, regs: cpu.regs.values.slice(), mem: cpu.mem.data.slice(), flags: Object.assign({}, cpu.flags), l: Object.assign({}, cpu.l), instructions: cpu.instructions, phaseCount: cpu.phaseCount });
      function pullPhase() {
        if (cpu.halted) return null;
        const pre = snap();
        const info = cpu.stepPhase();
        const post = snap();
        const n = info.steps.length;
        return info.steps.map((s, i) => Object.assign({}, s, { title: `${info.phaseFa} · ${i + 1}/${n}`, phase: info.phase, pre, post, first: i === 0, lastOfPhase: i === n - 1 }));
      }
      const stepper = UI.stepper(q('.st'), { pull: pullPhase, canPull: () => !cpu.halted, pause: 500 });

      UI.programEditor(q('.ed'), (r) => {
        asm = r; cpu.load(r.words);
        stepper.set([], render, 'برنامه بارگذاری شد. «گام بعدی» یا «پخش خودکار» را بزنید.');
      }, 'sum').assemble();

      function view(step, idx) {
        // architectural state visible at this micro-step
        if (!step) { const v = snap(); v.l = cpu.l; return v; }
        const steps = stepper.steps;
        let start = idx; while (start > 0 && !steps[start].first) start--;
        const done = new Set(steps.slice(start, idx + 1).flatMap((s) => s.commit || []));
        const v = {};
        ['pc', 'ir', 'regs', 'mem'].forEach((k) => { v[k] = done.has(k) ? step.post[k] : step.pre[k]; });
        v.flags = step.phase === 'EXECUTE' ? step.post.flags : step.pre.flags;
        v.l = step.post.l;
        v.instructions = step.lastOfPhase && step.phase === 'WRITEBACK' ? step.post.instructions : step.pre.instructions;
        v.phaseCount = step.pre.phaseCount + 1;
        return v;
      }

      function render(step, idx, animate) {
        const v = view(step, idx);
        const phase = step ? step.phase : null;
        const pidx = phase ? S.PHASES.indexOf(phase) : -1;
        q('.phases').innerHTML = S.PHASES.map((p, i) => `<span class="${i === pidx ? 'cur' : i < pidx ? 'done' : ''}">${S.PHASE_FA[p]}</span>`).join('');
        UI.$$('.comp', el).forEach((c) => c.classList.toggle('on', !!(step && step.comps.includes(c.id.slice(2)))));
        UI.$$('.wire', dsvg).forEach((w) => w.classList.toggle('on', !!(step && step.wires.includes(w.id))));
        const l = v.l || {};
        const setV = (id, t) => { const n = UI.$('#v-' + id, el); if (n) n.textContent = t; };
        const stepsSoFar = step ? stepper.steps.slice(0, idx + 1) : [];
        const inInstr = (ph) => step && S.PHASES.indexOf(phase) >= S.PHASES.indexOf(ph);
        setV('pc', String(v.pc));
        setV('ir', UI.hex(v.ir));
        setV('imem', step ? `[${l.pc}]` : '');
        setV('pcadd', step && l.pcPlus1 !== undefined ? String(l.pcPlus1) : '');
        setV('ctrl', inInstr('DECODE') && l.c && (phase !== 'DECODE' || stepsSoFar[idx].control || !step.first) ? (l.d ? l.d.name : '') : '');
        setV('regs', inInstr('DECODE') && l.d && l.c && (l.c.useA || l.c.useB) ? `A=${S.toSigned(l.a, 16)} B=${S.toSigned(l.b, 16)}` : '');
        setV('imm', inInstr('DECODE') && l.d && (l.d.format === 'I' || l.d.format === 'L' || l.d.format === 'J') ? String(l.imm) : '');
        setV('alu', inInstr('EXECUTE') && l.alu !== undefined && l.c && !l.c.jump ? String(S.toSigned(l.alu, 16)) : '');
        setV('dmem', inInstr('MEMORY') && l.c && (l.c.memRead || l.c.memWrite) ? `[${l.alu & 0xFF}]` : '');
        setV('muxB', ''); setV('muxWb', ''); setV('muxPc', '');

        // micro-step log for the current instruction
        if (step) {
          let s0 = idx; while (s0 > 0 && !(stepper.steps[s0].first && stepper.steps[s0].phase === 'FETCH')) s0--;
          q('.ulog').innerHTML = stepper.steps.slice(s0, idx + 1).map((s, i, arr) => `<li class="${i === arr.length - 1 ? 'cur' : ''}"><b>${S.PHASE_FA[s.phase].split(' ')[0]}</b> — ${s.text}</li>`).join('');
          const cur = UI.$('.ulog li.cur', el); if (cur && cur.scrollIntoView && animate) cur.scrollIntoView({ block: 'nearest' });
        } else q('.ulog').innerHTML = `<li class="muted">${cpu.halted ? 'پردازنده متوقف شد (HALT).' : 'هنوز ریزگامی اجرا نشده است.'}</li>`;

        const c = inInstr('DECODE') ? l.c : null;
        q('.state').innerHTML = `<dt>PC</dt><dd>${v.pc}</dd><dt>IR</dt><dd>${UI.hex(v.ir)}  ${step ? S.disassemble(v.ir) : ''}</dd>
          <dt>پرچم‌های ALU</dt><dd>Z=${v.flags.Z} N=${v.flags.N} C=${v.flags.C} V=${v.flags.V}</dd>
          <dt>سیگنال‌های کنترل</dt><dd class="small">${c ? S.CONTROL_SIGNALS.filter((s) => s.key !== 'aluOp' && c[s.key]).map((s) => s.key).join(' ') || '—' : '—'}</dd>
          <dt>دستورهای کامل‌شده</dt><dd>${v.instructions}</dd><dt>فاز (چرخه در مدل چندچرخه‌ای)</dt><dd>${step ? v.phaseCount : cpu.phaseCount}</dd>
          ${cpu.halted && (!step || idx === stepper.steps.length - 1) ? '<dt>وضعیت</dt><dd>⏹ HALT</dd>' : ''}`;
        q('.regview').innerHTML = UI.regsHTML(v.regs, { written: step && step.written !== undefined && step.commit ? step.written : null, read1: step ? step.read1 : null, read2: step ? step.read2 : null });

        if (asm) {
          const execPc = step ? l.pc : v.pc;
          q('.listing').innerHTML = `<table class="data ltr"><thead><tr><th>addr</th><th>hex</th><th style="text-align:left">source</th></tr></thead><tbody>${asm.listing.map((x) =>
            `<tr class="${x.addr === execPc && !x.isData ? 'curline' : ''}"><td>${x.addr}</td><td>${UI.hex(x.word)}</td><td style="text-align:left;white-space:pre">${UI.esc(x.src)}</td></tr>`).join('')}</tbody></table>`;
          const marks = {};
          if (step && step.memRead !== undefined) marks[step.memRead] = 'r';
          if (step && step.memWrite !== undefined) marks[step.memWrite] = 'w';
          marks[v.pc] = (marks[v.pc] ? marks[v.pc] + ' ' : '') + 'pc';
          q('.memview').innerHTML = UI.memHTML(v.mem, marks, UI.labelsByAddr(asm.labels));
        }
        q('.ph').disabled = q('.si').disabled = q('.runall').disabled = cpu.halted && (!step || idx === stepper.steps.length - 1);
        if (!step || !animate) return null;
        return (async () => {
          for (const t of step.tokens) await A.token(dsvg, t.wire, t.label, { duration: 750 });
          step.comps.forEach((id) => A.flash(UI.$('#c-' + id, el)));
        })();
      }

      function finishPhase() {
        const st = stepper.steps, i = stepper.index;
        if (i < 0 || st[i].lastOfPhase) { const more = pullPhase(); if (!more) return false; stepper.push(more); }
        stepper.last();
        return true;
      }
      q('.ph').addEventListener('click', () => { stepper.stop(); finishPhase(); });
      q('.si').addEventListener('click', () => {
        stepper.stop();
        do { if (!finishPhase()) break; } while (!(stepper.steps[stepper.index].phase === 'WRITEBACK' || cpu.halted));
      });
      q('.runall').addEventListener('click', () => {
        stepper.stop();
        let guard = 0, last = null;
        while (!cpu.halted && guard++ < 50000) { const m = pullPhase(); if (!m) break; last = m[m.length - 1]; }
        if (last) { last.pre = last.post; last.tokens = []; stepper.push([last]); stepper.last(); }
      });
      q('.rst').addEventListener('click', () => { cpu.reset(); stepper.set([], render, 'بازنشانی شد. «گام بعدی» را بزنید.'); });
    },
  });
})();
