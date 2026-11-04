(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  const OP_FA = {
    ADD: 'جمع (A + B)', SUB: 'تفریق (A − B = A + ~B + 1)', AND: 'و منطقی (AND)', OR: 'یا منطقی (OR)',
    XOR: 'یا انحصاری (XOR)', NOT: 'نقیض (NOT A)', SLT: 'کوچک‌تر از (A < B ؟ 1 : 0)', SHL: 'شیفت به چپ (A << B)',
    SHR: 'شیفت منطقی به راست (A >> B)', PASSB: 'عبور B',
  };
  const FLAG_FA = { Z: 'صفر (Zero)', N: 'منفی (Negative)', C: 'رقم نقلی (Carry)', V: 'سرریز (Overflow)' };

  UI.register({
    id: 'alu', title: 'واحد محاسبه و منطق (ALU)',
    desc: 'عملیات حسابی و منطقی، جمع‌کنندهٔ ریپل‌کری بیت‌به‌بیت و پرچم‌های Z/N/C/V',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p><b>ALU</b> قلب محاسباتی پردازنده است: دو عملوند A و B و یک کد عملیات می‌گیرد و نتیجه به همراه
        <b>پرچم‌ها</b> را تولید می‌کند. تفریق با جمع A و مکمل دوی B انجام می‌شود. جمع‌کنندهٔ ریپل‌کری رقم نقلی را بیت‌به‌بیت از راست به چپ منتقل می‌کند.</p></div>
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
            </div>
            <div class="btn-row"><button class="btn primary anim">شبیه‌سازی بیت‌به‌بیت ▶</button><button class="btn rnd">مقادیر تصادفی</button></div>
            <h3 style="margin-top:14px">پرچم‌ها</h3>
            <div class="flags btn-row"></div>
            <p class="muted small flag-explain" style="margin-top:8px"></p>
          </div>
          <div class="card">
            <h3>نمایش دودویی</h3>
            <div class="view"></div>
            <h3 style="margin-top:14px">زنجیرهٔ رقم نقلی (Ripple-Carry)</h3>
            <div class="chain table-wrap"></div>
          </div>
        </div>`;

      const q = (s) => UI.$(s, el);
      let animBit = null, animTimer = null;

      function render() {
        const w = +q('.w').value, op = q('.op').value;
        const a = UI.parseInput(q('.a').value), b = UI.parseInput(q('.b').value);
        const r = S.aluCompute(op, a, b, w);
        const show = (label, v, extra) => `<div style="margin-bottom:8px"><div class="muted small">${label}</div>${UI.bitsHTML(v, w)}
          <span class="small muted" style="margin-inline-start:10px">بی‌علامت: <b class="ltr">${v}</b> · باعلامت: <b class="ltr">${S.toSigned(v, w)}</b> · هگز: <b class="ltr">${UI.hex(v, Math.ceil(w / 4))}</b></span>${extra || ''}</div>`;
        let html = show('A', r.a);
        if (op !== 'NOT') html += show(op === 'SUB' ? 'B' : 'B', r.b);
        if (op === 'SUB') html += show('~B (مکمل یک B؛ رقم نقلی ورودی = 1)', r.bEff);
        html += `<div style="border-top:2px solid var(--border);padding-top:8px">${show('نتیجه (' + op + ')', r.result)}</div>`;
        q('.view').innerHTML = html;

        q('.flags').innerHTML = Object.keys(r.flags).map((f) => `<span class="flag${r.flags[f] ? ' on' : ''}" title="${FLAG_FA[f]}">${f}=${r.flags[f]}</span>`).join('');
        const ex = [];
        if (r.flags.Z) ex.push('نتیجه صفر است ⇒ Z=1.');
        if (r.flags.N) ex.push('بیت پرارزش نتیجه 1 است ⇒ در نمایش باعلامت، منفی است.');
        if (r.flags.C && (op === 'ADD')) ex.push('جمع بی‌علامت از ' + (Math.pow(2, w) - 1) + ' بیشتر شد ⇒ رقم نقلی خروجی.');
        if (op === 'SUB') ex.push(r.flags.C ? 'C=1 یعنی در تفریق بی‌علامت «قرض» لازم نشد (A ≥ B).' : 'C=0 یعنی A < B (بی‌علامت) و قرض لازم شد.');
        if (r.flags.V) ex.push('سرریز باعلامت: دو عملوند هم‌علامت، نتیجهٔ با علامت مخالف ساختند.');
        q('.flag-explain').textContent = ex.join(' ');

        if (r.chain) {
          const cols = r.chain.slice().reverse();
          const cell = (c, v, cls) => {
            const reached = animBit === null || c.bit <= animBit;
            const cur = animBit === c.bit;
            return `<td style="${cur ? 'background:var(--accent-soft);font-weight:700' : ''}${reached ? '' : ';opacity:.25'}" class="${cls || ''}">${reached ? v : '?'}</td>`;
          };
          q('.chain').innerHTML = `<table class="data ltr"><thead><tr><th>bit</th>${cols.map((c) => `<th>${c.bit}</th>`).join('')}</tr></thead><tbody>
            <tr><th>Cin</th>${cols.map((c) => cell(c, c.cin)).join('')}</tr>
            <tr><th>A</th>${cols.map((c) => `<td>${c.a}</td>`).join('')}</tr>
            <tr><th>${op === 'SUB' ? '~B' : 'B'}</th>${cols.map((c) => `<td>${c.b}</td>`).join('')}</tr>
            <tr><th>Sum</th>${cols.map((c) => cell(c, c.sum)).join('')}</tr>
            <tr><th>Cout</th>${cols.map((c) => cell(c, c.cout)).join('')}</tr>
          </tbody></table>
          <p class="muted small">هر ستون یک «تمام‌جمع‌کننده» است: Sum = A ⊕ B ⊕ Cin و Cout = AB + ACin + BCin. خروجی Cout هر بیت، Cin بیت بعدی است؛
          بنابراین تأخیر این جمع‌کننده با تعداد بیت‌ها رشد می‌کند.</p>`;
        } else {
          q('.chain').innerHTML = '<p class="muted">زنجیرهٔ رقم نقلی فقط برای ADD و SUB استفاده می‌شود. عملیات منطقی روی هر بیت مستقل انجام می‌شوند.</p>';
        }
      }

      function animate() {
        clearInterval(animTimer);
        const op = q('.op').value;
        if (op !== 'ADD' && op !== 'SUB') { q('.op').value = 'ADD'; }
        const w = +q('.w').value;
        animBit = -1;
        render();
        animTimer = setInterval(() => {
          animBit++;
          if (animBit >= w) { clearInterval(animTimer); animBit = null; }
          render();
        }, 450);
      }

      el.addEventListener('input', () => { clearInterval(animTimer); animBit = null; render(); });
      el.addEventListener('change', () => { clearInterval(animTimer); animBit = null; render(); });
      q('.anim').addEventListener('click', animate);
      q('.rnd').addEventListener('click', () => {
        const w = +q('.w').value, m = Math.pow(2, w);
        q('.a').value = Math.floor(Math.random() * m);
        q('.b').value = Math.floor(Math.random() * m);
        animBit = null; render();
      });
      render();
    },
  });
})();
