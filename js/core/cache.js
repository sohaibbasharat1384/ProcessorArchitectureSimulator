/*
 * Cache memory (حافظهٔ نهان) — direct-mapped / set-associative / fully-associative.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = Object.assign(root.Sim || {}, factory());
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function log2(n) {
    const l = Math.log2(n);
    if (!Number.isInteger(l)) throw new Error('Value must be a power of two: ' + n);
    return l;
  }

  class Cache {
    constructor(opts) {
      opts = opts || {};
      this.sets = opts.sets || 4;
      this.ways = opts.ways || 1;
      this.blockSize = opts.blockSize || 4;
      this.policy = opts.policy || 'LRU'; // LRU | FIFO | RANDOM
      this.addressBits = opts.addressBits || 8;
      this.hitTime = opts.hitTime || 1;
      this.missPenalty = opts.missPenalty || 20;
      this.offsetBits = log2(this.blockSize);
      this.indexBits = log2(this.sets);
      this.tagBits = this.addressBits - this.offsetBits - this.indexBits;
      if (this.tagBits < 0) throw new Error('Cache is larger than the address space');
      this.random = opts.random || Math.random;
      this.reset();
    }
    reset() {
      this.time = 0;
      this.lines = [];
      for (let s = 0; s < this.sets; s++) {
        const set = [];
        for (let w = 0; w < this.ways; w++) set.push({ valid: false, tag: 0, lastUsed: 0, insertedAt: 0 });
        this.lines.push(set);
      }
      this.seenBlocks = new Set();
      this.stats = { accesses: 0, hits: 0, misses: 0, evictions: 0, compulsory: 0 };
      this.history = [];
    }
    split(addr) {
      const offset = addr & (this.blockSize - 1);
      const index = (addr >> this.offsetBits) & (this.sets - 1);
      const tag = addr >> (this.offsetBits + this.indexBits);
      return { offset, index, tag, block: addr >> this.offsetBits };
    }
    blockStart(tag, index) { return ((tag << this.indexBits) | index) << this.offsetBits; }
    access(addr) {
      addr = addr & (Math.pow(2, this.addressBits) - 1);
      this.time++;
      this.stats.accesses++;
      const p = this.split(addr);
      const set = this.lines[p.index];
      const res = Object.assign({ addr, hit: false, way: -1, evicted: null, kind: null, n: this.time }, p);
      let way = set.findIndex((l) => l.valid && l.tag === p.tag);
      if (way >= 0) {
        res.hit = true;
        res.way = way;
        set[way].lastUsed = this.time;
        this.stats.hits++;
      } else {
        this.stats.misses++;
        res.kind = this.seenBlocks.has(p.block) ? 'conflict' : 'compulsory';
        if (res.kind === 'compulsory') this.stats.compulsory++;
        way = set.findIndex((l) => !l.valid);
        if (way < 0) {
          if (this.policy === 'FIFO') way = argMin(set, (l) => l.insertedAt);
          else if (this.policy === 'RANDOM') way = Math.floor(this.random() * this.ways);
          else way = argMin(set, (l) => l.lastUsed);
          const old = set[way];
          res.evicted = { tag: old.tag, start: this.blockStart(old.tag, p.index) };
          this.stats.evictions++;
        }
        set[way] = { valid: true, tag: p.tag, lastUsed: this.time, insertedAt: this.time };
        res.way = way;
        this.seenBlocks.add(p.block);
      }
      this.history.push(res);
      return res;
    }
    hitRate() { return this.stats.accesses ? this.stats.hits / this.stats.accesses : 0; }
    /** Average memory access time = hit time + miss rate × miss penalty */
    amat() { return this.hitTime + (1 - this.hitRate()) * this.missPenalty; }
  }

  function argMin(arr, f) {
    let best = 0;
    for (let i = 1; i < arr.length; i++) if (f(arr[i]) < f(arr[best])) best = i;
    return best;
  }

  return { Cache };
});
