# شبیه‌ساز معماری پردازنده (Processor Architecture Simulator)

یک شبیه‌ساز آموزشی و تعاملی که اجزای یک پردازندهٔ سادهٔ ۱۶ بیتی را **تک‌به‌تک** شبیه‌سازی می‌کند.
رابط کاربری فارسی است، هیچ وابستگی‌ای ندارد و مستقیماً در مرورگر اجرا می‌شود.

## اجرا

فایل `index.html` را در مرورگر باز کنید. یا یک سرور ساده بالا بیاورید:

```bash
python3 -m http.server 8000
```

سپس به آدرس `http://localhost:8000` بروید.

## بخش‌ها

| # | بخش | چه چیزی شبیه‌سازی می‌شود |
|---|-----|---------------------------|
| 1 | واحد محاسبه و منطق (ALU) | ADD, SUB, AND, OR, XOR, NOT, SLT, SHL, SHR؛ پرچم‌های Z/N/C/V؛ جمع‌کنندهٔ ریپل‌کری بیت‌به‌بیت با انیمیشن |
| 2 | بانک ثبات | ۸ ثبات ۱۶ بیتی، دو پورت خواندن، نوشتن روی لبهٔ ساعت با Write Enable، ثبات صفر (R0) |
| 3 | حافظهٔ اصلی و گذرگاه | چرخهٔ خواندن/نوشتن گام‌به‌گام با MAR، MDR و گذرگاه‌های آدرس، داده و کنترل |
| 4 | حافظهٔ نهان (Cache) | نگاشت مستقیم، انجمنی مجموعه‌ای و تمام‌انجمنی؛ tag/index/offset؛ LRU، FIFO، تصادفی؛ نرخ برخورد و AMAT |
| 5 | واحد کنترل و رمزگشایی | میدان‌های بیتی دستور و سیگنال‌های کنترلی؛ جدول درستی واحد کنترل |
| 6 | پردازندهٔ کامل (مسیر داده) | اجرای برنامهٔ اسمبلی فاز به فاز (Fetch/Decode/Execute/Memory/Write Back) با نمودار مسیر داده |
| 7 | خط لوله | خط لولهٔ ۵ مرحله‌ای، پیشرانی، توقف Load-Use، تخلیه در پرش‌ها، نمودار زمانی و CPI |
| 8 | پیش‌بینی پرش | ایستا، ۱ بیتی، ۲ بیتی (شمارندهٔ اشباع) و دو سطحی با تاریخچهٔ محلی |

## مجموعه‌دستورالعمل (ISA)

- ۸ ثبات `R0..R7` (۱۶ بیتی؛ `R0` همیشه صفر است)، حافظهٔ ۲۵۶ کلمهٔ ۱۶ بیتی (فون نویمان: دستور و داده در یک حافظه)
- دستورهای ۱۶ بیتی:

```
R-type : [15:12]=0001 [11:9]=rd [8:6]=rs [5:3]=rt [2:0]=funct   ADD SUB AND OR XOR SLT SHL SHR
I-type : [15:12]=op   [11:9]=rd [8:6]=rs [5:0]=imm6            ADDI LW SW BEQ BNE
L-type : [15:12]=0011 [11:9]=rd [8:0]=imm9                     LI
J-type : [15:12]=1000 [11:0]=addr                              JMP
         0000 = NOP, 1111 = HALT
```

نمونهٔ برنامه:

```asm
; sum = 1 + 2 + ... + 10
        LI   R1, 10
        LI   R2, 0
loop:   ADD  R2, R2, R1
        ADDI R1, R1, -1
        BNE  R1, R0, loop
        LI   R4, result
        SW   R2, 0(R4)
        HALT
result: .word 0
```

## ساختار پروژه

```
index.html          صفحهٔ اصلی
css/style.css       ظاهر (پوستهٔ روشن و تیره)
js/core/            منطق شبیه‌سازی (مستقل از رابط کاربری؛ در Node.js هم قابل استفاده)
  alu.js            ALU و پرچم‌ها
  isa.js            کدگذاری/رمزگشایی، واحد کنترل، اسمبلر و دیس‌اسمبلر
  storage.js        بانک ثبات و حافظه
  cache.js          حافظهٔ نهان
  predictor.js      پیش‌بین‌های پرش
  cpu.js            پردازندهٔ تک‌چرخه‌ای با نمایش فازها
  pipeline.js       خط لولهٔ ۵ مرحله‌ای
  programs.js       برنامه‌های نمونه
js/ui/              یک فایل برای رابط کاربری هر بخش
tests/run-tests.js  آزمون‌ها
```

## آزمون‌ها

```bash
npm test
```

آزمون‌ها، علاوه بر بررسی هر بخش، همهٔ برنامه‌های نمونه را روی پردازندهٔ تک‌چرخه‌ای و خط لوله (با و بدون پیشرانی) اجرا می‌کنند
و بررسی می‌کنند وضعیت نهایی ثبات‌ها و حافظه در هر سه مدل یکسان باشد.

---

**English summary:** an interactive, dependency-free, browser-based simulator (Persian UI) of a simple 16-bit processor.
Each part of the architecture has its own tab: ALU, register file, memory and bus, cache, control unit, full datapath, 5-stage pipeline
with forwarding/stalls/flushes, and branch predictors. Open `index.html` to use it; run `npm test` for the test suite.
