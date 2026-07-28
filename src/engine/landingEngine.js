// Движок главной: 3D-барабан слайдов + гибридный скролл + нейро-столп +
// кастомный курсор + интерактивные демо услуг. Перенос 1:1 из index.html,
// адаптация только: (1) SPA-переходы через onNavigate, (2) cleanup для React.
import { interceptInternalLinks } from './wipe.js';

export function initLanding({ onNavigate }) {

  const ac = new AbortController();
  const signal = ac.signal;
  let rafId = 0;
  let destroyed = false;

  /* ===== Mode detection =====
     prefers-reduced-motion игнорируем сознательно (урок HORIN):
     Windows с выключенными «эффектами анимации» репортит reduce
     и юзер получил бы мёртвую статичную страницу. */
  const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;
  document.documentElement.classList.add('mode-3d');
  if (COARSE) document.documentElement.classList.add('coarse');

  const slides = Array.from(document.querySelectorAll('.slide'));
  const inners = slides.map(s => s.querySelector('.slide-inner'));
  const N = slides.length;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ===== SPA-переходы (шторкой управляет wipe.js/App) ===== */
  interceptInternalLinks(onNavigate, signal);

  /* ===== Viewport (vh фиксируем — iOS toolbar дёргает innerHeight) ===== */
  let lockedVh = innerHeight, lastW = innerWidth;
  let vh = lockedVh, vw = innerWidth;

  /* ===== Mouse ===== */
  const mouse = { x: vw / 2, y: vh / 2, ix: vw / 2, iy: vh / 2, active: false };
  addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  }, { passive: true, signal });
  document.addEventListener('mouseleave', () => { mouse.active = false; }, { signal });

  /* ===== Custom cursor (только точный указатель) ===== */
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  let rx = vw / 2, ry = vh / 2;
  if (!COARSE) {
    document.addEventListener('mouseover', e => {
      if (e.target.closest('a, button')) ring.classList.add('link');
    }, { signal });
    document.addEventListener('mouseout', e => {
      if (e.target.closest('a, button')) ring.classList.remove('link');
    }, { signal });
  }

  /* ===== Nav shrink ===== */
  const navEl = document.querySelector('nav');
  let navShrunk = false;
  function updateNav() {
    const s = scrollY > 40;
    if (s !== navShrunk) { navShrunk = s; navEl.classList.toggle('shrunk', s); }
  }

  /* ===== 3D drum + внутренний докрут длинных слайдов ===== */
  const track = document.getElementById('track');
  const drum = document.getElementById('drum');
  const FACE = 72; // deg between faces
  let R = 0;
  let extras = slides.map(() => 0); // лишняя высота контента сверх vh
  let starts = [0];                  // scrollY, с которого начинается слайд
  let maxScroll = 0;
  let ySmooth = 0, lastApplied = -1, pSmooth = 0;

  function measure() {
    vh = lockedVh; vw = innerWidth;
    R = (vh / 2) / Math.tan((FACE / 2) * Math.PI / 180);
    drum.style.transform = `translateZ(${-R}px)`;
    extras = slides.map((s, i) => {
      let h = inners[i].offsetHeight;
      const tick = s.querySelector('.ticker'); if (tick) h += tick.offsetHeight;
      const fb = s.querySelector('.footer-bar'); if (fb) h += fb.offsetHeight;
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

  /* ===== Rail / counter / hint ===== */
  const railItems = Array.from(document.querySelectorAll('.rail-item'));
  const counterCur = document.querySelector('#counter .cur');
  const hint = document.getElementById('scrollHint');
  let activeIdx = -1;

  function goTo(i) {
    scrollTo({ top: starts[i], behavior: 'smooth' });
  }
  railItems.forEach(b => b.addEventListener('click', () => goTo(+b.dataset.i), { signal }));
  document.getElementById('navHome').addEventListener('click', e => { e.preventDefault(); goTo(0); }, { signal });
  document.querySelectorAll('[data-goto]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); goTo(+a.dataset.goto); }, { signal });
  });

  function setActive(idx) {
    if (idx === activeIdx) return;
    const first = activeIdx === -1;
    activeIdx = idx;
    railItems.forEach((b, i) => b.classList.toggle('on', i === idx));
    counterCur.textContent = String(idx + 1).padStart(2, '0');
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    fxIdx = idx;
    if (!first) kickColumn(); // нейро-столп реагирует на смену слайда
    if (idx === 2) startSvcAuto(); else stopSvcAuto();
  }

  function updateDrum() {
    const yT = clamp(scrollY, 0, maxScroll);
    ySmooth = lerp(ySmooth, yT, 0.14);
    if (Math.abs(ySmooth - yT) < 0.3) ySmooth = yT;
    // не пишем стили, когда барабан замер (урок HORIN: DOM-записи только при изменении)
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
    hint.classList.toggle('gone', scrollY > vh * 0.3);
  }

  /* ===== Interactive service demos ===== */
  let svcRows = [];
  const svcTitle = document.getElementById('svcDemoTitle');
  const svcDesc = document.getElementById('svcDemoDesc');
  const svcBody = document.getElementById('svcDemoBody');
  let SVC_NAMES = [];

  let demoTimers = [];
  const dt = (fn, ms) => { const id = setTimeout(fn, ms); demoTimers.push(id); return id; };
  const di = (fn, ms) => { const id = setInterval(fn, ms); demoTimers.push(id); return id; };
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const foot = t => el('div', 'd-foot', t);
  function typeTo(node, txt, sp, done) {
    let i = 0;
    const id = di(() => {
      node.textContent = txt.slice(0, ++i);
      if (i >= txt.length) { clearInterval(id); done && done(); }
    }, sp);
  }

  function demoStrategy(b) {
    const steps = [['Q1', 'Audyt danych i procesów'], ['Q2', 'Pilot: silnik treści AI'], ['Q3', 'Automatyzacja lejka'], ['Q4', 'Skala — operacje AI-native']];
    const list = el('div');
    const els = steps.map(([q, t]) => {
      const s = el('div', 'd-step');
      s.append(el('div', 'd-dot'), el('div', 'd-mono', `<span class="d-acc">${q}</span>&nbsp;&nbsp;${t}`));
      list.append(s);
      return s;
    });
    b.append(list, foot('roadmapa transformacji · 4 kwartały'));
    let k = 0;
    const cyc = () => {
      if (k < els.length) { els[k++].classList.add('on'); }
      else if (k === els.length) {
        k++;
        dt(() => { els.forEach(e => e.classList.remove('on')); k = 0; }, 1500);
      }
    };
    cyc();
    di(cyc, 900);
  }

  function demoGen(b) {
    const prompt = el('div', 'd-mono');
    const pr = el('span', 'd-acc');
    prompt.append(el('span', 'd-dim', '&gt; brief:&nbsp;'), pr);
    const out = el('div');
    out.style.marginTop = '12px';
    b.append(prompt, out, foot('3 warianty · 1,4 s · spójne z brand voice'));
    const lines = ['„Zima należy do odważnych."', '„Ciepło, które wygląda jak projekt."', '„FW26 — na temperatury i spojrzenia."'];
    typeTo(pr, 'premiera kolekcji FW26 — ton: pewny, minimal', 24, () => {
      lines.forEach((t, i) => dt(() => {
        const l = el('div', 'd-mono');
        l.innerHTML = `<span class="d-acc">H${i + 1}</span>&nbsp;&nbsp;`;
        const sp = el('span');
        l.append(sp);
        out.append(l);
        typeTo(sp, t, 13);
      }, 400 + i * 700));
      dt(() => { b.innerHTML = ''; demoGen(b); }, 400 + 3 * 700 + 3000);
    });
  }

  function demoVoice(b) {
    const tones = [
      ['Korporacyjny', 'Szanowni Państwo, z przyjemnością informujemy o premierze nowej kolekcji.'],
      ['Social', 'Drop jest. Nowa kolekcja właśnie wylądowała — leć, zanim zniknie.'],
      ['Twój brand', 'Nowa kolekcja. Bez kompromisów — dokładnie tak, jak lubisz.']
    ];
    const tabs = el('div', 'd-tabs');
    const txt = el('div', 'd-vtext');
    let cur = 0, paused = false;
    const tabEls = tones.map(([t], i) => {
      const tb = el('button', 'd-tab', t);
      tb.addEventListener('click', () => { paused = true; show(i); });
      tabs.append(tb);
      return tb;
    });
    function show(i) {
      cur = i;
      tabEls.forEach((t, k) => t.classList.toggle('on', k === i));
      txt.style.opacity = 0;
      dt(() => { txt.textContent = tones[i][1]; txt.style.opacity = 1; }, 240);
    }
    b.append(tabs, txt, foot('jeden komunikat · trzy głosy · 100% spójności'));
    show(0);
    di(() => { if (!paused) show((cur + 1) % tones.length); }, 2600);
  }

  function demoLLM(b) {
    const chat = el('div');
    b.append(chat, foot('asystent na danych marki · 24/7'));
    const seq = [
      ['me', 'Macie ten model w rozmiarze M?'],
      ['ai', 'Tak — ostatnie 3 sztuki. Rezerwuję na 30 minut?'],
      ['me', 'Poproszę.'],
      ['ai', 'Zarezerwowane ✓ Link do płatności już u Ciebie.']
    ];
    function run() {
      chat.innerHTML = '';
      let delay = 300;
      seq.forEach(([who, t]) => {
        dt(() => {
          const bb = el('div', 'd-bubble' + (who === 'me' ? ' me' : ''), t);
          chat.append(bb);
          requestAnimationFrame(() => bb.classList.add('show'));
        }, delay);
        delay += who === 'ai' ? 1600 : 1100;
      });
      dt(run, delay + 2400);
    }
    run();
  }

  function demoAuto(b) {
    const flow = el('div', 'd-row');
    flow.style.cssText = 'gap:8px;flex-wrap:wrap;';
    const nodes = ['Nowy lead', 'Scoring AI', 'Segment', 'Kampania 1:1'].map(t => el('div', 'd-node', t));
    nodes.forEach((n, i) => {
      flow.append(n);
      if (i < nodes.length - 1) flow.append(el('span', 'd-acc', '→'));
    });
    const stats = el('div', 'd-mono');
    stats.style.marginTop = '18px';
    let leads = 214, hot = 38, conv = 12, k = 0;
    const paint = () => {
      stats.innerHTML = `leady: <span class="d-acc">${leads}</span> · hot: <span class="d-acc">${hot}</span> · konwersje: <span class="d-acc">${conv}</span>`;
    };
    paint();
    b.append(flow, stats, foot('lejek pracuje sam · realtime'));
    di(() => {
      nodes.forEach((n, i) => n.classList.toggle('hot', i === k % nodes.length));
      if (k % nodes.length === nodes.length - 1) {
        leads += 1 + Math.floor(Math.random() * 3);
        hot += 1;
        if (k % (nodes.length * 2) === nodes.length * 2 - 1) conv += 1;
        paint();
      }
      k++;
    }, 650);
  }

  function demoCRM(b) {
    const data = [['Anna · TechCo', 92], ['Marek · RetailX', 61], ['Julia · FinApp', 34]];
    const rows = data.map(([name, score], i) => {
      const r = el('div', 'd-row');
      r.style.cssText = 'gap:14px;margin-bottom:14px;';
      const nm = el('span', 'd-mono', name);
      nm.style.cssText = 'width:42%;flex-shrink:0;font-size:11.5px;';
      const bar = el('div', 'd-bar');
      const fill = el('i');
      bar.append(fill);
      const sc = el('span', 'd-mono d-dim', '0');
      sc.style.cssText = 'width:54px;text-align:right;font-size:11.5px;';
      r.append(nm, bar, sc);
      b.append(r);
      return { fill, sc, score, nm, hot: i === 0 };
    });
    const ft = foot('');
    b.append(ft);
    rows.forEach(({ fill, sc, score, nm, hot }) => {
      dt(() => { fill.style.width = score + '%'; }, 200);
      let v = 0;
      const id = di(() => {
        v = Math.min(score, v + 3);
        sc.textContent = v + (hot && v === score ? ' · HOT' : '');
        if (v >= score) {
          clearInterval(id);
          if (hot) { sc.classList.add('d-acc'); sc.classList.remove('d-dim'); nm.classList.add('d-acc'); }
        }
      }, 36);
    });
    dt(() => {
      const sp = el('span');
      ft.append(sp);
      typeTo(sp, 'AI: follow-up do Anny dziś 14:00 · szansa 87%', 22);
    }, 1500);
    dt(() => { b.innerHTML = ''; demoCRM(b); }, 7200);
  }

  function demoPerf(b) {
    const ab = el('div', 'd-ab');
    const mk = (label, copy) => {
      const card = el('div', 'd-ad');
      card.append(el('div', 'd-mono d-dim', label), el('div', 'd-adcopy', copy));
      const ctr = el('div', 'd-mono', 'CTR: <span class="d-dim">0,0%</span>');
      card.append(ctr);
      ab.append(card);
      return { card, ctr };
    };
    const A = mk('Wariant A', 'Kup teraz — dostawa w 24h.');
    const B = mk('Wariant B', 'Zostały 3 sztuki. Dziś dostawa gratis.');
    const ft = foot('');
    b.append(ab, ft);
    let a = 0, bb = 0;
    const id = di(() => {
      a = Math.min(1.2, a + 0.06);
      bb = Math.min(3.8, bb + 0.19);
      A.ctr.innerHTML = `CTR: <span class="d-dim">${a.toFixed(1).replace('.', ',')}%</span>`;
      B.ctr.innerHTML = `CTR: <span class="d-acc">${bb.toFixed(1).replace('.', ',')}%</span>`;
      if (bb >= 3.8) {
        clearInterval(id);
        B.card.classList.add('win');
        ft.innerHTML = '→ wygrywa <span class="d-acc">wariant B</span> · ROAS 4,7×';
      }
    }, 90);
    dt(() => { b.innerHTML = ''; demoPerf(b); }, 8000);
  }

  function demoVideo(b) {
    const row = el('div', 'd-row');
    row.style.gap = '10px';
    const frames = [0, 1, 2, 3].map(() => {
      const f = el('div', 'd-frame', '▶');
      row.append(f);
      return f;
    });
    const prog = el('div', 'd-mono');
    prog.style.marginTop = '14px';
    b.append(row, prog, foot('4 ujęcia · 12 s · 9:16 · brand-safe'));
    let p = 0;
    const id = di(() => {
      p = Math.min(100, p + 2);
      const blocks = Math.round(p / 100 * 14);
      prog.innerHTML = `render: <span class="d-acc">${'█'.repeat(blocks)}</span><span class="d-dim">${'░'.repeat(14 - blocks)}</span> ${p}%`;
      frames.forEach((f, i) => { if (p >= (i + 1) * 25) f.classList.add('done'); });
      if (p >= 100) clearInterval(id);
    }, 70);
    dt(() => { b.innerHTML = ''; demoVideo(b); }, 7400);
  }

  // привязка демо по data-demo (а не по индексу) — чтобы добавление/скрытие строк
  // через CMS не ломало соответствие строка↔демо
  const DEMO_MAP = { strategy: demoStrategy, gen: demoGen, voice: demoVoice, llm: demoLLM, auto: demoAuto, crm: demoCRM, perf: demoPerf, video: demoVideo };

  let svcIdx = -1, svcAutoId = null, svcTouched = false, svcHoverT = null;
  function selectSvc(i, user) {
    if (!svcRows.length || i < 0 || i >= svcRows.length) return;
    if (user) { svcTouched = true; stopSvcAuto(); }
    if (i === svcIdx) return;
    svcIdx = i;
    svcRows.forEach((r, k) => r.classList.toggle('on', k === i));
    svcTitle.textContent = `Demo — ${('0' + (i + 1)).slice(-2)} / ${SVC_NAMES[i]}`;
    const dEl = svcRows[i].querySelector('.svc-desc');
    svcDesc.textContent = dEl ? dEl.textContent : '';
    demoTimers.forEach(id => { clearTimeout(id); clearInterval(id); });
    demoTimers = [];
    svcBody.innerHTML = '';
    const fn = DEMO_MAP[svcRows[i].getAttribute('data-demo') || ''];
    if (fn) fn(svcBody);
  }
  function startSvcAuto() {
    if (svcTouched || svcAutoId || !svcRows.length) return;
    svcAutoId = setInterval(() => selectSvc((svcIdx + 1) % svcRows.length, false), 5200);
  }
  function stopSvcAuto() {
    if (svcAutoId) { clearInterval(svcAutoId); svcAutoId = null; }
  }
  // (пере)инициализация списка услуг — вызывается после перестройки строк из CMS
  function initServices() {
    svcRows = Array.from(document.querySelectorAll('.svc-row'));
    SVC_NAMES = svcRows.map(r => { const n = r.querySelector('.svc-name'); return n ? n.textContent : ''; });
    svcIdx = -1;
    svcRows.forEach((r, i) => {
      if (r._svcBound) return;          // не навешивать повторно на те же узлы
      r._svcBound = true;
      r.addEventListener('click', () => selectSvc(i, true), { signal });
      // debounce: пролёт мыши по списку не должен щёлкать демо подряд
      r.addEventListener('mouseenter', () => {
        if (COARSE) return;
        clearTimeout(svcHoverT);
        svcHoverT = setTimeout(() => selectSvc(i, true), 120);
      }, { signal });
      r.addEventListener('mouseleave', () => clearTimeout(svcHoverT), { signal });
    });
    selectSvc(0, false);
  }
  window.fiqInitServices = initServices;
  initServices();

  /* ===== Neural column canvas ===== */
  const canvas = document.getElementById('neural');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);

  const COUNT = COARSE ? 90 : 150;
  const nodes = [];
  function buildNodes() {
    nodes.length = 0;
    for (let i = 0; i < COUNT; i++) {
      const t = i / COUNT;
      nodes.push({
        a: i * 2.39996,                       // golden angle helix
        y: (t - 0.5),                          // -0.5..0.5 (scaled later)
        rr: 0.78 + 0.3 * Math.sin(i * 1.7),    // radius variation
        ph: Math.random() * Math.PI * 2,       // pulse phase
        ox: 0, oy: 0,                          // mouse offsets
        sx: 0, sy: 0, depth: 0                 // projected (filled per frame)
      });
    }
  }
  buildNodes();

  function sizeCanvas() {
    canvas.width = vw * DPR;
    canvas.height = vh * DPR;
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  const pulses = []; // signals travelling along links

  /* ===== Column reacts to slides ===== */
  const SLIDE_FX = [
    { cx: 0.70, r: 1.00, tint: 0, dim: 0,    ex: 1.0 }, // hero
    { cx: 0.78, r: 0.80, tint: 0, dim: 0,    ex: 1.0 }, // czym jesteśmy — узкий, у правого края
    { cx: 0.72, r: 1.18, tint: 0, dim: 0,    ex: 1.6 }, // oferta — широкая сеть, живее
    { cx: 0.70, r: 1.00, tint: 0, dim: 0.65, ex: 0.5 }, // model — приглушён за зелёной панелью
    { cx: 0.74, r: 0.55, tint: 0, dim: 0,    ex: 1.0 }, // dla kogo — тугой луч
    { cx: 0.50, r: 0.95, tint: 1, dim: 0,    ex: 0.8 }, // greywolf — в центр + золотой
    { cx: 0.50, r: 1.28, tint: 0, dim: 0,    ex: 2.6 }, // CTA — широкий, разогнанный
  ];
  let fxIdx = 0;
  const fx = { cx: COARSE ? 0.5 : 0.70, r: 1, tint: 0, dim: 0, ex: 1 };
  let surge = 0, rotKick = 0, rotExtra = 0;

  function kickColumn() {
    surge = 1;
    rotKick += 0.012;
    for (let k = 0; k < 10 && pulses.length < 26; k++) {
      const i = Math.floor(Math.random() * (COUNT - 4));
      pulses.push({ i, j: i + 1 + Math.floor(Math.random() * 3), t: 0, sp: 0.02 + Math.random() * 0.025 });
    }
  }

  function drawNeural(time) {
    ctx.clearRect(0, 0, vw, vh);

    // плавный перелёт столпа к параметрам текущего слайда
    const tg = SLIDE_FX[fxIdx] || SLIDE_FX[0];
    fx.cx = lerp(fx.cx, COARSE ? (tg.cx === 0.5 ? 0.5 : 0.62) : tg.cx, 0.05);
    fx.r = lerp(fx.r, tg.r, 0.05);
    fx.tint = lerp(fx.tint, tg.tint, 0.05);
    fx.dim = lerp(fx.dim, tg.dim, 0.07);
    fx.ex = lerp(fx.ex, tg.ex, 0.05);
    rotExtra += rotKick; rotKick *= 0.95;
    surge *= 0.965;

    // цвет: зелёный → золото Greywolf
    const cr = Math.round(lerp(184, 214, fx.tint));
    const cg = Math.round(lerp(255, 182, fx.tint));
    const cb = Math.round(lerp(0, 107, fx.tint));

    const cx = vw * fx.cx;
    const cy = vh * 0.5;
    const baseR = Math.min(vw, vh) * (COARSE ? 0.34 : 0.26) * fx.r;
    const H = vh * 1.5;
    const f = 900;
    const rot = pSmooth * 1.1 + time * 0.00004 + rotExtra;

    // project
    for (const n of nodes) {
      const ang = n.a + rot;
      const r3 = baseR * n.rr;
      const x3 = Math.cos(ang) * r3;
      const z3 = Math.sin(ang) * r3;
      const s = f / (f + z3 + baseR * 1.4);
      let sx = cx + x3 * s;
      let sy = cy + n.y * H * s;

      // mouse repulsion (точный указатель)
      if (!COARSE && mouse.active) {
        const dx = sx + n.ox - mouse.x, dy = sy + n.oy - mouse.y;
        const d2 = dx * dx + dy * dy;
        const RAD = 150;
        if (d2 < RAD * RAD && d2 > 1) {
          const d = Math.sqrt(d2);
          const force = (1 - d / RAD) * 16;
          n.ox += (dx / d) * force * 0.18;
          n.oy += (dy / d) * force * 0.18;
        }
      }
      n.ox *= 0.88; n.oy *= 0.88;
      n.sx = sx + n.ox;
      n.sy = sy + n.oy;
      n.depth = clamp(1 - (z3 + baseR) / (2 * baseR), 0, 1); // 1 = front
    }

    const dimK = (1 - fx.dim) * (1 + surge * 0.55);

    // links between close nodes
    const L = Math.min(120, Math.max(80, vw * 0.07));
    const L2 = L * L;
    ctx.lineWidth = 1;
    const spawnP = 0.0015 * fx.ex;
    for (let i = 0; i < COUNT; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < COUNT; j++) {
        const b = nodes[j];
        const dx = a.sx - b.sx, dy = a.sy - b.sy;
        const d2 = dx * dx + dy * dy;
        if (d2 > L2) continue;
        const near = 1 - Math.sqrt(d2) / L;
        const dep = (a.depth + b.depth) * 0.5;
        const alpha = near * (0.06 + dep * 0.22) * dimK;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
        // spawn travelling signal occasionally
        if (pulses.length < 14 && Math.random() < spawnP) {
          pulses.push({ i, j, t: 0, sp: 0.018 + Math.random() * 0.02 });
        }
      }
    }

    // mouse synapses — cursor joins the network
    if (!COARSE && mouse.active) {
      const MR = 180, MR2 = MR * MR;
      for (const n of nodes) {
        const dx = n.sx - mouse.ix, dy = n.sy - mouse.iy;
        const d2 = dx * dx + dy * dy;
        if (d2 > MR2) continue;
        const near = 1 - Math.sqrt(d2) / MR;
        ctx.strokeStyle = `rgba(245,245,240,${(near * 0.22 * Math.min(1, dimK)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(mouse.ix, mouse.iy);
        ctx.lineTo(n.sx, n.sy);
        ctx.stroke();
      }
    }

    // travelling pulses
    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k];
      p.t += p.sp;
      if (p.t >= 1) { pulses.splice(k, 1); continue; }
      const a = nodes[p.i], b = nodes[p.j];
      const x = lerp(a.sx, b.sx, p.t);
      const y = lerp(a.sy, b.sy, p.t);
      const tw = Math.sin(p.t * Math.PI);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(1, tw * 0.9 * dimK).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + tw * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // nodes
    const flickSpeed = 0.0011 * (1 + (fx.ex - 1) * 0.4);
    for (const n of nodes) {
      const flicker = 0.65 + 0.35 * Math.sin(time * flickSpeed + n.ph);
      const a = Math.min(1, (0.12 + n.depth * 0.55) * flicker * dimK);
      const sz = 1 + n.depth * 1.8;
      ctx.fillStyle = n.ph % 1 < 0.22
        ? `rgba(${cr},${cg},${cb},${a.toFixed(3)})`
        : `rgba(245,245,240,${(a * 0.8).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ===== Main loop ===== */
  function frame(time) {
    if (destroyed) return;
    // mouse easing (shared by canvas + cursor)
    mouse.ix = lerp(mouse.ix, mouse.x, 0.2);
    mouse.iy = lerp(mouse.iy, mouse.y, 0.2);

    updateNav();
    updateDrum();

    if (!COARSE) {
      dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;
      rx = lerp(rx, mouse.x, 0.16);
      ry = lerp(ry, mouse.y, 0.16);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    }

    drawNeural(time);
    rafId = requestAnimationFrame(frame);
  }

  /* ===== Init ===== */
  measure();
  sizeCanvas();
  // хук для пересчёта высот после того как loader подставит контент из БД
  window.fiqRemeasure = () => { measure(); sizeCanvas(); };
  // перемер после шрифтов и полной загрузки (высоты слайдов меняются)
  let fontsAlive = true;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (fontsAlive) measure(); });
  addEventListener('load', () => measure(), { signal });
  addEventListener('resize', () => {
    // iOS toolbar дёргает innerHeight — пересобираем только при реальном изменении
    if (innerWidth !== lastW || Math.abs(innerHeight - lockedVh) > 120) {
      lastW = innerWidth;
      lockedVh = innerHeight;
      const cur = Math.max(0, activeIdx);
      measure();
      sizeCanvas();
      scrollTo(0, starts[cur]);
    }
  }, { signal });
  rafId = requestAnimationFrame(frame);

  /* ===== Cleanup (SPA) ===== */
  return function destroy() {
    destroyed = true;
    fontsAlive = false;
    cancelAnimationFrame(rafId);
    ac.abort();
    stopSvcAuto();
    demoTimers.forEach(id => { clearTimeout(id); clearInterval(id); });
    demoTimers = [];
    clearTimeout(svcHoverT);
    delete window.fiqInitServices;
    delete window.fiqRemeasure;
    document.documentElement.classList.remove('mode-3d', 'coarse');
  };
}
