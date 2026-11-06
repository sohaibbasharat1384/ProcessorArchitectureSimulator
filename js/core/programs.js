/*
 * Sample assembly programs (برنامه‌های نمونه).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = Object.assign(root.Sim || {}, factory());
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SAMPLE_PROGRAMS = [
    {
      id: 'sum', fa: 'جمع اعداد ۱ تا ۱۰',
      expect: { mem: { result: 55 } },
      src: `; sum = 1 + 2 + ... + 10  -> result
        LI   R1, 10        ; n
        LI   R2, 0         ; sum
loop:   ADD  R2, R2, R1    ; sum += n
        ADDI R1, R1, -1    ; n--
        BNE  R1, R0, loop  ; while (n != 0)
        LI   R4, result
        SW   R2, 0(R4)
        HALT
result: .word 0
`,
    },
    {
      id: 'mul', fa: 'ضرب با جمع‌های متوالی (۶×۷)',
      expect: { mem: { out: 42 } },
      src: `; out = 6 * 7 using repeated addition
        LI   R1, 6
        LI   R2, 7
        LI   R3, 0
loop:   BEQ  R2, R0, done
        ADD  R3, R3, R1
        ADDI R2, R2, -1
        JMP  loop
done:   LI   R4, out
        SW   R3, 0(R4)
        HALT
out:    .word 0
`,
    },
    {
      id: 'fib', fa: 'دنبالهٔ فیبوناچی در حافظه',
      expect: { memArray: { fib: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34] } },
      src: `; store the first 10 Fibonacci numbers at "fib"
        LI   R1, 0         ; a
        LI   R2, 1         ; b
        LI   R3, fib       ; pointer
        LI   R4, 10        ; counter
loop:   SW   R1, 0(R3)
        ADD  R5, R1, R2    ; t = a + b
        ADD  R1, R2, R0    ; a = b
        ADD  R2, R5, R0    ; b = t
        ADDI R3, R3, 1
        ADDI R4, R4, -1
        BNE  R4, R0, loop
        HALT
fib:    .word 0,0,0,0,0,0,0,0,0,0
`,
    },
    {
      id: 'array', fa: 'جمع عناصر آرایه (مخاطرهٔ Load-Use)',
      expect: { mem: { total: 14 } },
      src: `; total = sum of arr[0..4]
        LI   R1, arr
        LI   R2, 5         ; length
        LI   R3, 0         ; sum
loop:   LW   R4, 0(R1)
        ADD  R3, R3, R4    ; uses R4 right after LW -> load-use hazard
        ADDI R1, R1, 1
        ADDI R2, R2, -1
        BNE  R2, R0, loop
        LI   R5, total
        SW   R3, 0(R5)
        HALT
arr:    .word 3, 1, 4, 1, 5
total:  .word 0
`,
    },
    {
      id: 'hazards', fa: 'نمایش مخاطره‌های داده',
      expect: { regs: { 1: 5, 2: 10, 3: 5, 4: 5, 5: 10 } },
      src: `; a short program full of data dependencies
        LI   R1, 5
        ADD  R2, R1, R1    ; RAW on R1
        SUB  R3, R2, R1    ; RAW on R2 and R1
        LI   R6, 40
        SW   R3, 0(R6)
        LW   R4, 0(R6)
        ADD  R5, R4, R4    ; load-use on R4
        HALT
`,
    },
    {
      id: 'max', fa: 'یافتن بیشینهٔ آرایه (SLT)',
      expect: { mem: { max: 9 } },
      src: `; max = largest element of arr
        LI   R1, arr
        LI   R2, 6         ; length
        LW   R3, 0(R1)     ; max = arr[0]
loop:   LW   R4, 0(R1)
        SLT  R5, R3, R4    ; R5 = (max < x)
        BEQ  R5, R0, skip
        ADD  R3, R4, R0    ; max = x
skip:   ADDI R1, R1, 1
        ADDI R2, R2, -1
        BNE  R2, R0, loop
        LI   R6, max
        SW   R3, 0(R6)
        HALT
arr:    .word 4, -2, 9, 7, 0, 3
max:    .word 0
`,
    },
  ];

  return { SAMPLE_PROGRAMS };
});
