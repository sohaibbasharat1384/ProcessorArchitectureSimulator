(function () {
  'use strict';
  const S = window.Sim, UI = window.UI, A = window.Anim;

  const RY = (k) => 70 + k * 50;           // register row top
  const M1 = (k) => 85 + k * 21;           // MUX1 input k
  const M2 = (k) => 305 + k * 21;          // MUX2 input k

  function figure() {
    let s = '<svg viewBox="0 0 1000 540">';
    // write side
    s += `<path class="wire" id="w-wreg" d="M140,80 H180"/>`;
    let we = 'M140,278 H262 M262,90 V460', wd = 'M140,350 H345 M345,100 V475', clk = 'M140,450 H360 M360,105 V478';
    for (let k = 0; k < 8; k++) {
      const y = RY(k);
      s += `<path class="wire" id="w-dec-${k}" d="M240,${y + 20} H${k ? 285 : 300}"/>`;
      if (k) {
        we += ` M262,${y + 14} H285`;
        s += `<path class="wire" id="w-load-${k}" d="M319,${y + 20} H380"/>`;
        s += `<g class="gate" id="and-${k}"><rect class="box" x="285" y="${y + 8}" width="34" height="24" rx="10"/><text class="t-small" x="302" y="${y + 20}">&amp;</text></g>`;
      } else {
        s += `<text class="t-small t-muted" x="318" y="${y + 20}">×</text>`;
      }
      wd += ` M345,${y + 32} H380`;
      clk += ` M360,${y + 37} H380`;
      s += `<text class="t-small t-mono decv" id="dv-${k}" x="252" y="${y + 12}"></text>`;
    }
    s += `<path class="wire" id="w-we" d="${we}"/><path class="wire" id="w-wd" d="${wd}"/><path class="wire" id="w-clk" d="${clk}"/>`;
    s += `<g id="b-wreg"><rect class="box" x="20" y="60" width="120" height="40" rx="7"/><text x="80" y="72" class="t-small">Write Reg (rd)</text><text class="t-mono v" x="80" y="89"></text></g>`;
    s += `<g id="b-dec"><rect class="box" x="180" y="60" width="60" height="410" rx="7"/><text x="210" y="250">رمزگشا</text><text x="210" y="270" class="t-small">3→8</text></g>`;
    s += `<g id="b-we"><rect class="box" x="20" y="260" width="120" height="36" rx="7"/><text x="80" y="271" class="t-small">RegWrite (WE)</text><text class="t-mono v" x="80" y="287"></text></g>`;
    s += `<g id="b-wd"><rect class="box" x="20" y="330" width="120" height="40" rx="7"/><text x="80" y="342" class="t-small">Write Data</text><text class="t-mono v" x="80" y="359"></text></g>`;
    s += `<g id="b-clk"><rect class="box" x="20" y="420" width="120" height="60" rx="7"/><text x="80" y="432" class="t-small">CLK</text>
      <path class="clkwave" d="M30,470 H50 V448 H70 V470 H90 V448 H110 V470 H130"/><circle class="clkdot" r="4" cx="30" cy="470"/></g>`;
    // registers
    for (let k = 0; k < 8; k++) {
      const y = RY(k);
      s += `<g class="reg-box" id="rg-${k}"><rect class="box" x="380" y="${y}" width="180" height="40" rx="7"/>
        <text x="405" y="${y + 20}" class="t-mono" style="font-weight:700">R${k}</text><text class="t-mono v" x="490" y="${y + 14}"></text><text class="t-small t-muted vb" x="490" y="${y + 30}"></text>
        <path class="clktri" d="M380,${y + 31} l7,6 l-7,6"/></g>`;
      s += `<path class="wire" id="w-r${k}-m1" d="M560,${y + 20} H600 L650,${M1(k)}"/>`;
      s += `<path class="wire" id="w-r${k}-m2" d="M600,${y + 20} L650,${M2(k)}"/>`;
    }
    // read muxes
    s += `<path class="wire" id="w-sel1" d="M675,44 V73"/><path class="wire" id="w-sel2" d="M675,486 V467"/>`;
    s += `<path class="wire" id="w-out1" d="M700,160 H760"/><path class="wire" id="w-out2" d="M700,380 H760"/>`;
    s += `<g id="mux1"><path class="box" d="M650,70 L700,90 L700,230 L650,250 Z"/><text x="675" y="160" class="t-small">MUX</text></g>`;
    s += `<g id="mux2"><path class="box" d="M650,290 L700,310 L700,450 L650,470 Z"/><text x="675" y="380" class="t-small">MUX</text></g>`;
    s += `<g id="b-sel1"><rect class="box" x="620" y="10" width="110" height="34" rx="7"/><text x="675" y="21" class="t-small">Read Reg 1 (rs)</text><text class="t-mono v" x="675" y="36"></text></g>`;
    s += `<g id="b-sel2"><rect class="box" x="620" y="486" width="110" height="34" rx="7"/><text x="675" y="497" class="t-small">Read Reg 2 (rt)</text><text class="t-mono v" x="675" y="512"></text></g>`;
    s += `<g id="b-out1"><rect class="box" x="760" y="140" width="220" height="40" rx="7"/><text x="870" y="152" class="t-small">Read Data 1</text><text class="t-mono v" x="870" y="169"></text></g>`;
    s += `<g id="b-out2"><rect class="box" x="760" y="360" width="220" height="40" rx="7"/><text x="870" y="372" class="t-small">Read Data 2</text><text class="t-mono v" x="870" y="389"></text></g>`;
    return s + '</svg>';
  }

  UI.register({
    id: 'regs', title: 'بانک ثبات (Register File)',
    desc: 'رمزگشای آدرس، گیت‌های Write Enable، لبهٔ ساعت و مالتی‌پلکسرهای خواندن به‌صورت متحرک',
    init(el) {
      const rf = new S.RegisterFile(8, 16, true);
      [0, 12, -5, 300, 7, 0, 1024, 99].forEach((v, i) => rf.write(i, v));
      const regOpts = (sel) => rf.values.map((_, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>R${i}</option>`).join('');
      el.innerHTML = `
        <div class="lead"><p><b>بانک ثبات</b> ۸ ثبات ۱۶ بیتی دارد. <b>خواندن</b> با دو مالتی‌پلکسر ۸ به ۱ انجام می‌شود: شمارهٔ ثبات، ورودی انتخاب MUX است و مقدار
        بلافاصله (بدون ساعت) در خروجی ظاهر می‌شود. <b>نوشتن</b> سه شرط دارد: رمزگشای ۳ به ۸ فقط خط ثبات مقصد را فعال کند، سیگنال RegWrite یک باشد (گیت AND)،
        و <b>لبهٔ بالاروندهٔ ساعت</b> برسد. R0 به صفر سیم‌کشی شده و ورودی بارگذاری ندارد.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="controls">
            <label>Read Reg 1 (rs)<select class="r1">${regOpts(1)}</select></label>
            <label>Read Reg 2 (rt)<select class="r2">${regOpts(2)}</select></label>
            <button class="btn primary do-read">شبیه‌سازی خواندن</button>
            <span style="width:20px"></span>
            <label>Write Reg (rd)<select class="wr">${regOpts(3)}</select></label>
            <label>Write Data<input type="text" class="wd ltr" value="42" size="7"></label>
            <label class="inline"><input type="checkbox" class="we" checked> RegWrite</label>
            <button class="btn primary do-write">شبیه‌سازی نوشتن</button>
            <button class="btn rst">صفر کردن همه</button>
          </div>
          <div class="st"></div>
        </div>
        <div class="card"><div class="fig rf-fig">${figure()}</div></div>`;
      const q = (s) => UI.$(s, el);
      const fig = q('.rf-fig'), svg = UI.$('svg', fig);
      const stepper = UI.stepper(q('.st'));
      let before = rf.values.slice(), after = rf.values.slice(), mode = null, op = {};

      const setV = (id, t) => { const n = UI.$('#' + id + ' .v', fig); if (n) n.textContent = t; };
      function showRegs(vals, written) {
        for (let k = 0; k < 8; k++) {
          const g = UI.$('#rg-' + k, fig);
          g.querySelector('.v').textContent = `${S.toSigned(vals[k], 16)}`;
          g.querySelector('.vb').textContent = UI.hex(vals[k]);
          g.classList.toggle('written', written === k);
        }
      }
      function clear() {
        UI.$$('.on', fig).forEach((e) => e.classList.remove('on'));
        UI.$$('.hl', fig).forEach((e) => e.classList.remove('hl'));
        UI.$$('.decv', fig).forEach((e) => { e.textContent = ''; });
      }
      function idle() {
        const r1 = +q('.r1').value, r2 = +q('.r2').value, wr = +q('.wr').value;
        setV('b-sel1', `R${r1} = ${UI.bin(r1, 3)}`); setV('b-sel2', `R${r2} = ${UI.bin(r2, 3)}`);
        setV('b-wreg', `R${wr} = ${UI.bin(wr, 3)}`); setV('b-we', q('.we').checked ? '1' : '0');
        setV('b-wd', String(UI.parseInput(q('.wd').value)));
        setV('b-out1', '—'); setV('b-out2', '—');
      }

      function readSteps() {
        const r1 = +q('.r1').value, r2 = +q('.r2').value;
        op = { r1, r2 };
        const v = rf.values;
        return [
          { k: 's1', title: 'پورت ۱: انتخاب', text: `شمارهٔ ثبات rs = ${UI.bin(r1, 3)} (یعنی ${r1}) به ورودی انتخاب MUX اول می‌رود.` },
          { k: 'c1', title: 'پورت ۱: اتصال', text: `MUX فقط ورودی شمارهٔ ${r1} (خروجی ثبات R${r1}) را به خروجی وصل می‌کند؛ هفت ورودی دیگر قطع‌اند.` },
          { k: 'o1', title: 'پورت ۱: خروجی', text: `مقدار R${r1} = ${S.toSigned(v[r1], 16)} (${UI.hex(v[r1])}) از MUX عبور می‌کند و روی Read Data 1 قرار می‌گیرد.` },
          { k: 's2', title: 'پورت ۲: انتخاب', text: `همزمان، شمارهٔ rt = ${UI.bin(r2, 3)} به ورودی انتخاب MUX دوم می‌رود.` },
          { k: 'c2', title: 'پورت ۲: اتصال', text: `MUX دوم ورودی شمارهٔ ${r2} را انتخاب می‌کند.` },
          { k: 'o2', title: 'پورت ۲: خروجی', text: `مقدار R${r2} = ${S.toSigned(v[r2], 16)} روی Read Data 2 قرار می‌گیرد.` },
          { k: 'rd', title: 'خلاصه', text: 'خواندن «ترکیبی» است: به ساعت نیاز ندارد و به محض تغییر شمارهٔ ثبات، خروجی‌ها عوض می‌شوند. به همین دلیل دو ثبات در یک چرخه خوانده می‌شوند.' },
        ];
      }
      function writeSteps() {
        const wr = +q('.wr').value, val = UI.parseInput(q('.wd').value) & 0xFFFF, we = q('.we').checked;
        before = rf.values.slice();
        rf.latch(wr, val, we);
        const res = rf.clockEdge();
        after = rf.values.slice();
        op = { wr, val, we, res };
        const oneHot = Array.from({ length: 8 }, (_, k) => (k === wr ? 1 : 0)).reverse().join('');
        const st = [
          { k: 'w1', title: 'آدرس مقصد', text: `شمارهٔ ثبات مقصد rd = ${UI.bin(wr, 3)} به ورودی رمزگشای ۳ به ۸ می‌رود.` },
          { k: 'w2', title: 'رمزگشایی', text: `رمزگشا از ۸ خروجی فقط خروجی شمارهٔ ${wr} را ۱ می‌کند (کد یک‌داغ: ${oneHot}).${wr === 0 ? ' خروجی ۰ به هیچ ثباتی وصل نیست، چون R0 همیشه صفر است.' : ''}` },
          { k: 'w3', title: 'گذرگاه داده', text: `مقدار ${S.toSigned(val, 16)} (${UI.hex(val)}) روی گذرگاه Write Data به ورودی دادهٔ «همهٔ» ثبات‌ها می‌رسد؛ اما فقط ثباتی که Load آن فعال باشد آن را ذخیره می‌کند.` },
          { k: 'w4', title: 'RegWrite', text: `سیگنال RegWrite = ${we ? 1 : 0} به ورودی دوم همهٔ گیت‌های AND می‌رود.` },
          { k: 'w5', title: 'گیت AND', text: wr === 0 ? 'برای R0 گیتی وجود ندارد؛ ورودی Load هیچ ثباتی فعال نمی‌شود.'
            : we ? `فقط گیت AND شمارهٔ ${wr} هر دو ورودی‌اش ۱ است ⇒ ورودی Load ثبات R${wr} فعال می‌شود.` : `RegWrite صفر است، پس خروجی همهٔ گیت‌های AND صفر می‌ماند؛ هیچ ثباتی Load نمی‌شود.` },
          { k: 'w6', title: 'لبهٔ ساعت', text: 'لبهٔ بالاروندهٔ ساعت (CLK: 0 → 1) به همهٔ ثبات‌ها می‌رسد. ثبات‌ها فقط در همین لحظه می‌توانند مقدار جدید بگیرند.' },
          { k: 'w7', title: 'ذخیره', commit: true, text: res.committed ? `ثبات R${wr} مقدار ${S.toSigned(val, 16)} را ذخیره کرد. بقیهٔ ثبات‌ها تغییری نکردند.` : 'هیچ مقداری نوشته نشد؛ همهٔ ثبات‌ها مقدار قبلی خود را نگه داشتند.' },
        ];
        return st;
      }

      function render(step, idx, animate) {
        clear();
        idle();
        const list = stepper.steps;
        const committed = list.slice(0, idx + 1).some((s) => s.commit);
        showRegs(mode === 'write' ? (committed ? after : before) : rf.values, mode === 'write' && committed && op.res.committed ? op.wr : null);
        if (!step) return;
        const doneKeys = list.slice(0, idx + 1).map((s) => s.k);
        const on = (id) => { const e = UI.$('#' + id, fig); if (e) e.classList.add('on'); return e; };
        const anims = [];
        if (mode === 'read') {
          const { r1, r2 } = op;
          if (doneKeys.includes('o1')) setV('b-out1', `${S.toSigned(rf.values[r1], 16)}  (${UI.hex(rf.values[r1])})`);
          if (doneKeys.includes('o2')) setV('b-out2', `${S.toSigned(rf.values[r2], 16)}  (${UI.hex(rf.values[r2])})`);
          const port = step.k.endsWith('1') ? 1 : 2, r = port === 1 ? r1 : r2;
          if (step.k === 'rd') { ['w-r' + r1 + '-m1', 'w-r' + r2 + '-m2', 'w-out1', 'w-out2', 'mux1', 'mux2'].forEach(on); return; }
          on('mux' + port);
          if (step.k[0] === 's') { on('w-sel' + port); on('b-sel' + port); if (animate) anims.push(A.token(svg, 'w-sel' + port, 'R' + r, { reverse: port === 2, cls: 'addr' })); }
          if (step.k[0] === 'c') { on('w-r' + r + '-m' + port); UI.$('#rg-' + r, fig).classList.add('hl'); }
          if (step.k[0] === 'o') {
            on('w-r' + r + '-m' + port); on('w-out' + port); on('b-out' + port); UI.$('#rg-' + r, fig).classList.add('hl');
            if (animate) {
              setV('b-out' + port, '…');
              anims.push(A.token(svg, 'w-r' + r + '-m' + port, S.toSigned(rf.values[r], 16), { duration: 700 })
                .then(() => A.token(svg, 'w-out' + port, S.toSigned(rf.values[r], 16), { duration: 400 }))
                .then(() => { setV('b-out' + port, `${S.toSigned(rf.values[r], 16)}  (${UI.hex(rf.values[r])})`); A.flash(UI.$('#b-out' + port, fig)); }));
            }
          }
          return Promise.all(anims);
        }
        // write
        const { wr, val, we } = op;
        const decOn = doneKeys.includes('w2');
        if (decOn) for (let k = 0; k < 8; k++) UI.$('#dv-' + k, fig).textContent = k === wr ? '1' : '0';
        if (decOn) on('w-dec-' + wr);
        if (doneKeys.includes('w3')) on('w-wd');
        if (doneKeys.includes('w4') && we) on('w-we');
        if (doneKeys.includes('w5') && we && wr) { on('and-' + wr); on('w-load-' + wr); }
        if (step.k === 'w1') { on('w-wreg'); on('b-dec'); on('b-wreg'); if (animate) anims.push(A.token(svg, 'w-wreg', 'R' + wr, { cls: 'addr' })); }
        if (step.k === 'w2') { on('b-dec'); if (animate) anims.push(A.draw(UI.$('#w-dec-' + wr, fig), 500)); }
        if (step.k === 'w3') { on('b-wd'); if (animate) anims.push(A.draw(UI.$('#w-wd', fig), 800)); }
        if (step.k === 'w4') { on('b-we'); if (animate && we) anims.push(A.draw(UI.$('#w-we', fig), 700)); }
        if (step.k === 'w5' && we && wr) { UI.$('#rg-' + wr, fig).classList.add('hl'); if (animate) anims.push(A.token(svg, 'w-load-' + wr, 'Load=1', { cls: 'ctl', duration: 500 })); }
        if (step.k === 'w6') {
          on('w-clk'); on('b-clk');
          const dot = UI.$('.clkdot', fig), wave = UI.$('.clkwave', fig);
          if (animate) anims.push(A.tween(1100, (e) => { const p = wave.getPointAtLength(e * wave.getTotalLength() * 0.42); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); }));
          else { dot.setAttribute('cx', 50); dot.setAttribute('cy', 448); }
        }
        if (step.k === 'w7') {
          on('w-clk');
          if (op.res.committed) { UI.$('#rg-' + wr, fig).classList.add('hl'); if (animate) A.flash(UI.$('#rg-' + wr, fig)); }
        }
        setV('b-wd', String(S.toSigned(val, 16)));
        return Promise.all(anims);
      }

      q('.do-read').addEventListener('click', () => { mode = 'read'; stepper.set(readSteps(), render); stepper.next(); });
      q('.do-write').addEventListener('click', () => { mode = 'write'; stepper.set(writeSteps(), render); stepper.next(); });
      q('.rst').addEventListener('click', () => { rf.reset(); mode = null; stepper.set([], render, 'همهٔ ثبات‌ها صفر شدند.'); });
      el.addEventListener('change', (e) => { if (e.target.matches('select, input')) { mode = null; stepper.set([], render, 'تنظیمات تغییر کرد. «شبیه‌سازی خواندن» یا «شبیه‌سازی نوشتن» را بزنید.'); } });
      mode = null;
      stepper.set([], render, 'یکی از دکمه‌های «شبیه‌سازی خواندن» یا «شبیه‌سازی نوشتن» را بزنید.');
    },
  });
})();
