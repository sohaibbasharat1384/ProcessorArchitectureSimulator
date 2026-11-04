(function () {
  'use strict';
  const S = window.Sim, UI = window.UI, A = window.Anim;

  const EXAMPLES = ['ADD R1, R2, R3', 'SUB R4, R4, R1', 'SLT R5, R1, R2', 'ADDI R1, R1, -1', 'LI R2, 100', 'LW R3, 4(R1)', 'SW R3, 0(R2)', 'BEQ R1, R0, 5', 'BNE R2, R3, -4', 'JMP 20', 'NOP', 'HALT'];
  const DEC = [['NOP', 0], ['R-type', 1], ['ADDI', 2], ['LI', 3], ['LW', 4], ['SW', 5], ['BEQ', 6], ['BNE', 7], ['JMP', 8], ['HALT', 15]];
  const SIGS = ['regWrite', 'reg2Sel', 'aluSrc', 'memRead', 'memWrite', 'memToReg', 'branch', 'jump', 'halt'];
  const DY = (k) => 160 + k * 30, SX = (j) => 430 + j * 52;
  const sample = { 'R-type': 'ADD R1,R1,R1', NOP: 'NOP', ADDI: 'ADDI R1,R1,1', LI: 'LI R1,1', LW: 'LW R1,0(R1)', SW: 'SW R1,0(R1)', BEQ: 'BEQ R1,R1,0', BNE: 'BNE R1,R1,0', JMP: 'JMP 0', HALT: 'HALT' };
  const ctrlOf = (name) => S.control(S.decode(S.assemble(sample[name]).words[0]));

  function reason(k, d, c) {
    const n = d.name, v = c[k];
    const R = d.format === 'R';
    switch (k) {
      case 'regWrite': return v ? `${n} نتیجه را در ثبات rd می‌نویسد.` : `${n} هیچ ثباتی را تغییر نمی‌دهد${n === 'SW' ? ' (فقط حافظه را می‌نویسد)' : ''}.`;
      case 'reg2Sel': return v ? `${n} ثبات دوم را از میدان rd می‌خواند (${n === 'SW' ? 'داده‌ای که باید ذخیره شود' : 'عملوند مقایسه'}).` : R ? 'ثبات دوم از میدان rt خوانده می‌شود.' : 'پورت دوم استفاده نمی‌شود؛ مقدار پیش‌فرض 0.';
      case 'aluSrc': return v ? `ورودی دوم ALU باید مقدار فوری باشد (${n === 'LI' ? 'خود مقدار' : n === 'ADDI' ? 'عدد ثابت' : 'جابه‌جایی آدرس'}).` : R || c.branch ? 'ورودی دوم ALU از ثبات دوم می‌آید.' : 'از ALU استفادهٔ مهمی نمی‌شود.';
      case 'memRead': return v ? 'دستور بارگذاری است؛ باید از حافظهٔ داده بخواند.' : 'از حافظهٔ داده خوانده نمی‌شود.';
      case 'memWrite': return v ? 'دستور ذخیره است؛ باید در حافظهٔ داده بنویسد.' : 'در حافظه نوشته نمی‌شود (این سیگنال باید حتماً صفر باشد تا حافظه خراب نشود).';
      case 'memToReg': return v ? 'مقدار نوشته‌شده در ثبات از حافظه می‌آید، نه از ALU.' : c.regWrite ? 'مقدار نوشته‌شده در ثبات نتیجهٔ ALU است.' : 'چون regWrite = 0 است، این سیگنال اهمیتی ندارد.';
      case 'branch': return v ? `${n} پرش شرطی است (${c.branchNe ? 'اگر نامساوی' : 'اگر مساوی'})؛ نتیجهٔ ALU (پرچم Z) PC بعدی را تعیین می‌کند.` : 'پرش شرطی نیست.';
      case 'jump': return v ? 'پرش غیرشرطی: PC بعدی همان میدان آدرس است.' : 'پرش غیرشرطی نیست.';
      case 'halt': return v ? 'پردازنده باید متوقف شود.' : 'اجرا ادامه می‌یابد.';
      default: return '';
    }
  }

  function figure() {
    let s = '<svg viewBox="0 0 1000 600">';
    s += '<text class="t-small t-muted" x="230" y="36">IR</text>';
    for (let i = 15; i >= 0; i--) s += `<g class="irbit" id="ib-${i}"><rect class="bitc" x="${260 + (15 - i) * 30}" y="20" width="26" height="28" rx="4"/><text class="t-mono" x="${273 + (15 - i) * 30}" y="35"></text>
      <text class="t-small t-muted" x="${273 + (15 - i) * 30}" y="60">${i}</text></g>`;
    s += '<g class="irfields"></g>';
    s += `<path class="wire" id="w-op" d="M318,66 V100 H270 V130"/>`;
    s += `<path class="wire" id="w-funct" d="M${273 + 14 * 30},66 V110 H935 V478"/>`;
    s += `<g id="b-dec"><rect class="box" x="200" y="130" width="140" height="${DY(DEC.length - 1) - 100}" rx="8"/><text x="270" y="148" class="t-small">رمزگشای opcode</text><text x="270" y="${DY(DEC.length - 1) + 20}" class="t-small t-muted">4 → 16</text></g>`;
    DEC.forEach(([name, code], k) => {
      s += `<text class="t-small t-mono" x="${212}" y="${DY(k)}" style="text-anchor:start">${code.toString(2).padStart(4, '0')}</text>`;
      s += `<path class="wire decline" id="dl-${k}" d="M340,${DY(k)} H${SX(SIGS.length - 1) + 20}"/>`;
      s += `<text class="t-small dln" x="346" y="${DY(k) - 7}" style="text-anchor:start">${name}</text>`;
    });
    SIGS.forEach((k, j) => {
      s += `<path class="wire sigline" id="sl-${k}" d="M${SX(j)},${DY(0) - 14} V490"/>`;
      s += `<text class="t-small t-mono" transform="translate(${SX(j) + 4},${DY(0) - 20}) rotate(-40)" style="text-anchor:start">${k}</text>`;
      s += `<g class="sigout" id="so-${k}"><circle class="lamp" cx="${SX(j)}" cy="505" r="11"/><text class="t-mono t-small" x="${SX(j)}" y="506"></text></g>`;
      DEC.forEach(([name], kk) => { if (ctrlOf(name)[k]) s += `<circle class="dot" id="dot-${kk}-${k}" cx="${SX(j)}" cy="${DY(kk)}" r="5"/>`; });
    });
    s += `<g id="b-aluc"><rect class="box" x="880" y="478" width="110" height="56" rx="8"/><text x="935" y="494" class="t-small">کنترل ALU</text><text class="t-mono v" x="935" y="516"></text></g>`;
    s += `<path class="wire" id="w-raluc" d="M${SX(SIGS.length - 1) + 20},${DY(1)} H905 V478"/>`;
    s += '<text class="t-small t-muted" x="640" y="560">هر نقطه یعنی «این خروجی رمزگشا این سیگنال را ۱ می‌کند» (یک ماتریس OR، مانند PLA یا ROM کنترل)</text>';
    return s + '</svg>';
  }

  UI.register({
    id: 'control', title: 'واحد کنترل و رمزگشایی',
    desc: 'رمزگشای opcode، ماتریس سیگنال‌ها و تولید تک‌تک سیگنال‌های کنترلی با دلیل',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p><b>واحد کنترل</b> یک مدار ترکیبی (Hardwired) است: <b>رمزگشای opcode</b> چهار بیت [15:12] را می‌گیرد و فقط یکی از خروجی‌هایش را فعال می‌کند.
        هر سیگنال کنترلی، OR خروجی‌هایی از رمزگشاست که به آن «وصل» شده‌اند (نقطه‌ها در ماتریس). برای دستورهای R-type، واحد جداگانهٔ «کنترل ALU» از روی funct عملیات را مشخص می‌کند.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="controls">
            <label style="flex:1 1 200px">اسمبلی<input type="text" class="asm ltr" value="LW R3, 4(R1)"></label>
            <label>یا کد هگز<input type="text" class="hexin ltr" placeholder="0x48C4" size="8"></label>
            <button class="btn primary go">شبیه‌سازی رمزگشایی</button>
          </div>
          <div class="btn-row ex">${EXAMPLES.map((x) => `<button class="btn small" data-x="${x}"><span class="ltr">${x}</span></button>`).join('')}</div>
          <div class="err e" style="margin-top:6px"></div>
          <div class="st" style="margin-top:10px"></div>
        </div>
        <div class="card"><div class="fig ctl-fig">${figure()}</div></div>
        <div class="card" style="margin-top:16px"><h3>جدول درستی واحد کنترل</h3><div class="table-wrap truth"></div></div>`;
      const q = (s) => UI.$(s, el);
      const fig = q('.ctl-fig'), svg = UI.$('svg', fig);
      const stepper = UI.stepper(q('.st'));
      let cur = null;

      function truth(sel) {
        const keys = S.CONTROL_SIGNALS.map((s) => s.key);
        q('.truth').innerHTML = `<table class="data ltr"><thead><tr><th>instr</th><th>opcode</th>${keys.map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>
          ${['ADD', 'SUB', 'AND', 'OR', 'XOR', 'SLT', 'SHL', 'SHR', 'ADDI', 'LI', 'LW', 'SW', 'BEQ', 'BNE', 'JMP', 'HALT', 'NOP'].map((n) => {
            const src = S.R_FUNCTS.includes(n) ? `${n} R1,R1,R1` : sample[n];
            const w = S.assemble(src).words[0], c = S.control(S.decode(w));
            return `<tr style="${n === sel ? 'background:var(--accent-soft);font-weight:700' : ''}"><td>${n}</td><td>${UI.bin(w >> 12, 4)}${(w >> 12) === 1 ? '/' + UI.bin(w & 7, 3) : ''}</td>${keys.map((k) => `<td><span class="sig ${k === 'aluOp' || c[k] ? 'on' : 'off'}">${c[k]}</span></td>`).join('')}</tr>`;
          }).join('')}</tbody></table>`;
      }

      function build(word) {
        const d = S.decode(word), c = S.control(d);
        const k = DEC.findIndex(([, code]) => code === d.op);
        cur = { word, d, c, k: k < 0 ? 0 : k };
        q('.hexin').value = UI.hex(word);
        truth(d.name);
        const fields = S.fieldsOf(d);
        const st = [];
        st.push({ k: 'ir', title: 'ثبات دستور', text: `دستور «${S.disassemble(word)}» = ${UI.hex(word)} در IR است. میدان‌ها: ${fields.map((f) => `${f.name}=${f.bits}`).join('، ')}.` });
        st.push({ k: 'op', title: 'جدا کردن opcode', text: `چهار بیت بالا [15:12] = ${UI.bin(d.op, 4)} به ورودی رمزگشای opcode می‌روند.` });
        st.push({ k: 'dec', title: 'رمزگشایی', text: d.illegal ? `opcode ${UI.bin(d.op, 4)} تعریف نشده است؛ هیچ خط شناخته‌شده‌ای فعال نمی‌شود و دستور مثل NOP رفتار می‌کند.`
          : `رمزگشا از ۱۶ خروجی فقط خروجی شمارهٔ ${d.op} («${DEC[cur.k][0]}») را ۱ می‌کند؛ بقیه صفرند.` });
        SIGS.forEach((key) => {
          st.push({ k: 'sig', key, title: `${key} = ${c[key]}`, text: `${c[key] ? 'روی ستون این سیگنال، در محل خط فعال نقطهٔ اتصال هست ⇒ ۱.' : 'روی ستون این سیگنال در محل خط فعال اتصالی نیست ⇒ ۰.'} ${reason(key, d, c)}` });
        });
        if (d.name !== 'NOP' && !c.jump && !c.halt) {
          st.push({ k: 'alu', title: `aluOp = ${c.aluOp}`, text: d.format === 'R'
            ? `دستور R-type است، پس کنترل ALU به میدان funct = ${UI.bin(d.funct, 3)} نگاه می‌کند ⇒ عملیات ${c.aluOp}.`
            : `برای ${d.name}، کنترل ALU عملیات ${c.aluOp} را انتخاب می‌کند${c.memRead || c.memWrite ? ' (جمع پایه و جابه‌جایی برای ساختن آدرس)' : c.branch ? ' (تفریق برای مقایسه)' : c.aluOp === 'PASSB' ? ' (عبور مقدار فوری)' : ''}.` });
        }
        const routes = [];
        if (c.regWrite) routes.push(`rd = R${d.rd} ← شمارهٔ ثبات مقصد`);
        if (c.useA) routes.push(`rs = R${d.rs} ← پورت خواندن ۱`);
        if (c.useB) routes.push(`${d.format === 'R' ? 'rt = R' + d.rt : 'rd = R' + d.rd} ← پورت خواندن ۲`);
        if (d.format === 'I' || d.format === 'L') routes.push(`imm = ${d.imm} ← واحد گسترش علامت`);
        if (d.format === 'J') routes.push(`addr = ${d.addr} ← مقصد پرش`);
        st.push({ k: 'done', title: 'پایان', text: routes.length ? `همزمان، میدان‌های دیگر مستقیم به مسیر داده می‌روند: ${routes.join('؛ ')}.` : 'این دستور به میدان دیگری نیاز ندارد.' });
        stepper.set(st, render);
        stepper.next();
      }

      function render(step, idx, animate) {
        UI.$$('.on', fig).forEach((e) => e.classList.remove('on'));
        UI.$$('.hl', fig).forEach((e) => e.classList.remove('hl'));
        UI.$$('.dot', fig).forEach((e) => e.classList.remove('act'));
        UI.$$('.sigout', fig).forEach((g) => { g.querySelector('text').textContent = ''; g.querySelector('.lamp').classList.remove('on', 'off'); });
        UI.$('#b-aluc .v', fig).textContent = '';
        if (!cur) return;
        const { word, d, c, k } = cur;
        const list = stepper.steps.slice(0, idx + 1);
        const has = (x) => list.some((s) => s.k === x);
        const fieldOf = (i) => S.fieldsOf(d).find((f) => i <= f.hi && i >= f.lo);
        for (let i = 0; i < 16; i++) {
          const g = UI.$('#ib-' + i, fig), b = (word >> i) & 1;
          g.querySelector('text').textContent = idx >= 0 ? b : '';
          g.querySelector('rect').classList.toggle('one', idx >= 0 && b === 1);
          g.setAttribute('class', 'irbit f-' + (idx >= 0 ? fieldOf(i).name : 'none'));
        }
        if (has('dec') && !d.illegal) UI.$('#dl-' + k, fig).classList.add('on');
        list.filter((s) => s.k === 'sig').forEach((s) => {
          const g = UI.$('#so-' + s.key, fig);
          g.querySelector('text').textContent = c[s.key];
          g.querySelector('.lamp').classList.add(c[s.key] ? 'on' : 'off');
          if (c[s.key]) { UI.$('#sl-' + s.key, fig).classList.add('on'); const dt = UI.$(`#dot-${k}-${s.key}`, fig); if (dt) dt.classList.add('act'); }
        });
        if (has('alu')) { UI.$('#b-aluc .v', fig).textContent = c.aluOp; UI.$('#b-aluc', fig).classList.add('on'); }
        if (!step) return;
        const anims = [];
        if (step.k === 'op') {
          for (let i = 12; i < 16; i++) UI.$('#ib-' + i, fig).classList.add('hl');
          UI.$('#w-op', fig).classList.add('on'); UI.$('#b-dec', fig).classList.add('on');
          if (animate) anims.push(A.token(svg, 'w-op', UI.bin(d.op, 4), { cls: 'addr', duration: 700 }));
        }
        if (step.k === 'dec') { UI.$('#b-dec', fig).classList.add('on'); if (animate && !d.illegal) anims.push(A.draw(UI.$('#dl-' + k, fig), 700)); }
        if (step.k === 'sig') {
          const g = UI.$('#so-' + step.key, fig);
          g.classList.add('hl');
          if (animate) {
            if (c[step.key]) anims.push(A.draw(UI.$('#sl-' + step.key, fig), 450));
            A.flash(g);
          }
        }
        if (step.k === 'alu') {
          if (d.format === 'R') { for (let i = 0; i < 3; i++) UI.$('#ib-' + i, fig).classList.add('hl'); UI.$('#w-funct', fig).classList.add('on'); UI.$('#w-raluc', fig).classList.add('on'); if (animate) anims.push(A.token(svg, 'w-funct', 'funct=' + UI.bin(d.funct, 3), { cls: 'addr', duration: 1000 })); }
          if (animate) A.flash(UI.$('#b-aluc', fig));
        }
        if (step.k === 'ir' && animate) UI.$$('.irbit', fig).forEach((g) => A.flash(g));
        return Promise.all(anims);
      }

      function fromAsm(start) {
        const r = S.assemble(q('.asm').value);
        q('.e').textContent = r.errors.map((e) => e.msg).join(' ');
        if (r.ok && r.listing.length) { if (start) build(r.listing[0].word); else { cur = null; q('.hexin').value = UI.hex(r.listing[0].word); stepper.set([], render, '«شبیه‌سازی رمزگشایی» را بزنید.'); } }
      }
      q('.go').addEventListener('click', () => fromAsm(true));
      q('.asm').addEventListener('input', () => fromAsm(false));
      q('.hexin').addEventListener('change', () => {
        const w = UI.parseInput(q('.hexin').value.startsWith('0x') ? q('.hexin').value : '0x' + q('.hexin').value) & 0xFFFF;
        q('.asm').value = S.disassemble(w); q('.e').textContent = ''; build(w);
      });
      q('.ex').addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) { q('.asm').value = b.dataset.x; fromAsm(true); } });
      truth(null);
      fromAsm(true);
    },
  });
})();
