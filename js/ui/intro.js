(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  function overview() {
    const blk = (id, x, y, w, h, t, sub) => `<g class="ov-blk" data-go="${id}" tabindex="0" role="button"><rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>
      <text x="${x + w / 2}" y="${y + h / 2 - (sub ? 8 : 0)}" style="font-weight:700">${t}</text>${sub ? `<text class="t-small t-muted" x="${x + w / 2}" y="${y + h / 2 + 12}">${sub}</text>` : ''}</g>`;
    return `<svg viewBox="0 0 1000 330" class="ov">
      <rect class="box frame" x="20" y="20" width="560" height="290" rx="16"/><text x="300" y="44" class="t-muted">پردازنده (CPU)</text>
      <path class="flow" d="M180,120 H250"/><path class="flow" d="M400,120 H330 "/><path class="flow" d="M300,150 V200"/>
      <path class="flow" d="M130,150 V200"/><path class="flow" d="M470,150 V200"/>
      <path class="flow bus" d="M580,165 H650"/><path class="flow bus" d="M800,165 H860"/>
      ${blk('control', 40, 70, 140, 80, 'واحد کنترل', 'رمزگشایی و سیگنال‌ها')}
      ${blk('regs', 400, 70, 160, 80, 'بانک ثبات', 'R0..R7')}
      ${blk('alu', 250, 70, 100, 80, 'ALU', 'محاسبه')}
      ${blk('predictor', 40, 200, 160, 80, 'پیش‌بین پرش', 'حدس T / N')}
      ${blk('pipeline', 220, 200, 160, 80, 'خط لوله', 'IF ID EX MEM WB')}
      ${blk('cpu', 400, 200, 160, 80, 'مسیر داده', 'همهٔ اجزا با هم')}
      ${blk('cache', 650, 115, 150, 100, 'حافظهٔ نهان', 'سریع و کوچک')}
      ${blk('memory', 860, 95, 120, 140, 'حافظهٔ اصلی', 'و گذرگاه')}
      <text class="t-small t-muted" x="725" y="250">گذرگاه سیستم</text>
    </svg>`;
  }

  UI.register({
    id: 'intro', title: 'معرفی', desc: '',
    init(el) {
      const cards = UI.sections.filter((s) => s.id !== 'intro').map((s, i) =>
        `<button data-go="${s.id}"><b>${i + 1}. ${s.title}</b><span>${s.desc}</span></button>`).join('');
      const isaRows = Object.keys(S.INSTRUCTIONS).map((k) => {
        const x = S.INSTRUCTIONS[k];
        return `<tr><td class="ltr">${k}</td><td>${x.format}</td><td class="ltr">${x.syntax}</td><td class="ltr">${UI.esc(x.fa)}</td></tr>`;
      }).join('');
      el.innerHTML = `
        <div class="lead">
          <h2>شبیه‌ساز معماری پردازنده</h2>
          <p>این شبیه‌ساز اجزای یک پردازندهٔ سادهٔ ۱۶ بیتی را <b>تک‌به‌تک</b> و به‌صورت <b>متحرک</b> نشان می‌دهد. در هر بخش، عملیات به <b>گام‌های کوچک</b> شکسته شده است:
          با «گام بعدی» جلو بروید، با «گام قبلی» برگردید یا «پخش خودکار» را بزنید. سرعت انیمیشن را از بالای صفحه تنظیم کنید.</p>
          <p class="muted small">روی هر بلوک نمودار زیر کلیک کنید تا شبیه‌سازی آن بخش باز شود.</p>
        </div>
        <div class="card fig" style="margin-bottom:16px">${overview()}</div>
        <div class="cards-nav">${cards}</div>
        <div class="card" style="margin-top:16px">
          <h3>مجموعه‌دستورالعمل (ISA)</h3>
          <div class="grid two">
            <div class="table-wrap"><table class="data"><thead><tr><th>دستور</th><th>قالب</th><th>نحو</th><th>عملکرد</th></tr></thead><tbody>${isaRows}</tbody></table></div>
            <div>
              <h4>قالب دستورها (۱۶ بیت)</h4>
              <p>R-type (عملیات ثبات‌به‌ثبات):<br>${UI.fieldsHTML(S.assemble('ADD R1, R2, R3').words[0])}</p>
              <p>I-type (مقدار فوری، حافظه، پرش شرطی):<br>${UI.fieldsHTML(S.assemble('ADDI R1, R2, -3').words[0])}</p>
              <p>L-type (بارگذاری مقدار فوری):<br>${UI.fieldsHTML(S.assemble('LI R1, 100').words[0])}</p>
              <p>J-type (پرش غیرشرطی):<br>${UI.fieldsHTML(S.assemble('JMP 20').words[0])}</p>
              <p class="muted small">در اسمبلی، توضیح‌ها با <code>;</code> شروع می‌شوند، برچسب‌ها با <code>name:</code> تعریف می‌شوند و <code>.word</code> داده در حافظه قرار می‌دهد.</p>
            </div>
          </div>
        </div>`;
      UI.$$('[data-go]', el).forEach((b) => {
        b.addEventListener('click', () => window.App.show(b.dataset.go));
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.App.show(b.dataset.go); } });
      });
    },
  });
})();
