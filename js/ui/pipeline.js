(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  const STAGE_FA = { IF: 'واکشی', ID: 'رمزگشایی', EX: 'اجرا', MEM: 'حافظه', WB: 'بازنویسی' };

  UI.register({
    id: 'pipeline', title: 'خط لوله (Pipeline)',
    desc: 'خط لولهٔ ۵ مرحله‌ای، مخاطره‌های داده و کنترل، پیشرانی (Forwarding)، توقف و تخلیه',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p>در <b>خط لوله</b> پنج مرحلهٔ اجرای دستور مانند خط تولید روی هم همپوشانی دارند؛ در هر چرخه تا پنج دستور در مراحل مختلف‌اند.
        اما وابستگی‌ها مشکل‌ساز می‌شوند: <b>مخاطرهٔ داده</b> (دستوری به نتیجهٔ دستور قبلی نیاز دارد) با <b>پیشرانی</b> یا <b>توقف</b> حل می‌شود
        و <b>مخاطرهٔ کنترل</b> (پرش) با <b>تخلیه</b> دستورهای اشتباه واکشی‌شده. پرش‌ها در مرحلهٔ EX حل می‌شوند و پیش‌بینی پیش‌فرض «انجام‌نشدن» است.</p>
        <p class="small muted">راهنمای نمودار: <b>*</b> = توقف (حباب) · <b>×</b> = تخلیه‌شده · ثبات‌ها در نیمهٔ اول WB نوشته و در نیمهٔ دوم ID خوانده می‌شوند.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="btn-row" style="align-items:center">
            <button class="btn primary st">چرخهٔ بعدی ▶</button>
            <button class="btn run">اجرای خودکار ⏵</button>
            <button class="btn all">اجرا تا پایان ⏭</button>
            <button class="btn rst">بازنشانی ⟲</button>
            <label class="inline small" style="display:flex;align-items:center;gap:6px"><input type="checkbox" class="fw" checked> پیشرانی (Forwarding)</label>
            <label class="inline small" style="display:flex;align-items:center;gap:6px">سرعت <input type="range" class="speed" min="50" max="1500" value="700" style="direction:ltr"></label>
          </div>
        </div>
        <div class="grid side">
          <div class="card ed"><h3>برنامه</h3></div>
          <div>
            <div class="card"><h3>مراحل در چرخهٔ <span class="cyc">0</span></h3><div class="stages"></div><div class="evs log" style="margin-top:10px;max-height:150px"></div></div>
            <div class="card" style="margin-top:16px"><h3>آمار</h3><div class="stats"></div></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h3>نمودار زمانی خط لوله</h3><div class="table-wrap diag" style="max-height:480px;overflow:auto;direction:ltr"></div></div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>ثبات‌ها</h3><div class="regview"></div></div>
          <div class="card"><h3>مقایسه</h3><div class="cmp"></div></div>
        </div>`;
      const q = (s) => UI.$(s, el);
      let pl = new S.Pipeline({ forwarding: true });
      let asm = null, last = null, written = null;

      const runner = UI.runner(() => doStep(), () => pl.halted, () => 1550 - +q('.speed').value, () => { q('.run').textContent = 'اجرای خودکار ⏵'; });

      UI.programEditor(q('.ed'), (r) => { asm = r; rebuild(); }, 'hazards').assemble();

      function rebuild() {
        runner.stop();
        pl = new S.Pipeline({ forwarding: q('.fw').checked });
        if (asm) pl.load(asm.words);
        last = null; written = null;
        compare();
        render();
      }
      function doStep() {
        last = pl.step();
        written = null;
        if (last) { const w = last.events.find((e) => e.type === 'wb'); if (w) written = pl.regs.lastWrite.reg; }
        render();
      }
      function compare() {
        if (!asm) return;
        const res = [true, false].map((fw) => { const p = new S.Pipeline({ forwarding: fw }); p.load(asm.words); p.run(); return p; });
        const cpu = new S.CPU(); cpu.load(asm.words); cpu.run();
        const n = cpu.instructions;
        q('.cmp').innerHTML = `<table class="data"><thead><tr><th>مدل</th><th>چرخه</th><th>CPI</th><th>توقف</th><th>تخلیه</th></tr></thead><tbody>
          <tr><td>بدون خط لوله (چندچرخه‌ای، ۵ چرخه برای هر دستور)</td><td>${n * 5}</td><td>5.00</td><td>—</td><td>—</td></tr>
          ${res.map((p, i) => `<tr><td>خط لوله ${i === 0 ? 'با' : 'بدون'} پیشرانی</td><td>${p.stats.cycles}</td><td>${p.cpi().toFixed(2)}</td><td>${p.stats.stalls}</td><td>${p.stats.flushes}</td></tr>`).join('')}
          </tbody></table><p class="muted small">تعداد دستورهای اجراشده: ${n}. تسریع خط لوله با پیشرانی نسبت به چندچرخه‌ای: ×${(n * 5 / res[0].stats.cycles).toFixed(2)}</p>`;
      }
      function render() {
        q('.cyc').textContent = pl.cycle;
        const occ = last ? last.occ : {};
        q('.stages').innerHTML = S.STAGES.map((s) => {
          const rec = occ[s] !== null && occ[s] !== undefined ? pl.records[occ[s]] : null;
          const note = rec ? rec.cells[pl.cycle] : '';
          return `<div class="stage${rec ? ' busy' : ''}"><div class="sn">${s}</div><div class="small muted">${STAGE_FA[s]}</div>
            <div class="si">${rec ? UI.esc(rec.text) + (note.endsWith('*') ? ' <b class="ev-stall">*</b>' : note.endsWith('×') ? ' <b class="ev-flush">×</b>' : '') : '<span class="muted">حباب</span>'}</div></div>`;
        }).join('');
        q('.evs').innerHTML = last && last.events.length ? last.events.map((e) => `<div class="ev-${e.type}">${UI.esc(e.text)}</div>`).join('') : '<div class="muted">رویدادی ثبت نشده است.</div>';
        const st = pl.stats;
        q('.stats').innerHTML = `<dl class="kv"><dt>چرخه‌ها</dt><dd>${st.cycles}</dd><dt>دستورهای کامل‌شده</dt><dd>${st.completed}</dd>
          <dt>CPI</dt><dd>${pl.cpi().toFixed(2)}</dd><dt>چرخه‌های توقف</dt><dd>${st.stalls}</dd><dt>دستورهای تخلیه‌شده</dt><dd>${st.flushes}</dd>
          <dt>پیشرانی‌ها</dt><dd>${st.forwards}</dd><dt>PC</dt><dd>${pl.pc}</dd></dl>${pl.halted ? '<p><span class="badge ok">اجرا پایان یافت</span></p>' : ''}`;

        const maxC = pl.cycle, from = Math.max(1, maxC - 59);
        let head = '<tr><th class="instr">instruction</th>';
        for (let c = from; c <= maxC; c++) head += `<th class="${c === maxC ? 'cur' : ''}">${c}</th>`;
        head += '</tr>';
        const recs = pl.records.filter((r) => Object.keys(r.cells).some((c) => +c >= from));
        const body = recs.map((r) => {
          let row = `<td class="instr${r.squashed ? ' sq' : ''}">${r.pc}: ${UI.esc(r.text)}</td>`;
          for (let c = from; c <= maxC; c++) {
            const v = r.cells[c];
            if (!v) { row += '<td></td>'; continue; }
            const base = v.replace(/[*×]$/, '');
            const cls = v.endsWith('*') ? 'stall' : v.endsWith('×') ? 'flush' : '';
            row += `<td class="s-${base} ${cls}">${v}</td>`;
          }
          return `<tr>${row}</tr>`;
        }).join('');
        q('.diag').innerHTML = maxC ? `<table class="pipe-diagram"><thead>${head}</thead><tbody>${body}</tbody></table>${from > 1 ? '<p class="muted small">فقط ۶۰ چرخهٔ آخر نمایش داده می‌شود.</p>' : ''}` : '<p class="muted">«چرخهٔ بعدی» را بزنید.</p>';
        const d = q('.diag'); d.scrollLeft = d.scrollWidth; d.scrollTop = d.scrollHeight;
        q('.regview').innerHTML = UI.regsHTML(pl.regs.values, { written });
        q('.st').disabled = pl.halted;
      }
      q('.st').addEventListener('click', () => { runner.stop(); doStep(); });
      q('.all').addEventListener('click', () => { runner.stop(); while (!pl.halted) last = pl.step() || last; written = null; render(); });
      q('.run').addEventListener('click', () => { if (runner.running) runner.stop(); else { runner.start(); q('.run').textContent = 'توقف ⏸'; } });
      q('.rst').addEventListener('click', rebuild);
      q('.fw').addEventListener('change', rebuild);
      render();
    },
  });
})();
