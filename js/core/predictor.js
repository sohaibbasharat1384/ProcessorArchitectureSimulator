/*
 * Branch predictors (پیش‌بینی پرش):
 *   static-taken, static-not-taken, 1-bit, 2-bit saturating counter,
 *   and a two-level local-history predictor.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = Object.assign(root.Sim || {}, factory());
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TWO_BIT_STATES = ['SN', 'WN', 'WT', 'ST']; // strongly/weakly not-taken / taken

  const PREDICTOR_TYPES = {
    'static-T': { fa: 'ایستا: همیشه «انجام می‌شود»' },
    'static-N': { fa: 'ایستا: همیشه «انجام نمی‌شود»' },
    '1bit': { fa: 'پویا ۱ بیتی' },
    '2bit': { fa: 'پویا ۲ بیتی (شمارندهٔ اشباع)' },
    'history': { fa: 'دو سطحی با تاریخچهٔ محلی' },
  };

  class BranchPredictor {
    constructor(type, historyBits) {
      this.type = type || '2bit';
      this.historyBits = historyBits || 2;
      this.reset();
    }
    reset() {
      this.bit = 0;          // 1-bit: last outcome
      this.counter = 1;      // 2-bit: start Weakly Not-taken
      this.history = 0;      // two-level: recent outcomes
      this.table = new Array(1 << this.historyBits).fill(1);
    }
    predict() {
      switch (this.type) {
        case 'static-T': return true;
        case 'static-N': return false;
        case '1bit': return this.bit === 1;
        case '2bit': return this.counter >= 2;
        case 'history': return this.table[this.history] >= 2;
        default: throw new Error('Unknown predictor ' + this.type);
      }
    }
    state() {
      switch (this.type) {
        case '1bit': return this.bit ? 'T' : 'N';
        case '2bit': return TWO_BIT_STATES[this.counter];
        case 'history': return `h=${this.history.toString(2).padStart(this.historyBits, '0')}:${TWO_BIT_STATES[this.table[this.history]]}`;
        default: return '-';
      }
    }
    update(taken) {
      const t = taken ? 1 : 0;
      this.bit = t;
      this.counter = Math.max(0, Math.min(3, this.counter + (t ? 1 : -1)));
      const h = this.history;
      this.table[h] = Math.max(0, Math.min(3, this.table[h] + (t ? 1 : -1)));
      this.history = ((h << 1) | t) & ((1 << this.historyBits) - 1);
    }
    step(taken) {
      const before = this.state();
      const prediction = this.predict();
      this.update(taken);
      return { prediction, outcome: !!taken, correct: prediction === !!taken, before, after: this.state() };
    }
  }

  function runSequence(type, outcomes, historyBits) {
    const p = new BranchPredictor(type, historyBits);
    const steps = outcomes.map((o) => p.step(o));
    const correct = steps.filter((s) => s.correct).length;
    return { steps, correct, accuracy: outcomes.length ? correct / outcomes.length : 0 };
  }

  function parseOutcomes(s) {
    return (s.toUpperCase().match(/[TN10]/g) || []).map((c) => c === 'T' || c === '1');
  }

  return { BranchPredictor, PREDICTOR_TYPES, TWO_BIT_STATES, runSequence, parseOutcomes };
});
