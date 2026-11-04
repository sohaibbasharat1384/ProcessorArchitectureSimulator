/* Simple test runner: node tests/run-tests.js */
'use strict';
const assert = require('assert');
const { aluCompute, toSigned } = require('../js/core/alu.js');
const ISA = require('../js/core/isa.js');
const { RegisterFile, Memory } = require('../js/core/storage.js');
const { Cache } = require('../js/core/cache.js');
const { runSequence, parseOutcomes } = require('../js/core/predictor.js');
const { CPU } = require('../js/core/cpu.js');
const { Pipeline } = require('../js/core/pipeline.js');
const { SAMPLE_PROGRAMS } = require('../js/core/programs.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('ALU');
test('ADD with carry and overflow (8-bit)', () => {
  let r = aluCompute('ADD', 200, 100, 8);
  assert.strictEqual(r.result, 44); assert.strictEqual(r.flags.C, 1); assert.strictEqual(r.flags.V, 0);
  r = aluCompute('ADD', 100, 100, 8);
  assert.strictEqual(r.result, 200); assert.strictEqual(r.flags.V, 1); assert.strictEqual(r.flags.N, 1);
});
test('SUB produces zero flag and borrow semantics', () => {
  let r = aluCompute('SUB', 5, 5, 8);
  assert.strictEqual(r.result, 0); assert.strictEqual(r.flags.Z, 1); assert.strictEqual(r.flags.C, 1);
  r = aluCompute('SUB', 3, 5, 8);
  assert.strictEqual(toSigned(r.result, 8), -2); assert.strictEqual(r.flags.C, 0);
  r = aluCompute('SUB', -128, 1, 8);
  assert.strictEqual(r.flags.V, 1);
});
test('logic, shifts and SLT', () => {
  assert.strictEqual(aluCompute('AND', 0b1100, 0b1010, 4).result, 0b1000);
  assert.strictEqual(aluCompute('OR', 0b1100, 0b1010, 4).result, 0b1110);
  assert.strictEqual(aluCompute('XOR', 0b1100, 0b1010, 4).result, 0b0110);
  assert.strictEqual(aluCompute('NOT', 0b1100, 0, 4).result, 0b0011);
  const shl = aluCompute('SHL', 0b10010001, 1, 8);
  assert.strictEqual(shl.result, 0b00100010); assert.strictEqual(shl.flags.C, 1);
  assert.strictEqual(aluCompute('SHR', 0b1000, 3, 4).result, 1);
  assert.strictEqual(aluCompute('SLT', -3, 2, 8).result, 1);
  assert.strictEqual(aluCompute('SLT', 2, -3, 8).result, 0);
});
test('ripple carry chain matches result', () => {
  const r = aluCompute('ADD', 0b1011, 0b0111, 4);
  assert.strictEqual(r.chain.length, 4);
  assert.strictEqual(r.chain.reduce((acc, c) => acc | (c.sum << c.bit), 0), r.result);
});

console.log('ISA / assembler');
test('encode/decode round trip via disassembler', () => {
  const src = 'ADD R1, R2, R3\nADDI R4, R5, -7\nLI R6, -200\nLW R1, 3(R2)\nSW R7, -1(R0)\nJMP 12\nHALT\nNOP';
  const a = ISA.assemble(src);
  assert.ok(a.ok, JSON.stringify(a.errors));
  const dis = a.listing.map((l) => ISA.disassemble(l.word));
  assert.deepStrictEqual(dis, ['ADD R1, R2, R3', 'ADDI R4, R5, -7', 'LI R6, -200', 'LW R1, 3(R2)', 'SW R7, -1(R0)', 'JMP 12', 'HALT', 'NOP']);
});
test('labels and branch offsets', () => {
  const a = ISA.assemble('top: NOP\n BEQ R1, R2, top\n BNE R1, R2, end\n NOP\nend: HALT');
  assert.ok(a.ok);
  assert.strictEqual(ISA.decode(a.words[1]).imm6, -2);
  assert.strictEqual(ISA.decode(a.words[2]).imm6, 1);
});
test('assembler reports errors with line numbers', () => {
  const a = ISA.assemble('ADDI R1, R1, 100\nFOO R1\nADD R9, R1, R1');
  assert.strictEqual(a.ok, false);
  assert.deepStrictEqual(a.errors.map((e) => e.line), [1, 2, 3]);
});
test('control signals', () => {
  const c = ISA.control(ISA.decode(ISA.assemble('LW R1, 0(R2)').words[0]));
  assert.strictEqual(c.memRead, 1); assert.strictEqual(c.memToReg, 1); assert.strictEqual(c.regWrite, 1); assert.strictEqual(c.aluSrc, 1);
  const s = ISA.control(ISA.decode(ISA.assemble('SW R1, 0(R2)').words[0]));
  assert.strictEqual(s.memWrite, 1); assert.strictEqual(s.regWrite, 0);
});

console.log('Register file / memory');
test('R0 hard-wired, write on clock edge', () => {
  const rf = new RegisterFile(8, 16, true);
  rf.latch(3, 42, true);
  assert.strictEqual(rf.values[3], 0);
  rf.clockEdge();
  assert.strictEqual(rf.values[3], 42);
  rf.latch(4, 9, false); rf.clockEdge();
  assert.strictEqual(rf.values[4], 0);
  rf.write(0, 5);
  assert.strictEqual(rf.values[0], 0);
});
test('memory masks values and addresses', () => {
  const m = new Memory(256, 16);
  m.write(300, 0x1FFFF);
  assert.strictEqual(m.peek(44), 0xFFFF);
});

console.log('Cache');
test('direct-mapped conflict misses', () => {
  const c = new Cache({ sets: 4, ways: 1, blockSize: 4, addressBits: 8 });
  const res = [0, 1, 16, 0].map((a) => c.access(a));
  assert.deepStrictEqual(res.map((r) => r.hit), [false, true, false, false]);
  assert.strictEqual(res[3].kind, 'conflict');
  assert.strictEqual(res[2].evicted.start, 0);
});
test('2-way LRU keeps both blocks', () => {
  const c = new Cache({ sets: 2, ways: 2, blockSize: 4, addressBits: 8, policy: 'LRU' });
  const res = [0, 16, 0, 32, 0].map((a) => c.access(a));
  assert.deepStrictEqual(res.map((r) => r.hit), [false, false, true, false, true]);
  assert.strictEqual(res[3].evicted.start, 16);
});
test('FIFO evicts oldest inserted', () => {
  const c = new Cache({ sets: 1, ways: 2, blockSize: 1, addressBits: 8, policy: 'FIFO' });
  const res = [0, 1, 0, 2, 0].map((a) => c.access(a));
  assert.deepStrictEqual(res.map((r) => r.hit), [false, false, true, false, false]);
});

console.log('Branch predictor');
test('2-bit beats 1-bit on loop pattern', () => {
  const seq = parseOutcomes('TTTN TTTN TTTN TTTN');
  const one = runSequence('1bit', seq), two = runSequence('2bit', seq);
  assert.ok(two.accuracy > one.accuracy, `${two.accuracy} vs ${one.accuracy}`);
});
test('history predictor learns alternating pattern', () => {
  const seq = parseOutcomes('TN'.repeat(20));
  const h = runSequence('history', seq, 2);
  assert.ok(h.steps.slice(10).every((s) => s.correct));
});

console.log('CPU & pipeline on sample programs');
function checkExpect(p, asm, regs, mem, label) {
  const e = p.expect || {};
  if (e.mem) for (const k in e.mem) assert.strictEqual(toSigned(mem.peek(asm.labels[k]), 16), e.mem[k], `${label} ${k}`);
  if (e.memArray) for (const k in e.memArray) e.memArray[k].forEach((v, i) => assert.strictEqual(mem.peek(asm.labels[k] + i), v, `${label} ${k}[${i}]`));
  if (e.regs) for (const k in e.regs) assert.strictEqual(regs.values[k], e.regs[k], `${label} R${k}`);
}
for (const p of SAMPLE_PROGRAMS) {
  test(`${p.id}: single-cycle CPU`, () => {
    const asm = ISA.assemble(p.src);
    assert.ok(asm.ok, JSON.stringify(asm.errors));
    const cpu = new CPU(); cpu.load(asm.words); cpu.run(10000);
    assert.ok(cpu.halted);
    checkExpect(p, asm, cpu.regs, cpu.mem, 'cpu');
  });
  for (const fwd of [true, false]) {
    test(`${p.id}: pipeline (forwarding=${fwd}) matches CPU`, () => {
      const asm = ISA.assemble(p.src);
      const cpu = new CPU(); cpu.load(asm.words); cpu.run(10000);
      const pl = new Pipeline({ forwarding: fwd }); pl.load(asm.words); pl.run();
      assert.ok(!pl.timedOut, 'pipeline timed out');
      assert.deepStrictEqual(pl.regs.values, cpu.regs.values);
      assert.deepStrictEqual(pl.mem.data, cpu.mem.data);
      assert.strictEqual(pl.stats.completed, cpu.instructions, 'instruction count');
      checkExpect(p, asm, pl.regs, pl.mem, 'pipe');
    });
  }
}
const KNOWN_WIRES = new Set(['w-pc-imem', 'w-pc-pcadd', 'w-pcadd-muxPc', 'w-imm-muxPc', 'w-muxPc-pc', 'w-imem-ir', 'w-ir-ctrl', 'w-ir-regs', 'w-ir-imm',
  'w-regs-alu', 'w-regs-muxB', 'w-imm-muxB', 'w-muxB-alu', 'w-alu-dmem', 'w-regs-dmem', 'w-dmem-muxWb', 'w-alu-muxWb', 'w-muxWb-regs',
  'c-ctrl-muxB', 'c-ctrl-alu', 'c-ctrl-dmem', 'c-ctrl-muxWb', 'c-ctrl-regs', 'c-ctrl-muxPc']);
test('CPU micro-steps: every phase has steps, tokens travel on known wires', () => {
  for (const p of SAMPLE_PROGRAMS) {
    const cpu = new CPU(); cpu.load(ISA.assemble(p.src).words);
    let guard = 0;
    while (!cpu.halted && guard++ < 5000) {
      const info = cpu.stepPhase();
      assert.ok(info.steps.length > 0, `${p.id} ${info.phase} has no steps`);
      for (const s of info.steps) {
        assert.ok(s.text && s.text.length > 10, 'step text');
        for (const w of s.wires) assert.ok(KNOWN_WIRES.has(w), 'unknown wire ' + w);
        for (const t of s.tokens) assert.ok(s.wires.includes(t.wire), `token wire ${t.wire} not lit in step`);
      }
      if (info.phase === 'WRITEBACK') assert.ok(info.steps.some((s) => (s.commit || []).includes('pc')), 'WB commits pc');
    }
  }
});
test('pipeline describes every busy stage in every cycle', () => {
  for (const p of SAMPLE_PROGRAMS) for (const fwd of [true, false]) {
    const pl = new Pipeline({ forwarding: fwd }); pl.load(ISA.assemble(p.src).words); pl.run();
    for (const t of pl.timeline) for (const s of ['IF', 'ID', 'EX', 'MEM', 'WB']) {
      if (t.occ[s] !== null) assert.ok(t.detail[s], `${p.id} cycle ${t.cycle} ${s} has no description`);
    }
  }
});
test('forwarding reduces cycles and load-use still stalls', () => {
  const asm = ISA.assemble(SAMPLE_PROGRAMS.find((p) => p.id === 'hazards').src);
  const a = new Pipeline({ forwarding: true }); a.load(asm.words); a.run();
  const b = new Pipeline({ forwarding: false }); b.load(asm.words); b.run();
  assert.ok(a.stats.cycles < b.stats.cycles);
  assert.strictEqual(a.stats.stalls, 1);
  assert.ok(a.stats.forwards > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
