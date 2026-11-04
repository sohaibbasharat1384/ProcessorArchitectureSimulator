/*
 * Single-cycle CPU, shown one phase at a time:
 *   FETCH → DECODE → EXECUTE → MEMORY → WRITEBACK
 * Every phase is further broken into micro-steps. Each micro-step lists the datapath
 * components and wires it uses and the values ("tokens") that travel on those wires,
 * so the UI can animate exactly what happens inside the processor.
 *
 * A micro-step may carry `commit`: the part of the architectural state (ir, mem, regs, pc)
 * that becomes visible at that moment. The model itself updates state once per phase.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./alu.js'), require('./isa.js'), require('./storage.js'));
  } else {
    root.Sim = Object.assign(root.Sim || {}, factory(root.Sim, root.Sim, root.Sim));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ALU, ISA, Storage) {
  'use strict';

  const PHASES = ['FETCH', 'DECODE', 'EXECUTE', 'MEMORY', 'WRITEBACK'];
  const PHASE_FA = {
    FETCH: 'واکشی (Fetch)', DECODE: 'رمزگشایی (Decode)', EXECUTE: 'اجرا (Execute)',
    MEMORY: 'دسترسی به حافظه (Memory)', WRITEBACK: 'بازنویسی (Write Back)',
  };

  const hex4 = (v) => '0x' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  const bin = (v, w) => (v >>> 0).toString(2).padStart(w, '0').slice(-w);
  const s16 = (v) => ALU.toSigned(v, 16);

  /** Control lines from the control unit to the datapath. */
  const CONTROL_LINES = {
    regWrite: 'c-ctrl-regs', aluSrc: 'c-ctrl-muxB', aluOp: 'c-ctrl-alu',
    memRead: 'c-ctrl-dmem', memWrite: 'c-ctrl-dmem', memToReg: 'c-ctrl-muxWb', branch: 'c-ctrl-muxPc', jump: 'c-ctrl-muxPc',
  };

  function step(text, comps, wires, tokens, extra) {
    return Object.assign({ text, comps: comps || [], wires: wires || [], tokens: tokens || [] }, extra || {});
  }

  class CPU {
    constructor() {
      this.mem = new Storage.Memory(ISA.MEM_SIZE, 16);
      this.regs = new Storage.RegisterFile(8, 16, true);
      this.program = new Array(ISA.MEM_SIZE).fill(0);
      this.reset();
    }
    load(words) {
      this.program = words.slice();
      this.reset();
    }
    reset() {
      this.mem.load(this.program);
      this.regs.reset();
      this.pc = 0;
      this.ir = 0;
      this.phaseIndex = 0;
      this.halted = false;
      this.instructions = 0;
      this.phaseCount = 0;
      this.flags = { Z: 0, N: 0, C: 0, V: 0 };
      this.l = {}; // internal latches of the current instruction
    }
    get nextPhase() { return PHASES[this.phaseIndex]; }

    stepPhase() {
      if (this.halted) return null;
      this.mem.log = [];
      const phase = PHASES[this.phaseIndex];
      const info = this['_' + phase]();
      info.phase = phase;
      info.phaseFa = PHASE_FA[phase];
      info.memLog = this.mem.log.slice();
      // union of everything used in the phase (for a non-animated overview)
      info.active = Array.from(new Set(info.steps.flatMap((s) => s.comps)));
      info.wires = Array.from(new Set(info.steps.flatMap((s) => s.wires)));
      info.text = info.steps.map((s) => s.text).join(' ');
      this.phaseCount++;
      this.phaseIndex = (this.phaseIndex + 1) % PHASES.length;
      if (this.phaseIndex === 0) this.instructions++;
      if (this.halted && this.phaseIndex !== 0) { this.instructions++; this.phaseIndex = 0; }
      return info;
    }
    stepInstruction() {
      const infos = [];
      do {
        const i = this.stepPhase();
        if (!i) break;
        infos.push(i);
      } while (this.phaseIndex !== 0 && !this.halted);
      return infos;
    }
    run(maxInstructions) {
      maxInstructions = maxInstructions || 100000;
      let n = 0;
      while (!this.halted && n < maxInstructions) { this.stepInstruction(); n++; }
      return n;
    }

    _FETCH() {
      const l = (this.l = {});
      l.pc = this.pc;
      this.ir = this.mem.read(this.pc);
      l.pcPlus1 = (this.pc + 1) & 0xFF;
      return {
        steps: [
          step(`مقدار PC = ${l.pc} از ثبات PC خارج شده و به عنوان آدرس به ورودی حافظهٔ دستور می‌رود.`,
            ['pc', 'imem'], ['w-pc-imem'], [{ wire: 'w-pc-imem', label: String(l.pc) }]),
          step(`حافظه خانهٔ شمارهٔ ${l.pc} را انتخاب می‌کند و محتوای آن، کلمهٔ ${hex4(this.ir)} (دودویی ${bin(this.ir, 16)})، را روی خروجی قرار می‌دهد.`,
            ['imem'], []),
          step(`کلمهٔ ${hex4(this.ir)} روی لبهٔ ساعت در ثبات دستور (IR) ذخیره می‌شود. این دستور «${ISA.disassemble(this.ir)}» است.`,
            ['imem', 'ir'], ['w-imem-ir'], [{ wire: 'w-imem-ir', label: hex4(this.ir) }], { commit: ['ir'] }),
          step(`همزمان، جمع‌کنندهٔ جداگانهٔ PC مقدار ${l.pc} + 1 = ${l.pcPlus1} را محاسبه می‌کند تا آدرس دستور بعدی آماده باشد.`,
            ['pc', 'pcadd'], ['w-pc-pcadd'], [{ wire: 'w-pc-pcadd', label: String(l.pc) }]),
        ],
      };
    }

    _DECODE() {
      const l = this.l;
      const d = (l.d = ISA.decode(this.ir));
      const c = (l.c = ISA.control(d));
      l.p2 = ISA.port2Reg(d);
      l.a = this.regs.values[d.rs];
      l.b = this.regs.values[l.p2];
      l.imm = d.imm;
      const asm = ISA.disassemble(this.ir);
      const opBits = bin(d.op, 4);
      const steps = [
        step(`بیت‌های [15:12] دستور، یعنی opcode = ${opBits}${d.format === 'R' ? ` و funct = ${bin(d.funct, 3)}` : ''}، به ورودی واحد کنترل می‌روند.`,
          ['ir', 'ctrl'], ['w-ir-ctrl'], [{ wire: 'w-ir-ctrl', label: opBits }]),
      ];
      if (c.halt) {
        this.halted = true;
        steps.push(step('واحد کنترل opcode = 1111 را HALT تشخیص می‌دهد و سیگنال توقف را فعال می‌کند. پردازنده متوقف می‌شود.', ['ctrl'], []));
        return { steps, asm };
      }
      const on = ISA.CONTROL_SIGNALS.filter((s) => s.key !== 'aluOp' && c[s.key]).map((s) => s.key);
      const lines = Array.from(new Set(Object.keys(CONTROL_LINES).filter((k) => k === 'aluOp' ? d.name !== 'NOP' && !c.jump : c[k]).map((k) => CONTROL_LINES[k])));
      steps.push(step(`واحد کنترل دستور ${d.name} (قالب ${d.format}) را تشخیص می‌دهد و سیگنال‌ها را تولید می‌کند: ${on.length ? on.map((k) => k + '=1').join('، ') : 'همهٔ سیگنال‌ها صفر'}${d.name !== 'NOP' && !c.jump ? `، aluOp = ${c.aluOp}` : ''}.`,
        ['ctrl'], lines, [], { control: c }));
      if (c.useA) {
        steps.push(step(`میدان rs = ${bin(d.rs, 3)} (یعنی R${d.rs}) به پورت خواندن ۱ بانک ثبات می‌رود. خروجی: R${d.rs} = ${s16(l.a)}.`,
          ['ir', 'regs'], ['w-ir-regs'], [{ wire: 'w-ir-regs', label: 'rs=R' + d.rs }], { read1: d.rs }));
      }
      if (c.useB) {
        const which = d.format === 'R' ? 'rt' : 'rd';
        steps.push(step(`میدان ${which} = ${bin(l.p2, 3)} (یعنی R${l.p2}) به پورت خواندن ۲ می‌رود (reg2Sel = ${c.reg2Sel}). خروجی: R${l.p2} = ${s16(l.b)}.`,
          ['ir', 'regs'], ['w-ir-regs'], [{ wire: 'w-ir-regs', label: which + '=R' + l.p2 }], { read2: l.p2 }));
      }
      if (d.format === 'I' || d.format === 'L') {
        const bits = d.format === 'L' ? 9 : 6;
        steps.push(step(`مقدار فوری ${bin(d.word, bits)} (${bits} بیت) با تکرار بیت علامت به ۱۶ بیت گسترش می‌یابد: ${bin(l.imm & 0xFFFF, 16)} = ${l.imm}.`,
          ['ir', 'imm'], ['w-ir-imm'], [{ wire: 'w-ir-imm', label: 'imm=' + l.imm }]));
      }
      if (d.format === 'J') {
        steps.push(step(`میدان آدرس [11:0] = ${d.addr} به عنوان مقصد پرش جدا می‌شود.`, ['ir', 'imm'], ['w-ir-imm'], [{ wire: 'w-ir-imm', label: String(d.addr) }]));
      }
      if (d.name === 'NOP') steps.push(step('NOP هیچ ثبات یا مقدار فوری‌ای نمی‌خواند.', [], []));
      return { steps, asm, control: c };
    }

    _EXECUTE() {
      const l = this.l, d = l.d, c = l.c;
      const bIn = c.aluSrc ? l.imm : l.b;
      const r = ALU.aluCompute(c.aluOp, l.a, bIn, 16);
      l.alu = r.result;
      l.nextPc = l.pcPlus1;
      const steps = [];
      if (c.jump) {
        l.nextPc = d.addr & 0xFF;
        steps.push(step(`JMP به ALU نیازی ندارد. آدرس مقصد ${l.nextPc} به ورودی MUX انتخاب PC فرستاده می‌شود و jump = 1 آن را انتخاب خواهد کرد.`,
          ['imm', 'muxPc'], ['w-imm-muxPc', 'c-ctrl-muxPc'], [{ wire: 'w-imm-muxPc', label: String(l.nextPc) }]));
        return { steps };
      }
      if (d.name === 'NOP') return { steps: [step('NOP: واحد اجرا در این چرخه بیکار است.', [], [])] };
      this.flags = r.flags;
      if (c.useA) {
        steps.push(step(`ورودی اول ALU (A) مستقیماً از پورت خواندن ۱ می‌آید: A = ${s16(l.a)}.`,
          ['regs', 'alu'], ['w-regs-alu'], [{ wire: 'w-regs-alu', label: String(s16(l.a)) }]));
      }
      if (c.aluSrc) {
        steps.push(step(`سیگنال aluSrc = 1 است، پس MUX ورودی دوم ALU «مقدار فوری» را انتخاب می‌کند: B = ${l.imm}.`,
          ['imm', 'muxB', 'alu'], ['w-imm-muxB', 'w-muxB-alu', 'c-ctrl-muxB'], [{ wire: 'w-imm-muxB', label: String(l.imm) }, { wire: 'w-muxB-alu', label: String(l.imm) }]));
      } else {
        steps.push(step(`سیگنال aluSrc = 0 است، پس MUX ورودی دوم ALU خروجی پورت ۲ بانک ثبات را انتخاب می‌کند: B = ${s16(l.b)}.`,
          ['regs', 'muxB', 'alu'], ['w-regs-muxB', 'w-muxB-alu', 'c-ctrl-muxB'], [{ wire: 'w-regs-muxB', label: String(s16(l.b)) }, { wire: 'w-muxB-alu', label: String(s16(l.b)) }]));
      }
      let opText;
      if (c.aluOp === 'PASSB') opText = `ALU با aluOp = PASSB ورودی B را بدون تغییر عبور می‌دهد: نتیجه = ${s16(r.result)}.`;
      else if (c.memRead || c.memWrite) opText = `ALU آدرس مؤثر حافظه را حساب می‌کند: ${s16(l.a)} + ${l.imm} = ${r.result & 0xFF}.`;
      else if (c.branch) opText = `ALU برای مقایسه تفریق می‌کند: ${s16(l.a)} − ${s16(l.b)} = ${s16(r.result)}، پس پرچم Z = ${r.flags.Z}.`;
      else opText = `ALU عملیات ${c.aluOp} را انجام می‌دهد: ${s16(l.a)} ${c.aluOp} ${s16(bIn)} = ${s16(r.result)}. پرچم‌ها: Z=${r.flags.Z} N=${r.flags.N} C=${r.flags.C} V=${r.flags.V}.`;
      steps.push(step(opText, ['alu'], ['c-ctrl-alu'], [], { alu: r }));
      if (c.branch) {
        const eq = r.flags.Z === 1;
        l.taken = c.branchNe ? !eq : eq;
        const target = (l.pcPlus1 + l.imm) & 0xFF;
        steps.push(step(`آدرس مقصد پرش محاسبه می‌شود: (PC+1) + imm = ${l.pcPlus1} + ${l.imm} = ${target}.`,
          ['imm', 'muxPc'], ['w-imm-muxPc'], [{ wire: 'w-imm-muxPc', label: String(target) }]));
        steps.push(step(`شرط ${d.name} (${c.branchNe ? 'نامساوی، یعنی Z = 0' : 'مساوی، یعنی Z = 1'}) ${l.taken ? `برقرار است ⇒ پرش انجام می‌شود و PC بعدی ${target} خواهد بود.` : `برقرار نیست ⇒ پرش انجام نمی‌شود و اجرا از ${l.pcPlus1} ادامه می‌یابد.`}`,
          ['alu', 'muxPc'], ['c-ctrl-muxPc'], []));
        if (l.taken) l.nextPc = target;
      }
      return { steps, alu: r };
    }

    _MEMORY() {
      const l = this.l, c = l.c;
      const addr = l.alu & 0xFF;
      if (c.memRead) {
        l.mdr = this.mem.read(addr);
        return {
          addr,
          steps: [
            step(`خروجی ALU، یعنی آدرس ${addr}، به ورودی آدرس حافظهٔ داده می‌رود.`, ['alu', 'dmem'], ['w-alu-dmem'], [{ wire: 'w-alu-dmem', label: String(addr) }]),
            step(`سیگنال MemRead = 1 فعال است. حافظه خانهٔ ${addr} را می‌خواند: MEM[${addr}] = ${s16(l.mdr)}.`, ['dmem'], ['c-ctrl-dmem'], [], { memRead: addr }),
            step(`دادهٔ خوانده‌شده (${s16(l.mdr)}) روی خروجی حافظه، به سمت MUX بازنویسی می‌رود.`, ['dmem', 'muxWb'], ['w-dmem-muxWb'], [{ wire: 'w-dmem-muxWb', label: String(s16(l.mdr)) }]),
          ],
        };
      }
      if (c.memWrite) {
        this.mem.write(addr, l.b);
        return {
          addr,
          steps: [
            step(`خروجی ALU، یعنی آدرس ${addr}، به ورودی آدرس حافظهٔ داده می‌رود.`, ['alu', 'dmem'], ['w-alu-dmem'], [{ wire: 'w-alu-dmem', label: String(addr) }]),
            step(`مقدار ثبات R${l.d.rd} = ${s16(l.b)} از پورت خواندن ۲ به ورودی «دادهٔ نوشتن» حافظه می‌رسد.`, ['regs', 'dmem'], ['w-regs-dmem'], [{ wire: 'w-regs-dmem', label: String(s16(l.b)) }]),
            step(`سیگنال MemWrite = 1 فعال است. روی لبهٔ ساعت MEM[${addr}] ← ${s16(l.b)} نوشته می‌شود.`, ['dmem'], ['c-ctrl-dmem'], [], { commit: ['mem'], memWrite: addr }),
          ],
        };
      }
      return { steps: [step(`MemRead = 0 و MemWrite = 0 است. این دستور (${l.d.name}) به حافظهٔ داده دسترسی ندارد؛ این فاز بدون کار می‌گذرد.`, [], [])] };
    }

    _WRITEBACK() {
      const l = this.l, c = l.c, d = l.d;
      const steps = [];
      if (c.regWrite) {
        const v = c.memToReg ? l.mdr : l.alu;
        steps.push(step(c.memToReg
          ? `سیگنال memToReg = 1 است، پس MUX بازنویسی دادهٔ حافظه (${s16(v)}) را انتخاب می‌کند.`
          : `سیگنال memToReg = 0 است، پس MUX بازنویسی نتیجهٔ ALU (${s16(v)}) را انتخاب می‌کند.`,
        ['muxWb', c.memToReg ? 'dmem' : 'alu'], [c.memToReg ? 'w-dmem-muxWb' : 'w-alu-muxWb', 'c-ctrl-muxWb'],
        [{ wire: c.memToReg ? 'w-dmem-muxWb' : 'w-alu-muxWb', label: String(s16(v)) }]));
        const ok = this.regs.write(d.rd, v);
        steps.push(step(ok
          ? `مقدار ${s16(v)} به ورودی «دادهٔ نوشتن» بانک ثبات می‌رسد. با regWrite = 1، روی لبهٔ ساعت R${d.rd} ← ${s16(v)} ذخیره می‌شود.`
          : 'مقصد R0 است. R0 به صفر سیم‌کشی شده و نوشتن در آن نادیده گرفته می‌شود.',
        ['muxWb', 'regs'], ['w-muxWb-regs', 'c-ctrl-regs'], [{ wire: 'w-muxWb-regs', label: String(s16(v)) }], { commit: ['regs'], written: ok ? d.rd : null }));
      } else {
        steps.push(step('regWrite = 0 است؛ این دستور چیزی در بانک ثبات نمی‌نویسد.', [], []));
      }
      const viaTarget = l.nextPc !== l.pcPlus1 || (c.jump && l.nextPc === l.pcPlus1);
      steps.push(step(viaTarget
        ? `MUX انتخاب PC ورودی «آدرس مقصد» (${l.nextPc}) را انتخاب می‌کند، چون ${c.jump ? 'jump = 1' : 'شرط پرش برقرار بود'}.`
        : `MUX انتخاب PC ورودی PC+1 (${l.nextPc}) را انتخاب می‌کند${c.branch ? '، چون شرط پرش برقرار نبود' : ''}.`,
      ['muxPc', viaTarget ? 'imm' : 'pcadd'], [viaTarget ? 'w-imm-muxPc' : 'w-pcadd-muxPc'], [{ wire: viaTarget ? 'w-imm-muxPc' : 'w-pcadd-muxPc', label: String(l.nextPc) }]));
      this.pc = l.nextPc;
      steps.push(step(`روی لبهٔ ساعت PC ← ${this.pc}. اجرای این دستور کامل شد و دستور بعدی از آدرس ${this.pc} واکشی خواهد شد.`,
        ['muxPc', 'pc'], ['w-muxPc-pc'], [{ wire: 'w-muxPc-pc', label: String(this.pc) }], { commit: ['pc'] }));
      return { steps };
    }
  }

  return { CPU, PHASES, PHASE_FA, CONTROL_LINES };
});
