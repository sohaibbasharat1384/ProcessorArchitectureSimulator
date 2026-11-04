(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

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
          <p>این شبیه‌ساز اجزای یک پردازندهٔ سادهٔ ۱۶ بیتی را <b>تک‌به‌تک</b> نشان می‌دهد. هر زبانه یک بخش از معماری را جداگانه و به‌صورت تعاملی شبیه‌سازی می‌کند؛
          از مدارهای پایه مثل ALU و بانک ثبات شروع کنید و به پردازندهٔ کامل، خط لوله و پیش‌بینی پرش برسید.</p>
          <p class="muted small">همهٔ بخش‌ها از یک مجموعه‌دستورالعمل (ISA) مشترک استفاده می‌کنند: ۸ ثبات ۱۶ بیتی (R0 همیشه صفر است)، حافظهٔ ۲۵۶ کلمه‌ای و دستورهای ۱۶ بیتی.</p>
        </div>
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
      UI.$$('[data-go]', el).forEach((b) => b.addEventListener('click', () => window.App.show(b.dataset.go)));
    },
  });
})();
