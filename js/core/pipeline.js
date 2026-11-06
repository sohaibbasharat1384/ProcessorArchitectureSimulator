/*
 * Classic 5-stage pipeline (خط لوله): IF → ID → EX → MEM → WB
 *  - data hazards: forwarding (EX/MEM, MEM/WB → EX) or stalls when forwarding is off
 *  - load-use hazard: one-cycle stall even with forwarding
 *  - control hazards: branches resolved in EX (predict not-taken, 2-cycle flush),
 *    JMP resolved in ID (1-cycle flush)
 *  - register file is written in the first half of WB and read in the second half of ID
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./alu.js'), require('./isa.js'), require('./storage.js'));
  } else {
    root.Sim = Object.assign(root.Sim || {}, factory(root.Sim, root.Sim, root.Sim));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ALU, ISA, Storage) {
  'use strict';

  const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];
  const BUBBLE = null;

  class Pipeline {
    constructor(opts) {
      opts = opts || {};
      this.forwarding = opts.forwarding !== false;
      this.mem = new Storage.Memory(ISA.MEM_SIZE, 16);
      this.regs = new Storage.RegisterFile(8, 16, true);
      this.program = new Array(ISA.MEM_SIZE).fill(0);
      this.maxCycles = opts.maxCycles || 5000;
      this.reset();
    }
    load(words) { this.program = words.slice(); this.reset(); }
    reset() {
      this.mem.load(this.program);
      this.regs.reset();
      this.pc = 0;
      this.cycle = 0;
      this.ifid = BUBBLE; this.idex = BUBBLE; this.exmem = BUBBLE; this.memwb = BUBBLE;
      this.halted = false;
      this.fetchStopped = false;
      this.fetchRec = null;
      this.records = [];      // dynamic instructions (rows of the pipeline diagram)
      this.timeline = [];     // per-cycle stage occupancy
      this.stats = { cycles: 0, completed: 0, stalls: 0, flushes: 0, forwards: 0 };
    }

    _newRecord(pc) {
      const word = this.mem.peek(pc);
      const rec = { id: this.records.length, pc, word, text: ISA.disassemble(word), squashed: false, cells: {} };
      this.records.push(rec);
      return rec;
    }

    step() {
      if (this.halted) return null;
      if (this.cycle >= this.maxCycles) { this.halted = true; this.timedOut = true; return null; }
      this.cycle++;
      const cyc = this.cycle;
      const occ = { IF: null, ID: null, EX: null, MEM: null, WB: null };
      const events = [];
      const detail = { IF: '', ID: '', EX: '', MEM: '', WB: '' };
      const forwards = [];
      const mark = (rec, stage, note) => { if (rec) { occ[stage] = rec.id; rec.cells[cyc] = note ? stage + note : stage; } };
      const recOf = (latch) => (latch ? this.records[latch.id] : null);

      // ---------------- WB
      const wb = this.memwb;
      if (wb) {
        mark(recOf(wb), 'WB');
        if (wb.c.regWrite) {
          const v = wb.c.memToReg ? wb.memVal : wb.alu;
          if (this.regs.write(wb.d.rd, v)) {
            events.push({ type: 'wb', text: `WB: R${wb.d.rd} ← ${ALU.toSigned(v, 16)}` });
            detail.WB = `نیمهٔ اول چرخه: ${wb.c.memToReg ? 'دادهٔ حافظه' : 'نتیجهٔ ALU'} (${ALU.toSigned(v, 16)}) در R${wb.d.rd} نوشته می‌شود.`;
          } else detail.WB = 'مقصد R0 است؛ نوشتن نادیده گرفته می‌شود.';
        } else detail.WB = wb.c.halt ? 'HALT کامل می‌شود.' : 'این دستور ثباتی نمی‌نویسد؛ فقط از خط لوله خارج می‌شود.';
        if (wb.c.halt) { this.halted = true; events.push({ type: 'halt', text: 'HALT به مرحلهٔ WB رسید؛ اجرا پایان یافت.' }); }
        this.stats.completed++;
      }

      // ---------------- MEM
      let newMemwb = BUBBLE;
      const mm = this.exmem;
      if (mm) {
        mark(recOf(mm), 'MEM');
        let memVal = 0;
        const addr = mm.alu & 0xFF;
        if (!this.halted) {
          if (mm.c.memRead) { memVal = this.mem.read(addr); events.push({ type: 'mem', text: `MEM: خواندن MEM[${addr}] = ${ALU.toSigned(memVal, 16)}` }); detail.MEM = `خواندن از حافظه: MEM[${addr}] = ${ALU.toSigned(memVal, 16)}؛ مقدار در ثبات MEM/WB قرار می‌گیرد.`; }
          else if (mm.c.memWrite) { this.mem.write(addr, mm.store); events.push({ type: 'mem', text: `MEM: نوشتن MEM[${addr}] ← ${ALU.toSigned(mm.store, 16)}` }); detail.MEM = `نوشتن در حافظه: MEM[${addr}] ← ${ALU.toSigned(mm.store, 16)}.`; }
          else detail.MEM = `دسترسی به حافظه ندارد؛ نتیجهٔ ALU (${ALU.toSigned(mm.alu, 16)}) فقط به ثبات MEM/WB منتقل می‌شود.`;
        }
        newMemwb = { id: mm.id, d: mm.d, c: mm.c, alu: mm.alu, memVal };
      }
      if (this.halted) {
        // Instructions behind HALT never complete.
        this._record(cyc, occ, events, { detail, forwards });
        return this._last;
      }

      // ---------------- EX
      let newExmem = BUBBLE, flush = false, redirect = null;
      const ex = this.idex;
      const fw = { A: null, B: null };
      if (ex) {
        mark(recOf(ex), 'EX');
        let a = ex.a, b = ex.b;
        if (this.forwarding) {
          const pick = (reg, which) => {
            if (reg === 0) return null;
            if (mm && mm.c.regWrite && !mm.c.memRead && mm.d.rd === reg) return { from: 'EX/MEM', value: mm.alu };
            if (wb && wb.c.regWrite && wb.d.rd === reg) return { from: 'MEM/WB', value: wb.c.memToReg ? wb.memVal : wb.alu };
            return null;
          };
          if (ex.c.useA) { const f = pick(ex.d.rs, 'A'); if (f) { a = f.value; fw.A = f.from; } }
          if (ex.c.useB) { const f = pick(ex.p2, 'B'); if (f) { b = f.value; fw.B = f.from; } }
          if (fw.A) { this.stats.forwards++; forwards.push({ from: fw.A, operand: 'A', reg: ex.d.rs, value: a }); events.push({ type: 'fwd', text: `پیشرانی (Forwarding): R${ex.d.rs} = ${ALU.toSigned(a, 16)} از ${fw.A} به ورودی A واحد EX` }); }
          if (fw.B) { this.stats.forwards++; forwards.push({ from: fw.B, operand: 'B', reg: ex.p2, value: b }); events.push({ type: 'fwd', text: `پیشرانی (Forwarding): R${ex.p2} = ${ALU.toSigned(b, 16)} از ${fw.B} به ورودی B واحد EX` }); }
        }
        const r = ALU.aluCompute(ex.c.aluOp, a, ex.c.aluSrc ? ex.imm : b, 16);
        const bIn = ex.c.aluSrc ? ex.imm : b;
        if (ex.c.jump || ex.d.name === 'NOP' || ex.c.halt) detail.EX = 'به ALU نیازی ندارد؛ از این مرحله عبور می‌کند.';
        else if (ex.c.aluOp === 'PASSB') detail.EX = `ALU مقدار فوری ${ex.imm} را عبور می‌دهد.`;
        else if (ex.c.memRead || ex.c.memWrite) detail.EX = `محاسبهٔ آدرس: ${ALU.toSigned(a, 16)} + ${ex.imm} = ${r.result & 0xFF}${fw.A ? ' (A با پیشرانی)' : ''}.`;
        else if (ex.c.branch) detail.EX = `مقایسه: ${ALU.toSigned(a, 16)} − ${ALU.toSigned(b, 16)} ⇒ Z = ${r.flags.Z}${fw.A || fw.B ? ' (با پیشرانی)' : ''}.`;
        else detail.EX = `ALU: ${ALU.toSigned(a, 16)} ${ex.c.aluOp} ${ALU.toSigned(bIn, 16)} = ${ALU.toSigned(r.result, 16)}${fw.A || fw.B ? ` (پیشرانی: ${[fw.A && 'A←' + fw.A, fw.B && 'B←' + fw.B].filter(Boolean).join('، ')})` : ''}.`;
        if (ex.c.branch) {
          const eq = r.flags.Z === 1;
          const taken = ex.c.branchNe ? !eq : eq;
          if (taken) {
            redirect = (ex.pc + 1 + ex.imm) & 0xFF;
            flush = true;
            this.stats.flushes += 2;
            events.push({ type: 'flush', text: `${ex.d.name} در EX انجام شد ⇒ پرش به ${redirect}؛ دو دستور بعدی تخلیه (Flush) شدند.` });
            detail.EX += ` شرط برقرار است ⇒ PC ← ${redirect} و دستورهای ID و IF تخلیه می‌شوند.`;
          } else {
            events.push({ type: 'info', text: `${ex.d.name} در EX انجام نشد؛ پیش‌بینی «انجام‌نشدن» درست بود.` });
            detail.EX += ' شرط برقرار نیست ⇒ پیش‌بینی «انجام‌نشدن» درست بود.';
          }
        }
        newExmem = { id: ex.id, d: ex.d, c: ex.c, alu: r.result, store: b, fw };
      }

      // ---------------- ID
      let newIdex = BUBBLE, stall = false, jumpTo = null;
      const id = this.ifid;
      if (id) {
        const rec = recOf(id);
        if (flush) {
          mark(rec, 'ID', '×');
          rec.squashed = true;
          detail.ID = `«${rec.text}» تخلیه شد (به حباب تبدیل شد) چون پرش در EX انجام شد.`;
        } else {
          const d = ISA.decode(id.word);
          const c = ISA.control(d);
          const srcs = ISA.sourceRegs(d, c).filter((r) => r !== 0);
          if (this.forwarding) {
            if (ex && ex.c.memRead && srcs.includes(ex.d.rd)) {
              stall = true;
              events.push({ type: 'stall', text: `مخاطرهٔ Load-Use: «${rec.text}» به نتیجهٔ LW نیاز دارد ⇒ یک چرخه توقف (حباب).` });
            }
          } else {
            const hz = [ex, mm].find((x) => x && x.c.regWrite && srcs.includes(x.d.rd));
            if (hz) {
              stall = true;
              events.push({ type: 'stall', text: `مخاطرهٔ داده (RAW) روی R${hz.d.rd}: «${rec.text}» منتظر می‌ماند (بدون پیشرانی).` });
            }
          }
          if (stall) {
            mark(rec, 'ID', '*');
            this.stats.stalls++;
            detail.ID = `واحد تشخیص مخاطره توقف می‌دهد: «${rec.text}» در ID می‌ماند و یک حباب به EX فرستاده می‌شود.`;
          } else {
            mark(rec, 'ID');
            const p2 = ISA.port2Reg(d);
            newIdex = { id: id.id, pc: id.pc, d, c, p2, a: this.regs.values[d.rs], b: this.regs.values[p2], imm: d.imm };
            const reads = [];
            if (c.useA) reads.push(`R${d.rs} = ${ALU.toSigned(newIdex.a, 16)}`);
            if (c.useB) reads.push(`R${p2} = ${ALU.toSigned(newIdex.b, 16)}`);
            detail.ID = `رمزگشایی ${d.name}؛ ${reads.length ? 'نیمهٔ دوم چرخه خواندن ' + reads.join('، ') : 'ثباتی خوانده نمی‌شود'}${c.aluSrc || c.branch ? `؛ مقدار فوری ${d.imm}` : ''}.`;
            if (c.jump) {
              jumpTo = d.addr & 0xFF;
              detail.ID += ` پرش غیرشرطی به ${jumpTo} همین‌جا انجام می‌شود.`;
              this.stats.flushes += 1;
              events.push({ type: 'flush', text: `JMP در ID شناسایی شد ⇒ پرش به ${jumpTo}؛ دستور واکشی‌شده تخلیه شد.` });
            }
            if (c.halt) {
              this.fetchStopped = true;
              events.push({ type: 'info', text: 'HALT در ID شناسایی شد؛ واکشی متوقف می‌شود.' });
            }
          }
        }
      }

      // ---------------- IF
      let newIfid = BUBBLE;
      if (!this.fetchStopped || flush) {
        if (flush) this.fetchStopped = false;
        if (!this.fetchRec || this.fetchRec.pc !== this.pc) this.fetchRec = this._newRecord(this.pc);
        const rec = this.fetchRec;
        if (flush || jumpTo !== null) {
          mark(rec, 'IF', '×');
          rec.squashed = true;
          this.fetchRec = null;
          detail.IF = `«${rec.text}» از آدرس ${rec.pc} واکشی شد اما چون مسیر اشتباه است دور ریخته می‌شود؛ PC ← ${flush ? redirect : jumpTo}.`;
          this.pc = flush ? redirect : jumpTo;
        } else if (stall) {
          mark(rec, 'IF', '*');
          newIfid = this.ifid; // hold
          detail.IF = `PC = ${this.pc} ثابت می‌ماند؛ واکشی «${rec.text}» در چرخهٔ بعد تکرار می‌شود.`;
        } else {
          mark(rec, 'IF');
          detail.IF = `واکشی «${rec.text}» از آدرس ${this.pc}؛ PC ← ${(this.pc + 1) & 0xFF}.`;
          newIfid = { id: rec.id, pc: this.pc, word: this.mem.peek(this.pc) };
          this.fetchRec = null;
          this.pc = (this.pc + 1) & 0xFF;
        }
      } else if (stall) {
        newIfid = this.ifid;
      }

      this.memwb = newMemwb;
      this.exmem = newExmem;
      this.idex = newIdex;
      this.ifid = newIfid;
      this._record(cyc, occ, events, { stall, flush: flush || jumpTo !== null, branchTo: flush ? redirect : null, jumpTo, detail, forwards });
      return this._last;
    }

    _record(cyc, occ, events, extra) {
      this.stats.cycles = cyc;
      this._last = Object.assign({ cycle: cyc, occ, events }, extra);
      this.timeline.push(this._last);
    }

    run() {
      while (!this.halted) this.step();
      return this.stats;
    }

    cpi() { return this.stats.completed ? this.stats.cycles / this.stats.completed : 0; }
  }

  return { Pipeline, STAGES };
});
