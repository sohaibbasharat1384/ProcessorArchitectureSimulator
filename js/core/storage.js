/*
 * Register file (بانک ثبات) and main memory (حافظه اصلی).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = Object.assign(root.Sim || {}, factory());
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class RegisterFile {
    constructor(count, width, zeroReg) {
      this.count = count || 8;
      this.width = width || 16;
      this.mask = Math.pow(2, this.width) - 1;
      this.zeroReg = zeroReg !== false; // R0 hard-wired to zero
      this.reset();
    }
    reset() {
      this.values = new Array(this.count).fill(0);
      this.pending = null;
      this.lastWrite = null;
      this.lastReads = [];
    }
    read(i) {
      this.lastReads.push(i);
      return this.values[i];
    }
    /** Immediate write (used by CPU models). Returns false if ignored (R0). */
    write(i, v) {
      if (this.zeroReg && i === 0) { this.lastWrite = { reg: 0, value: v & this.mask, ignored: true }; return false; }
      this.values[i] = v & this.mask;
      this.lastWrite = { reg: i, value: this.values[i], ignored: false };
      return true;
    }
    /** Prepare a write that takes effect on the next clock edge. */
    latch(i, v, writeEnable) { this.pending = { reg: i, value: v & this.mask, we: !!writeEnable }; }
    /** Rising clock edge: commit a pending write if write-enable is set. */
    clockEdge() {
      const p = this.pending;
      this.pending = null;
      if (!p) return { committed: false, reason: 'nothing' };
      if (!p.we) return { committed: false, reason: 'we', reg: p.reg, value: p.value };
      const ok = this.write(p.reg, p.value);
      return { committed: ok, reason: ok ? 'ok' : 'zero', reg: p.reg, value: p.value };
    }
  }

  class Memory {
    constructor(size, width) {
      this.size = size || 256;
      this.width = width || 16;
      this.mask = Math.pow(2, this.width) - 1;
      this.data = new Array(this.size).fill(0);
      this.log = [];
    }
    norm(addr) { return ((addr % this.size) + this.size) % this.size; }
    read(addr) {
      addr = this.norm(addr);
      const value = this.data[addr];
      this.log.push({ type: 'R', addr, value });
      return value;
    }
    write(addr, value) {
      addr = this.norm(addr);
      this.data[addr] = value & this.mask;
      this.log.push({ type: 'W', addr, value: this.data[addr] });
    }
    peek(addr) { return this.data[this.norm(addr)]; }
    load(words) {
      this.data = new Array(this.size).fill(0);
      (words || []).forEach((w, i) => { if (i < this.size) this.data[i] = w & this.mask; });
      this.log = [];
    }
    clear() { this.load([]); }
  }

  return { RegisterFile, Memory };
});
