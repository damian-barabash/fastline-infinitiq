// Движок страниц продуктов (/agenci-ai, /ai-doradca): нейро-фон, курсор, меню,
// силуэты «цифровых работников» (team.js) и живые демо-сцены.
//
// Bębna 3D nie ma (usunięty 2026-10-13, właściciel: przewijanie „jak w prezentacji"
// spowalniało stronę) — sekcje `.slide` leżą w zwykłym dokumencie i przewijają się
// natywnie. Silnik tylko wskazuje aktywną sekcję (licznik, sceny, animacje CSS).

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
  // SMALL = telefon/dotyk (mniej punktów tła, sieć na środku, układ mobilny).
  // Klasa `mode-flat` jest zawsze (zwykłe przewijanie); `mode-desk` = desktop:
  // własny kursor, licznik, sekcja na wysokość okna z treścią na środku.
  const SMALL = COARSE || matchMedia('(max-width: 900px)').matches;
  document.documentElement.classList.add('mode-flat');
  if (!SMALL) document.documentElement.classList.add('mode-desk');
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
  /* Kursor na kwasowym tle: kwasowa kropka i pierścień na zieleni znikają,
     więc nad takimi blokami przełączamy je na czarne (2026-09-11, właściciel).
     Jedna lista selektorów dla wszystkich stron — te same klasy wracają. */
  const ACID = '.ck-btn, .model-panel, .ag-final, .btn-primary, .btn-send, .bf-btn, .bf-pill.on, .bf-slot.on, .nav-cta, .menu-cta,'
    + ' .af-btn, .af-btn-a, .wh-cta, .fb-cta-btn, .pill.on, .cta-slide-inner .btn-primary';
  const markAcid = (el) => {
    const on = !!(el && el.closest && el.closest(ACID));
    dot.classList.toggle('acid', on); ring.classList.toggle('acid', on);
  };
  if (!COARSE) {
    document.addEventListener('mouseover', (e) => {
      markAcid(e.target);
      if (e.target.closest(CLICKABLE)) { ring.classList.add('link'); dot.classList.add('link'); }
    }, { signal });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(CLICKABLE)) { ring.classList.remove('link'); dot.classList.remove('link'); }
    }, { signal });
  }

  /* ===== sekcje ===== */
  const slides = Array.from(document.querySelectorAll('.slide'));
  const N = slides.length;
  // karty agentów żyją teraz w grani hero — szukamy jej po samej siatce kart,
  // żeby przeniesienie bloku nie wymagało ruszania silnika
  const teamGridEl = document.getElementById('teamGrid');
  const ZESPOL = teamGridEl ? slides.findIndex((s2) => s2.contains(teamGridEl)) : -1;

  const railItems = Array.from(document.querySelectorAll('.rail-item'));
  const counterCur = document.querySelector('#counter .cur');
  const hint = document.getElementById('scrollHint');
  let activeIdx = -1;

  function goTo(i) {
    const idx = clamp(i, 0, N - 1);
    slides[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  railItems.forEach((b) => b.addEventListener('click', () => goTo(+b.dataset.i), { signal }));
  const closeMenu = initMenu({ signal, goTo });
  // внутренние якоря (#kontakt) — płynne przewinięcie do sekcji
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
    updateNext();
  }

  /* ===== „Dalej: <następna sekcja>" — strzałka na dole okna =====
     Tylko strony, które mają `#nextHint` w markupie. Nazwa jak w menu: tekst
     `.section-label` następnej sekcji (CMS), awaryjnie nazwa z railu. Znika od
     razu przy przewijaniu, wraca po zatrzymaniu; w ostatniej sekcji jej nie ma. */
  const nextHint = document.getElementById('nextHint');
  const nextName = nextHint ? nextHint.querySelector('[data-next]') : null;
  const railNames = railItems.map((b) => ((b.querySelector('.rail-name') || {}).textContent || '').trim());
  const secName = (i) => {
    const raw = ((slides[i].querySelector('.section-label') || {}).textContent || '').trim();
    return raw.replace(/^(\/\/|\d+\s*[—–-])\s*/, '') || railNames[i] || slides[i].id;
  };
  function updateNext() {
    if (!nextHint) return;
    const last = activeIdx >= N - 1;
    // telefon: sekcje są dłuższe niż ekran i plakietka zasłaniałaby treść — tylko na pierwszym ekranie
    nextHint.classList.toggle('end', last || (SMALL && activeIdx > 0));
    if (!last && nextName) {
      const name = secName(activeIdx + 1);
      if (nextName.textContent !== name) nextName.textContent = name;
    }
  }
  if (nextHint) {
    let stopT = 0;
    addEventListener('scroll', () => {
      if (!nextHint.classList.contains('moving')) nextHint.classList.add('moving');
      clearTimeout(stopT);
      stopT = setTimeout(() => nextHint.classList.remove('moving'), 280);
    }, { passive: true, signal });
    nextHint.addEventListener('click', () => goTo(activeIdx + 1), { signal });
    addEventListener('fiq:content-ready', updateNext, { signal }); // CMS mógł zmienić nazwy sekcji
  }

  // Aktywna jest sekcja najbliżej środka okna.
  // Prostokąty czytamy tylko po przewinięciu / zmianie układu, nie co klatkę.
  let flatDirty = true;
  {
    const dirty = () => { flatDirty = true; };
    addEventListener('scroll', dirty, { passive: true, signal });
    addEventListener('resize', dirty, { signal });
    addEventListener('fiq:content-ready', dirty, { signal });
    addEventListener('load', dirty, { signal });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(dirty);
  }
  // `inview` = sekcja jest w oknie (z zapasem): poza nim arkusz stawia animacje
  // CSS na pauzie — wszystkie sekcje leżą w dokumencie naraz.
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('inview', e.isIntersecting)), { rootMargin: '12% 0px' })
    : null;
  slides.forEach((s) => { if (io) io.observe(s); else s.classList.add('inview'); });

  function updateFlat() {
    if (!flatDirty) return;
    flatDirty = false;
    if (hint) hint.classList.toggle('gone', scrollY > innerHeight * 0.3);
    let best = 0, bestD = Infinity;
    slides.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      // sekcja, która weszła w okno, zostaje oznaczona na stałe (`seen`) — strona
      // może dzięki temu pokazać treść raz, zamiast gasić ją po zejściu ze środka
      if (r.top < innerHeight * 0.86 && !s.classList.contains('seen')) s.classList.add('seen');
      const d = Math.abs(r.top + r.height / 2 - innerHeight / 2);
      if (d < bestD) { bestD = d; best = i; }
    });
    setActive(best);
  }

  /* ===== силуэты команды ===== */
  const WEAK = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  const team = initTeam({ signal, coarse: COARSE, weak: WEAK, mouse });

  /* ===== фон: нейро-сеть ===== */
  const canvas = document.getElementById('neural');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, WEAK ? 1.5 : 2);
  const COUNT = SMALL ? (WEAK ? 46 : 64) : (WEAK ? 90 : 120);
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
    const cx = vw * (SMALL ? 0.5 : 0.78);
    const cy = H0 * 0.5;
    const baseR = Math.min(vw, H0) * (SMALL ? 0.36 : 0.28);
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
      if (!SMALL && mouse.active) {
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
        if (!SMALL && pulses.length < 10 && Math.random() < 0.001) {
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

  let teamNear = true;
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
    if (team && ZESPOL >= 0) {
      // sekcję z kartami rysujemy, gdy jest w oknie (z zapasem ekranu w każdą stronę)
      if (flatDirty) {
        const r = slides[ZESPOL].getBoundingClientRect();
        teamNear = r.bottom > -innerHeight && r.top < innerHeight * 2;
      }
      team.tick(time, teamNear, Math.round(scrollY), teamNear);
    }
    updateFlat();
    if (!document.hidden) drawNeural(time);
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
    // сцена «живёт», только пока её секция активна — иначе четыре таймера крутились бы вхолостую
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

  return function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    timers.clear();
    if (claim) claim.destroy();
    if (closeMenu) closeMenu();
    unwatchClaim();
    ac.abort();
    if (io) io.disconnect();
    document.documentElement.classList.remove('mode-flat', 'mode-desk', 'coarse');
  };
}
