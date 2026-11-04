(function () {
  'use strict';
  const S = window.Sim, UI = window.UI, A = window.Anim;

  const PRESETS = {
    loop4: { fa: 'حلقهٔ ۴ تکراری (TTTN)', v: 'TTTN TTTN TTTN TTTN TTTN TTTN TTTN TTTN' },
    loop8: { fa: 'حلقهٔ ۸ تکراری', v: 'TTTTTTTN TTTTTTTN TTTTTTTN' },
    alt: { fa: 'یک در میان (TN)', v: 'TNTNTNTNTNTNTNTNTNTN' },
    taken: { fa: 'همیشه انجام', v: 'TTTTTTTTTTTTTTTT' },
    rand: { fa: 'تصادفی', v: '' },
  };
  const TYPES = Object.keys(S.PREDICTOR_TYPES);
  const ST = S.TWO_BIT_STATES;
  const FX = (k) => 130 + k * 200, FY = 120;

  function fsmSvg() {
    let s = '<svg viewBox="0 0 900 250">';
    s += `<rect class="zone n" x="20" y="40" width="410" height="160" rx="16"/><rect class="zone t" x="470" y="40" width="410" height="160" rx="16"/>
      <text class="t-small" x="225" y="232">پیش‌بینی: انجام نمی‌شود (N)</text><text class="t-small" x="675" y="232">پیش‌بینی: انجام می‌شود (T)</text>`;
    for (let k = 0; k < 4; k++) {
      if (k < 3) {
        s += `<path class="wire fsm-t" id="tT-${k}" d="M${FX(k) + 26},${FY - 30} Q${FX(k) + 100},${FY - 85} ${FX(k + 1) - 26},${FY - 30}"/><text class="t-small t-mono" x="${FX(k) + 100}" y="${FY - 66}">T</text>`;
        s += `<path class="wire fsm-n" id="tN-${k + 1}" d="M${FX(k + 1) - 26},${FY + 30} Q${FX(k) + 100},${FY + 85} ${FX(k) + 26},${FY + 30}"/><text class="t-small t-mono" x="${FX(k) + 100}" y="${FY + 72}">N</text>`;
      }
    }
    s += `<path class="wire fsm-t" id="tT-3" d="M${FX(3) + 30},${FY - 24} C${FX(3) + 95},${FY - 70} ${FX(3) + 95},${FY + 70} ${FX(3) + 30},${FY + 24}"/><text class="t-small t-mono" x="${FX(3) + 88}" y="${FY}">T</text>`;
    s += `<path class="wire fsm-n" id="tN-0" d="M${FX(0) - 30},${FY + 24} C${FX(0) - 95},${FY + 70} ${FX(0) - 95},${FY - 70} ${FX(0) - 30},${FY - 24}"/><text class="t-small t-mono" x="${FX(0) - 88}" y="${FY}">N</text>`;
    for (let k = 0; k < 4; k++) s += `<g class="fst ${k >= 2 ? 't' : 'n'}" id="fs-${k}"><circle class="box" cx="${FX(k)}" cy="${FY}" r="38"/><text x="${FX(k)}" y="${FY - 6}" style="font-weight:700">${ST[k]}</text><text class="t-small t-muted" x="${FX(k)}" y="${FY + 14}">${UI.bin(k, 2)}</text></g>`;
    return s + '</svg>';
  }
  function oneBitSvg() {
    return `<svg viewBox="0 0 420 170">
      <path class="wire fsm-t" id="o-tT-0" d="M126,62 Q210,10 294,62"/><text class="t-small t-mono" x="210" y="30">T</text>
      <path class="wire fsm-n" id="o-tN-1" d="M294,108 Q210,160 126,108"/><text class="t-small t-mono" x="210" y="152">N</text>
      <path class="wire fsm-t" id="o-tT-1" d="M352,64 C410,30 410,140 352,106"/><text class="t-small t-mono" x="404" y="88">T</text>
      <path class="wire fsm-n" id="o-tN-0" d="M68,106 C10,140 10,30 68,64"/><text class="t-small t-mono" x="16" y="88">N</text>
      <g class="fst n" id="os-0"><circle class="box" cx="100" cy="85" r="36"/><text x="100" y="80" style="font-weight:700">N</text><text class="t-small t-muted" x="100" y="99">0</text></g>
      <g class="fst t" id="os-1"><circle class="box" cx="320" cy="85" r="36"/><text x="320" y="80" style="font-weight:700">T</text><text class="t-small t-muted" x="320" y="99">1</text></g></svg>`;
  }

  UI.register({
    id: 'predictor', title: 'پیش‌بینی پرش (Branch Prediction)',
    desc: 'ماشین حالت متحرک ۱ و ۲ بیتی، ثبات تاریخچه و جدول الگو، و مقایسهٔ دقت',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p>در خط لوله، نتیجهٔ پرش شرطی دیر (در EX) مشخص می‌شود. <b>پیش‌بین پرش</b> هنگام واکشی حدس می‌زند پرش انجام می‌شود (T) یا نه (N).
        هر پرش سه گام دارد: <b>پیش‌بینی</b> از روی حالت فعلی، <b>حل شدن</b> پرش و مقایسه با حدس (حدس غلط = تخلیهٔ خط لوله)، و <b>به‌روزرسانی</b> حالت پیش‌بین.
        شمارندهٔ ۲ بیتی فقط پس از دو اشتباه پیاپی نظرش را عوض می‌کند. پیش‌بین تاریخچه‌دار برای هر الگوی اخیر یک شمارندهٔ جدا دارد.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="controls">
            <label style="flex:1 1 300px">دنبالهٔ نتایج پرش (T = انجام، N = عدم انجام)<input type="text" class="seq ltr" value="${PRESETS.loop4.v}"></label>
            <label>نمونه<select class="preset"><option value="">—</option>${Object.keys(PRESETS).map((k) => `<option value="${k}">${PRESETS[k].fa}</option>`).join('')}</select></label>
            <label>بیت‌های تاریخچه<select class="hb"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label>
            <label>جریمهٔ پیش‌بینی غلط (چرخه)<input type="number" class="pen" value="2" min="1" max="30" style="width:70px"></label>
          </div>
          <div class="st"></div>
        </div>
        <div class="card"><h3>شمارندهٔ اشباع ۲ بیتی</h3><div class="fig fsm2">${fsmSvg()}</div>
          <p class="muted small">SN/WN: قویاً/ضعیفاً «انجام نمی‌شود» · WT/ST: ضعیفاً/قویاً «انجام می‌شود». هر T یک خانه به راست، هر N یک خانه به چپ.</p></div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>پیش‌بین ۱ بیتی</h3><div class="fig fsm1">${oneBitSvg()}</div><p class="muted small">فقط نتیجهٔ آخرین اجرای پرش را به یاد می‌آورد.</p></div>
          <div class="card"><h3>پیش‌بین دو سطحی: ثبات تاریخچه و جدول الگو</h3><div class="hist-view"></div></div>
        </div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>دقت پیش‌بین‌ها</h3><div class="acc"></div>
            <p class="muted small">نکته: پیش‌بین تاریخچه‌دار فقط وقتی الگو را یاد می‌گیرد که تاریخچه به اندازهٔ کافی بلند باشد؛ برای حلقهٔ TTTN با ۲ بیت تاریخچه، «TT» گاهی به T و گاهی به N می‌رسد، اما با ۳ بیت هر الگو یکتاست.</p></div>
        </div>
        <div class="card" style="margin-top:16px"><h3>گام‌به‌گام</h3><div class="table-wrap tbl" style="max-height:420px;overflow-y:auto"></div></div>`;
      const q = (s) => UI.$(s, el);
      const stepper = UI.stepper(q('.st'), { pause: 500 });
      let seq = [], rows = [], hb = 3;

      const snapOf = (p) => ({ bit: p.bit, counter: p.counter, history: p.history, table: p.table.slice() });
      function build() {
        seq = S.parseOutcomes(q('.seq').value);
        hb = +q('.hb').value;
        const preds = TYPES.map((t) => new S.BranchPredictor(t, hb));
        rows = seq.map((o) => {
          const before = preds.map(snapOf);
          const res = preds.map((p) => p.step(o));
          return { o, before, after: preds.map(snapOf), res };
        });
        const steps = [];
        rows.forEach((r, i) => {
          const b2 = r.before[TYPES.indexOf('2bit')], bh = r.before[TYPES.indexOf('history')];
          const hbits = UI.bin(bh.history, hb);
          steps.push({ i, k: 'predict', title: `پرش ${i + 1} · پیش‌بینی`, text: `دستور پرش واکشی شد. پیش‌بین ۲ بیتی در حالت ${ST[b2.counter]} است ⇒ حدس «${b2.counter >= 2 ? 'T' : 'N'}». پیش‌بین ۱ بیتی آخرین نتیجه (${r.before[TYPES.indexOf('1bit')].bit ? 'T' : 'N'}) را حدس می‌زند. پیش‌بین تاریخچه‌دار با تاریخچهٔ ${hbits} سطر ${bh.history} جدول را می‌خواند (${ST[bh.table[bh.history]]}).` });
          const wrong = r.res.filter((x) => !x.correct).length;
          steps.push({ i, k: 'resolve', title: `پرش ${i + 1} · حل شدن`, text: `پرش در مرحلهٔ EX حل شد: نتیجهٔ واقعی «${r.o ? 'T' : 'N'}». ${wrong ? `${wrong} پیش‌بین اشتباه کردند ⇒ برای آن‌ها خط لوله تخلیه می‌شود (${+q('.pen').value || 2} چرخه جریمه).` : 'همهٔ پیش‌بین‌ها درست حدس زدند.'}` });
          const a2 = r.after[TYPES.indexOf('2bit')], ah = r.after[TYPES.indexOf('history')];
          steps.push({ i, k: 'update', title: `پرش ${i + 1} · به‌روزرسانی`, text: `۲ بیتی: ${ST[b2.counter]} → ${ST[a2.counter]}${b2.counter === a2.counter ? ' (اشباع؛ حالت عوض نشد)' : ''}. ۱ بیتی: ← ${r.o ? 'T' : 'N'}. تاریخچه‌دار: شمارندهٔ سطر ${bh.history} از ${ST[bh.table[bh.history]]} به ${ST[ah.table[bh.history]]} رفت و نتیجه از راست وارد ثبات تاریخچه شد: ${hbits} → ${UI.bin(ah.history, hb)}.` });
        });
        stepper.set(steps, render, `${seq.length} پرش در صف. «گام بعدی» را بزنید.`);
      }

      function render(step, idx, animate) {
        const i = step ? step.i : -1;
        const r = step ? rows[i] : null;
        const upd = step && step.k === 'update';
        const resolvedN = step ? (step.k === 'predict' ? i : i + 1) : 0;
        const s2 = (k) => (r ? (upd ? r.after : r.before)[TYPES.indexOf(k)] : { bit: 0, counter: 1, history: 0, table: new Array(1 << hb).fill(1) });
        const b2 = s2('2bit'), b1 = s2('1bit'), bh = s2('history');
        // 2-bit FSM
        const f2 = q('.fsm2');
        UI.$$('.fst', f2).forEach((g, k) => g.classList.toggle('cur', k === b2.counter));
        UI.$$('.wire', f2).forEach((w) => w.classList.remove('on'));
        const f1 = q('.fsm1');
        UI.$$('.fst', f1).forEach((g, k) => g.classList.toggle('cur', k === b1.bit));
        UI.$$('.wire', f1).forEach((w) => w.classList.remove('on'));
        const anims = [];
        if (upd) {
          const from = r.before[TYPES.indexOf('2bit')].counter;
          const id = (r.o ? 'tT-' : 'tN-') + from;
          UI.$('#' + id, f2).classList.add('on');
          const from1 = r.before[TYPES.indexOf('1bit')].bit;
          const id1 = 'o-' + (r.o ? 'tT-' : 'tN-') + from1;
          UI.$('#' + id1, f1).classList.add('on');
          if (animate) {
            UI.$$('.fst', f2).forEach((g, k) => g.classList.toggle('cur', k === from));
            UI.$$('.fst', f1).forEach((g, k) => g.classList.toggle('cur', k === from1));
            anims.push(Promise.all([
              A.token(UI.$('svg', f2), id, r.o ? 'T' : 'N', { cls: r.o ? 'data' : 'bad', duration: 900 }),
              A.token(UI.$('svg', f1), id1, r.o ? 'T' : 'N', { cls: r.o ? 'data' : 'bad', duration: 900 }),
            ]).then(() => {
              UI.$$('.fst', f2).forEach((g, k) => g.classList.toggle('cur', k === b2.counter));
              UI.$$('.fst', f1).forEach((g, k) => g.classList.toggle('cur', k === b1.bit));
              A.flash(UI.$('#fs-' + b2.counter, f2));
            }));
          }
        } else if (step && step.k === 'predict' && animate) {
          A.flash(UI.$('#fs-' + b2.counter, f2)); A.flash(UI.$('#os-' + b1.bit, f1));
        }
        // history view
        const hrow = upd ? r.before[TYPES.indexOf('history')].history : bh.history;
        const hist = upd && !animate ? bh.history : (r ? r.before[TYPES.indexOf('history')].history : 0);
        q('.hist-view').innerHTML = `<div class="hreg"><span class="muted small">ثبات تاریخچه (${hb} بیت):</span> <span class="bits">${UI.bin(hist, hb).split('').map((b) => `<span class="bit${b === '1' ? ' one' : ''}">${b === '1' ? 'T' : 'N'}</span>`).join('')}</span>
          ${upd ? `<span class="hin bit ${r.o ? 'one' : ''}">${r.o ? 'T' : 'N'}</span>` : ''}</div>
          <table class="data ltr pht" style="margin-top:8px"><thead><tr><th>history</th><th>counter</th><th>prediction</th></tr></thead><tbody>
          ${bh.table.map((c, k) => `<tr class="${step && k === hrow ? 'selrow' : ''}"><td>${UI.bin(k, hb).replace(/1/g, 'T').replace(/0/g, 'N')}</td><td>${ST[c]}</td><td>${c >= 2 ? 'T' : 'N'}</td></tr>`).join('')}</tbody></table>`;
        if (upd && animate) {
          const bits = UI.$('.hreg .bits', el), hin = UI.$('.hreg .hin', el);
          anims.push(A.tween(700, (e) => { bits.style.transform = `translateX(${-e * 26}px)`; hin.style.transform = `translateX(${-e * 30}px)`; }).then(() => {
            bits.innerHTML = UI.bin(bh.history, hb).split('').map((b) => `<span class="bit${b === '1' ? ' one' : ''}">${b === '1' ? 'T' : 'N'}</span>`).join('');
            bits.style.transform = ''; hin.remove();
          }));
        }
        // accuracy
        const pen = +q('.pen').value || 2;
        q('.acc').innerHTML = `<table class="data"><thead><tr><th>پیش‌بین</th><th>درست</th><th>دقت</th><th></th><th>چرخهٔ هدررفته</th></tr></thead><tbody>${TYPES.map((t, ti) => {
          const done = rows.slice(0, resolvedN), c = done.filter((x) => x.res[ti].correct).length, n = done.length, acc = n ? c / n : 0;
          return `<tr><td style="text-align:start">${S.PREDICTOR_TYPES[t].fa}</td><td>${c}/${n}</td><td>${(acc * 100).toFixed(0)}%</td>
            <td style="width:30%"><div class="bar"><i style="width:${acc * 100}%"></i></div></td><td>${(n - c) * pen}</td></tr>`;
        }).join('')}</tbody></table>`;
        // table
        const head = `<tr><th>#</th><th>نتیجهٔ واقعی</th>${TYPES.map((t) => `<th>${t}</th>`).join('')}</tr>`;
        const shown = step ? i + 1 : 0;
        const body = rows.slice(0, shown).map((x, ri) => {
          const resolved = ri < resolvedN;
          return `<tr class="${ri === i ? 'selrow' : ''}"><td>${ri + 1}</td><td><b>${resolved ? (x.o ? 'T' : 'N') : '?'}</b></td>${x.res.map((s) => `<td class="${resolved ? (s.correct ? 'ok' : 'bad') : ''}" title="${s.before} → ${s.after}">${s.prediction ? 'T' : 'N'} ${resolved ? (s.correct ? '✓' : '✗') : ''} <span class="muted small">${s.before !== '-' ? s.before : ''}</span></td>`).join('')}</tr>`;
        }).join('');
        q('.tbl').innerHTML = `<table class="data ltr"><thead>${head}</thead><tbody>${body}</tbody></table>`;
        const sel = UI.$('.tbl tr.selrow', el); if (sel && animate) { const box = q('.tbl'); box.scrollTop = sel.offsetTop - box.clientHeight / 2; }
        return Promise.all(anims);
      }

      q('.preset').addEventListener('change', () => {
        const k = q('.preset').value;
        if (!k) return;
        q('.seq').value = k === 'rand' ? Array.from({ length: 24 }, () => (Math.random() < 0.6 ? 'T' : 'N')).join('') : PRESETS[k].v;
        build();
      });
      q('.seq').addEventListener('change', build);
      q('.hb').addEventListener('change', build);
      q('.pen').addEventListener('input', () => stepper.refresh());
      build();
    },
  });
})();
