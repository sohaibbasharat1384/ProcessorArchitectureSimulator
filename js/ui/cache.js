(function () {
  'use strict';
  const S = window.Sim, UI = window.UI;

  const PRESETS = {
    seq: { fa: 'پیمایش ترتیبی (محلیت مکانی)', v: '0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15' },
    loop: { fa: 'حلقه روی آرایه (محلیت زمانی)', v: '0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7' },
    conflict: { fa: 'تعارض (Conflict) در نگاشت مستقیم', v: '0 16 0 16 0 16 32 0 16 32' },
    mixed: { fa: 'ترکیبی', v: '0 4 8 12 16 0 20 4 64 8 0 128 4' },
  };

  UI.register({
    id: 'cache', title: 'حافظهٔ نهان (Cache)',
    desc: 'نگاشت مستقیم و انجمنی مجموعه‌ای، تقسیم آدرس به tag/index/offset، LRU و FIFO',
    init(el) {
      const opt = (arr, sel) => arr.map((v) => `<option${v === sel ? ' selected' : ''}>${v}</option>`).join('');
      el.innerHTML = `
        <div class="lead"><p><b>حافظهٔ نهان</b> حافظه‌ای کوچک و سریع بین پردازنده و حافظهٔ اصلی است که بلوک‌هایی از داده‌های اخیر را نگه می‌دارد.
        آدرس به سه بخش تقسیم می‌شود: <b>offset</b> (جایگاه کلمه درون بلوک)، <b>index</b> (شمارهٔ مجموعه) و <b>tag</b> (برای تشخیص بلوک).
        اگر tag در مجموعه پیدا شود «برخورد» (Hit) و در غیر این صورت «فقدان» (Miss) رخ می‌دهد و بلوک از حافظه آورده می‌شود.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="controls">
            <label>تعداد مجموعه‌ها<select class="sets">${opt([1, 2, 4, 8, 16], 4)}</select></label>
            <label>درجهٔ انجمنی (Ways)<select class="ways">${opt([1, 2, 4, 8], 1)}</select></label>
            <label>اندازهٔ بلوک (کلمه)<select class="bs">${opt([1, 2, 4, 8], 4)}</select></label>
            <label>سیاست جایگزینی<select class="pol"><option>LRU</option><option>FIFO</option><option>RANDOM</option></select></label>
            <label>جریمهٔ فقدان (چرخه)<input type="number" class="pen" value="20" min="1" max="500" style="width:80px"></label>
          </div>
          <div class="controls">
            <label style="flex:1 1 300px">دنبالهٔ آدرس‌ها (۰ تا ۲۵۵)<input type="text" class="seq ltr" value="${PRESETS.conflict.v}"></label>
            <label>نمونه<select class="preset"><option value="">—</option>${Object.keys(PRESETS).map((k) => `<option value="${k}">${PRESETS[k].fa}</option>`).join('')}</select></label>
          </div>
          <div class="btn-row"><button class="btn primary step">دسترسی بعدی ▶</button><button class="btn all">اجرای همه</button><button class="btn rst">بازنشانی</button></div>
          <p class="muted small cfg" style="margin-top:8px"></p>
        </div>
        <div class="grid two">
          <div class="card">
            <h3>دسترسی جاری</h3>
            <div class="cur"></div>
            <h3 style="margin-top:14px">آمار</h3>
            <div class="stats"></div>
          </div>
          <div class="card">
            <h3>محتوای حافظهٔ نهان</h3>
            <div class="lines table-wrap"></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h3>تاریخچهٔ دسترسی‌ها</h3><div class="hist table-wrap"></div></div>`;
      const q = (s) => UI.$(s, el);
      let cache, seq, pos;

      function build() {
        cache = new S.Cache({ sets: +q('.sets').value, ways: +q('.ways').value, blockSize: +q('.bs').value, policy: q('.pol').value, addressBits: 8, missPenalty: +q('.pen').value || 20 });
        seq = (q('.seq').value.match(/0x[0-9a-f]+|\d+/gi) || []).map((x) => UI.parseInput(x) & 0xFF);
        pos = 0;
        const kind = cache.ways === 1 ? 'نگاشت مستقیم (Direct-Mapped)' : cache.sets === 1 ? 'تمام‌انجمنی (Fully Associative)' : `انجمنی ${cache.ways} راهه (${cache.ways}-way Set Associative)`;
        q('.cfg').innerHTML = `${kind} · ظرفیت ${cache.sets * cache.ways * cache.blockSize} کلمه · آدرس ۸ بیتی = tag ${cache.tagBits} بیت + index ${cache.indexBits} بیت + offset ${cache.offsetBits} بیت`;
        render(null);
      }
      function render(last) {
        if (last) {
          const b = UI.bin(last.addr, 8);
          const t = cache.tagBits, i = cache.indexBits;
          const part = (cls, bits, name, val) => bits ? `<span class="part ${cls}">${bits}<small>${name} = ${val}</small></span>` : '';
          q('.cur').innerHTML = `<p>آدرس <b class="ltr">${last.addr}</b> (${UI.hex(last.addr, 2)}) :</p>
            <div class="addr-split">${part('tag', b.slice(0, t), 'tag', last.tag)}${part('index', b.slice(t, t + i), 'index', last.index)}${part('offset', b.slice(t + i), 'offset', last.offset)}</div>
            <p style="margin-top:10px">${last.hit ? `<span class="badge hit">برخورد (Hit)</span> بلوک در مجموعهٔ ${last.index}، راه ${last.way} پیدا شد.`
              : `<span class="badge miss">فقدان (Miss)</span> ${last.kind === 'compulsory' ? 'فقدان اجباری (اولین دسترسی به این بلوک).' : 'فقدان تعارض/ظرفیت (بلوک قبلاً بیرون رانده شده بود).'}
                بلوک ${last.block * cache.blockSize}..${last.block * cache.blockSize + cache.blockSize - 1} در مجموعهٔ ${last.index}، راه ${last.way} بارگذاری شد.
                ${last.evicted ? `بلوکی که از آدرس ${last.evicted.start} شروع می‌شود بیرون رانده شد.` : ''}`}</p>`;
        } else q('.cur').innerHTML = `<p class="muted">${seq.length} آدرس در صف. «دسترسی بعدی» را بزنید.</p>`;

        const st = cache.stats;
        q('.stats').innerHTML = `<dl class="kv"><dt>دسترسی‌ها</dt><dd>${st.accesses} / ${seq.length}</dd><dt>برخورد</dt><dd>${st.hits}</dd>
          <dt>فقدان (اجباری)</dt><dd>${st.misses} (${st.compulsory})</dd><dt>بیرون‌رانی</dt><dd>${st.evictions}</dd>
          <dt>نرخ برخورد</dt><dd>${(cache.hitRate() * 100).toFixed(1)}%</dd>
          <dt>AMAT</dt><dd>${cache.amat().toFixed(2)} چرخه</dd></dl>
          <p class="muted small">AMAT = زمان برخورد + نرخ فقدان × جریمهٔ فقدان = 1 + ${(1 - cache.hitRate()).toFixed(2)} × ${cache.missPenalty}</p>`;

        let rows = '';
        cache.lines.forEach((set, s) => set.forEach((l, w) => {
          const hl = last && last.index === s && last.way === w ? (last.hit ? 'hl-hit' : 'hl-miss') : '';
          const start = l.valid ? cache.blockStart(l.tag, s) : null;
          const order = cache.policy === 'FIFO' ? l.insertedAt : l.lastUsed;
          rows += `<tr class="${hl}">${w === 0 ? `<td rowspan="${cache.ways}">${s}</td>` : ''}<td>${w}</td><td>${l.valid ? 1 : 0}</td>
            <td>${l.valid ? l.tag + ' (' + UI.bin(l.tag, Math.max(cache.tagBits, 1)) + ')' : '—'}</td>
            <td>${l.valid ? `MEM[${start}..${start + cache.blockSize - 1}]` : '—'}</td><td>${l.valid ? order : '—'}</td></tr>`;
        }));
        q('.lines').innerHTML = `<table class="data ltr"><thead><tr><th>set</th><th>way</th><th>V</th><th>tag</th><th>block</th><th>${cache.policy === 'FIFO' ? 'inserted' : 'last used'}</th></tr></thead><tbody>${rows}</tbody></table>`;

        q('.hist').innerHTML = cache.history.length ? `<table class="data ltr"><thead><tr><th>#</th><th>addr</th><th>tag</th><th>index</th><th>offset</th><th>result</th><th>evicted</th></tr></thead><tbody>
          ${cache.history.map((h) => `<tr><td>${h.n}</td><td>${h.addr}</td><td>${h.tag}</td><td>${h.index}</td><td>${h.offset}</td>
          <td>${h.hit ? '<span class="badge hit">HIT</span>' : `<span class="badge miss">MISS</span> <span class="small muted">${h.kind}</span>`}</td>
          <td>${h.evicted ? 'block @' + h.evicted.start : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">هنوز دسترسی‌ای انجام نشده است.</p>';
      }
      function step() { if (pos < seq.length) render(cache.access(seq[pos++])); }
      q('.step').addEventListener('click', step);
      q('.all').addEventListener('click', () => { let last = null; while (pos < seq.length) last = cache.access(seq[pos++]); render(last); });
      q('.rst').addEventListener('click', build);
      q('.preset').addEventListener('change', () => { if (q('.preset').value) { q('.seq').value = PRESETS[q('.preset').value].v; build(); } });
      ['.sets', '.ways', '.bs', '.pol', '.pen'].forEach((s) => q(s).addEventListener('change', build));
      q('.seq').addEventListener('change', build);
      build();
    },
  });
})();
