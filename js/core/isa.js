/*
 * ISA — Instruction Set Architecture of the simulated 16-bit processor.
 *
 *  R-type : [15:12]=0001  [11:9]=rd  [8:6]=rs  [5:3]=rt  [2:0]=funct
 *  I-type : [15:12]=op    [11:9]=rd  [8:6]=rs  [5:0]=imm6 (signed)
 *  L-type : [15:12]=0011  [11:9]=rd  [8:0]=imm9 (signed)            (LI)
 *  J-type : [15:12]=1000  [11:0]=addr                              (JMP)
 *
 *  Registers R0..R7 (R0 is hard-wired to zero), 256 words of 16-bit memory.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = Object.assign(root.Sim || {}, factory());
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OPCODES = { NOP: 0, R: 1, ADDI: 2, LI: 3, LW: 4, SW: 5, BEQ: 6, BNE: 7, JMP: 8, HALT: 15 };
  const R_FUNCTS = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'SLT', 'SHL', 'SHR'];
  const MEM_SIZE = 256;

  const INSTRUCTIONS = {
    NOP:  { format: 'N', syntax: 'NOP', fa: 'هیچ کاری انجام نمی‌دهد' },
    ADD:  { format: 'R', syntax: 'ADD rd, rs, rt', fa: 'rd = rs + rt' },
    SUB:  { format: 'R', syntax: 'SUB rd, rs, rt', fa: 'rd = rs - rt' },
    AND:  { format: 'R', syntax: 'AND rd, rs, rt', fa: 'rd = rs & rt' },
    OR:   { format: 'R', syntax: 'OR rd, rs, rt', fa: 'rd = rs | rt' },
    XOR:  { format: 'R', syntax: 'XOR rd, rs, rt', fa: 'rd = rs ^ rt' },
    SLT:  { format: 'R', syntax: 'SLT rd, rs, rt', fa: 'rd = (rs < rt) ? 1 : 0' },
    SHL:  { format: 'R', syntax: 'SHL rd, rs, rt', fa: 'rd = rs << rt' },
    SHR:  { format: 'R', syntax: 'SHR rd, rs, rt', fa: 'rd = rs >> rt' },
    ADDI: { format: 'I', syntax: 'ADDI rd, rs, imm', fa: 'rd = rs + imm   (imm: -32..31)' },
    LI:   { format: 'L', syntax: 'LI rd, imm', fa: 'rd = imm   (imm: -256..255)' },
    LW:   { format: 'I', syntax: 'LW rd, imm(rs)', fa: 'rd = MEM[rs + imm]' },
    SW:   { format: 'I', syntax: 'SW rd, imm(rs)', fa: 'MEM[rs + imm] = rd' },
    BEQ:  { format: 'I', syntax: 'BEQ rd, rs, label', fa: 'if (rd == rs) PC = PC + 1 + imm' },
    BNE:  { format: 'I', syntax: 'BNE rd, rs, label', fa: 'if (rd != rs) PC = PC + 1 + imm' },
    JMP:  { format: 'J', syntax: 'JMP label', fa: 'PC = addr' },
    HALT: { format: 'N', syntax: 'HALT', fa: 'توقف پردازنده' },
  };

  function sext(v, bits) {
    const s = 1 << (bits - 1);
    return v & s ? v - (1 << bits) : v;
  }

  function decode(word) {
    word &= 0xFFFF;
    const op = (word >> 12) & 0xF;
    const d = {
      word, op,
      rd: (word >> 9) & 7, rs: (word >> 6) & 7, rt: (word >> 3) & 7, funct: word & 7,
      imm6: sext(word & 0x3F, 6), imm9: sext(word & 0x1FF, 9), addr: word & 0xFFF,
      name: 'NOP', format: 'N', illegal: false,
    };
    switch (op) {
      case 0: d.name = 'NOP'; d.format = 'N'; break;
      case 1: d.name = R_FUNCTS[d.funct]; d.format = 'R'; break;
      case 2: d.name = 'ADDI'; d.format = 'I'; break;
      case 3: d.name = 'LI'; d.format = 'L'; break;
      case 4: d.name = 'LW'; d.format = 'I'; break;
      case 5: d.name = 'SW'; d.format = 'I'; break;
      case 6: d.name = 'BEQ'; d.format = 'I'; break;
      case 7: d.name = 'BNE'; d.format = 'I'; break;
      case 8: d.name = 'JMP'; d.format = 'J'; break;
      case 15: d.name = 'HALT'; d.format = 'N'; break;
      default: d.name = 'NOP'; d.format = 'N'; d.illegal = true;
    }
    d.imm = d.format === 'L' ? d.imm9 : d.format === 'J' ? d.addr : d.imm6;
    return d;
  }

  /** Bit fields of an encoded instruction (for visualisation). */
  function fieldsOf(d) {
    const f = [{ name: 'opcode', hi: 15, lo: 12 }];
    if (d.format === 'R') f.push({ name: 'rd', hi: 11, lo: 9 }, { name: 'rs', hi: 8, lo: 6 }, { name: 'rt', hi: 5, lo: 3 }, { name: 'funct', hi: 2, lo: 0 });
    else if (d.format === 'I') f.push({ name: 'rd', hi: 11, lo: 9 }, { name: 'rs', hi: 8, lo: 6 }, { name: 'imm6', hi: 5, lo: 0 });
    else if (d.format === 'L') f.push({ name: 'rd', hi: 11, lo: 9 }, { name: 'imm9', hi: 8, lo: 0 });
    else if (d.format === 'J') f.push({ name: 'addr', hi: 11, lo: 0 });
    else f.push({ name: 'unused', hi: 11, lo: 0 });
    return f.map((x) => {
      const width = x.hi - x.lo + 1;
      const value = (d.word >> x.lo) & ((1 << width) - 1);
      return Object.assign(x, { width, value, bits: value.toString(2).padStart(width, '0') });
    });
  }

  /** Control unit: decoded instruction -> control signals. */
  function control(d) {
    const c = {
      regWrite: 0, aluSrc: 0, aluOp: 'ADD', memRead: 0, memWrite: 0, memToReg: 0,
      branch: 0, branchNe: 0, jump: 0, halt: 0, useA: 0, useB: 0, reg2Sel: 0,
    };
    switch (d.name) {
      case 'ADD': case 'SUB': case 'AND': case 'OR': case 'XOR': case 'SLT': case 'SHL': case 'SHR':
        Object.assign(c, { regWrite: 1, aluOp: d.name, useA: 1, useB: 1, reg2Sel: 0 }); break;
      case 'ADDI': Object.assign(c, { regWrite: 1, aluSrc: 1, aluOp: 'ADD', useA: 1 }); break;
      case 'LI': Object.assign(c, { regWrite: 1, aluSrc: 1, aluOp: 'PASSB' }); break;
      case 'LW': Object.assign(c, { regWrite: 1, aluSrc: 1, aluOp: 'ADD', memRead: 1, memToReg: 1, useA: 1 }); break;
      case 'SW': Object.assign(c, { aluSrc: 1, aluOp: 'ADD', memWrite: 1, useA: 1, useB: 1, reg2Sel: 1 }); break;
      case 'BEQ': Object.assign(c, { aluOp: 'SUB', branch: 1, useA: 1, useB: 1, reg2Sel: 1 }); break;
      case 'BNE': Object.assign(c, { aluOp: 'SUB', branch: 1, branchNe: 1, useA: 1, useB: 1, reg2Sel: 1 }); break;
      case 'JMP': c.jump = 1; break;
      case 'HALT': c.halt = 1; break;
      default: break; // NOP
    }
    return c;
  }

  const CONTROL_SIGNALS = [
    { key: 'regWrite', fa: 'نوشتن در بانک ثبات' },
    { key: 'reg2Sel', fa: 'انتخاب پورت دوم (0=rt ، 1=rd)' },
    { key: 'aluSrc', fa: 'ورودی دوم ALU (0=ثبات ، 1=مقدار فوری)' },
    { key: 'aluOp', fa: 'عملیات ALU' },
    { key: 'memRead', fa: 'خواندن از حافظه' },
    { key: 'memWrite', fa: 'نوشتن در حافظه' },
    { key: 'memToReg', fa: 'مقدار بازنویسی (0=ALU ، 1=حافظه)' },
    { key: 'branch', fa: 'دستور پرش شرطی' },
    { key: 'jump', fa: 'پرش غیرشرطی' },
    { key: 'halt', fa: 'توقف' },
  ];

  /** Register index read on the second read port. */
  function port2Reg(d) { return d.format === 'R' ? d.rt : d.rd; }

  /** Registers an instruction reads (used for hazard detection). */
  function sourceRegs(d, c) {
    c = c || control(d);
    const s = [];
    if (c.useA) s.push(d.rs);
    if (c.useB) s.push(port2Reg(d));
    return s;
  }

  function disassemble(word) {
    const d = decode(word);
    switch (d.format) {
      case 'R': return `${d.name} R${d.rd}, R${d.rs}, R${d.rt}`;
      case 'L': return `LI R${d.rd}, ${d.imm9}`;
      case 'J': return `JMP ${d.addr}`;
      case 'I':
        if (d.name === 'LW' || d.name === 'SW') return `${d.name} R${d.rd}, ${d.imm6}(R${d.rs})`;
        if (d.name === 'BEQ' || d.name === 'BNE') return `${d.name} R${d.rd}, R${d.rs}, ${d.imm6 >= 0 ? '+' : ''}${d.imm6}`;
        return `${d.name} R${d.rd}, R${d.rs}, ${d.imm6}`;
      default: return d.illegal ? `.word 0x${word.toString(16).toUpperCase().padStart(4, '0')}` : d.name;
    }
  }

  // ---------------------------------------------------------------- assembler

  function encodeR(funct, rd, rs, rt) { return (1 << 12) | (rd << 9) | (rs << 6) | (rt << 3) | funct; }
  function encodeI(op, rd, rs, imm) { return (op << 12) | (rd << 9) | (rs << 6) | (imm & 0x3F); }

  function assemble(src) {
    const lines = src.split(/\r?\n/);
    const labels = {};
    const items = [];
    const errors = [];
    let addr = 0;

    // Pass 1: labels & addresses
    lines.forEach((raw, i) => {
      let line = raw.replace(/(;|\/\/).*$/, '').trim();
      let m;
      while ((m = line.match(/^([A-Za-z_][\w]*)\s*:(.*)$/))) {
        const name = m[1];
        if (labels[name] !== undefined) errors.push({ line: i + 1, msg: `برچسب تکراری: ${name}` });
        labels[name] = addr;
        line = m[2].trim();
      }
      if (!line) return;
      m = line.match(/^(\S+)\s*(.*)$/);
      const mnem = m[1].toUpperCase();
      const args = m[2] ? m[2].split(',').map((s) => s.trim()).filter((s) => s.length) : [];
      if (mnem === '.ORG') {
        const v = parseNumber(args[0]);
        if (v === null || v < 0 || v >= MEM_SIZE) errors.push({ line: i + 1, msg: 'آدرس .org نامعتبر است' });
        else addr = v;
        return;
      }
      if (mnem === '.WORD') {
        if (!args.length) errors.push({ line: i + 1, msg: '.word به حداقل یک مقدار نیاز دارد' });
        args.forEach((a) => { items.push({ addr, mnem, args: [a], line: i + 1, src: raw.trim() }); addr++; });
        return;
      }
      items.push({ addr, mnem, args, line: i + 1, src: raw.trim() });
      addr++;
    });

    const words = new Array(MEM_SIZE).fill(0);
    const sourceMap = {};
    const listing = [];

    function err(it, msg) { errors.push({ line: it.line, msg }); }
    function reg(it, s) {
      const m = /^R([0-7])$/i.exec(s || '');
      if (!m) { err(it, `ثبات نامعتبر: «${s || ''}» (R0 تا R7)`); return 0; }
      return +m[1];
    }
    function value(it, s) {
      if (s === undefined) { err(it, 'عملوند کم است'); return 0; }
      const n = parseNumber(s);
      if (n !== null) return n;
      if (labels[s] !== undefined) return labels[s];
      err(it, `عدد یا برچسب نامعتبر: «${s}»`);
      return 0;
    }
    function range(it, v, lo, hi, what) {
      if (v < lo || v > hi) err(it, `${what} خارج از محدوده (${lo} تا ${hi}): ${v}`);
      return v;
    }
    function argc(it, n) { if (it.args.length !== n) err(it, `${it.mnem} به ${n} عملوند نیاز دارد`); }

    // Pass 2: encode
    items.forEach((it) => {
      if (it.addr >= MEM_SIZE) { err(it, 'برنامه از حافظه (۲۵۶ کلمه) بزرگ‌تر است'); return; }
      let w = 0;
      const a = it.args;
      const fidx = R_FUNCTS.indexOf(it.mnem);
      if (it.mnem === '.WORD') {
        w = range(it, value(it, a[0]), -32768, 65535, 'مقدار') & 0xFFFF;
      } else if (fidx >= 0) {
        argc(it, 3); w = encodeR(fidx, reg(it, a[0]), reg(it, a[1]), reg(it, a[2]));
      } else {
        switch (it.mnem) {
          case 'NOP': argc(it, 0); w = 0; break;
          case 'HALT': argc(it, 0); w = 0xF000; break;
          case 'ADDI': argc(it, 3); w = encodeI(2, reg(it, a[0]), reg(it, a[1]), range(it, value(it, a[2]), -32, 31, 'مقدار فوری')); break;
          case 'LI': argc(it, 2); w = (3 << 12) | (reg(it, a[0]) << 9) | (range(it, value(it, a[1]), -256, 255, 'مقدار فوری') & 0x1FF); break;
          case 'LW': case 'SW': {
            argc(it, 2);
            const m = /^(.*)\(\s*(R[0-7])\s*\)$/i.exec(a[1] || '');
            if (!m) { err(it, 'قالب آدرس باید imm(Rs) باشد، مثلاً 0(R1)'); break; }
            const off = m[1].trim() === '' ? 0 : value(it, m[1].trim());
            w = encodeI(it.mnem === 'LW' ? 4 : 5, reg(it, a[0]), reg(it, m[2]), range(it, off, -32, 31, 'جابه‌جایی'));
            break;
          }
          case 'BEQ': case 'BNE': {
            argc(it, 3);
            const t = a[2];
            let off;
            if (t !== undefined && labels[t] !== undefined) off = labels[t] - (it.addr + 1);
            else off = value(it, t);
            w = encodeI(it.mnem === 'BEQ' ? 6 : 7, reg(it, a[0]), reg(it, a[1]), range(it, off, -32, 31, 'فاصلهٔ پرش'));
            break;
          }
          case 'JMP': argc(it, 1); w = (8 << 12) | (range(it, value(it, a[0]), 0, MEM_SIZE - 1, 'آدرس') & 0xFFF); break;
          default: err(it, `دستور ناشناخته: ${it.mnem}`);
        }
      }
      words[it.addr] = w & 0xFFFF;
      sourceMap[it.addr] = it.line;
      listing.push({ addr: it.addr, word: w & 0xFFFF, line: it.line, src: it.src, isData: it.mnem === '.WORD' });
    });

    return { words, labels, errors, sourceMap, listing, ok: errors.length === 0 };
  }

  function parseNumber(s) {
    if (s === undefined || s === null) return null;
    s = String(s).trim();
    if (/^[-+]?0x[0-9a-f]+$/i.test(s)) return (s[0] === '-' ? -1 : 1) * parseInt(s.replace(/^[-+]/, ''), 16);
    if (/^[-+]?0b[01]+$/i.test(s)) return (s[0] === '-' ? -1 : 1) * parseInt(s.replace(/^[-+]?0b/i, ''), 2);
    if (/^[-+]?\d+$/.test(s)) return parseInt(s, 10);
    return null;
  }

  return {
    OPCODES, R_FUNCTS, INSTRUCTIONS, CONTROL_SIGNALS, MEM_SIZE,
    decode, fieldsOf, control, port2Reg, sourceRegs, disassemble, assemble, parseNumber, sext,
  };
});
