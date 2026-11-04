/*
 * ALU — Arithmetic Logic Unit
 * واحد محاسبه و منطق: عملیات حسابی/منطقی و تولید پرچم‌ها (Z, N, C, V)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = Object.assign(root.Sim || {}, factory());
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ALU_OPS = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'NOT', 'SLT', 'SHL', 'SHR', 'PASSB'];

  function maskOf(width) { return Math.pow(2, width) - 1; }

  function toUnsigned(v, width) {
    const m = Math.pow(2, width);
    return ((Math.trunc(v) % m) + m) % m;
  }

  function toSigned(v, width) {
    v = toUnsigned(v, width);
    const sign = Math.pow(2, width - 1);
    return v >= sign ? v - Math.pow(2, width) : v;
  }

  /**
   * Compute an ALU operation.
   * Returns result, flags and (for ADD/SUB) the ripple-carry chain bit by bit.
   */
  function aluCompute(op, a, b, width) {
    width = width || 16;
    const m = maskOf(width);
    const sign = Math.pow(2, width - 1);
    a = toUnsigned(a, width);
    b = toUnsigned(b, width);
    let r = 0, C = 0, V = 0, chain = null, bEff = b;

    switch (op) {
      case 'ADD':
      case 'SUB': {
        // SUB = A + (~B) + 1  (two's complement)
        bEff = op === 'SUB' ? (~b) & m : b;
        let c = op === 'SUB' ? 1 : 0;
        chain = [];
        for (let i = 0; i < width; i++) {
          const ai = (a >> i) & 1, bi = (bEff >> i) & 1;
          const s = ai ^ bi ^ c;
          const co = (ai & bi) | (ai & c) | (bi & c);
          chain.push({ bit: i, a: ai, b: bi, cin: c, sum: s, cout: co });
          r |= s << i;
          c = co;
        }
        r = toUnsigned(r, width);
        C = c;
        const sa = a & sign ? 1 : 0, sb = bEff & sign ? 1 : 0, sr = r & sign ? 1 : 0;
        V = sa === sb && sr !== sa ? 1 : 0;
        break;
      }
      case 'AND': r = a & b; break;
      case 'OR': r = a | b; break;
      case 'XOR': r = a ^ b; break;
      case 'NOT': r = (~a) & m; break;
      case 'SLT': r = toSigned(a, width) < toSigned(b, width) ? 1 : 0; break;
      case 'SHL': {
        const s = b % 32;
        if (s >= width) { r = 0; C = s === width ? a & 1 : 0; }
        else { r = (a << s) & m; C = s > 0 ? (a >> (width - s)) & 1 : 0; }
        break;
      }
      case 'SHR': {
        const s = b % 32;
        if (s >= width) { r = 0; C = s === width ? (a >> (width - 1)) & 1 : 0; }
        else { r = a >>> s; C = s > 0 ? (a >> (s - 1)) & 1 : 0; }
        break;
      }
      case 'PASSB': r = b; break;
      default: throw new Error('Unknown ALU op: ' + op);
    }
    r = toUnsigned(r, width);
    return {
      op, a, b, bEff, width, result: r,
      flags: { Z: r === 0 ? 1 : 0, N: r & sign ? 1 : 0, C, V },
      chain,
    };
  }

  return { ALU_OPS, aluCompute, toSigned, toUnsigned, maskOf };
});
