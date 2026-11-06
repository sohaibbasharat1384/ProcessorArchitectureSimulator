(function () {
  'use strict';
  const S = window.Sim, UI = window.UI, A = window.Anim;

  const OP_FA = {
    ADD: 'جمع (A + B)', SUB: 'تفریق (A − B = A + ~B + 1)', AND: 'و منطقی (AND)', OR: 'یا منطقی (OR)',
    XOR: 'یا انحصاری (XOR)', NOT: 'نقیض (NOT A)', SLT: 'کوچک‌تر از (A < B ؟ 1 : 0)', SHL: 'شیفت به چپ (A << B)',
    SHR: 'شیفت منطقی به راست (A >> B)', PASSB: 'عبور B',
  };
  const GATE = { AND: '&', OR: '≥1', XOR: '=1', NOT: '1', PASSB: 'B' };
  const GATE_FA = { AND: 'و', OR: 'یا', XOR: 'یای انحصاری', NOT: 'نقیض', PASSB: 'عبور' };
  const COL = 74, LM = 110, RM = 70;

  UI.register({
    id: 'alu', title: 'واحد محاسبه و منطق (ALU)',
    desc: 'جمع‌کنندهٔ ریپل‌کری متحرک، گیت‌های منطقی بیت‌به‌بیت، شیفت‌دهنده و تولید پرچم‌ها',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p><b>ALU</b> از مدارهای کوچک‌تر ساخته شده است: برای جمع و تفریق یک زنجیره از <b>تمام‌جمع‌کننده‌ها (FA)</b> که رقم نقلی را از بیت صفر به سمت بیت پرارزش
        منتقل می‌کنند، برای عملیات منطقی یک گیت برای هر بیت، و برای شیفت یک شیفت‌دهنده. تفریق با همان جمع‌کننده انجام می‌شود: بیت‌های B از گیت XOR با سیگنال SUB=1 می‌گذرند (معکوس می‌شوند)
        و رقم نقلی ورودی ۱ می‌شود. در پایان، پرچم‌ها از روی نتیجه و رقم‌های نقلی ساخته می‌شوند.</p></div>
        <div class="grid side">
          <div class="card">
            <h3>ورودی‌ها</h3>
            <div class="controls">
              <label>عرض (بیت)<select class="w"><option>4</option><option selected>8</option><option>16</option></select></label>
              <label>عملیات<select class="op">${S.ALU_OPS.map((o) => `<option value="${o}">${o} — ${OP_FA[o]}</option>`).join('')}</select></label>
            </div>
            <div class="controls">
              <label>A (دهدهی / 0x / 0b)<input type="text" class="a ltr" value="100" size="8"></label>
              <label>B<input type="text" class="b ltr" value="58" size="8"></label>
              <button class="btn rnd">تصادفی</button>
            </div>
            <dl class="kv sum"></dl>
            <h3 style="margin-top:14px">پرچم‌ها</h3>
            <div class="flags btn-row"></div>
          </div>
          <div class="card">
            <div class="st"></div>
            <div class="fig alu-fig" style="margin-top:10px"></div>
          </div>
        </div>`;
      const q = (s) => UI.$(s, el);
      const stepper = UI.stepper(q('.st'));
      let cfg = null;

      function build() {
        const w = +q('.w').value, op = q('.op').value;
        const a = UI.parseInput(q('.a').value), b = UI.parseInput(q('.b').value);
        const r = S.aluCompute(op, a, b, w);
        const arith = op === 'ADD' || op === 'SUB' || op === 'SLT';
        const chain = arith ? S.aluCompute(op === 'ADD' ? 'ADD' : 'SUB', a, b, w) : null;
        const shift = op === 'SHL' || op === 'SHR';
        cfg = { w, op, a: r.a, b: r.b, r, chain, arith, shift, sub: op !== 'ADD' && arith };
        q('.sum').innerHTML = `<dt>A</dt><dd>${r.a} · ${S.toSigned(r.a, w)} · ${UI.bin(r.a, w)}</dd>
          ${op !== 'NOT' ? `<dt>B</dt><dd>${r.b} · ${S.toSigned(r.b, w)} · ${UI.bin(r.b, w)}</dd>` : ''}
          <dt>نتیجه</dt><dd>${r.result} · ${S.toSigned(r.result, w)} · ${UI.bin(r.result, w)}</dd>`;
        q('.flags').innerHTML = Object.keys(r.flags).map((f) => `<span class="flag" data-f="${f}">${f}=?</span>`).join('');
        drawFigure();
        stepper.set(makeSteps(), render, 'دکمهٔ «گام بعدی» یا «پخش خودکار» را بزنید تا عملیات بیت‌به‌بیت اجرا شود.');
      }

      // ------------------------------------------------------------------ figure
      const cx = (i) => LM + (cfg.w - 1 - i) * COL + COL / 2;
      function drawFigure() {
        const { w, op, shift } = cfg;
        const W = LM + w * COL + RM;
        let s = `<svg viewBox="0 0 ${W} ${shift ? 240 : 330}">`;
        if (shift) {
          s += `<text class="t-muted" x="20" y="60">A</text><text class="t-muted" x="20" y="150">${op === 'SHL' ? '← شیفت' : 'شیفت →'}</text>
            <g class="shift-row"></g>
            <rect class="box cbox" x="${op === 'SHL' ? 8 : W - 58}" y="120" width="50" height="40" rx="6"/>
            <text x="${op === 'SHL' ? 33 : W - 33}" y="133" class="t-small">C</text><text class="cval t-mono" x="${op === 'SHL' ? 33 : W - 33}" y="150"></text>
            <text class="t-muted shift-note" x="${W / 2}" y="215"></text>`;
          s += '</svg>';
          q('.alu-fig').innerHTML = s;
          return;
        }
        const labels = [['A', 21], ['B', 51], [cfg.sub ? "B'" : 'B', 115], [cfg.arith ? '' : 'گیت', 155], ['S', 216]];
        if (op === 'NOT') labels.splice(1, 2);
        labels.forEach(([t, y]) => { s += `<text class="t-muted t-small" x="8" y="${y}" style="text-anchor:start">${t}</text>`; });
        if (cfg.sub) s += `<path class="wire ctl" id="w-subline" d="M${W - 10},84 H${cx(w - 1) - 14}"/><text class="t-small" x="${W - 30}" y="76">SUB=1</text>`;
        for (let i = 0; i < w; i++) {
          const x = cx(i);
          s += `<path class="wire" id="wa-${i}" d="M${x - 10},32 V130"/>`;
          if (op !== 'NOT') s += `<path class="wire" id="wb-${i}" d="M${x + 10},62 V130"/>`;
          s += `<path class="wire" id="ws-${i}" d="M${x},180 V205"/>`;
          if (cfg.arith) {
            const to = i === w - 1 ? 96 : cx(i + 1) + 26;
            s += `<path class="wire" id="wc-${i}" d="M${x - 26},155 H${to}"/>`;
          }
          s += cell('ca-' + i, x - 22, 10, 0);
          if (op !== 'NOT') s += cell('cb-' + i, x + 2, 40, 0, 20);
          if (cfg.sub) s += `<g class="gate" id="gx-${i}"><rect class="box" x="${x}" y="74" width="22" height="20" rx="4"/><text x="${x + 11}" y="85" class="t-small">⊕</text></g>`;
          if (cfg.sub || cfg.arith) s += cell('cbe-' + i, x + 2, 104, 0, 20);
          s += `<g class="unit" id="u-${i}"><rect class="box" x="${x - 26}" y="130" width="52" height="50" rx="7"/>
            <text x="${x}" y="150">${cfg.arith ? 'FA' : GATE[op]}</text><text class="t-small t-muted" x="${x}" y="169">${i}</text></g>`;
          s += cell('cs-' + i, x - 12, 205, 0, 24);
        }
        if (cfg.arith) {
          s += `<path class="wire" id="wc-in" d="M${W - 10},155 H${cx(0) + 26}"/><text class="t-small" x="${W - 32}" y="146">Cin=${cfg.sub ? 1 : 0}</text>`;
          s += `<rect class="box" id="cout" x="52" y="138" width="44" height="34" rx="6"/><text class="t-small" x="74" y="150">Cout</text><text class="t-mono coutv" x="74" y="164"></text>`;
        }
        // flags row
        const fl = ['Z', 'N', 'C', 'V'];
        fl.forEach((f, k) => {
          const x = W / 2 - 170 + k * 90;
          s += `<g class="flagbox" id="fb-${f}"><rect class="box" x="${x}" y="262" width="70" height="40" rx="8"/><text x="${x + 22}" y="282">${f}</text>
            <circle class="lamp" cx="${x + 50}" cy="282" r="9"/></g>`;
        });
        s += '</svg>';
        q('.alu-fig').innerHTML = s;
      }
      function cell(id, x, y, v, wd) {
        wd = wd || 24;
        return `<g class="bitg" id="${id}"><rect class="bitc" x="${x}" y="${y}" width="${wd}" height="22" rx="4"/><text class="t-mono" x="${x + wd / 2}" y="${y + 12}">${v}</text></g>`;
      }
      function setCell(id, v, on) {
        const g = UI.$('#' + id, q('.alu-fig'));
        if (!g) return;
        g.querySelector('text').textContent = v === null ? '?' : v;
        g.querySelector('rect').classList.toggle('one', v === 1 || v === '1');
        g.classList.toggle('dim', v === null);
        if (on !== undefined) g.classList.toggle('hl', !!on);
      }

      // ------------------------------------------------------------------ steps
      function makeSteps() {
        const { w, op, r, chain, a, b, shift } = cfg;
        const st = [];
        st.push({ kind: 'in', title: 'ورودی‌ها', text: `A = ${UI.bin(a, w)} (${a})${op !== 'NOT' ? ` و B = ${UI.bin(b, w)} (${b})` : ''} روی ورودی‌های ALU قرار می‌گیرند. سیگنال کنترل عملیات = ${op}.` });
        if (shift) {
          const s = b % 32, n = Math.min(s, w);
          if (n === 0) st.push({ kind: 'shift', k: 0, title: 'شیفت', text: 'مقدار شیفت صفر است؛ A بدون تغییر عبور می‌کند.' });
          for (let k = 1; k <= n; k++) {
            const prev = op === 'SHL' ? (a << (k - 1)) & S.maskOf(w) : a >>> (k - 1);
            const out = op === 'SHL' ? (prev >> (w - 1)) & 1 : prev & 1;
            st.push({ kind: 'shift', k, title: `شیفت ${k} از ${s}`, text: `همهٔ بیت‌ها یک خانه به ${op === 'SHL' ? 'چپ' : 'راست'} می‌روند. بیت ${out} از ${op === 'SHL' ? 'سمت چپ (MSB)' : 'سمت راست (LSB)'} بیرون می‌افتد و در C می‌نشیند و از سمت دیگر یک 0 وارد می‌شود.` });
          }
        } else if (cfg.arith) {
          if (cfg.sub) {
            st.push({ kind: 'inv', title: 'مکمل B', text: `چون عملیات ${op === 'SLT' ? 'SLT (که با تفریق کار می‌کند)' : 'تفریق'} است، سیگنال SUB = 1 به همهٔ گیت‌های XOR می‌رود: <span class="ltr">B' = B ⊕ 1 = ~B = ${UI.bin(chain.bEff, w)}</span>. رقم نقلی ورودی بیت صفر هم ۱ می‌شود؛ پس <span class="ltr">A + ~B + 1 = A − B</span>.` });
          }
          chain.chain.forEach((c) => {
            st.push({ kind: 'bit', i: c.bit, title: `تمام‌جمع‌کنندهٔ بیت ${c.bit}`, text: `ورودی‌ها: <span class="ltr">a=${c.a}, b'=${c.b}, Cin=${c.cin}</span>. مجموع: <span class="ltr">Sum = a ⊕ b' ⊕ Cin = ${c.sum}</span>؛ رقم نقلی خروجی: <span class="ltr">Cout = ab' + a·Cin + b'·Cin = ${c.cout}</span>${c.bit < w - 1 ? ` که به بیت ${c.bit + 1} می‌رود` : ' که Cout نهایی است'}.` });
          });
        } else {
          for (let i = 0; i < w; i++) {
            const ai = (a >> i) & 1, bi = (b >> i) & 1, ri = (r.result >> i) & 1;
            const expr = '<span class="ltr">' + (op === 'NOT' ? `NOT ${ai} = ${ri}` : op === 'PASSB' ? `b = ${ri}` : `${ai} ${op} ${bi} = ${ri}`) + '</span>';
            st.push({ kind: 'bit', i, title: `گیت بیت ${i}`, text: `گیت «${GATE_FA[op]}» بیت ${i}: ${expr}. هر بیت مستقل از بقیه محاسبه می‌شود و رقم نقلی ندارد.` });
          }
        }
        if (op === 'SLT') {
          const N = chain.flags.N, V = chain.flags.V;
          st.push({ kind: 'slt', title: 'نتیجهٔ SLT', text: `بیت علامت تفاضل N = ${N} و سرریز V = ${V}. A < B (باعلامت) دقیقاً وقتی است که N ⊕ V = 1. اینجا N ⊕ V = ${N ^ V}، پس نتیجه = ${r.result} (فقط بیت صفر).` });
        }
        const msb = w - 1;
        const fl = r.flags;
        st.push({ kind: 'flag', f: 'Z', title: 'پرچم Z', text: `همهٔ بیت‌های نتیجه وارد یک گیت NOR می‌شوند. Z = 1 فقط اگر همه صفر باشند. نتیجه ${r.result === 0 ? 'صفر است' : 'صفر نیست'} ⇒ Z = ${fl.Z}.` });
        st.push({ kind: 'flag', f: 'N', title: 'پرچم N', text: `N همان بیت پرارزش (بیت ${msb}) نتیجه است: N = ${fl.N}. در نمایش مکمل دو یعنی نتیجه ${fl.N ? 'منفی' : 'نامنفی'} است.` });
        let cText;
        if (op === 'ADD') cText = `C همان رقم نقلی خروجی آخرین تمام‌جمع‌کننده است: C = ${fl.C}${fl.C ? '؛ یعنی جمع بی‌علامت از ' + S.maskOf(w) + ' بیشتر شد.' : '.'}`;
        else if (op === 'SUB') cText = `C رقم نقلی خروجی آخرین FA است: C = ${fl.C}. در تفریق، C = 1 یعنی «قرض لازم نشد» (A ≥ B بی‌علامت).`;
        else if (shift) cText = `C آخرین بیتی است که بیرون افتاد: C = ${fl.C}.`;
        else cText = `این عملیات رقم نقلی تولید نمی‌کند: C = ${fl.C}.`;
        st.push({ kind: 'flag', f: 'C', title: 'پرچم C', text: cText });
        st.push({ kind: 'flag', f: 'V', title: 'پرچم V', text: op === 'ADD' || op === 'SUB'
          ? `سرریز باعلامت برابر است با رقم نقلی ورودی بیت ${msb} XOR رقم نقلی خروجی آن: <span class="ltr">V = ${chain.chain[msb].cin} ⊕ ${chain.chain[msb].cout} = ${fl.V}</span>.${fl.V ? ' دو عملوند هم‌علامت نتیجه‌ای با علامت مخالف ساختند.' : ''}`
          : `این عملیات سرریز باعلامت ندارد: V = ${fl.V}.` });
        st.push({ kind: 'done', title: 'پایان', text: `نتیجهٔ نهایی ${op}: ${UI.bin(r.result, w)} = ${r.result} (بی‌علامت) = ${S.toSigned(r.result, w)} (باعلامت).` });
        return st;
      }

      // ------------------------------------------------------------------ render
      function render(step, idx, animate) {
        const fig = q('.alu-fig');
        const steps = stepper.steps;
        const { w, op, chain, r, a, b, shift } = cfg;
        const done = (k) => steps.slice(0, idx + 1).filter(k);
        const flagsShown = done((s) => s.kind === 'flag').map((s) => s.f);
        UI.$$('.flag', el).forEach((f) => {
          const k = f.dataset.f, shown = flagsShown.includes(k);
          f.textContent = `${k}=${shown ? r.flags[k] : '?'}`;
          f.classList.toggle('on', shown && r.flags[k] === 1);
        });
        UI.$$('.flagbox', fig).forEach((g) => {
          const k = g.id.slice(3), shown = flagsShown.includes(k);
          g.querySelector('.lamp').classList.toggle('on', shown && r.flags[k] === 1);
          g.querySelector('.lamp').classList.toggle('off', shown && r.flags[k] === 0);
          g.classList.toggle('on', !!step && step.f === k);
        });
        UI.$$('.on', fig).forEach((e) => { if (!e.classList.contains('lamp') && !e.closest('.flagbox')) e.classList.remove('on'); });
        UI.$$('.hl', fig).forEach((e) => e.classList.remove('hl'));
        if (shift) return renderShift(step, idx, animate);

        const inputsOn = idx >= 0;
        const invDone = !cfg.sub || done((s) => s.kind === 'inv').length > 0;
        const bitsDone = done((s) => s.kind === 'bit').map((s) => s.i);
        for (let i = 0; i < w; i++) {
          setCell('ca-' + i, inputsOn ? (a >> i) & 1 : null);
          if (op !== 'NOT') setCell('cb-' + i, inputsOn ? (b >> i) & 1 : null);
          if (cfg.sub || cfg.arith) setCell('cbe-' + i, inputsOn && invDone ? (chain.bEff >> i) & 1 : null);
          const has = bitsDone.includes(i);
          const sumBit = cfg.arith ? chain.chain[i].sum : (r.result >> i) & 1;
          setCell('cs-' + i, has ? sumBit : null);
          if (cfg.arith) {
            const cw = UI.$('#wc-' + i, fig);
            cw.classList.toggle('done', has);
          }
        }
        if (cfg.arith) {
          const last = bitsDone.includes(w - 1);
          UI.$('.coutv', fig).textContent = last ? chain.chain[w - 1].cout : '?';
          UI.$('#wc-in', fig).classList.toggle('done', inputsOn);
        }
        if (!step) return;
        const anims = [];
        if (step.kind === 'in') {
          for (let i = 0; i < w; i++) { UI.$('#ca-' + i, fig).classList.add('hl'); if (op !== 'NOT') UI.$('#cb-' + i, fig).classList.add('hl'); }
        }
        if (step.kind === 'inv') {
          UI.$('#w-subline', fig).classList.add('on');
          for (let i = 0; i < w; i++) {
            UI.$('#gx-' + i, fig).classList.add('on');
            UI.$('#cbe-' + i, fig).classList.add('hl');
          }
          if (animate) anims.push(A.draw(UI.$('#w-subline', fig), 600));
        }
        if (step.kind === 'bit') {
          const i = step.i;
          UI.$('#u-' + i, fig).classList.add('on');
          ['wa-', 'wb-', 'ws-'].forEach((p) => { const e = UI.$('#' + p + i, fig); if (e) e.classList.add('on'); });
          UI.$('#ca-' + i, fig).classList.add('hl');
          if (UI.$('#cbe-' + i, fig)) UI.$('#cbe-' + i, fig).classList.add('hl'); else if (UI.$('#cb-' + i, fig)) UI.$('#cb-' + i, fig).classList.add('hl');
          UI.$('#cs-' + i, fig).classList.add('hl');
          if (cfg.arith) {
            const inW = i === 0 ? UI.$('#wc-in', fig) : UI.$('#wc-' + (i - 1), fig);
            inW.classList.add('on');
            UI.$('#wc-' + i, fig).classList.add('on');
          }
          if (animate) {
            const svg = UI.$('svg', fig);
            const mine = cfg;
            const seq = async () => {
              await Promise.all([A.token(svg, 'wa-' + i, (a >> i) & 1, { duration: 450, cls: 'addr' }),
                op !== 'NOT' && UI.$('#wb-' + i, fig) ? A.token(svg, 'wb-' + i, ((cfg.arith ? chain.bEff : b) >> i) & 1, { duration: 450, cls: 'addr' }) : null]);
              if (cfg !== mine) return;
              A.flash(UI.$('#u-' + i, fig));
              const sumBit = cfg.arith ? chain.chain[i].sum : (r.result >> i) & 1;
              const ps = [A.token(svg, 'ws-' + i, sumBit, { duration: 350 })];
              if (cfg.arith) ps.push(A.token(svg, 'wc-' + i, 'c=' + chain.chain[i].cout, { duration: 550, cls: 'ctl' }));
              await Promise.all(ps);
              A.flash(UI.$('#cs-' + i, fig));
            };
            anims.push(seq());
          }
        }
        if (step.kind === 'slt' || step.kind === 'done') for (let i = 0; i < w; i++) UI.$('#cs-' + i, fig).classList.add('hl');
        if (step.kind === 'slt') {
          for (let i = 0; i < w; i++) setCell('cs-' + i, (r.result >> i) & 1, true);
        }
        if (step.kind === 'done' && op === 'SLT') for (let i = 0; i < w; i++) setCell('cs-' + i, (r.result >> i) & 1, true);
        if (step.kind === 'flag') {
          const f = step.f;
          if (f === 'Z') for (let i = 0; i < w; i++) UI.$('#cs-' + i, fig).classList.add('hl');
          if (f === 'N') UI.$('#cs-' + (w - 1), fig).classList.add('hl');
          if (f === 'C' && cfg.arith) { UI.$('#wc-' + (w - 1), fig).classList.add('on'); UI.$('#cout', fig).classList.add('on'); }
          if (f === 'V' && cfg.arith) { UI.$('#wc-' + (w - 1), fig).classList.add('on'); (w > 1 ? UI.$('#wc-' + (w - 2), fig) : UI.$('#wc-in', fig)).classList.add('on'); }
          if (animate) A.flash(UI.$('#fb-' + f, fig));
          if (op === 'SLT') for (let i = 0; i < w; i++) setCell('cs-' + i, (r.result >> i) & 1);
        }
        return Promise.all(anims);
      }

      function shiftValue(k) {
        const { op, a, w } = cfg;
        return op === 'SHL' ? (a * Math.pow(2, k)) % Math.pow(2, w) : Math.floor(a / Math.pow(2, k));
      }
      function drawShiftRow(v, offset, incoming) {
        const fig = q('.alu-fig');
        const row = UI.$('.shift-row', fig);
        let s = '';
        for (let i = 0; i < cfg.w; i++) {
          const x = cx(i);
          const bit = (v >> i) & 1;
          const isIn = incoming !== null && i === incoming;
          s += `<g class="bitg${isIn ? ' hl' : ''}"><rect class="bitc${bit ? ' one' : ''}" x="${x - 14}" y="${offset}" width="28" height="28" rx="5"/><text class="t-mono" x="${x}" y="${offset + 15}">${bit}</text>
            <text class="t-small t-muted" x="${x}" y="${offset + 42}">${i}</text></g>`;
        }
        row.innerHTML = s;
        return row;
      }
      function renderShift(step, idx, animate) {
        const fig = q('.alu-fig');
        const { op, w } = cfg;
        const k = step && step.kind !== 'in' ? Math.max(...stepper.steps.slice(0, idx + 1).filter((s) => s.kind === 'shift').map((s) => s.k).concat([0])) : 0;
        const v = shiftValue(k);
        const dropped = k > 0 ? (op === 'SHL' ? (shiftValue(k - 1) >> (w - 1)) & 1 : shiftValue(k - 1) & 1) : null;
        UI.$('.cval', fig).textContent = dropped === null ? '–' : dropped;
        UI.$('.shift-note', fig).textContent = idx < 0 ? '' : `پس از ${k} شیفت: ${UI.bin(v, w)} = ${v}`;
        const incoming = k > 0 ? (op === 'SHL' ? 0 : w - 1) : null;
        if (step && step.kind === 'shift' && step.k > 0 && animate) {
          const prev = shiftValue(step.k - 1);
          const row = drawShiftRow(prev, 120, null);
          const dir = op === 'SHL' ? -COL : COL;
          const mine = cfg;
          return A.tween(600, (e) => row.setAttribute('transform', `translate(${dir * e},0)`)).then(() => {
            if (cfg !== mine) return;
            row.removeAttribute('transform');
            drawShiftRow(v, 120, incoming);
            A.flash(UI.$('.cbox', fig));
          });
        }
        drawShiftRow(idx < 0 ? 0 : v, 120, incoming);
        if (idx < 0) UI.$$('.shift-row text.t-mono', fig).forEach((t) => { t.textContent = '?'; });
        return null;
      }

      el.addEventListener('change', (e) => { if (e.target.matches('select, input')) build(); });
      q('.rnd').addEventListener('click', () => {
        const w = +q('.w').value, m = Math.pow(2, w);
        q('.a').value = Math.floor(Math.random() * m);
        q('.b').value = q('.op').value.startsWith('SH') ? Math.floor(Math.random() * 4) + 1 : Math.floor(Math.random() * m);
        build();
      });
      build();
    },
  });
})();
