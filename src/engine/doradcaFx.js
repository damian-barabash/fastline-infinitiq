// Wizualizacje strony /ai-doradca: małe sieci „neuronów" w tle bloków
// (`canvas.ad-neuro`) i synapsa łącząca cztery zasady (`#adSynapse`).
// Rysuje tylko to, co widać: w bębnie — płótna aktywnej grani, bez bębna
// (mode-flat) — te, które są w oknie. Jedna pętla rAF dla wszystkiego.

import { renderDpr, skipFrame } from './perf.js';

export function initDoradcaFx({ signal } = {}) {
  const FLAT = document.documentElement.classList.contains('mode-flat');
  const DPR = renderDpr(1.5);   // perf.js: dekoracje bez Retina 2×
  const rnd = (a, b) => a + Math.random() * (b - a);
  let raf = 0, dead = false, last = 0;

  const nets = Array.from(document.querySelectorAll('canvas.ad-neuro')).map((c) => ({
    c, ctx: c.getContext('2d'), slide: c.closest('.slide'),
    n: Math.round((+c.dataset.n || 30) * (FLAT ? 0.6 : 1)),
    dark: c.dataset.ink === 'dark',
    w: 0, h: 0, nodes: [], pulses: [],
  }));

  function size(it) {
    const w = it.c.clientWidth, h = it.c.clientHeight;
    if (!w || !h || (w === it.w && h === it.h)) return;
    it.w = w; it.h = h;
    it.c.width = Math.round(w * DPR); it.c.height = Math.round(h * DPR);
    it.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    it.nodes = Array.from({ length: it.n }, () => ({
      x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.12, 0.12), vy: rnd(-0.12, 0.12),
      r: rnd(1, 2.4), ph: rnd(0, 6.28), hot: Math.random() < 0.3,
    }));
    it.pulses = [];
  }

  // bez bębna: o tym, co jest w oknie, mówi IntersectionObserver (zero pomiarów w pętli)
  const seen = new WeakMap();
  const io = FLAT && 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => seen.set(e.target, e.isIntersecting)), { rootMargin: '80px' })
    : null;
  function visible(el, slide) {
    if (!FLAT) return !slide || slide.classList.contains('active');
    return io ? seen.get(el) === true : true;
  }

  function drawNet(it, t, k) {
    const { ctx, w, h, nodes, pulses, dark } = it;
    ctx.clearRect(0, 0, w, h);
    const L = Math.max(70, Math.min(140, Math.max(w, h) * 0.2));
    const ink = dark ? '13,13,13' : '184,255,0';
    for (const n of nodes) {
      n.x += n.vx * k; n.y += n.vy * k;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > L * L) continue;
        const near = 1 - Math.sqrt(d2) / L;
        ctx.strokeStyle = `rgba(${ink},${(near * (dark ? 0.22 : 0.2)).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (pulses.length < 7 && Math.random() < 0.0016) pulses.push({ i, j, t: 0, sp: rnd(0.012, 0.026) });
      }
    }
    for (let q = pulses.length - 1; q >= 0; q--) {
      const p = pulses[q];
      p.t += p.sp * k;
      if (p.t >= 1) { pulses.splice(q, 1); continue; }
      const a = nodes[p.i], b = nodes[p.j], tw = Math.sin(p.t * Math.PI);
      ctx.fillStyle = `rgba(${ink},${(tw * 0.95).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(a.x + (b.x - a.x) * p.t, a.y + (b.y - a.y) * p.t, 1.6 + tw * 1.6, 0, 6.283);
      ctx.fill();
    }
    for (const n of nodes) {
      const fl = 0.6 + 0.4 * Math.sin(t * 0.0012 + n.ph);
      ctx.fillStyle = dark
        ? `rgba(13,13,13,${(0.5 * fl).toFixed(3)})`
        : (n.hot ? `rgba(184,255,0,${(0.75 * fl).toFixed(3)})` : `rgba(245,245,240,${(0.4 * fl).toFixed(3)})`);
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill();
    }
  }

  /* ---- synapsa: impuls idzie przez cztery zasady i „zapala" tę, do której dotarł ---- */
  const sc = document.getElementById('adSynapse');
  const syn = sc ? {
    c: sc, ctx: sc.getContext('2d'), slide: sc.closest('.slide'), box: sc.parentElement,
    steps: Array.from(sc.parentElement.querySelectorAll('.step')), pts: [], w: 0, h: 0, t: 0, lit: -1,
  } : null;

  function sizeSyn() {
    if (!syn) return;
    const w = syn.c.clientWidth, h = syn.c.clientHeight;
    if (!w || !h) return;
    if (w !== syn.w || h !== syn.h) {
      syn.w = w; syn.h = h;
      syn.c.width = Math.round(w * DPR); syn.c.height = Math.round(h * DPR);
      syn.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    // offsety zamiast getBoundingClientRect: projekcja 3D bębna zniekształca prostokąty
    syn.pts = syn.steps.filter((s) => s.offsetParent).map((s) => ({ x: s.offsetLeft + 14, y: s.offsetTop + 14 }));
  }

  function drawSyn(k) {
    const { ctx, w, h, pts } = syn;
    ctx.clearRect(0, 0, w, h);
    if (pts.length < 2) return;
    const LEG = 110;                       // klatek na odcinek
    syn.t = (syn.t + k) % (LEG * pts.length);
    const seg = Math.floor(syn.t / LEG), f = (syn.t % LEG) / LEG;
    const a = pts[seg], b = pts[(seg + 1) % pts.length];
    const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
    g.addColorStop(0, 'rgba(184,255,0,0.9)'); g.addColorStop(1, 'rgba(184,255,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, 6.283); ctx.fill();
    pts.forEach((p, i) => {
      ctx.fillStyle = i === seg ? '#B8FF00' : 'rgba(184,255,0,0.45)';
      ctx.beginPath(); ctx.arc(p.x, p.y, i === seg ? 4 : 2.5, 0, 6.283); ctx.fill();
    });
    if (seg !== syn.lit) {                 // DOM tylko przy realnej zmianie
      syn.lit = seg;
      syn.steps.forEach((s, i) => s.classList.toggle('lit', i === seg));
    }
  }

  if (io) { nets.forEach((it) => io.observe(it.c)); if (syn) io.observe(syn.c); }

  function resize() { nets.forEach(size); sizeSyn(); }
  resize();
  addEventListener('resize', resize, { signal });
  addEventListener('fiq:content-ready', () => requestAnimationFrame(resize), { signal });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!dead) resize(); });

  function frame(t) {
    if (dead) return;
    // w spoczynku co druga klatka (perf.js); `last` zostaje, więc ruch nie zwalnia
    if (skipFrame(t, 'dfx')) { raf = requestAnimationFrame(frame); return; }
    const k = Math.min(3, last ? (t - last) / 16.7 : 1);
    last = t;
    if (!document.hidden) {
      for (const it of nets) {
        if (!it.w) size(it);
        if (it.w && visible(it.c, it.slide)) drawNet(it, t, k);
      }
      if (syn) {
        if (!syn.pts.length) sizeSyn();
        if (syn.w && visible(syn.c, syn.slide)) drawSyn(k);
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => { dead = true; cancelAnimationFrame(raf); if (io) io.disconnect(); };
}
