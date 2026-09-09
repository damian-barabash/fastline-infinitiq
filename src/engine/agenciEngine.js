// Движок страницы /agenci-ai: нейро-фон, курсор, reveal по скроллу,
// силуэты «цифровых работников» в hero (модуль team.js) и живые демо-сцены
// (кanały, rozmowa telefoniczna, widget na stronie, asystent wewnętrzny).
//
// Сцены крутятся ТОЛЬКО когда видны (IntersectionObserver) и вкладка активна —
// четыре бесконечных таймера в фоне грели бы процессор без пользы.

import { interceptInternalLinks } from './wipe.js';
import { initTeam } from './team.js';
import { watchNavClaim, initClaimScramble } from './navClaim.js';

export function initAgenci({ onNavigate }) {
  const ac = new AbortController();
  const signal = ac.signal;
  let rafId = 0;
  let destroyed = false;

  /* prefers-reduced-motion игнорируем сознательно (урок HORIN) */
  const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;
  const small = matchMedia('(max-width: 1000px)').matches;
  const FLAT = COARSE || small;
  document.documentElement.classList.add(FLAT ? 'mode-flat' : 'mode-3d');

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
  addEventListener('scroll', () => {
    const s = scrollY > 40;
    if (s !== navShrunk) { navShrunk = s; navEl.classList.toggle('shrunk', s); }
  }, { passive: true, signal });

  // плавный скролл по внутренним якорям (#kontakt)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-scroll]');
    if (!a) return;
    const id = (a.getAttribute('href') || '').replace('#', '');
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, { signal });

  /* ===== курсор ===== */
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  const CLICKABLE = 'a, button, summary, .team-card, .dm-tab';
  if (!FLAT) {
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(CLICKABLE)) { ring.classList.add('link'); dot.classList.add('link'); }
    }, { signal });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(CLICKABLE)) { ring.classList.remove('link'); dot.classList.remove('link'); }
    }, { signal });
  }

  /* ===== reveal ===== */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('on'); revealIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  document.querySelectorAll('.rv').forEach((el) => revealIO.observe(el));

  /* ===== сильвуэты команды (тот же модуль, что на лендинге) ===== */
  const WEAK = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  const team = initTeam({ signal, coarse: COARSE, weak: WEAK, mouse });
  // team.tick(time, visible, scrollKey, centered): без «visible» силуэты не рисуются,
  // без «centered» не запускается intro — на лендинге это давал барабан, тут даём мы
  let teamVisible = false, teamCentered = false;
  const teamGrid = document.getElementById('teamGrid');
  if (teamGrid) {
    const tio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        teamVisible = en.isIntersecting;
        if (en.isIntersecting) teamCentered = true;   // intro odpala się przy pierwszym pokazaniu
      });
    }, { threshold: [0, 0.3, 0.6] });
    tio.observe(teamGrid);
    signal.addEventListener('abort', () => tio.disconnect());
  }

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
    vw = innerWidth; vh = innerHeight;
    canvas.width = Math.round(vw * DPR);
    canvas.height = Math.round(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  sizeCanvas();
  addEventListener('resize', sizeCanvas, { signal });

  const pulses = [];
  function drawNeural(time) {
    ctx.clearRect(0, 0, vw, vh);
    const cx = vw * (FLAT ? 0.5 : 0.76);
    const cy = vh * 0.5;
    const baseR = Math.min(vw, vh) * (FLAT ? 0.36 : 0.3);
    const H = vh * 1.5;
    const f = 900;
    const rot = scrollY / vh * 0.7 + time * 0.00004;

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
    if (!FLAT) {
      dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${lerp(parseFloat(ring.dataset.x || vw / 2), mouse.x, 0.16)}px, ${lerp(parseFloat(ring.dataset.y || vh / 2), mouse.y, 0.16)}px) translate(-50%, -50%)`;
      ring.dataset.x = lerp(parseFloat(ring.dataset.x || vw / 2), mouse.x, 0.16);
      ring.dataset.y = lerp(parseFloat(ring.dataset.y || vh / 2), mouse.y, 0.16);
    }
    if (team) team.tick(time, teamVisible, Math.round(scrollY), teamCentered);
    drawNeural(time);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  /* =========================================================================
     ДЕМО-СЦЕНЫ: «как агент работает» — каналы, telefon, widget, asystent.
     Разметка держит шаги в [data-s]; сцена показывает их по очереди и
     повторяется. Никаких библиотек: таймеры + классы.
     ====================================================================== */
  const timers = new Set();
  const wait = (ms) => new Promise((res) => {
    const id = setTimeout(() => { timers.delete(id); res(); }, ms);
    timers.add(id);
  });
  const alive = () => !destroyed;

  function stepsOf(root, chScope) {
    const scope = chScope || root;
    return Array.from(scope.querySelectorAll('[data-s]'))
      .sort((a, b) => +a.dataset.s - +b.dataset.s);
  }

  function resetSteps(scope) {
    scope.querySelectorAll('[data-s]').forEach((el) => el.classList.remove('on'));
  }

  // пауза, пока сцена не видна или вкладка в фоне — иначе анимация «проходит мимо»
  async function untilVisible(state) {
    while (alive() && (!state.visible || document.hidden)) await wait(220);
  }

  async function runSteps(state, scope, { gap = 900, typingGap = 1100 } = {}) {
    for (const el of stepsOf(null, scope)) {
      if (!alive()) return;
      await untilVisible(state);
      el.classList.add('on');
      // индикатор «pisze…» держим короче — он не читается, а czeka się na odpowiedź
      const isTyping = el.classList.contains('typing');
      await wait(isTyping ? typingGap : gap);
      if (isTyping) el.classList.remove('on');
    }
  }

  const scenes = [];
  document.querySelectorAll('.dm[data-demo]').forEach((root) => {
    const state = { visible: false, root };
    scenes.push(state);

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
        await wait(500);
        await runSteps(state, ch, { gap: 1250, typingGap: 1150 });
        await wait(2200);
        idx = (idx + 1) % chans.length;
      }
    }

    async function loopSimple(opts) {
      while (alive()) {
        resetSteps(root);
        await untilVisible(state);
        await wait(500);
        await runSteps(state, root, opts);
        await wait(2600);
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
        await wait(700);
        let sec = 0;
        const tick = setInterval(() => {
          if (destroyed) { clearInterval(tick); return; }
          sec += 1;
          if (timerEl) timerEl.textContent = '00:' + String(sec).padStart(2, '0');
        }, 1000);
        timers.add(tick);
        await runSteps(state, root, { gap: 1500 });
        await wait(1800);
        clearInterval(tick); timers.delete(tick);
        root.classList.remove('ringing');
        await wait(1200);
      }
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { state.visible = en.isIntersecting; });
    }, { threshold: 0.25 });
    io.observe(root);
    state.io = io;

    if (kind === 'chat') loopChat();
    else if (kind === 'call') loopCall();
    else if (kind === 'advisor') loopSimple({ gap: 1350, typingGap: 1150 });
    else loopSimple({ gap: 1250, typingGap: 1000 });
  });

  return function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    timers.clear();
    revealIO.disconnect();
    scenes.forEach((s) => s.io && s.io.disconnect());
    if (claim) claim.destroy();
    unwatchClaim();
    ac.abort();
    document.documentElement.classList.remove('mode-3d', 'mode-flat');
  };
}
