/* Przejście między krokami formularza briefingu (/kontakt).

   Właściciel: „po kliknięciu «Dalej» zielona sieć pojawia się od środka, wciąga
   w siebie wszystkie dane razem z polami, kręci się i pisze, że dane są
   przetwarzane" — w tym czasie backend czyta stronę klienta i pisze analizę.

   Trzy fazy, wszystkie na jednym canvasie (własna projekcja 3D, jak neuro-słup
   i kula w hero — zero bibliotek):
     1. WCIĄGANIE (~1,1 s) — z każdego pola formularza wylatują punkty i lecą do
        środka; same pola w tym czasie gasną (klasa `.bf-suck` na formularzu).
     2. PRZETWARZANIE (do odpowiedzi z serwera) — punkty siedzą na kuli, która
        się obraca; sąsiedzi łączą się liniami, po liniach biegną impulsy.
     3. ROZEJŚCIE (~0,5 s) — kula rozsypuje się i gaśnie, wchodzi krok drugi.

   `run()` zwraca obiekt z `finish()` (kończy fazę 2) i `stop()` (twarde
   sprzątanie przy odmontowaniu Reacta). */

const TAU = Math.PI * 2;
const ease = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

export function runBriefFx(canvas, { sources = [], onDone } = {}) {
  if (!canvas || !canvas.getContext) return { finish: () => {}, stop: () => {} };
  const ctx = canvas.getContext('2d');
  const WEAK = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const DPR = Math.min(devicePixelRatio || 1, WEAK ? 1.5 : 2);

  let W = 0, H = 0, cx = 0, cy = 0, R = 0;
  function size() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H / 2;
    R = Math.min(W, H) * 0.26;
  }
  size();

  // punkty startują na polach formularza (albo, gdy ich nie ma, na obwodzie)
  const N = WEAK ? 150 : 260;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const src = sources.length ? sources[i % sources.length] : null;
    const sx = src ? src.x + Math.random() * src.w : cx + (Math.random() - 0.5) * W * 0.8;
    const sy = src ? src.y + Math.random() * src.h : cy + (Math.random() - 0.5) * H * 0.8;
    // cel: punkt na sferze (spirala golden-angle → równomiernie, bez skupisk)
    const y = 1 - (2 * (i + 0.5)) / N;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.39996;
    pts.push({
      sx, sy,
      ux: Math.cos(th) * rr, uy: y, uz: Math.sin(th) * rr,
      d: Math.random() * 0.34,                 // opóźnienie startu — wciąganie falą
      ph: Math.random() * TAU,
      x: sx, y: sy, z: 0, vis: 0,
    });
  }

  let raf = 0, t0 = performance.now(), phase = 1, endT = 0, stopped = false;
  const pulses = [];

  function project(p, rot, spread) {
    // obrót wokół osi Y + lekkie kołysanie, potem rzut perspektywiczny
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const x3 = p.ux * ca + p.uz * sa;
    const z3 = -p.ux * sa + p.uz * ca;
    const f = 620;
    const s = f / (f + (z3 + 1.6) * R * spread);
    p.x = cx + x3 * R * spread * s;
    p.y = cy + p.uy * R * spread * s;
    p.z = z3;
    p.vis = 0.45 + 0.55 * ((z3 + 1) / 2);
    return s;
  }

  function frame(now) {
    if (stopped) return;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    const rot = t * 0.55;
    let spread = 1;
    let gather = 1;                              // 0 = na polach, 1 = na kuli

    if (phase === 1) {
      gather = 0;
      let done = true;
      for (const p of pts) {
        const k = Math.min(1, Math.max(0, (t - p.d) / 0.8));
        if (k < 1) done = false;
        p.k = ease(k);
      }
      if (done) { phase = 2; }
    } else if (phase === 3) {
      const k = Math.min(1, (now - endT) / 520);
      spread = 1 + k * 1.9;                       // kula rozchodzi się na zewnątrz
      if (k >= 1) { stopped = true; ctx.clearRect(0, 0, W, H); onDone && onDone(); return; }
    }

    const alphaAll = phase === 3 ? 1 - Math.min(1, (now - endT) / 520) : 1;

    // pozycje
    for (const p of pts) {
      const s = project(p, rot, spread);
      if (phase === 1) {
        const k = p.k ?? 0;
        p.x = lerp(p.sx, p.x, k);
        p.y = lerp(p.sy, p.y, k);
        p.vis *= 0.35 + 0.65 * k;
      }
      p.s = s;
    }

    // linie między bliskimi sąsiadami (tylko na kuli — w locie byłby bałagan)
    if (phase !== 1 || gather > 0.5) {
      const L = R * 0.52, L2 = L * L;
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i];
        for (let j = i + 1; j < Math.min(pts.length, i + 14); j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > L2) continue;
          const near = 1 - Math.sqrt(d2) / L;
          ctx.strokeStyle = `rgba(184,255,0,${(near * 0.22 * a.vis * alphaAll).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (pulses.length < 14 && Math.random() < 0.0016) pulses.push({ i, j, t: 0, sp: 0.02 + Math.random() * 0.03 });
        }
      }
    }

    // impulsy po liniach — „dane płyną"
    for (let k = pulses.length - 1; k >= 0; k--) {
      const pu = pulses[k];
      pu.t += pu.sp;
      if (pu.t >= 1) { pulses.splice(k, 1); continue; }
      const a = pts[pu.i], b = pts[pu.j];
      const tw = Math.sin(pu.t * Math.PI);
      ctx.fillStyle = `rgba(245,245,240,${(tw * 0.75 * alphaAll).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(lerp(a.x, b.x, pu.t), lerp(a.y, b.y, pu.t), 1.4 + tw * 1.4, 0, TAU);
      ctx.fill();
    }

    // punkty
    for (const p of pts) {
      const fl = 0.7 + 0.3 * Math.sin(t * 2.2 + p.ph);
      const a = (0.22 + p.vis * 0.7) * fl * alphaAll;
      ctx.fillStyle = p.ph % 1 < 0.3
        ? `rgba(245,245,240,${(a * 0.8).toFixed(3)})`
        : `rgba(184,255,0,${a.toFixed(3)})`;
      const rr = (1 + p.vis * 1.7) * (p.s || 1);
      ctx.fillRect(p.x - rr / 2, p.y - rr / 2, rr, rr);
    }

    // pierścień skanujący wokół kuli
    if (phase === 2) {
      const ring = R * (1.25 + 0.06 * Math.sin(t * 1.8));
      ctx.strokeStyle = 'rgba(184,255,0,0.28)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ring, ring * 0.34, Math.sin(t * 0.6) * 0.5, 0, TAU);
      ctx.stroke();
    }

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const onResize = () => size();
  addEventListener('resize', onResize, { passive: true });

  return {
    /** koniec fazy „przetwarzamy" — kula się rozchodzi i woła `onDone` */
    finish() { if (phase !== 3) { phase = 3; endT = performance.now(); } },
    stop() { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); },
  };
}
