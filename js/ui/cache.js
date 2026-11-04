(function () {
  'use strict';
  const S = window.Sim, UI = window.UI, A = window.Anim;

  const PRESETS = {
    seq: { fa: 'پیمایش ترتیبی (محلیت مکانی)', v: '0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15' },
    loop: { fa: 'حلقه روی آرایه (محلیت زمانی)', v: '0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7' },
    conflict: { fa: 'تعارض (Conflict) در نگاشت مستقیم', v: '0 16 0 16 0 16 32 0 16 32' },
    mixed: { fa: 'ترکیبی', v: '0 4 8 12 16 0 20 4 64 8 0 128 4' },
  };
  const memVal = (a) => (a * 13 + 7) & 0xFF;
  const clone = (lines) => lines.map((set) => set.map((l) => Object.assign({}, l)));

  UI.register({
    id: 'cache', title: 'حافظهٔ نهان (Cache)',
    desc: 'تقسیم آدرس، انتخاب مجموعه، مقایسه‌گرهای tag، جایگزینی و آوردن بلوک از حافظه به‌صورت متحرک',
    init(el) {
      const opt = (arr, sel) => arr.map((v) => `<option${v === sel ? ' selected' : ''}>${v}</option>`).join('');
      el.innerHTML = `
        <div class="lead"><p><b>حافظهٔ نهان</b> بلوک‌هایی از حافظهٔ اصلی را نزدیک پردازنده نگه می‌دارد. سخت‌افزار آدرس را به <b>tag | index | offset</b> تقسیم می‌کند:
        index مجموعه را انتخاب می‌کند، tag ذخیره‌شده در هر «راه» آن مجموعه با tag آدرس <b>مقایسه</b> می‌شود (همهٔ مقایسه‌گرها همزمان)، و اگر یکی برابر و معتبر بود «برخورد» است.
        در «فقدان»، یک قربانی انتخاب، بیرون رانده و بلوک تازه از حافظهٔ اصلی آورده می‌شود. offset کلمهٔ مورد نظر را از داخل بلوک برمی‌دارد.</p></div>
        <div class="card" style="margin-bottom:16px">
          <div class="controls">
            <label>تعداد مجموعه‌ها<select class="sets">${opt([1, 2, 4, 8], 4)}</select></label>
            <label>درجهٔ انجمنی (Ways)<select class="ways">${opt([1, 2, 4], 1)}</select></label>
            <label>اندازهٔ بلوک (کلمه)<select class="bs">${opt([1, 2, 4, 8], 4)}</select></label>
            <label>سیاست جایگزینی<select class="pol"><option>LRU</option><option>FIFO</option><option>RANDOM</option></select></label>
            <label>جریمهٔ فقدان (چرخه)<input type="number" class="pen" value="20" min="1" max="500" style="width:80px"></label>
          </div>
          <div class="controls">
            <label style="flex:1 1 300px">دنبالهٔ آدرس‌ها (۰ تا ۲۵۵)<input type="text" class="seq ltr" value="${PRESETS.conflict.v}"></label>
            <label>نمونه<select class="preset"><option value="">—</option>${Object.keys(PRESETS).map((k) => `<option value="${k}">${PRESETS[k].fa}</option>`).join('')}</select></label>
          </div>
          <div class="btn-row"><button class="btn primary nexta">دسترسی بعدی ⏭</button><button class="btn autoa">همهٔ دسترسی‌ها با انیمیشن ⏵</button><button class="btn all">اجرای فوری همه</button><button class="btn rst">بازنشانی</button>
            <span class="small muted cfg" style="align-self:center"></span></div>
          <div class="st" style="margin-top:10px"></div>
        </div>
        <div class="card"><div class="fig cache-fig"></div></div>
        <div class="grid two" style="margin-top:16px">
          <div class="card"><h3>آمار</h3><div class="stats"></div></div>
          <div class="card"><h3>تاریخچهٔ دسترسی‌ها</h3><div class="hist table-wrap" style="max-height:320px;overflow-y:auto"></div></div>
        </div>`;
      const q = (s) => UI.$(s, el);
      const fig = q('.cache-fig');
      const stepper = UI.stepper(q('.st'));
      let cache, seq, pos, cur = null, auto = false, G = {};

      function build() {
        auto = false;
        cache = new S.Cache({ sets: +q('.sets').value, ways: +q('.ways').value, blockSize: +q('.bs').value, policy: q('.pol').value, addressBits: 8, missPenalty: +q('.pen').value || 20 });
        seq = (q('.seq').value.match(/0x[0-9a-f]+|\d+/gi) || []).map((x) => UI.parseInput(x) & 0xFF);
        pos = 0; cur = null;
        const kind = cache.ways === 1 ? 'نگاشت مستقیم' : cache.sets === 1 ? 'تمام‌انجمنی' : `انجمنی ${cache.ways} راهه`;
        q('.cfg').textContent = `${kind} · ظرفیت ${cache.sets * cache.ways * cache.blockSize} کلمه · tag ${cache.tagBits} + index ${cache.indexBits} + offset ${cache.offsetBits} بیت`;
        drawFigure();
        stepper.set([], render, `${seq.length} آدرس در صف است. «دسترسی بعدی» را بزنید.`);
      }

      // ------------------------------------------------------------- figure
      function drawFigure() {
        const sets = cache.sets, ways = cache.ways;
        const gx = 150, gy = 150, rh = 34, ww = Math.min(250, 780 / ways);
        const gridB = gy + sets * rh;
        const cmpY = gridB + 40, busY = cmpY + 44;
        const H = busY + 150;
        G = { gx, gy, rh, ww, gridB, cmpY, busY, H };
        const bitX = (i) => 300 + i * 40; // i = 0 (MSB) .. 7
        let s = `<svg viewBox="0 0 1000 ${H}">`;
        s += '<text class="t-small t-muted" x="250" y="36">آدرس</text>';
        for (let i = 0; i < 8; i++) s += `<g class="abit" id="ab-${i}"><rect class="bitc" x="${bitX(i)}" y="18" width="34" height="30" rx="5"/><text class="t-mono" x="${bitX(i) + 17}" y="34"></text></g>`;
        const tb = cache.tagBits, ib = cache.indexBits;
        const span = (from, n, cls, label) => n ? `<g class="split ${cls}"><path d="M${bitX(from) + 2},56 v6 H${bitX(from + n - 1) + 32} v-6"/><text class="t-small" x="${(bitX(from) + bitX(from + n - 1) + 34) / 2}" y="76">${label}</text></g>` : '';
        s += span(0, tb, 'tag', 'tag') + span(tb, ib, 'index', 'index') + span(tb + ib, cache.offsetBits, 'offset', 'offset');
        // index → set
        const ixX = ib ? bitX(tb) + 4 : 70;
        s += `<g id="b-idx"><rect class="box" x="20" y="104" width="70" height="26" rx="6"/><text class="t-small" x="55" y="117">index</text></g>`;
        s += `<path class="wire" id="w-idx" d="M${ixX},62 V96 H55 V104"/>`;
        s += `<path class="wire" id="w-set" d=""/>`;
        // ways header + lines
        for (let w = 0; w < ways; w++) s += `<text class="t-small t-muted" x="${gx + w * ww + ww / 2}" y="${gy - 10}">راه (way) ${w}</text>`;
        for (let st = 0; st < sets; st++) {
          s += `<text class="t-small t-muted" x="${gx - 8}" y="${gy + st * rh + rh / 2 + 4}" style="text-anchor:end">set ${st}</text>`;
          for (let w = 0; w < ways; w++) {
            const x = gx + w * ww, y = gy + st * rh;
            s += `<g class="cline" id="cl-${st}-${w}"><rect class="box" x="${x + 2}" y="${y + 2}" width="${ww - 4}" height="${rh - 4}" rx="5"/>
              <text class="t-mono t-small cv" x="${x + 16}" y="${y + rh / 2}"></text><text class="t-mono ct" x="${x + 54}" y="${y + rh / 2}"></text>
              <text class="t-small t-muted cb" x="${x + ww - 8}" y="${y + rh / 2}" style="text-anchor:end"></text></g>`;
          }
        }
        // comparators
        const tagX = tb ? bitX(0) + 4 : 300;
        let bus = `M${tagX},62 V88 H8 V${busY} H${gx + (ways - 1) * ww + ww / 2}`;
        for (let w = 0; w < ways; w++) {
          const cx = gx + w * ww + ww / 2;
          bus += ` M${cx},${busY} V${cmpY + 14}`;
          s += `<path class="wire" id="w-tag-${w}" d=""/>`;
          s += `<g class="cmp" id="cmp-${w}"><circle class="box" cx="${cx}" cy="${cmpY}" r="14"/><text x="${cx}" y="${cmpY + 1}">=</text></g>`;
          s += `<text class="t-small cmpr" id="cmpr-${w}" x="${cx + 22}" y="${cmpY + 1}" style="text-anchor:start"></text>`;
          s += `<path class="wire" id="w-hit-${w}" d="M${cx + 10},${cmpY + 10} L${cx + 18},${cmpY + 26} H880 V${cmpY + 10}"/>`;
        }
        s += `<path class="wire" id="w-tagbus" d="${bus}"/>`;
        s += `<g id="b-hit"><rect class="box" x="850" y="${cmpY - 30}" width="120" height="40" rx="8"/><circle class="lamp" cx="875" cy="${cmpY - 10}" r="9"/><text class="hitt" x="922" y="${cmpY - 10}">HIT?</text></g>`;
        // block detail + memory
        const by = busY + 30;
        s += `<text class="t-small t-muted" x="20" y="${by + 6}" style="text-anchor:start">داده‌های بلوک</text>`;
        const cwd = Math.min(70, 520 / cache.blockSize);
        for (let o = 0; o < cache.blockSize; o++) s += `<g class="bword" id="bw-${o}"><rect class="bitc" x="${120 + o * cwd}" y="${by + 20}" width="${cwd - 6}" height="34" rx="5"/><text class="t-mono t-small" x="${120 + o * cwd + (cwd - 6) / 2}" y="${by + 37}"></text>
          <text class="t-small t-muted" x="${120 + o * cwd + (cwd - 6) / 2}" y="${by + 66}">${o}</text></g>`;
        s += `<g id="b-out"><rect class="box" x="${130 + cache.blockSize * cwd}" y="${by + 18}" width="150" height="38" rx="7"/><text class="t-small" x="${205 + cache.blockSize * cwd}" y="${by + 30}">داده به پردازنده</text><text class="t-mono v" x="${205 + cache.blockSize * cwd}" y="${by + 46}"></text></g>`;
        s += `<g id="b-mem"><rect class="box frame" x="820" y="${by + 10}" width="160" height="70" rx="10"/><text x="900" y="${by + 32}">حافظهٔ اصلی</text><text class="t-small t-muted v" x="900" y="${by + 56}"></text></g>`;
        s += `<path class="wire" id="w-fetch" d=""/><path class="wire" id="w-evict" d=""/><path class="wire" id="w-word" d=""/>`;
        s += '</svg>';
        fig.innerHTML = s;
        G.by = by; G.cwd = cwd; G.svg = UI.$('svg', fig);
      }

      function paintLines(lines, sel) {
        for (let st = 0; st < cache.sets; st++) for (let w = 0; w < cache.ways; w++) {
          const g = UI.$(`#cl-${st}-${w}`, fig), l = lines[st][w];
          g.querySelector('.cv').textContent = 'V=' + (l.valid ? 1 : 0);
          g.querySelector('.ct').textContent = l.valid ? 'tag=' + l.tag : '';
          const start = l.valid ? cache.blockStart(l.tag, st) : null;
          g.querySelector('.cb').textContent = l.valid ? `[${start}..${start + cache.blockSize - 1}]${cache.ways > 1 && cache.policy !== 'RANDOM' ? ' · t' + (cache.policy === 'FIFO' ? l.insertedAt : l.lastUsed) : ''}` : 'خالی';
          g.classList.toggle('invalid', !l.valid);
          g.classList.toggle('selset', sel === st);
        }
      }

      // ------------------------------------------------------------- one access
      function nextAccess() {
        if (pos >= seq.length) return false;
        const addr = seq[pos++];
        const before = clone(cache.lines);
        const res = cache.access(addr);
        const after = clone(cache.lines);
        const set = before[res.index];
        const bits = UI.bin(addr, 8);
        const tb = cache.tagBits, ib = cache.indexBits;
        cur = { addr, res, before, after, n: cache.history.length };
        const st = [];
        st.push({ k: 'addr', title: `دسترسی ${cur.n}`, text: `پردازنده آدرس ${addr} (دودویی ${bits}) را از حافظهٔ نهان درخواست می‌کند.` });
        st.push({ k: 'split', title: 'تقسیم آدرس', text: `tag = ${bits.slice(0, tb) || '—'} (${res.tag})${ib ? `، index = ${bits.slice(tb, tb + ib)} (${res.index})` : '، index ندارد (تمام‌انجمنی)'}${cache.offsetBits ? `، offset = ${bits.slice(tb + ib)} (${res.offset})` : '، offset ندارد (بلوک یک‌کلمه‌ای)'}.` });
        st.push({ k: 'index', title: 'انتخاب مجموعه', text: ib ? `index = ${res.index} ⇒ فقط مجموعهٔ ${res.index} بررسی می‌شود؛ بلوکی با این آدرس جای دیگری نمی‌تواند باشد.` : 'تنها یک مجموعه وجود دارد؛ بلوک می‌تواند در هر راهی باشد.' });
        set.forEach((l, w) => {
          const eq = l.valid && l.tag === res.tag;
          st.push({ k: 'cmp', w, eq, title: `مقایسه‌گر راه ${w}`, text: !l.valid ? `راه ${w}: بیت اعتبار V = 0 است؛ این خط داده‌ای ندارد و نتیجهٔ مقایسه بی‌اثر است ✗.`
            : `راه ${w}: tag ذخیره‌شده ${l.tag} با tag آدرس ${res.tag} مقایسه می‌شود ⇒ ${eq ? 'برابر ✓ (و V = 1)' : 'نابرابر ✗'}.${cache.ways > 1 ? ' (در سخت‌افزار همهٔ راه‌ها همزمان مقایسه می‌شوند.)' : ''}` });
        });
        st.push({ k: 'result', title: res.hit ? 'برخورد' : 'فقدان', text: res.hit ? `خروجی یکی از مقایسه‌گرها (راه ${res.way}) ۱ است ⇒ سیگنال HIT = 1. داده همین‌جا موجود است (زمان ${cache.hitTime} چرخه).`
          : `هیچ مقایسه‌گری برابر نشد ⇒ HIT = 0، یعنی فقدان (${res.kind === 'compulsory' ? 'اجباری: اولین بار است که این بلوک خواسته می‌شود' : 'تعارض/ظرفیت: این بلوک قبلاً بود ولی بیرون رانده شده'}).` });
        if (!res.hit) {
          let why;
          const free = set.findIndex((l) => !l.valid);
          if (cache.ways === 1) why = `نگاشت مستقیم: بلوک فقط یک جای ممکن دارد، راه 0 مجموعهٔ ${res.index}.`;
          else if (free >= 0) why = `راه ${free} خالی است (V = 0)، پس بدون بیرون‌راندن همان استفاده می‌شود.`;
          else if (cache.policy === 'LRU') why = `همهٔ راه‌ها پرند. LRU راهی را برمی‌دارد که از همه دیرتر استفاده شده: زمان آخرین استفاده‌ها ${set.map((l, w) => `راه ${w}: ${l.lastUsed}`).join('، ')} ⇒ راه ${res.way}.`;
          else if (cache.policy === 'FIFO') why = `همهٔ راه‌ها پرند. FIFO قدیمی‌ترین بلوک واردشده را برمی‌دارد: زمان ورود ${set.map((l, w) => `راه ${w}: ${l.insertedAt}`).join('، ')} ⇒ راه ${res.way}.`;
          else why = `همهٔ راه‌ها پرند. سیاست تصادفی راه ${res.way} را انتخاب کرد.`;
          st.push({ k: 'victim', title: 'انتخاب جا', text: why });
          if (res.evicted) st.push({ k: 'evict', title: 'بیرون‌رانی', text: `بلوک قبلی این خط (آدرس‌های ${res.evicted.start}..${res.evicted.start + cache.blockSize - 1}، tag = ${res.evicted.tag}) کنار گذاشته می‌شود.` });
          const bs = res.block * cache.blockSize;
          st.push({ k: 'fetch', title: 'آوردن بلوک', text: `کل بلوک شامل آدرس‌های ${bs}..${bs + cache.blockSize - 1} (${cache.blockSize} کلمه) از حافظهٔ اصلی خوانده می‌شود. این کار ${cache.missPenalty} چرخه طول می‌کشد (جریمهٔ فقدان).` });
          st.push({ k: 'fill', commit: true, title: 'به‌روزرسانی خط', text: `خط مجموعهٔ ${res.index}، راه ${res.way} پر می‌شود: V = 1، tag = ${res.tag}${cache.policy !== 'RANDOM' && cache.ways > 1 ? `، زمان ${cache.policy === 'FIFO' ? 'ورود' : 'استفاده'} = ${cur.n}` : ''}.` });
        }
        st.push({ k: 'word', commit: res.hit, title: 'انتخاب کلمه', text: `offset = ${res.offset} کلمهٔ شمارهٔ ${res.offset} از بلوک را انتخاب می‌کند: MEM[${addr}] = ${memVal(addr)} به پردازنده فرستاده می‌شود.${res.hit && cache.policy === 'LRU' && cache.ways > 1 ? ` زمان آخرین استفادهٔ راه ${res.way} به ${cur.n} به‌روز شد.` : ''}` });
        stepper.set(st, render);
        return true;
      }

      // ------------------------------------------------------------- render
      function render(step, idx, animate) {
        UI.$$('.on', fig).forEach((e) => e.classList.remove('on'));
        UI.$$('.hl', fig).forEach((e) => e.classList.remove('hl'));
        UI.$$('.cmpr', fig).forEach((e) => { e.textContent = ''; });
        const lamp = UI.$('#b-hit .lamp', fig);
        lamp.classList.remove('on', 'bad');
        UI.$('.hitt', fig).textContent = 'HIT?';
        const histN = cur ? (stepper.steps.slice(0, idx + 1).some((s) => s.commit) ? cur.n : cur.n - 1) : cache.history.length;
        renderStats(histN);
        if (!cur) {
          paintLines(cache.lines, null);
          UI.$$('.abit text', fig).forEach((t) => { t.textContent = ''; });
          UI.$$('.bword text.t-mono', fig).forEach((t) => { t.textContent = ''; });
          UI.$('#b-out .v', fig).textContent = '';
          return;
        }
        const { addr, res, before, after } = cur;
        const keys = stepper.steps.slice(0, idx + 1).map((s) => s.k);
        const has = (k) => keys.includes(k);
        const committed = stepper.steps.slice(0, idx + 1).some((s) => s.commit);
        paintLines(committed ? after : before, has('index') ? res.index : null);
        const bits = UI.bin(addr, 8), tb = cache.tagBits, ib = cache.indexBits;
        for (let i = 0; i < 8; i++) {
          const g = UI.$('#ab-' + i, fig);
          g.querySelector('text').textContent = bits[i];
          g.querySelector('rect').classList.toggle('one', bits[i] === '1');
          g.classList.remove('tag', 'index', 'offset');
          if (has('split')) g.classList.add(i < tb ? 'tag' : i < tb + ib ? 'index' : 'offset');
        }
        UI.$$('.split', fig).forEach((e) => e.classList.toggle('shown', has('split')));
        const { gx, gy, rh, ww, cmpY, by, cwd } = G;
        const svg = G.svg;
        const lineCenter = (w) => [gx + w * ww + ww / 2, gy + res.index * rh + rh / 2];
        UI.$('#w-set', fig).setAttribute('d', `M55,130 V${gy + res.index * rh + 9} H${gx + 2}`);
        for (let w = 0; w < cache.ways; w++) {
          const [cx, cy] = lineCenter(w);
          UI.$('#w-tag-' + w, fig).setAttribute('d', `M${cx},${cy + rh / 2 - 2} V${cmpY - 14}`);
        }
        const [lx, ly] = lineCenter(res.way);
        UI.$('#w-fetch', fig).setAttribute('d', `M820,${by + 45} H${gx + cache.ways * ww + 20} V${ly} H${lx + ww / 2 - 4}`);
        UI.$('#w-evict', fig).setAttribute('d', `M${lx + ww / 2 - 4},${ly - 6} H${gx + cache.ways * ww + 34} V${by + 30} H820`);
        UI.$('#w-word', fig).setAttribute('d', `M${lx},${ly + rh / 2} V${by + 14} H${120 + res.offset * cwd + (cwd - 6) / 2} V${by + 20}`);
        // block words
        const bs = res.block * cache.blockSize;
        const blockShown = has('word') && (res.hit || has('fill'));
        for (let o = 0; o < cache.blockSize; o++) {
          const g = UI.$('#bw-' + o, fig);
          g.querySelector('text.t-mono').textContent = has('fetch') || (res.hit && has('word')) ? memVal(bs + o) : '';
          g.classList.toggle('hl', blockShown && o === res.offset);
        }
        UI.$('#b-out .v', fig).textContent = blockShown ? String(memVal(addr)) : '';
        UI.$('#b-mem .v', fig).textContent = has('fetch') ? `بلوک ${bs}..${bs + cache.blockSize - 1}` : '';
        const cmps = stepper.steps.slice(0, idx + 1).filter((s) => s.k === 'cmp');
        cmps.forEach((c) => {
          const r = UI.$('#cmpr-' + c.w, fig);
          r.textContent = c.eq ? '✓' : '✗';
          r.classList.toggle('ok', c.eq);
          UI.$('#cmp-' + c.w, fig).classList.toggle('eq', c.eq);
          UI.$('#cmp-' + c.w, fig).classList.toggle('ne', !c.eq);
        });
        if (has('result')) {
          lamp.classList.add(res.hit ? 'on' : 'bad');
          UI.$('.hitt', fig).textContent = res.hit ? 'HIT' : 'MISS';
          if (res.hit) UI.$('#w-hit-' + res.way, fig).classList.add('on');
        }
        if (!step) return;
        const on = (id) => { const e = UI.$('#' + id, fig); if (e) e.classList.add('on'); return e; };
        const anims = [];
        switch (step.k) {
          case 'addr': UI.$$('.abit', fig).forEach((g) => g.classList.add('hl')); break;
          case 'split': break;
          case 'index':
            on('w-idx'); on('w-set'); on('b-idx');
            if (animate) anims.push(A.token(svg, 'w-idx', 'idx=' + res.index, { cls: 'addr', duration: 600 }).then(() => A.token(svg, 'w-set', 'set ' + res.index, { cls: 'addr', duration: 600 })));
            break;
          case 'cmp':
            on('cmp-' + step.w); on('w-tag-' + step.w); on('w-tagbus'); UI.$(`#cl-${res.index}-${step.w}`, fig).classList.add('hl');
            if (animate) {
              const l = before[res.index][step.w];
              anims.push(Promise.all([A.token(svg, 'w-tag-' + step.w, l.valid ? 'tag=' + l.tag : 'V=0', { duration: 600 }), A.token(svg, 'w-tagbus', 'tag=' + res.tag, { cls: 'addr', duration: 900 })]));
            }
            break;
          case 'result': on('b-hit'); if (animate) A.flash(UI.$('#b-hit', fig)); break;
          case 'victim': UI.$(`#cl-${res.index}-${res.way}`, fig).classList.add('hl'); if (animate) A.flash(UI.$(`#cl-${res.index}-${res.way}`, fig)); break;
          case 'evict': on('w-evict'); UI.$(`#cl-${res.index}-${res.way}`, fig).classList.add('hl'); if (animate) anims.push(A.token(svg, 'w-evict', 'tag=' + res.evicted.tag, { cls: 'bad', duration: 1000 })); break;
          case 'fetch': on('w-fetch'); on('b-mem'); if (animate) anims.push(A.token(svg, 'w-fetch', `[${bs}..${bs + cache.blockSize - 1}]`, { cls: 'data', duration: 1300 })); break;
          case 'fill': UI.$(`#cl-${res.index}-${res.way}`, fig).classList.add('hl'); if (animate) A.flash(UI.$(`#cl-${res.index}-${res.way}`, fig)); break;
          case 'word': on('w-word'); on('b-out'); UI.$(`#cl-${res.index}-${res.way}`, fig).classList.add('hl'); if (animate) anims.push(A.token(svg, 'w-word', String(memVal(addr)), { duration: 800 }).then(() => A.flash(UI.$('#b-out', fig)))); break;
          default: break;
        }
        return Promise.all(anims);
      }

      function renderStats(n) {
        const h = cache.history.slice(0, n);
        const hits = h.filter((x) => x.hit).length, misses = n - hits;
        const comp = h.filter((x) => x.kind === 'compulsory').length, ev = h.filter((x) => x.evicted).length;
        const hr = n ? hits / n : 0;
        q('.stats').innerHTML = `<dl class="kv"><dt>دسترسی‌ها</dt><dd>${n} / ${seq.length}</dd><dt>برخورد</dt><dd>${hits}</dd>
          <dt>فقدان (اجباری)</dt><dd>${misses} (${comp})</dd><dt>بیرون‌رانی</dt><dd>${ev}</dd>
          <dt>نرخ برخورد</dt><dd>${(hr * 100).toFixed(1)}%</dd><dt>AMAT</dt><dd>${(cache.hitTime + (1 - hr) * cache.missPenalty).toFixed(2)} چرخه</dd></dl>
          <div class="bar" style="margin-top:8px"><i style="width:${hr * 100}%;background:var(--ok)"></i></div>
          <p class="muted small">AMAT = زمان برخورد + نرخ فقدان × جریمهٔ فقدان = ${cache.hitTime} + ${(1 - hr).toFixed(2)} × ${cache.missPenalty}</p>`;
        q('.hist').innerHTML = h.length ? `<table class="data ltr"><thead><tr><th>#</th><th>addr</th><th>tag</th><th>index</th><th>offset</th><th>result</th><th>evicted</th></tr></thead><tbody>
          ${h.map((x) => `<tr><td>${x.n}</td><td>${x.addr}</td><td>${x.tag}</td><td>${x.index}</td><td>${x.offset}</td>
          <td>${x.hit ? '<span class="badge hit">HIT</span>' : `<span class="badge miss">MISS</span> <span class="small muted">${x.kind}</span>`}</td>
          <td>${x.evicted ? 'block @' + x.evicted.start : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">هنوز دسترسی‌ای انجام نشده است.</p>';
      }

      q('.nexta').addEventListener('click', () => { auto = false; if (nextAccess()) stepper.next(); });
      q('.autoa').addEventListener('click', async () => {
        if (auto) { auto = false; stepper.stop(); return; }
        auto = true; q('.autoa').textContent = 'توقف ⏸';
        while (auto) {
          if (!cur || stepper.index >= stepper.steps.length - 1) { if (!nextAccess()) break; }
          await stepper.play();
          if (!auto || stepper.index < stepper.steps.length - 1) break;
          await A.sleep(500);
        }
        auto = false; q('.autoa').textContent = 'همهٔ دسترسی‌ها با انیمیشن ⏵';
      });
      q('.all').addEventListener('click', () => {
        auto = false;
        if (cur) stepper.last();
        while (pos < seq.length) nextAccess();
        if (cur) stepper.last();
      });
      q('.rst').addEventListener('click', build);
      q('.preset').addEventListener('change', () => { if (q('.preset').value) { q('.seq').value = PRESETS[q('.preset').value].v; build(); } });
      ['.sets', '.ways', '.bs', '.pol', '.pen', '.seq'].forEach((s) => q(s).addEventListener('change', build));
      build();
    },
  });
})();
