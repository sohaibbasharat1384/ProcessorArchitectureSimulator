(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  UI.register({
    id: 'regs', title: 'بانک ثبات (Register File)',
    desc: 'دو پورت خواندن ترکیبی، یک پورت نوشتن همگام با لبهٔ ساعت و ثبات صفر',
    init(el) {
      const rf = new S.RegisterFile(8, 16, true);
      [0, 12, -5, 300, 7, 0, 1024, 99].forEach((v, i) => rf.write(i, v));
      const regOpts = (sel) => rf.values.map((_, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>R${i}</option>`).join('');
      el.innerHTML = `
        <div class="lead"><p><b>بانک ثبات</b> حافظهٔ کوچک و بسیار سریع داخل پردازنده است. در این طراحی ۸ ثبات ۱۶ بیتی داریم با
        <b>دو پورت خواندن</b> (هر چرخه دو عملوند می‌دهد) و <b>یک پورت نوشتن</b>. خواندن «ترکیبی» است و بلافاصله انجام می‌شود،
        اما نوشتن فقط روی <b>لبهٔ بالاروندهٔ ساعت</b> و وقتی سیگنال Write Enable فعال باشد اعمال می‌شود. R0 به صفر سیم‌کشی شده است.</p></div>
        <div class="grid side">
          <div class="card">
            <h3>پورت‌های خواندن</h3>
            <div class="controls">
              <label>Read Reg 1 (rs)<select class="r1">${regOpts(1)}</select></label>
              <label>Read Reg 2 (rt)<select class="r2">${regOpts(2)}</select></label>
            </div>
            <dl class="kv rd-out"></dl>
            <h3 style="margin-top:14px">پورت نوشتن</h3>
            <div class="controls">
              <label>Write Reg (rd)<select class="wr">${regOpts(3)}</select></label>
              <label>Write Data<input type="text" class="wd ltr" value="42" size="7"></label>
              <label class="inline"><input type="checkbox" class="we" checked> RegWrite (WE)</label>
            </div>
            <div class="btn-row"><button class="btn primary clk">⏱ لبهٔ ساعت</button><button class="btn rst">پاک کردن همه</button></div>
            <p class="muted small pend" style="margin-top:8px"></p>
          </div>
          <div class="card">
            <h3>محتوای ثبات‌ها</h3>
            <div class="regview"></div>
            <p class="muted small" style="margin-top:8px">کادر آبی: پورت خواندن ۱ · کادر نارنجی: پورت خواندن ۲ · سبز: آخرین نوشتن</p>
            <h3>رویدادها</h3>
            <div class="log"></div>
          </div>
        </div>`;
      const q = (s) => UI.$(s, el);
      let written = null, cycle = 0;
      const log = (t) => { const d = document.createElement('div'); d.innerHTML = `<span class="t">#${cycle}</span>${t}`; q('.log').prepend(d); };

      function render() {
        const r1 = +q('.r1').value, r2 = +q('.r2').value;
        q('.regview').innerHTML = UI.regsHTML(rf.values, { written, read1: r1, read2: r2 });
        q('.rd-out').innerHTML = `<dt>Read Data 1</dt><dd>R${r1} = ${S.toSigned(rf.values[r1], 16)} (${UI.hex(rf.values[r1])})</dd>
          <dt>Read Data 2</dt><dd>R${r2} = ${S.toSigned(rf.values[r2], 16)} (${UI.hex(rf.values[r2])})</dd>`;
        const wr = +q('.wr').value, we = q('.we').checked;
        q('.pend').textContent = `در لبهٔ بعدی ساعت: ${we ? (wr === 0 ? 'نوشتن در R0 نادیده گرفته می‌شود.' : `R${wr} ← ${UI.parseInput(q('.wd').value)}`) : 'WE غیرفعال است؛ چیزی نوشته نمی‌شود.'}`;
      }
      q('.clk').addEventListener('click', () => {
        cycle++;
        rf.latch(+q('.wr').value, UI.parseInput(q('.wd').value), q('.we').checked);
        const r = rf.clockEdge();
        written = r.committed ? r.reg : null;
        if (r.reason === 'ok') log(`R${r.reg} ← ${S.toSigned(rf.values[r.reg], 16)}`);
        else if (r.reason === 'zero') log('تلاش برای نوشتن در R0 — نادیده گرفته شد (R0 = 0)');
        else log('لبهٔ ساعت بدون نوشتن (WE = 0)');
        render();
      });
      q('.rst').addEventListener('click', () => { rf.reset(); written = null; log('همهٔ ثبات‌ها صفر شدند'); render(); });
      el.addEventListener('change', render);
      el.addEventListener('input', render);
      render();
    },
  });
})();
