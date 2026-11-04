(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  const PRESETS = {
    loop4: { fa: 'حلقهٔ ۴ تکراری (TTTN)', v: 'TTTN TTTN TTTN TTTN TTTN TTTN TTTN TTTN' },
    loop8: { fa: 'حلقهٔ ۸ تکراری', v: 'TTTTTTTN TTTTTTTN TTTTTTTN' },
    alt: { fa: 'یک در میان (TN)', v: 'TNTNTNTNTNTNTNTNTNTN' },
    taken: { fa: 'همیشه انجام', v: 'TTTTTTTTTTTTTTTT' },
    rand: { fa: 'تصادفی', v: '' },
  };
  const TYPES = Object.keys(S.PREDICTOR_TYPES);

  UI.register({
    id: 'predictor', title: 'پیش‌بینی پرش (Branch Prediction)',
    desc: 'مقایسهٔ پیش‌بین‌های ایستا، ۱ بیتی، ۲ بیتی و تاریخچه‌دار روی الگوی پرش‌ها',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p>در خط لوله، نتیجهٔ پرش شرطی دیر مشخص می‌شود. <b>پیش‌بین پرش</b> حدس می‌زند پرش انجام می‌شود (T) یا نه (N) تا واکشی متوقف نشود؛
        حدس اشتباه یعنی تخلیهٔ خط لوله و هدر رفتن چرخه‌ها. شمارندهٔ <b>۲ بیتی</b> فقط پس از دو اشتباه پیاپی نظرش را عوض می‌کند و برای حلقه‌ها از ۱ بیتی بهتر است.
        پیش‌بین <b>تاریخچه‌دار</b> الگوهای تکرارشونده را هم یاد می‌گیرد.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="controls">
            <label style="flex:1 1 300px">دنبالهٔ نتایج پرش (T = انجام، N = عدم انجام)<input type="text" class="seq ltr" value="${PRESETS.loop4.v}"></label>
            <label>نمونه<select class="preset"><option value="">—</option>${Object.keys(PRESETS).map((k) => `<option value="${k}">${PRESETS[k].fa}</option>`).join('')}</select></label>
            <label>بیت‌های تاریخچه<select class="hb"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label>
            <label>جریمهٔ پیش‌بینی غلط (چرخه)<input type="number" class="pen" value="2" min="1" max="30" style="width:70px"></label>
          </div>
          <div class="btn-row"><button class="btn primary step">پرش بعدی ▶</button><button class="btn all">اجرای همه</button><button class="btn rst">بازنشانی</button></div>
        </div>
        <div class="grid two">
          <div class="card"><h3>دقت پیش‌بین‌ها</h3><div class="acc"></div>
            <p class="muted small">نکته: پیش‌بین تاریخچه‌دار فقط وقتی الگو را یاد می‌گیرد که تاریخچه به اندازهٔ کافی بلند باشد؛ برای حلقهٔ TTTN با ۲ بیت تاریخچه، «TT» گاهی به T و گاهی به N می‌رسد، اما با ۳ بیت هر الگو یکتاست.</p></div>
          <div class="card"><h3>ماشین حالت شمارندهٔ ۲ بیتی</h3><div class="fsm-view"></div>
            <p class="muted small">SN: قویاً انجام‌نشدن · WN: ضعیفاً انجام‌نشدن · WT: ضعیفاً انجام · ST: قویاً انجام. با هر T یک خانه به راست و با هر N یک خانه به چپ.</p></div>
        </div>
        <div class="card" style="margin-top:16px"><h3>گام‌به‌گام</h3><div class="table-wrap tbl"></div></div>`;
      const q = (s) => UI.$(s, el);
      let seq = [], preds = [], rows = [];

      function build() {
        seq = S.parseOutcomes(q('.seq').value);
        preds = TYPES.map((t) => new S.BranchPredictor(t, +q('.hb').value));
        rows = [];
        render();
      }
      function step() {
        if (rows.length >= seq.length) return;
        const o = seq[rows.length];
        rows.push(preds.map((p) => p.step(o)));
        render();
      }
      function render() {
        const n = rows.length, pen = +q('.pen').value || 2;
        q('.acc').innerHTML = `<table class="data"><thead><tr><th>پیش‌بین</th><th>درست</th><th>دقت</th><th></th><th>چرخهٔ هدررفته</th></tr></thead><tbody>${TYPES.map((t, i) => {
          const c = rows.filter((r) => r[i].correct).length, acc = n ? c / n : 0;
          return `<tr><td style="text-align:start">${S.PREDICTOR_TYPES[t].fa}</td><td>${c}/${n}</td><td>${(acc * 100).toFixed(0)}%</td>
            <td style="width:30%"><div class="bar"><i style="width:${acc * 100}%"></i></div></td><td>${(n - c) * pen}</td></tr>`;
        }).join('')}</tbody></table>`;
        const st = S.TWO_BIT_STATES[preds[TYPES.indexOf('2bit')].counter];
        q('.fsm-view').innerHTML = `<div class="fsm">${S.TWO_BIT_STATES.map((s, i) => `${i ? '<span class="arr">⇄</span>' : ''}<span class="st ${i >= 2 ? 't' : 'n'}${s === st ? ' cur' : ''}">${s}</span>`).join('')}</div>
          <p style="margin-top:8px">پیش‌بینی بعدی: <b>${st[1] === 'T' ? 'انجام (T)' : 'عدم انجام (N)'}</b></p>`;
        const head = `<tr><th>#</th><th>نتیجهٔ واقعی</th>${TYPES.map((t) => `<th>${t}</th>`).join('')}</tr>`;
        const body = rows.map((r, i) => `<tr><td>${i + 1}</td><td><b>${seq[i] ? 'T' : 'N'}</b></td>${r.map((s) =>
          `<td class="${s.correct ? 'ok' : 'bad'}" title="${s.before} → ${s.after}">${s.prediction ? 'T' : 'N'} ${s.correct ? '✓' : '✗'} <span class="muted small">${s.before !== '-' ? s.before : ''}</span></td>`).join('')}</tr>`).join('');
        q('.tbl').innerHTML = `<table class="data ltr"><thead>${head}</thead><tbody>${body}</tbody></table>
          <p class="muted small">${rows.length}/${seq.length} پرش پردازش شد. عدد کوچک کنار هر پیش‌بینی، حالت پیش‌بین قبل از آن پرش است.</p>`;
      }
      q('.step').addEventListener('click', step);
      q('.all').addEventListener('click', () => { while (rows.length < seq.length) { const o = seq[rows.length]; rows.push(preds.map((p) => p.step(o))); } render(); });
      q('.rst').addEventListener('click', build);
      q('.preset').addEventListener('change', () => {
        const k = q('.preset').value;
        if (!k) return;
        q('.seq').value = k === 'rand' ? Array.from({ length: 24 }, () => (Math.random() < 0.6 ? 'T' : 'N')).join('') : PRESETS[k].v;
        build();
      });
      q('.seq').addEventListener('change', build);
      q('.hb').addEventListener('change', build);
      q('.pen').addEventListener('input', render);
      build();
    },
  });
})();
