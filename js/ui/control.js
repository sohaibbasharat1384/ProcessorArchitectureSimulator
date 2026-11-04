(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  const EXAMPLES = ['ADD R1, R2, R3', 'SUB R4, R4, R1', 'SLT R5, R1, R2', 'ADDI R1, R1, -1', 'LI R2, 100', 'LW R3, 4(R1)', 'SW R3, 0(R2)', 'BEQ R1, R0, 5', 'BNE R2, R3, -4', 'JMP 20', 'NOP', 'HALT'];

  UI.register({
    id: 'control', title: 'واحد کنترل و رمزگشایی',
    desc: 'تبدیل دستور ماشین به میدان‌های بیتی و سیگنال‌های کنترلی مسیر داده',
    init(el) {
      el.innerHTML = `
        <div class="lead"><p><b>واحد کنترل</b> با نگاه به opcode (و funct در دستورهای R-type) تعیین می‌کند که هر بخش مسیر داده چه کند:
        کدام ورودی به ALU برود، ALU چه عملیاتی انجام دهد، آیا حافظه خوانده یا نوشته شود و آیا نتیجه در ثبات ذخیره شود. این واحد در این طراحی
        «سیم‌بندی‌شده» (Hardwired) است: یک مدار ترکیبی که از بیت‌های دستور، سیگنال‌ها را می‌سازد.</p></div>
        <div class="grid two">
          <div class="card">
            <h3>دستور</h3>
            <div class="controls">
              <label style="flex:1 1 200px">اسمبلی<input type="text" class="asm ltr" value="LW R3, 4(R1)"></label>
              <label>یا کد هگز<input type="text" class="hexin ltr" placeholder="0x48C4" size="8"></label>
            </div>
            <div class="btn-row ex">${EXAMPLES.map((x) => `<button class="btn small" data-x="${x}"><span class="ltr">${x}</span></button>`).join('')}</div>
            <div class="err e" style="margin-top:6px"></div>
            <h3 style="margin-top:14px">کدگذاری</h3>
            <div class="enc"></div>
          </div>
          <div class="card">
            <h3>سیگنال‌های کنترلی</h3>
            <div class="sigs"></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <h3>جدول درستی واحد کنترل</h3>
          <div class="table-wrap truth"></div>
        </div>`;
      const q = (s) => UI.$(s, el);

      function show(word) {
        const d = S.decode(word), c = S.control(d);
        q('.enc').innerHTML = `<p>${UI.fieldsHTML(word)}</p>
          <dl class="kv"><dt>هگز</dt><dd>${UI.hex(word)}</dd><dt>دستور</dt><dd>${S.disassemble(word)}</dd><dt>قالب</dt><dd>${d.format}-type</dd>
          <dt>عملکرد</dt><dd>${UI.esc((S.INSTRUCTIONS[d.name] || {}).fa || '')}</dd>
          ${d.format !== 'N' && d.format !== 'J' ? `<dt>rd / rs${d.format === 'R' ? ' / rt' : ''}</dt><dd>R${d.rd}${d.format !== 'L' ? ' / R' + d.rs : ''}${d.format === 'R' ? ' / R' + d.rt : ''}</dd>` : ''}
          ${d.format === 'I' || d.format === 'L' ? `<dt>مقدار فوری (گسترش علامت)</dt><dd>${d.imm} → ${UI.bin(d.imm & 0xFFFF, 16)}</dd>` : ''}</dl>
          ${d.illegal ? '<p class="err">opcode تعریف‌نشده؛ مانند NOP رفتار می‌شود.</p>' : ''}`;
        q('.sigs').innerHTML = `<table class="data"><tbody>${S.CONTROL_SIGNALS.map((s) => {
          const v = c[s.key];
          const on = s.key === 'aluOp' ? true : !!v;
          const label = s.key === 'branch' && c.branch ? (c.branchNe ? '1 (≠)' : '1 (=)') : v;
          return `<tr><td class="ltr" style="text-align:left">${s.key}</td><td><span class="sig ${on ? 'on' : 'off'}">${label}</span></td><td style="text-align:start">${s.fa}</td></tr>`;
        }).join('')}</tbody></table>`;
        q('.hexin').value = UI.hex(word);
      }
      function fromAsm() {
        const r = S.assemble(q('.asm').value);
        q('.e').textContent = r.errors.map((e) => e.msg).join(' ');
        if (r.ok && r.listing.length) show(r.listing[0].word);
      }
      q('.asm').addEventListener('input', fromAsm);
      q('.hexin').addEventListener('change', () => {
        const w = UI.parseInput(q('.hexin').value.startsWith('0x') ? q('.hexin').value : '0x' + q('.hexin').value) & 0xFFFF;
        q('.asm').value = S.disassemble(w); q('.e').textContent = ''; show(w);
      });
      q('.ex').addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) { q('.asm').value = b.dataset.x; fromAsm(); } });

      const names = ['ADD', 'SUB', 'AND', 'SLT', 'ADDI', 'LI', 'LW', 'SW', 'BEQ', 'BNE', 'JMP', 'HALT', 'NOP'];
      const sample = { ADD: 'ADD R1,R1,R1', SUB: 'SUB R1,R1,R1', AND: 'AND R1,R1,R1', SLT: 'SLT R1,R1,R1', ADDI: 'ADDI R1,R1,1', LI: 'LI R1,1', LW: 'LW R1,0(R1)', SW: 'SW R1,0(R1)', BEQ: 'BEQ R1,R1,0', BNE: 'BNE R1,R1,0', JMP: 'JMP 0', HALT: 'HALT', NOP: 'NOP' };
      const keys = S.CONTROL_SIGNALS.map((s) => s.key);
      q('.truth').innerHTML = `<table class="data ltr"><thead><tr><th>instr</th><th>opcode</th>${keys.map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>
        ${names.map((n) => {
          const w = S.assemble(sample[n]).words[0], c = S.control(S.decode(w));
          return `<tr><td>${n}</td><td>${UI.bin(w >> 12, 4)}${(w >> 12) === 1 ? '/' + UI.bin(w & 7, 3) : ''}</td>${keys.map((k) => `<td><span class="sig ${k === 'aluOp' || c[k] ? 'on' : 'off'}">${c[k]}</span></td>`).join('')}</tr>`;
        }).join('')}</tbody></table>
        <p class="muted small">OR، XOR، SHL و SHR مانند ADD هستند و فقط مقدار aluOp (از روی funct) متفاوت است.</p>`;
      fromAsm();
    },
  });
})();
