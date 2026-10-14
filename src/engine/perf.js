/* Budżet rysowania dla wszystkich canvasów strony (2026-10-14).
   Właściciel: „wielu mówi, że strona im się tnie". Dekoracje (neuro-słup, kula,
   sylwetki, sieci w kartach) rysowały się 60×/s w pełnej rozdzielczości ekranu
   Retina, każda w swojej pętli — na słabszych laptopach to zjadało kartę.

   Trzy zasady, wspólne dla każdego silnika:
   1) `renderDpr(cap)` — dekoracje nie potrzebują 2× gęstości; limit 1,5
      (w trybie lite 1). Ostrość linii o grubości 1 px nie zmienia się na oko,
      a pikseli do wypełnienia jest prawie 2× mniej.
   2) `skipFrame(now, key)` — gdy nikt nic nie robi (ruch myszy, przewijanie,
      klawisz w ostatnich 1,5 s) dekoracje rysują się co drugą klatkę (~30/s);
      ruch jest wolny, różnicy nie widać, a praca spada o połowę.
   3) tryb lite — jeśli przez kilka sekund przeglądarka nie wyrabia 60 kl./s
      (średni odstęp klatek > 22 ms), strona przechodzi na stałe na lżejszy
      rysunek: `html.fiq-lite` (CSS gasi pętle animacji i poświaty), 30 kl./s
      dla dekoracji, DPR 1. Silniki mogą słuchać `fiq:lite`. */

const IDLE_MS = 1500;
let lastInput = 0;
let lite = false;
let started = false;
const skip = Object.create(null);

function markInput() { lastInput = performance.now(); }
function markPointer() { markInput(); document.documentElement.classList.add('has-pointer'); }

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  lastInput = performance.now();
  addEventListener('pointermove', markPointer, { passive: true });
  addEventListener('pointerdown', markInput, { passive: true });
  addEventListener('scroll', markInput, { passive: true });
  addEventListener('wheel', markInput, { passive: true });
  addEventListener('keydown', markInput);
  addEventListener('touchmove', markInput, { passive: true });
  try { if (sessionStorage.getItem('fiq_lite') === '1') setLite(); } catch (e) { /* prywatne okno */ }

  // próbnik płynności: własna, pusta pętla rAF (koszt ~0) mierzy odstępy klatek
  let prev = 0, sum = 0, n = 0, bad = 0;
  const sample = (t) => {
    if (lite) return;
    if (prev && !document.hidden) {
      const d = t - prev;
      if (d < 200) { sum += d; n++; }            // dłuższe przerwy = karta w tle / debugger
      if (n >= 90) {
        bad = sum / n > 22 ? bad + 1 : 0;
        sum = 0; n = 0;
        if (bad >= 2) { setLite(); return; }      // ~3 s z rzędu poniżej ~45 kl./s
      }
    }
    prev = t;
    requestAnimationFrame(sample);
  };
  // pierwsze sekundy po wejściu to ładowanie (czcionki, CMS, hydracja) — nie liczymy
  setTimeout(() => requestAnimationFrame(sample), 4000);
}

function setLite() {
  if (lite) return;
  lite = true;
  document.documentElement.classList.add('fiq-lite');
  try { sessionStorage.setItem('fiq_lite', '1'); } catch (e) { /* ignore */ }
  dispatchEvent(new Event('fiq:lite'));
}

export function isLite() { start(); return lite; }

export function renderDpr(cap = 1.5) {
  start();
  return Math.max(1, Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, lite ? 1 : cap));
}

export function isIdle() { return performance.now() - lastInput > IDLE_MS; }

/* true = tę klatkę pomiń. `key` rozdziela pętle (każda liczy swoje klatki). */
export function skipFrame(now, key = 'main') {
  start();
  if (!lite && !isIdle()) { skip[key] = 0; return false; }
  skip[key] = (skip[key] || 0) + 1;
  return (skip[key] & 1) === 1;
}

/* Paczkowanie kresek po przezroczystości: zamiast ustawiać `strokeStyle`
   i wołać `stroke()` dla KAŻDEJ linii (setki wywołań na klatkę), dzielimy
   linie na kilka poziomów jasności i rysujemy każdy jednym `stroke()`. */
export const ALPHA_STEPS = 8;
export function makeBuckets() {
  return Array.from({ length: ALPHA_STEPS }, () => []);
}
export function pushLine(buckets, alpha, maxAlpha, x1, y1, x2, y2) {
  if (alpha <= 0.004) return;
  const k = Math.min(ALPHA_STEPS - 1, Math.floor((alpha / maxAlpha) * ALPHA_STEPS));
  buckets[k].push(x1, y1, x2, y2);
}
export function strokeBuckets(ctx, buckets, rgb, maxAlpha) {
  for (let k = 0; k < ALPHA_STEPS; k++) {
    const arr = buckets[k];
    if (!arr.length) continue;
    ctx.strokeStyle = `rgba(${rgb},${(((k + 0.5) / ALPHA_STEPS) * maxAlpha).toFixed(3)})`;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i += 4) { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3]); }
    ctx.stroke();
    arr.length = 0;
  }
}
