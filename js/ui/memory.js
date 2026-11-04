(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  UI.register({
    id: 'memory', title: 'حافظهٔ اصلی و گذرگاه (Memory & Bus)',
    desc: 'چرخهٔ خواندن/نوشتن حافظه با ثبات‌های MAR و MDR و گذرگاه‌های آدرس، داده و کنترل',
    init(el) {
      const mem = new S.Memory(256, 16);
      for (let i = 0; i < 256; i++) mem.data[i] = (i * 37 + 11) % 7 === 0 ? (i * 97) & 0xFFFF : 0;
      el.innerHTML = `
        <div class="lead"><p>پردازنده از طریق <b>گذرگاه سیستم</b> با حافظه ارتباط دارد. آدرس در <b>MAR</b> (ثبات آدرس حافظه) و داده در
        <b>MDR</b> (ثبات دادهٔ حافظه) قرار می‌گیرد. گذرگاه آدرس یک‌طرفه (پردازنده → حافظه)، گذرگاه داده دوطرفه و گذرگاه کنترل سیگنال‌های Read/Write را حمل می‌کند.
        چرخهٔ دسترسی را گام‌به‌گام اجرا کنید.</p></div>
        <div class="grid side">
          <div class="card">
            <h3>دسترسی</h3>
            <div class="controls">
              <label>نوع<select class="op"><option value="R">خواندن (Read)</option><option value="W">نوشتن (Write)</option></select></label>
              <label>آدرس (0..255)<input type="text" class="addr ltr" value="14" size="5"></label>
              <label>داده (برای نوشتن)<input type="text" class="data ltr" value="1234" size="7"></label>
            </div>
            <div class="btn-row">
              <button class="btn primary step">گام بعدی ▶</button>
              <button class="btn full">کل چرخه</button>
              <button class="btn rnd">پر کردن تصادفی</button>
              <button class="btn clr">پاک کردن حافظه</button>
            </div>
            <div class="phases" style="margin-top:12px"></div>
            <div class="explain"></div>
            <h3 style="margin-top:14px">تاریخچه</h3>
            <div class="log"></div>
          </div>
          <div class="card">
            <div class="bus">
              <div class="box cpu"><b>پردازنده</b><div class="reglbl mar">MAR = —</div><div class="reglbl mdr">MDR = —</div></div>
              <div class="lines">
                <div class="line ab">گذرگاه آدرس (Address Bus) →</div>
                <div class="line db">↔ گذرگاه داده (Data Bus)</div>
                <div class="line cb">گذرگاه کنترل (Control Bus) →</div>
              </div>
              <div class="box memb"><b>حافظه</b><div class="reglbl">256 × 16 بیت</div><div class="reglbl cellv"></div></div>
            </div>
            <h3 style="margin-top:14px">محتوای حافظه (هگز)</h3>
            <p class="muted small">روی یک خانه کلیک کنید تا آدرس آن انتخاب شود.</p>
            <div class="memwrap memview"></div>
          </div>
        </div>`;
      const q = (s) => UI.$(s, el);

      const READ_STEPS = [
        'MAR ← آدرس: پردازنده آدرس را در MAR قرار می‌دهد و روی گذرگاه آدرس می‌فرستد.',
        'سیگنال Read روی گذرگاه کنترل فعال می‌شود؛ رمزگشای آدرس حافظه خانهٔ مورد نظر را انتخاب می‌کند.',
        'حافظه محتوای خانه را روی گذرگاه داده قرار می‌دهد (پس از زمان دسترسی).',
        'MDR ← داده: پردازنده داده را از گذرگاه داده در MDR ذخیره می‌کند. چرخه پایان یافت.',
      ];
      const WRITE_STEPS = [
        'MAR ← آدرس و MDR ← داده: پردازنده آدرس و داده را آماده می‌کند.',
        'آدرس روی گذرگاه آدرس و داده روی گذرگاه داده قرار می‌گیرند.',
        'سیگنال Write روی گذرگاه کنترل فعال می‌شود.',
        'حافظه داده را در خانهٔ انتخاب‌شده می‌نویسد. چرخه پایان یافت.',
      ];
      let step = -1, mar = null, mdr = null, lastOp = null;

      function render() {
        const op = q('.op').value, steps = op === 'R' ? READ_STEPS : WRITE_STEPS;
        q('.phases').innerHTML = steps.map((_, i) => `<span class="${i === step ? 'cur' : i < step ? 'done' : ''}">گام ${i + 1}</span>`).join('');
        q('.explain').textContent = step >= 0 ? steps[step] : 'برای شروع چرخه «گام بعدی» را بزنید.';
        const on = (cls, v) => q(cls).classList.toggle('on', !!v);
        on('.ab', (op === 'R' && step >= 0 && step <= 2) || (op === 'W' && step >= 1));
        on('.cb', (op === 'R' && step >= 1 && step <= 2) || (op === 'W' && step >= 2));
        on('.db', (op === 'R' && step >= 2) || (op === 'W' && step >= 1));
        on('.cpu', step === 0 || (op === 'R' && step === 3));
        on('.memb', (op === 'R' && step === 2) || (op === 'W' && step === 3) || step === 1);
        q('.cb').textContent = `گذرگاه کنترل: ${op === 'R' ? 'READ' : 'WRITE'} →`;
        q('.mar').textContent = 'MAR = ' + (mar === null ? '—' : mar);
        q('.mdr').textContent = 'MDR = ' + (mdr === null ? '—' : `${S.toSigned(mdr, 16)} (${UI.hex(mdr)})`);
        const a = UI.parseInput(q('.addr').value) & 0xFF;
        q('.cellv').textContent = `MEM[${a}] = ${UI.hex(mem.peek(a))}`;
        const marks = { [a]: 'sel' };
        if (step === 3 && lastOp) marks[mar] = lastOp === 'R' ? 'r' : 'w';
        q('.memview').innerHTML = UI.memHTML(mem.data, marks);
      }
      function next() {
        const op = q('.op').value, a = UI.parseInput(q('.addr').value) & 0xFF;
        if (step >= 3) { step = -1; mar = null; mdr = null; lastOp = null; }
        step++;
        if (step === 0) { mar = a; if (op === 'W') mdr = UI.parseInput(q('.data').value) & 0xFFFF; }
        if (step === 3) {
          lastOp = op;
          if (op === 'R') mdr = mem.read(mar);
          else mem.write(mar, mdr);
          const d = document.createElement('div');
          d.innerHTML = op === 'R' ? `خواندن MEM[${mar}] → ${S.toSigned(mdr, 16)}` : `نوشتن MEM[${mar}] ← ${S.toSigned(mdr, 16)}`;
          q('.log').prepend(d);
        }
        render();
      }
      q('.step').addEventListener('click', next);
      q('.full').addEventListener('click', () => { if (step >= 3) next(); while (step < 3) next(); });
      q('.rnd').addEventListener('click', () => { for (let i = 0; i < 256; i++) mem.data[i] = Math.random() < 0.3 ? Math.floor(Math.random() * 65536) : 0; render(); });
      q('.clr').addEventListener('click', () => { mem.clear(); render(); });
      q('.memview').addEventListener('click', (e) => {
        const c = e.target.closest('[data-addr]');
        if (c) { q('.addr').value = c.dataset.addr; step = -1; render(); }
      });
      q('.op').addEventListener('change', () => { step = -1; mar = mdr = null; render(); });
      q('.addr').addEventListener('input', () => { if (step < 0 || step >= 3) render(); });
      render();
    },
  });
})();
