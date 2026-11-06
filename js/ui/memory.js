(function () {
  'use strict';
  const S = window.Sim, UI = window.UI, A = window.Anim;
  const GX = 690, GY = 60, CW = 17, CH = 20, WAIT = 3;
  const cellX = (c) => GX + c * CW, cellY = (r) => GY + r * CH;

  function figure() {
    let s = '<svg viewBox="0 0 1000 520">';
    // buses
    s += `<path class="wire bus" id="b-addr" d="M220,110 H610"/><text class="t-small t-muted" x="400" y="100">گذرگاه آدرس (۸ بیت) →</text>`;
    s += `<path class="wire bus" id="b-data" d="M220,190 H595 V467 H690"/><text class="t-small t-muted" x="400" y="180">↔ گذرگاه داده (۱۶ بیت)</text>`;
    s += `<path class="wire bus" id="b-ctl" d="M220,270 H575 V452 H610"/><text class="t-small t-muted" x="400" y="260">گذرگاه کنترل (READ / WRITE) →</text>`;
    s += `<path class="wire" id="w-col" d="M605,110 V52 H680 V417 H690"/>`;
    // CPU
    s += `<rect class="box frame" x="20" y="40" width="240" height="300" rx="12"/><text x="140" y="62" style="font-weight:700">پردازنده</text>`;
    s += `<g id="b-mar"><rect class="box" x="60" y="90" width="160" height="40" rx="7"/><text x="140" y="102" class="t-small">MAR (ثبات آدرس)</text><text class="t-mono v" x="140" y="119">—</text></g>`;
    s += `<g id="b-mdr"><rect class="box" x="60" y="170" width="160" height="40" rx="7"/><text x="140" y="182" class="t-small">MDR (ثبات داده)</text><text class="t-mono v" x="140" y="199">—</text></g>`;
    s += `<g id="b-cu"><rect class="box" x="60" y="250" width="160" height="40" rx="7"/><text x="140" y="262" class="t-small">واحد کنترل</text><text class="t-mono v" x="140" y="279"></text></g>`;
    // memory module
    s += `<rect class="box frame" x="600" y="20" width="385" height="490" rx="12"/><text x="840" y="38" style="font-weight:700">حافظه (256 × 16)</text>`;
    s += `<g id="b-rowdec"><rect class="box" x="610" y="60" width="60" height="320" rx="7"/><text x="640" y="210" class="t-small">رمزگشای</text><text x="640" y="226" class="t-small">سطر</text><text class="t-mono v" x="640" y="250"></text></g>`;
    s += '<g class="grid">';
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) s += `<rect class="mcell" id="mc-${r * 16 + c}" x="${cellX(c) + 1}" y="${cellY(r) + 1}" width="${CW - 2}" height="${CH - 2}" rx="2"/>`;
    s += '</g>';
    s += `<path class="wire rowline" id="w-row" d=""/><path class="wire colline" id="w-colline" d=""/><path class="wire" id="w-cellbuf" d=""/>`;
    s += `<g id="b-colmux"><rect class="box" x="690" y="400" width="272" height="34" rx="7"/><text x="826" y="412" class="t-small">MUX انتخاب ستون</text><text class="t-mono v" x="826" y="427"></text></g>`;
    s += `<g id="b-buf"><rect class="box" x="690" y="450" width="272" height="34" rx="7"/><text x="826" y="462" class="t-small">بافر داده</text><text class="t-mono v" x="826" y="477"></text></g>`;
    s += `<g id="b-rw"><rect class="box" x="610" y="420" width="60" height="64" rx="7"/><text x="640" y="440" class="t-small">R/W</text><text class="t-mono v" x="640" y="462"></text></g>`;
    s += `<text class="t-small wait" x="900" y="500"></text><text class="t-mono cellv" x="745" y="500"></text>`;
    return s + '</svg>';
  }

  UI.register({
    id: 'memory', title: 'حافظهٔ اصلی و گذرگاه (Memory & Bus)',
    desc: 'حرکت آدرس و داده روی گذرگاه‌ها، رمزگشای سطر و ستون، و زمان انتظار حافظه',
    init(el) {
      const mem = new S.Memory(256, 16);
      for (let i = 0; i < 256; i++) mem.data[i] = (i * 37 + 11) % 7 === 0 ? (i * 97) & 0xFFFF : 0;
      el.innerHTML = `
        <div class="lead"><p>پردازنده از راه <b>گذرگاه سیستم</b> با حافظه کار می‌کند. آدرس در <b>MAR</b> و داده در <b>MDR</b> نگه داشته می‌شود. داخل حافظه،
        ۴ بیت بالای آدرس با <b>رمزگشای سطر</b> یک سطر را فعال می‌کنند و ۴ بیت پایین با <b>MUX ستون</b> یک خانه از آن سطر را انتخاب می‌کنند.
        حافظه از پردازنده کندتر است، پس پردازنده چند چرخه منتظر می‌ماند (<b>Wait State</b>).</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="controls">
            <label>نوع<select class="op"><option value="R">خواندن (Read)</option><option value="W">نوشتن (Write)</option></select></label>
            <label>آدرس (0..255)<input type="text" class="addr ltr" value="14" size="5"></label>
            <label>داده (برای نوشتن)<input type="text" class="data ltr" value="1234" size="7"></label>
            <button class="btn primary go">شروع چرخهٔ گذرگاه</button>
            <button class="btn rnd">پر کردن تصادفی</button>
            <button class="btn clr">پاک کردن حافظه</button>
          </div>
          <div class="st"></div>
        </div>
        <div class="card"><div class="fig mem-fig">${figure()}</div></div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>محتوای حافظه (هگز)</h3><p class="muted small">روی یک خانه کلیک کنید تا آدرس آن انتخاب شود.</p><div class="memwrap memview"></div></div>
          <div class="card"><h3>تاریخچه</h3><div class="log"></div></div>
        </div>`;
      const q = (s) => UI.$(s, el);
      const fig = q('.mem-fig'), svg = UI.$('svg', fig);
      const stepper = UI.stepper(q('.st'));
      let op = null;

      const setV = (id, t) => { const n = UI.$('#' + id + ' .v', fig); if (n) n.textContent = t; };
      function paintGrid(data, sel) {
        for (let a = 0; a < 256; a++) {
          const c = UI.$('#mc-' + a, fig);
          c.classList.toggle('nz', data[a] !== 0);
          c.classList.toggle('sel', a === sel);
        }
      }
      function memList(data, marks) { q('.memview').innerHTML = UI.memHTML(data, marks); }

      function build() {
        const kind = q('.op').value, addr = UI.parseInput(q('.addr').value) & 0xFF, val = UI.parseInput(q('.data').value) & 0xFFFF;
        const r = addr >> 4, c = addr & 15;
        const before = mem.data.slice();
        let readVal = null;
        if (kind === 'R') readVal = mem.read(addr); else mem.write(addr, val);
        const after = mem.data.slice();
        op = { kind, addr, val, r, c, before, after, readVal };
        // dynamic paths
        UI.$('#w-row', fig).setAttribute('d', `M670,${cellY(r) + CH / 2} H${GX + 16 * CW}`);
        UI.$('#w-colline', fig).setAttribute('d', `M${cellX(c) + CW / 2},${GY} V400`);
        UI.$('#w-cellbuf', fig).setAttribute('d', `M${cellX(c) + CW / 2},${cellY(r) + CH / 2} V450`);
        const ab = UI.bin(addr, 8);
        const st = [];
        if (kind === 'R') {
          st.push({ k: 'mar', title: 'MAR', text: `پردازنده آدرس ${addr} را در MAR قرار می‌دهد (دودویی ${ab}).` });
          st.push({ k: 'abus', title: 'گذرگاه آدرس', text: `MAR آدرس ${ab} را روی ۸ خط گذرگاه آدرس قرار می‌دهد و آدرس به حافظه می‌رسد.` });
          st.push({ k: 'ctl', title: 'گذرگاه کنترل', text: 'واحد کنترل سیگنال READ را روی گذرگاه کنترل فعال می‌کند تا حافظه بداند باید بخواند.' });
          st.push({ k: 'row', title: 'رمزگشایی سطر', text: `۴ بیت بالای آدرس (${ab.slice(0, 4)} = ${r}) به رمزگشای سطر می‌رود و فقط «خط کلمهٔ» سطر ${r} فعال می‌شود.` });
          st.push({ k: 'col', title: 'انتخاب ستون', text: `۴ بیت پایین (${ab.slice(4)} = ${c}) ورودی انتخاب MUX ستون است؛ از ۱۶ خانهٔ سطر ${r} فقط ستون ${c} عبور داده می‌شود.` });
          st.push({ k: 'wait', title: 'زمان دسترسی', text: `خانهٔ تقاطع سطر ${r} و ستون ${c} (آدرس ${addr}) انتخاب شد. حافظه ${WAIT} چرخهٔ ساعت زمان لازم دارد تا داده پایدار شود؛ پردازنده در این مدت منتظر می‌ماند.` });
          st.push({ k: 'cellbuf', title: 'خروج داده', text: `محتوای خانه، ${UI.hex(readVal)} (${S.toSigned(readVal, 16)})، از ستون انتخاب‌شده به بافر داده می‌رود.` });
          st.push({ k: 'dbus', title: 'گذرگاه داده', text: 'بافر حافظه داده را روی گذرگاه داده قرار می‌دهد و داده به سمت پردازنده حرکت می‌کند.' });
          st.push({ k: 'mdr', title: 'MDR', commit: true, text: `پردازنده داده را در MDR ذخیره می‌کند: MDR = ${UI.hex(readVal)}. سیگنال READ غیرفعال و گذرگاه‌ها آزاد می‌شوند. محتوای حافظه تغییری نکرد.` });
        } else {
          st.push({ k: 'mar', title: 'MAR و MDR', text: `پردازنده آدرس ${addr} را در MAR و دادهٔ ${S.toSigned(val, 16)} (${UI.hex(val)}) را در MDR قرار می‌دهد.` });
          st.push({ k: 'abus', title: 'گذرگاه آدرس', text: `آدرس ${ab} روی گذرگاه آدرس به حافظه می‌رسد.` });
          st.push({ k: 'dbus', title: 'گذرگاه داده', text: `MDR داده را روی گذرگاه داده قرار می‌دهد؛ این بار داده از پردازنده به سمت حافظه می‌رود و در بافر داده می‌نشیند.` });
          st.push({ k: 'ctl', title: 'گذرگاه کنترل', text: 'واحد کنترل سیگنال WRITE را فعال می‌کند.' });
          st.push({ k: 'row', title: 'رمزگشایی سطر', text: `۴ بیت بالا (${ab.slice(0, 4)} = ${r}) سطر ${r} را فعال می‌کنند.` });
          st.push({ k: 'col', title: 'انتخاب ستون', text: `۴ بیت پایین (${ab.slice(4)} = ${c}) ستون ${c} را انتخاب می‌کنند.` });
          st.push({ k: 'cellbuf', title: 'نوشتن در خانه', text: `داده از بافر از طریق ستون ${c} به خانهٔ آدرس ${addr} می‌رود. حافظه ${WAIT} چرخهٔ ساعت زمان نوشتن لازم دارد.` });
          st.push({ k: 'done', title: 'پایان', commit: true, text: `MEM[${addr}] از ${UI.hex(op.before[addr])} به ${UI.hex(val)} تغییر کرد. سیگنال WRITE غیرفعال و گذرگاه‌ها آزاد می‌شوند.` });
        }
        stepper.set(st, render);
        stepper.next();
      }

      function render(step, idx, animate) {
        UI.$$('.on', fig).forEach((e) => e.classList.remove('on'));
        UI.$$('.hl', fig).forEach((e) => e.classList.remove('hl'));
        q('.wait').textContent = '';
        if (!op) {
          ['b-mar', 'b-mdr', 'b-cu', 'b-rowdec', 'b-colmux', 'b-buf', 'b-rw'].forEach((id) => setV(id, id === 'b-mar' || id === 'b-mdr' ? '—' : ''));
          const a = UI.parseInput(q('.addr').value) & 0xFF;
          paintGrid(mem.data, a);
          q('.cellv').textContent = `MEM[${a}] = ${UI.hex(mem.peek(a))}`;
          memList(mem.data, { [a]: 'sel' });
          return;
        }
        const list = stepper.steps, keys = list.slice(0, idx + 1).map((s) => s.k);
        const committed = list.slice(0, idx + 1).some((s) => s.commit);
        const data = committed ? op.after : op.before;
        const has = (k) => keys.includes(k);
        const isR = op.kind === 'R';
        paintGrid(data, has('col') ? op.addr : null);
        q('.cellv').textContent = `MEM[${op.addr}] = ${UI.hex(data[op.addr])}`;
        memList(data, { [op.addr]: committed ? (isR ? 'r' : 'w') : 'sel' });
        setV('b-mar', has('mar') ? `${op.addr}  (${UI.bin(op.addr, 8)})` : '—');
        setV('b-mdr', isR ? (committed ? UI.hex(op.readVal) : '—') : has('mar') ? UI.hex(op.val) : '—');
        setV('b-cu', has('ctl') && !committed ? (isR ? 'READ = 1' : 'WRITE = 1') : '');
        setV('b-rw', has('ctl') && !committed ? (isR ? 'READ' : 'WRITE') : '');
        setV('b-rowdec', has('row') ? `سطر ${op.r}` : '');
        setV('b-colmux', has('col') ? `ستون ${op.c}` : '');
        setV('b-buf', isR ? (has('cellbuf') && !committed ? UI.hex(op.readVal) : '') : has('dbus') && !committed ? UI.hex(op.val) : '');
        if (has('abus') && !committed) UI.$('#b-addr', fig).classList.add('on');
        if (has('ctl') && !committed) UI.$('#b-ctl', fig).classList.add('on');
        if (has('row')) { UI.$('#w-row', fig).classList.add('on'); UI.$('#b-rowdec', fig).classList.add('on'); }
        if (has('col')) { UI.$('#w-colline', fig).classList.add('on'); UI.$('#w-col', fig).classList.add('on'); }
        if (!step) return;
        const on = (id) => UI.$('#' + id, fig).classList.add('on');
        const anims = [];
        switch (step.k) {
          case 'mar': UI.$('#b-mar', fig).classList.add('hl'); if (!isR) UI.$('#b-mdr', fig).classList.add('hl'); if (animate) A.flash(UI.$('#b-mar', fig)); break;
          case 'abus': on('b-addr'); if (animate) anims.push(A.token(svg, 'b-addr', UI.bin(op.addr, 8), { cls: 'addr', duration: 1000 })); break;
          case 'ctl': on('b-ctl'); on('b-cu'); if (animate) anims.push(A.token(svg, 'b-ctl', isR ? 'READ' : 'WRITE', { cls: 'ctl', duration: 1200 })); break;
          case 'row': if (animate) anims.push(A.draw(UI.$('#w-row', fig), 600)); break;
          case 'col': on('b-colmux'); if (animate) anims.push(A.token(svg, 'w-col', UI.bin(op.c, 4), { cls: 'addr', duration: 700 }).then(() => A.draw(UI.$('#w-colline', fig), 500))); break;
          case 'wait': {
            UI.$('#mc-' + op.addr, fig).classList.add('hl');
            const show = (n) => { q('.wait').textContent = `انتظار: چرخهٔ ${n} از ${WAIT} ⏱`; };
            if (animate) {
              anims.push((async () => { for (let n = 1; n <= WAIT; n++) { show(n); A.flash(UI.$('#mc-' + op.addr, fig)); await A.sleep(450); } })());
            } else show(WAIT);
            break;
          }
          case 'cellbuf':
            on('w-cellbuf'); on('b-buf'); UI.$('#mc-' + op.addr, fig).classList.add('hl');
            if (!isR) q('.wait').textContent = `زمان نوشتن: ${WAIT} چرخهٔ ساعت`;
            if (animate) anims.push(A.token(svg, 'w-cellbuf', UI.hex(isR ? op.readVal : op.val), { reverse: !isR, duration: 900 }));
            break;
          case 'dbus':
            on('b-data'); on('b-buf');
            if (animate) anims.push(A.token(svg, 'b-data', UI.hex(isR ? op.readVal : op.val), { reverse: isR, duration: 1300 }));
            break;
          case 'mdr': UI.$('#b-mdr', fig).classList.add('hl'); if (animate) A.flash(UI.$('#b-mdr', fig)); break;
          case 'done': UI.$('#mc-' + op.addr, fig).classList.add('hl'); if (animate) A.flash(UI.$('#mc-' + op.addr, fig)); break;
          default: break;
        }
        if (step.commit && animate) {
          const d = document.createElement('div');
          d.textContent = isR ? `خواندن MEM[${op.addr}] → ${S.toSigned(op.readVal, 16)}` : `نوشتن MEM[${op.addr}] ← ${S.toSigned(op.val, 16)}`;
          q('.log').prepend(d);
        }
        return Promise.all(anims);
      }

      q('.go').addEventListener('click', build);
      q('.rnd').addEventListener('click', () => { for (let i = 0; i < 256; i++) mem.data[i] = Math.random() < 0.3 ? Math.floor(Math.random() * 65536) : 0; op = null; stepper.set([], render); });
      q('.clr').addEventListener('click', () => { mem.clear(); op = null; stepper.set([], render); });
      q('.memview').addEventListener('click', (e) => {
        const c = e.target.closest('[data-addr]');
        if (c) { q('.addr').value = c.dataset.addr; op = null; stepper.set([], render, 'آدرس انتخاب شد. «شروع چرخهٔ گذرگاه» را بزنید.'); }
      });
      el.addEventListener('change', (e) => { if (e.target.matches('select, input')) { op = null; stepper.set([], render, '«شروع چرخهٔ گذرگاه» را بزنید.'); } });
      stepper.set([], render, '«شروع چرخهٔ گذرگاه» را بزنید تا خواندن یا نوشتن گام‌به‌گام اجرا شود.');
    },
  });
})();
