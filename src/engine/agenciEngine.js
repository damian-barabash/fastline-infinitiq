// Движок страницы /agenci-ai: тот же 3D-барабан слайдов, что и на главной
// (грани перелистываются скроллом, длинные докручиваются внутри), нейро-фон,
// курсор, силуэты «цифровых работников» (team.js) и живые демо-сцены.
//
// Механика барабана перенесена из landingEngine — формулы те же (rotateX по
// граням, R = (vh/2)/tan(36°), гибридный скролл), без CMS-специфики лендинга.

import { interceptInternalLinks } from './wipe.js';
import { initTeam } from './team.js';
import { watchNavClaim, initClaimScramble } from './navClaim.js';
import { initMenu } from './menu.js';

export function initAgenci({ onNavigate }) {
  const ac = new AbortController();
  const signal = ac.signal;
  let rafId = 0;
  let destroyed = false;

  /* prefers-reduced-motion игнорируем сознательно (урок HORIN) */
  const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;
  const FLAT = COARSE || matchMedia('(max-width: 900px)').matches;
  document.documentElement.classList.add(FLAT ? 'mode-flat' : 'mode-3d');
  if (COARSE) document.documentElement.classList.add('coarse');

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let vw = innerWidth, vh = innerHeight;

  interceptInternalLinks(onNavigate, signal);
  const unwatchClaim = watchNavClaim({ signal });
  const claim = initClaimScramble({ signal, immediate: true });

  const mouse = { x: vw / 2, y: vh / 2, ix: vw / 2, iy: vh / 2, active: false };
  addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true, signal });
  document.addEventListener('mouseleave', () => { mouse.active = false; }, { signal });

  /* ===== nav ===== */
  const navEl = document.querySelector('nav');
  let navShrunk = false;
  function updateNav() {
    const s = scrollY > 40;
    if (s !== navShrunk) { navShrunk = s; navEl.classList.toggle('shrunk', s); }
  }

  /* ===== курсор ===== */
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  let rx = vw / 2, ry = vh / 2;
  const CLICKABLE = 'a, button, summary, .team-card, .dm-tab, .rail-item';
  if (!COARSE) {
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(CLICKABLE)) { ring.classList.add('link'); dot.classList.add('link'); }
    }, { signal });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(CLICKABLE)) { ring.classList.remove('link'); dot.classList.remove('link'); }
    }, { signal });
  }

  /* Na DUŻYM ekranie właściciel chce blok „Poznaj zespół" na samej górze —
     przestawiamy grań przed hero (razem z pozycją railu, z którego menu bierze
     podpisy). Na telefonie zostaje kolejność z makiety: najpierw hero. */
  if (!FLAT) {
    const drumEl = document.getElementById('drum');
    const startEl = document.getElementById('start');
    const zespolEl = document.getElementById('zespol');
    if (drumEl && startEl && zespolEl) drumEl.insertBefore(zespolEl, startEl);
    // przestawienie railu wykonujemy raz na dokument: silnik startuje ponownie,
    // gdy CMS wytnie którąś grań, a drugi swap wróciłby do starej kolejności
    const railBox = document.getElementById('rail');
    if (railBox && !railBox.hasAttribute('data-reordered') && railBox.children.length > 1) {
      railBox.setAttribute('data-reordered', '1');
      railBox.insertBefore(railBox.children[1], railBox.children[0]);
      Array.from(railBox.children).forEach((b2, i) => { b2.dataset.i = String(i); });
    }
  }

  /* ===== 3D-барабан + гибридный скролл (как на главной) ===== */
  const slides = Array.from(document.querySelectorAll('.slide'));
  const inners = slides.map((s) => s.querySelector('.slide-inner'));
  const N = slides.length;
  const ZESPOL = slides.findIndex((s) => s.id === 'zespol');
  const track = document.getElementById('track');
  const drum = document.getElementById('drum');
  const FACE = 72;
  let R = 0;
  let extras = slides.map(() => 0);
  let starts = [0];
  let maxScroll = 0;
  let ySmooth = 0, lastApplied = -1, pSmooth = 0;
  let lockedVh = innerHeight, lastW = innerWidth;

  function measure() {
    vh = lockedVh; vw = innerWidth;
    R = (vh / 2) / Math.tan((FACE / 2) * Math.PI / 180);
    drum.style.transform = `translateZ(${-R}px)`;
    extras = slides.map((s, i) => {
      const h = inners[i].offsetHeight;
      const ex = Math.max(0, Math.ceil(h - vh));
      s.classList.toggle('tall', ex > 0);
      if (ex === 0) inners[i].style.transform = '';
      return ex;
    });
    starts = [0];
    for (let i = 0; i < N; i++) starts.push(starts[i] + vh + extras[i]);
    maxScroll = starts[N - 1] + extras[N - 1];
    track.innerHTML = '';
    for (let i = 0; i < N; i++) {
      const d = document.createElement('div');
      d.className = 'snap';
      d.style.height = (vh + extras[i]) + 'px';
      track.appendChild(d);
    }
    lastApplied = -1;
  }

  function mapScroll(y) {
    let i = 0;
    while (i < N - 1 && y >= starts[i + 1]) i++;
    const local = y - starts[i];
    const flip = clamp((local - extras[i]) / vh, 0, 1);
    return { i, flip };
  }

  const railItems = Array.from(document.querySelectorAll('.rail-item'));
  const counterCur = document.querySelector('#counter .cur');
  const hint = document.getElementById('scrollHint');
  let activeIdx = -1;

  function goTo(i) {
    const idx = clamp(i, 0, N - 1);
    if (FLAT) { slides[idx].scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    scrollTo({ top: starts[idx], behavior: 'smooth' });
  }
  railItems.forEach((b) => b.addEventListener('click', () => goTo(+b.dataset.i), { signal }));
  const closeMenu = initMenu({ signal, goTo });
  // внутренние якоря (#kontakt) — перелистываем барабан, а не скроллим вслепую
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-scroll]');
    if (!a) return;
    const id = (a.getAttribute('href') || '').replace('#', '');
    const idx = slides.findIndex((s) => s.id === id);
    if (idx < 0) return;
    e.preventDefault();
    goTo(idx);
  }, { signal });

  function setActive(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    railItems.forEach((b, i) => b.classList.toggle('on', i === idx));
    if (counterCur) counterCur.textContent = String(idx + 1).padStart(2, '0');
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
  }

  function updateDrum() {
    const yT = clamp(scrollY, 0, maxScroll);
    ySmooth = lerp(ySmooth, yT, 0.14);
    if (Math.abs(ySmooth - yT) < 0.3) ySmooth = yT;
    if (ySmooth === lastApplied) return;
    lastApplied = ySmooth;
    const m = mapScroll(ySmooth);
    const pF = m.i + m.flip;
    pSmooth = pF;
    for (let k = 0; k < N; k++) {
      const d = k - pF;
      const el = slides[k];
      if (Math.abs(d) > 1.1) { el.classList.remove('shown'); continue; }
      el.classList.add('shown');
      el.style.transform = `rotateX(${(-d * FACE).toFixed(3)}deg) translateZ(${R.toFixed(1)}px)`;
      el.style.opacity = (1 - clamp(Math.abs(d), 0, 1) * 0.85).toFixed(3);
      if (extras[k] > 0) {
        const off = clamp(ySmooth - starts[k], 0, extras[k]);
        inners[k].style.transform = `translateY(${(-off).toFixed(1)}px)`;
      }
    }
    setActive(m.flip > 0.5 ? Math.min(m.i + 1, N - 1) : m.i);
    if (hint) hint.classList.toggle('gone', scrollY > vh * 0.3);
  }

  // flat-режим (телефон): барабана нет — активной считаем ближайшую к центру грань
  function updateFlat() {
    let best = 0, bestD = Infinity;
    slides.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - innerHeight / 2);
      if (d < bestD) { bestD = d; best = i; }
    });
    setActive(best);
  }

  if (!FLAT) {
    measure();
    addEventListener('resize', () => {
      // iOS дёргает innerHeight при показе тулбара — меряем только при реальной смене
      if (Math.abs(innerHeight - lockedVh) > 120 || innerWidth !== lastW) {
        lockedVh = innerHeight; lastW = innerWidth; measure();
      }
    }, { signal });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) measure(); });
    addEventListener('load', () => { if (!destroyed) measure(); }, { signal });
  } else {
    slides.forEach((s) => s.classList.add('shown'));
  }

  /* ===== силуэты команды ===== */
  const WEAK = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  const team = initTeam({ signal, coarse: COARSE, weak: WEAK, mouse });

  /* ===== фон: нейро-сеть ===== */
  const canvas = document.getElementById('neural');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, WEAK ? 1.5 : 2);
  const COUNT = FLAT ? (WEAK ? 46 : 64) : (WEAK ? 90 : 120);
  const nodes = [];
  for (let i = 0; i < COUNT; i++) {
    nodes.push({
      a: i * 2.39996,
      y: (i / COUNT - 0.5),
      rr: 0.74 + 0.32 * Math.sin(i * 1.7),
      ph: Math.random() * Math.PI * 2,
      ox: 0, oy: 0, sx: 0, sy: 0, depth: 0,
    });
  }
  function sizeCanvas() {
    vw = innerWidth;
    canvas.width = Math.round(vw * DPR);
    canvas.height = Math.round(innerHeight * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  sizeCanvas();
  addEventListener('resize', sizeCanvas, { signal });

  const pulses = [];
  function drawNeural(time) {
    const H0 = innerHeight;
    ctx.clearRect(0, 0, vw, H0);
    const cx = vw * (FLAT ? 0.5 : 0.78);
    const cy = H0 * 0.5;
    const baseR = Math.min(vw, H0) * (FLAT ? 0.36 : 0.28);
    const H = H0 * 1.5;
    const f = 900;
    const rot = scrollY / Math.max(1, H0) * 0.7 + time * 0.00004;

    for (const n of nodes) {
      const ang = n.a + rot;
      const r3 = baseR * n.rr;
      const x3 = Math.cos(ang) * r3;
      const z3 = Math.sin(ang) * r3;
      const s = f / (f + z3 + baseR * 1.4);
      const sx = cx + x3 * s;
      const sy = cy + n.y * H * s;
      if (!FLAT && mouse.active) {
        const dx = sx + n.ox - mouse.x, dy = sy + n.oy - mouse.y;
        const d2 = dx * dx + dy * dy;
        const RAD = 150;
        if (d2 < RAD * RAD && d2 > 1) {
          const d = Math.sqrt(d2);
          const force = (1 - d / RAD) * 15;
          n.ox += (dx / d) * force * 0.16;
          n.oy += (dy / d) * force * 0.16;
        }
      }
      n.ox *= 0.88; n.oy *= 0.88;
      n.sx = sx + n.ox; n.sy = sy + n.oy;
      n.depth = clamp(1 - (z3 + baseR) / (2 * baseR), 0, 1);
    }

    const L = Math.min(120, Math.max(80, vw * 0.07));
    const L2 = L * L;
    ctx.lineWidth = 1;
    for (let i = 0; i < COUNT; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < COUNT; j++) {
        const b = nodes[j];
        const dx = a.sx - b.sx, dy = a.sy - b.sy;
        const d2 = dx * dx + dy * dy;
        if (d2 > L2) continue;
        const near = 1 - Math.sqrt(d2) / L;
        const dep = (a.depth + b.depth) * 0.5;
        ctx.strokeStyle = `rgba(184,255,0,${(near * (0.04 + dep * 0.14)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
        if (!FLAT && pulses.length < 10 && Math.random() < 0.001) {
          pulses.push({ i, j, t: 0, sp: 0.018 + Math.random() * 0.02 });
        }
      }
    }

    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k];
      p.t += p.sp;
      if (p.t >= 1) { pulses.splice(k, 1); continue; }
      const a = nodes[p.i], b = nodes[p.j];
      const tw = Math.sin(p.t * Math.PI);
      ctx.fillStyle = `rgba(184,255,0,${(tw * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(lerp(a.sx, b.sx, p.t), lerp(a.sy, b.sy, p.t), 1.5 + tw * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const n of nodes) {
      const flicker = 0.65 + 0.35 * Math.sin(time * 0.0011 + n.ph);
      const a = (0.09 + n.depth * 0.42) * flicker;
      ctx.fillStyle = n.ph % 1 < 0.22
        ? `rgba(184,255,0,${a.toFixed(3)})`
        : `rgba(245,245,240,${(a * 0.8).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, 1 + n.depth * 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(time) {
    if (destroyed) return;
    mouse.ix = lerp(mouse.ix, mouse.x, 0.2);
    mouse.iy = lerp(mouse.iy, mouse.y, 0.2);
    if (!COARSE) {
      dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;
      rx = lerp(rx, mouse.x, 0.16);
      ry = lerp(ry, mouse.y, 0.16);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    }
    updateNav();
    // team.tick читает getBoundingClientRect — зовём ДО записи трансформов барабана
    if (team && ZESPOL >= 0) {
      if (FLAT) {
        // grań z kartami rysujemy, gdy jest w oknie (z zapasem ekranu w każdą stronę)
        const r = slides[ZESPOL].getBoundingClientRect();
        const near = r.bottom > -innerHeight && r.top < innerHeight * 2;
        team.tick(time, near, Math.round(scrollY), near);
      } else {
        const d = Math.abs(pSmooth - ZESPOL);
        team.tick(time, d < 1.15, Math.round(ySmooth), d < 0.45);
      }
    }
    if (FLAT) updateFlat(); else updateDrum();
    drawNeural(time);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  /* =========================================================================
     ДЕМО-СЦЕНЫ: «как агент работает». Разметка держит шаги в [data-s];
     сцена показывает их по очереди и повторяется, пока её грань активна.
     ====================================================================== */
  const timers = new Set();
  const wait = (ms) => new Promise((res) => {
    const id = setTimeout(() => { timers.delete(id); res(); }, ms);
    timers.add(id);
  });
  const alive = () => !destroyed;

  function resetSteps(scope) {
    scope.querySelectorAll('[data-s]').forEach((el) => el.classList.remove('on'));
  }

  async function untilVisible(state) {
    while (alive() && (!state.visible() || document.hidden)) await wait(220);
  }

  async function runSteps(state, scope, { gap = 900, typingGap = 1100 } = {}) {
    const steps = Array.from(scope.querySelectorAll('[data-s]')).sort((a, b) => +a.dataset.s - +b.dataset.s);
    for (const el of steps) {
      if (!alive()) return;
      await untilVisible(state);
      el.classList.add('on');
      const isTyping = el.classList.contains('typing');
      await wait(isTyping ? typingGap : gap);
      if (isTyping) el.classList.remove('on');
    }
  }

  document.querySelectorAll('.dm[data-demo]').forEach((root) => {
    const slide = root.closest('.slide');
    const slideIdx = slides.indexOf(slide);
    // сцена «живёт», только пока её грань активна — иначе четыре таймера крутились бы вхолостую
    const state = { visible: () => slideIdx < 0 || activeIdx === slideIdx };
    const kind = root.dataset.demo;

    async function loopChat() {
      const chans = Array.from(root.querySelectorAll('.dm-ch'));
      const tabs = Array.from(root.querySelectorAll('.dm-tab'));
      let idx = 0;
      while (alive()) {
        const ch = chans[idx];
        chans.forEach((c, i) => c.classList.toggle('on', i === idx));
        tabs.forEach((t, i) => t.classList.toggle('on', i === idx));
        resetSteps(ch);
        await untilVisible(state);
        await wait(450);
        await runSteps(state, ch, { gap: 1200, typingGap: 1100 });
        await wait(2000);
        idx = (idx + 1) % chans.length;
      }
    }

    async function loopSimple(opts) {
      while (alive()) {
        resetSteps(root);
        await untilVisible(state);
        await wait(450);
        await runSteps(state, root, opts);
        await wait(2400);
      }
    }

    async function loopCall() {
      const timerEl = root.querySelector('[data-timer]');
      while (alive()) {
        resetSteps(root);
        root.classList.remove('ringing');
        if (timerEl) timerEl.textContent = '00:00';
        await untilVisible(state);
        root.classList.add('ringing');
        await wait(650);
        let sec = 0;
        const tick = setInterval(() => {
          if (destroyed) { clearInterval(tick); return; }
          sec += 1;
          if (timerEl) timerEl.textContent = '00:' + String(sec).padStart(2, '0');
        }, 1000);
        timers.add(tick);
        await runSteps(state, root, { gap: 1400 });
        await wait(1600);
        clearInterval(tick); timers.delete(tick);
        root.classList.remove('ringing');
        await wait(1100);
      }
    }

    if (kind === 'chat') loopChat();
    else if (kind === 'call') loopCall();
    else if (kind === 'advisor') loopSimple({ gap: 1300, typingGap: 1100 });
    else loopSimple({ gap: 1200, typingGap: 1000 });
  });

  /* высоты граней меняются после подмены текстов из CMS */
  addEventListener('fiq:content-ready', () => {
    if (!destroyed && !FLAT) requestAnimationFrame(measure);
  }, { signal });

  return function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    timers.clear();
    if (claim) claim.destroy();
    if (closeMenu) closeMenu();
    unwatchClaim();
    ac.abort();
    document.documentElement.classList.remove('mode-3d', 'mode-flat', 'coarse');
  };
}
