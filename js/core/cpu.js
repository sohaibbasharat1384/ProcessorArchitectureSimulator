/*
 * Single-cycle CPU, shown one phase at a time:
 *   FETCH → DECODE → EXECUTE → MEMORY → WRITEBACK
 * Each phase returns the datapath components/wires it uses so the UI can highlight them.
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
        active: ['pc', 'imem', 'ir', 'pcadd'],
        wires: ['w-pc-imem', 'w-imem-ir', 'w-pc-pcadd'],
        text: `آدرس PC=${l.pc} به حافظه فرستاده شد و دستور ${hex4(this.ir)} در ثبات دستور (IR) قرار گرفت. همزمان PC+1=${l.pcPlus1} محاسبه شد.`,
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
      if (c.halt) {
        this.halted = true;
        return { active: ['ir', 'ctrl'], wires: ['w-ir-ctrl'], text: 'دستور HALT رمزگشایی شد؛ پردازنده متوقف می‌شود.', asm };
      }
      const parts = [`دستور «${asm}» رمزگشایی شد (قالب ${d.format}).`];
      if (c.useA) parts.push(`خواندن R${d.rs}=${l.a}`);
      if (c.useB) parts.push(`خواندن R${l.p2}=${l.b}`);
      if (c.aluSrc || c.branch || c.jump) parts.push(`مقدار فوری با گسترش علامت = ${l.imm}`);
      return {
        active: ['ir', 'ctrl', 'regs', 'imm'],
        wires: ['w-ir-ctrl', 'w-ir-regs', 'w-ir-imm'],
        text: parts.join('؛ '),
        asm,
        control: c,
      };
    }
    _EXECUTE() {
      const l = this.l, d = l.d, c = l.c;
      const bIn = c.aluSrc ? l.imm : l.b;
      const r = ALU.aluCompute(c.aluOp, l.a, bIn, 16);
      l.alu = r.result;
      this.flags = r.flags;
      l.nextPc = l.pcPlus1;
      const active = ['alu', 'muxB'], wires = ['w-muxB-alu'];
      if (c.useA) wires.push('w-regs-alu');
      wires.push(c.aluSrc ? 'w-imm-muxB' : 'w-regs-muxB');
      let text;
      if (c.jump) {
        l.nextPc = d.addr & 0xFF;
        return { active: ['muxPc', 'imm'], wires: ['w-imm-muxPc'], text: `پرش غیرشرطی: PC بعدی = ${l.nextPc}` };
      }
      if (d.name === 'NOP') return { active: [], wires: [], text: 'NOP: واحد اجرا بیکار است.' };
      if (c.branch) {
        const eq = r.flags.Z === 1;
        l.taken = c.branchNe ? !eq : eq;
        const target = (l.pcPlus1 + l.imm) & 0xFF;
        if (l.taken) l.nextPc = target;
        active.push('muxPc');
        wires.push('w-imm-muxPc');
        text = `ALU مقدار ${l.a} − ${l.b} = ${ALU.toSigned(r.result, 16)} را محاسبه کرد (Z=${r.flags.Z}). شرط ${d.name} ${l.taken ? 'برقرار است ⇒ پرش به ' + target : 'برقرار نیست ⇒ ادامه از ' + l.pcPlus1}.`;
      } else if (c.aluOp === 'PASSB') {
        text = `ALU مقدار فوری ${l.imm} را عبور داد.`;
      } else {
        text = `ALU: ${l.a} ${c.aluOp} ${ALU.toSigned(bIn, 16)} = ${ALU.toSigned(r.result, 16)}  (Z=${r.flags.Z} N=${r.flags.N} C=${r.flags.C} V=${r.flags.V})`;
        if (c.memRead || c.memWrite) text = `محاسبهٔ آدرس حافظه: ${l.a} + ${l.imm} = ${r.result & 0xFF}`;
      }
      return { active, wires, text, alu: r };
    }
    _MEMORY() {
      const l = this.l, c = l.c;
      const addr = l.alu & 0xFF;
      if (c.memRead) {
        l.mdr = this.mem.read(addr);
        return { active: ['dmem'], wires: ['w-alu-dmem', 'w-dmem-muxWb'], text: `خواندن از حافظه: MEM[${addr}] = ${ALU.toSigned(l.mdr, 16)}`, addr };
      }
      if (c.memWrite) {
        this.mem.write(addr, l.b);
        return { active: ['dmem'], wires: ['w-alu-dmem', 'w-regs-dmem'], text: `نوشتن در حافظه: MEM[${addr}] ← ${ALU.toSigned(l.b, 16)}`, addr };
      }
      return { active: [], wires: [], text: 'این دستور به حافظهٔ داده دسترسی ندارد.' };
    }
    _WRITEBACK() {
      const l = this.l, c = l.c, d = l.d;
      const active = ['pc', 'muxPc'], wires = ['w-muxPc-pc', l.nextPc === l.pcPlus1 ? 'w-pcadd-muxPc' : 'w-imm-muxPc'];
      let text = '';
      if (c.regWrite) {
        const v = c.memToReg ? l.mdr : l.alu;
        const ok = this.regs.write(d.rd, v);
        active.push('regs', 'muxWb');
        wires.push('w-muxWb-regs', c.memToReg ? 'w-dmem-muxWb' : 'w-alu-muxWb');
        text = ok ? `R${d.rd} ← ${ALU.toSigned(v, 16)}؛ ` : 'R0 همیشه صفر است، نوشتن نادیده گرفته شد؛ ';
      }
      this.pc = l.nextPc;
      text += `PC ← ${this.pc}`;
      return { active, wires, text };
    }
  }

  return { CPU, PHASES, PHASE_FA };
});
