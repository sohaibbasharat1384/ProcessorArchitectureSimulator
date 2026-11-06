(function () {
  'use strict';
  const S = window.Sim, UI = window.UI, A = window.Anim;

  const STAGE_FA = { IF: 'واکشی', ID: 'رمزگشایی و خواندن ثبات', EX: 'اجرا (ALU)', MEM: 'دسترسی حافظه', WB: 'بازنویسی' };
  const COLORS = 8;
  const FWD_X = { 'EX/MEM': 600, 'MEM/WB': 800 };

  UI.register({
    id: 'pipeline', title: 'خط لوله (Pipeline)',
    desc: 'حرکت دستورها بین مراحل، حباب، توقف، تخلیه و مسیرهای پیشرانی به‌صورت متحرک',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p>در <b>خط لوله</b> هر مرحله در هر چرخه روی یک دستور متفاوت کار می‌کند و بین مراحل <b>ثبات‌های خط لوله</b> (IF/ID، ID/EX، EX/MEM، MEM/WB) قرار دارند.
        هر کارت یک دستور است که در هر چرخه یک مرحله جلو می‌رود. <b>پیشرانی</b> (فلش سبز) نتیجه را از ثبات‌های EX/MEM یا MEM/WB مستقیم به ورودی ALU می‌رساند.
        وقتی پیشرانی کافی نیست (Load-Use) <b>واحد تشخیص مخاطره</b> خط لوله را متوقف می‌کند و یک <b>حباب</b> می‌فرستد. پرش‌ها در EX حل می‌شوند و در صورت انجام، دستورهای اشتباه <b>تخلیه</b> می‌شوند (فلش قرمز).</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="controls">
            <label class="inline"><input type="checkbox" class="fw" checked> پیشرانی (Forwarding)</label>
          </div>
          <div class="st"></div>
        </div>
        <div class="grid side">
          <div class="card ed"><h3>برنامه</h3></div>
          <div>
            <div class="card">
              <h3>خط لوله در چرخهٔ <span class="cyc">0</span></h3>
              <div class="pipe-track">
                <div class="ptrack-cols">${S.STAGES.map((s) => `<div class="pcol" data-s="${s}"><div class="pcol-h"><b>${s}</b><span>${STAGE_FA[s]}</span></div><div class="pbubble">حباب</div></div>`).join('')}</div>
                <div class="pregs">${['IF/ID', 'ID/EX', 'EX/MEM', 'MEM/WB'].map((r, i) => `<div class="preg" style="left:${(i + 1) * 20}%"><span>${r}</span></div>`).join('')}</div>
                <div class="hazard">واحد تشخیص مخاطره</div>
                <svg class="parrows" viewBox="0 0 1000 260" preserveAspectRatio="none"><defs>
                  <marker id="pa-ok" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="m-ok"/></marker>
                  <marker id="pa-bad" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="m-bad"/></marker>
                  <marker id="pa-warn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="m-warn"/></marker></defs><g class="arrows"></g></svg>
                <div class="plabels"></div>
                <div class="pcards"></div>
              </div>
              <div class="pdetail"></div>
              <div class="evs log" style="margin-top:10px;max-height:150px"></div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h3>نمودار زمانی خط لوله</h3><div class="table-wrap diag" style="max-height:480px;overflow:auto;direction:ltr"></div></div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>ثبات‌ها</h3><div class="regview"></div><h3 style="margin-top:12px">آمار</h3><div class="stats"></div></div>
          <div class="card"><h3>مقایسه</h3><div class="cmp"></div></div>
        </div>`;
      const q = (s) => UI.$(s, el);
      const stepper = UI.stepper(q('.st'), { pause: 900 });
      const cards = new Map();
      let pl = null, asm = null, frames = [], lastIdx = -1;

      UI.programEditor(q('.ed'), (r) => { asm = r; rebuild(); }, 'hazards').assemble();

      function rebuild() {
        pl = new S.Pipeline({ forwarding: q('.fw').checked });
        pl.load(asm.words);
        frames = [];
        while (!pl.halted) {
          const t = pl.step();
          if (!t) break;
          frames.push({ t, regs: pl.regs.values.slice(), pc: pl.pc, stats: Object.assign({}, pl.stats) });
        }
        cards.forEach((c) => c.remove()); cards.clear();
        lastIdx = -1;
        compare();
        const steps = frames.map((f) => ({ title: `چرخهٔ ${f.t.cycle}`, text: summary(f.t), f }));
        stepper.set(steps, render, `${frames.length} چرخه شبیه‌سازی شد. «گام بعدی» را بزنید تا چرخه‌به‌چرخه جلو بروید.`);
      }
      function summary(t) {
        const parts = [];
        if (t.stall) parts.push('توقف (حباب) به خاطر مخاطرهٔ داده');
        if (t.forwards && t.forwards.length) parts.push(`${t.forwards.length} پیشرانی`);
        if (t.branchTo !== null && t.branchTo !== undefined) parts.push(`پرش انجام شد ⇒ تخلیهٔ IF و ID، PC ← ${t.branchTo}`);
        if (t.jumpTo !== null && t.jumpTo !== undefined) parts.push(`JMP ⇒ تخلیهٔ IF، PC ← ${t.jumpTo}`);
        if (t.events.some((e) => e.type === 'halt')) parts.push('HALT به WB رسید؛ پایان اجرا');
        const n = S.STAGES.filter((s) => t.occ[s] !== null).length;
        return `${n} مرحله مشغول${parts.length ? '؛ ' + parts.join('؛ ') : ''}. جزئیات هر مرحله در جدول زیر خط لوله آمده است.`;
      }
      function compare() {
        const res = [true, false].map((fw) => { const p = new S.Pipeline({ forwarding: fw }); p.load(asm.words); p.run(); return p; });
        const cpu = new S.CPU(); cpu.load(asm.words); cpu.run();
        const n = cpu.instructions;
        const max = Math.max(n * 5, res[0].stats.cycles, res[1].stats.cycles);
        const row = (label, cyc, cpi, st, fl) => `<tr><td style="text-align:start">${label}</td><td>${cyc}</td><td>${cpi}</td><td>${st}</td><td>${fl}</td><td style="width:28%"><div class="bar"><i style="width:${(cyc / max) * 100}%"></i></div></td></tr>`;
        q('.cmp').innerHTML = `<table class="data"><thead><tr><th>مدل</th><th>چرخه</th><th>CPI</th><th>توقف</th><th>تخلیه</th><th></th></tr></thead><tbody>
          ${row('بدون خط لوله (۵ چرخه برای هر دستور)', n * 5, '5.00', '—', '—')}
          ${res.map((p, i) => row(`خط لوله ${i === 0 ? 'با' : 'بدون'} پیشرانی`, p.stats.cycles, p.cpi().toFixed(2), p.stats.stalls, p.stats.flushes)).join('')}
          </tbody></table><p class="muted small">تعداد دستورهای اجراشده: ${n}. تسریع خط لوله با پیشرانی نسبت به حالت بدون خط لوله: ×${(n * 5 / res[0].stats.cycles).toFixed(2)}</p>`;
      }

      function cardFor(rec) {
        let c = cards.get(rec.id);
        if (!c) {
          c = UI.el(`<div class="pcard c${rec.id % COLORS}"><span class="pc">${rec.pc}</span> ${UI.esc(rec.text)}</div>`);
          c.style.left = '-20%';
          c.style.opacity = '0';
          q('.pcards').appendChild(c);
          void c.offsetWidth;
          cards.set(rec.id, c);
        }
        return c;
      }

      function render(step, idx, animate) {
        const track = q('.pipe-track');
        track.classList.toggle('notrans', !animate || Math.abs(idx - lastIdx) !== 1);
        lastIdx = idx;
        const f = step ? step.f : null, t = f ? f.t : null;
        q('.cyc').textContent = t ? t.cycle : 0;
        const occ = t ? t.occ : {};
        const present = new Set();
        S.STAGES.forEach((s, si) => {
          const id = occ[s];
          UI.$(`.pcol[data-s="${s}"]`, el).classList.toggle('empty', id === null || id === undefined);
          if (id === null || id === undefined) return;
          const rec = pl.records[id];
          const note = rec.cells[t.cycle] || '';
          const c = cardFor(rec);
          present.add(id);
          c.style.left = `calc(${si * 20}% + 6px)`;
          c.style.opacity = '1';
          c.classList.toggle('stall', note.endsWith('*'));
          c.classList.toggle('flush', note.endsWith('×'));
          c.classList.remove('leaving');
        });
        cards.forEach((c, id) => {
          if (present.has(id)) return;
          const rec = pl.records[id];
          const lastCycle = Math.max(...Object.keys(rec.cells).map(Number));
          if (!t || lastCycle > t.cycle || Math.min(...Object.keys(rec.cells).map(Number)) > t.cycle) {
            // not yet fetched (navigating backwards)
            c.remove(); cards.delete(id); return;
          }
          c.classList.add('leaving');
          c.style.left = rec.squashed ? c.style.left : '102%';
          c.style.opacity = '0';
          setTimeout(() => { if (!present.has(id) && c.classList.contains('leaving')) { c.remove(); cards.delete(id); } }, A.dur(600));
        });
        q('.hazard').classList.toggle('on', !!(t && t.stall));

        // arrows
        const g = UI.$('.parrows .arrows', el);
        g.innerHTML = '';
        q('.plabels').innerHTML = '';
        const anims = [];
        const arrow = (d, cls, marker, label, lx, ly) => {
          const p = A.svgEl('path', { d, class: 'parrow ' + cls, 'marker-end': `url(#${marker})`, 'vector-effect': 'non-scaling-stroke' }, g);
          if (label) q('.plabels').appendChild(UI.el(`<span class="plabel ${cls}" style="left:${lx / 10}%;top:${ly}px">${UI.esc(label)}</span>`));
          if (animate) anims.push(A.draw(p, 700));
        };
        if (t) {
          (t.forwards || []).forEach((fw, i) => {
            const x = FWD_X[fw.from], y = 200 + i * 22;
            arrow(`M${x},150 C${x},${y + 20} 520,${y + 20} 520,150`, 'ok', 'pa-ok', `${fw.from} → ${fw.operand}: R${fw.reg} = ${S.toSigned(fw.value, 16)}`, (x + 520) / 2, y - 6);
          });
          if (t.branchTo !== null && t.branchTo !== undefined) arrow('M500,60 C500,8 100,8 100,60', 'bad', 'pa-bad', `پرش ⇒ PC ← ${t.branchTo}`, 300, 6);
          if (t.jumpTo !== null && t.jumpTo !== undefined) arrow('M300,60 C300,20 100,20 100,60', 'bad', 'pa-bad', `JMP ⇒ PC ← ${t.jumpTo}`, 200, 14);
          if (t.stall) arrow('M330,182 C260,215 140,215 110,150', 'warn', 'pa-warn', 'توقف: ID و IF ثابت، حباب به EX', 230, 212);
        }

        // per-stage detail
        q('.pdetail').innerHTML = t ? `<table class="data pdet"><tbody>${S.STAGES.map((s) => {
          const id = occ[s];
          const rec = id !== null && id !== undefined ? pl.records[id] : null;
          return `<tr><th class="ltr">${s}</th><td class="ltr" style="text-align:left;white-space:nowrap">${rec ? UI.esc(rec.text) : '—'}</td><td style="text-align:start">${rec ? UI.esc(t.detail[s] || '') : '<span class="muted">حباب (کاری انجام نمی‌شود)</span>'}</td></tr>`;
        }).join('')}</tbody></table>` : '';
        q('.evs').innerHTML = t && t.events.length ? t.events.map((e) => `<div class="ev-${e.type}">${UI.esc(e.text)}</div>`).join('') : '<div class="muted">رویدادی ثبت نشده است.</div>';
        q('.regview').innerHTML = UI.regsHTML(f ? f.regs : new Array(8).fill(0), { written: t && t.events.some((e) => e.type === 'wb') ? pl.records[occ.WB].word >> 9 & 7 : null });
        const st = f ? f.stats : { cycles: 0, completed: 0, stalls: 0, flushes: 0, forwards: 0 };
        q('.stats').innerHTML = `<dl class="kv"><dt>چرخه‌ها</dt><dd>${st.cycles}</dd><dt>دستورهای کامل‌شده</dt><dd>${st.completed}</dd>
          <dt>CPI تا اینجا</dt><dd>${st.completed ? (st.cycles / st.completed).toFixed(2) : '—'}</dd><dt>چرخه‌های توقف</dt><dd>${st.stalls}</dd><dt>دستورهای تخلیه‌شده</dt><dd>${st.flushes}</dd>
          <dt>پیشرانی‌ها</dt><dd>${st.forwards}</dd><dt>PC</dt><dd>${f ? f.pc : 0}</dd></dl>${f && idx === frames.length - 1 ? '<p><span class="badge ok">اجرا پایان یافت</span></p>' : ''}`;
        diagram(t ? t.cycle : 0, animate);
        return Promise.all(anims);
      }

      function diagram(maxC, animate) {
        if (!maxC) { q('.diag').innerHTML = '<p class="muted">«گام بعدی» را بزنید.</p>'; return; }
        const from = Math.max(1, maxC - 59);
        let head = '<tr><th class="instr">instruction</th>';
        for (let c = from; c <= maxC; c++) head += `<th class="${c === maxC ? 'cur' : ''}">${c}</th>`;
        head += '</tr>';
        const recs = pl.records.filter((r) => Object.keys(r.cells).some((c) => +c >= from && +c <= maxC));
        const body = recs.map((r) => {
          const sq = r.squashed && Object.keys(r.cells).some((c) => +c <= maxC && r.cells[c].endsWith('×'));
          let row = `<td class="instr${sq ? ' sq' : ''}">${r.pc}: ${UI.esc(r.text)}</td>`;
          for (let c = from; c <= maxC; c++) {
            const v = r.cells[c];
            if (!v) { row += '<td></td>'; continue; }
            const base = v.replace(/[*×]$/, '');
            const cls = v.endsWith('*') ? 'stall' : v.endsWith('×') ? 'flush' : '';
            row += `<td class="s-${base} ${cls}${c === maxC && animate ? ' newcell' : ''}">${v}</td>`;
          }
          return `<tr>${row}</tr>`;
        }).join('');
        q('.diag').innerHTML = `<table class="pipe-diagram"><thead>${head}</thead><tbody>${body}</tbody></table>${from > 1 ? '<p class="muted small">فقط ۶۰ چرخهٔ آخر نمایش داده می‌شود.</p>' : ''}`;
        const d = q('.diag'); d.scrollLeft = d.scrollWidth; d.scrollTop = d.scrollHeight;
      }

      q('.fw').addEventListener('change', rebuild);
    },
  });
})();
