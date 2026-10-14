/* ═══ HERO — kula rozcięta na cztery wycinki ═══════════════════════════════
   Zamiast planety i zakładek: kula z punktów, przecięta na krzyż na cztery
   części — każda to jedna grupa produktów. Najechanie na wycinek podświetla go,
   wysuwa z kuli, pokazuje nazwę grupy, a potem RYSUJE linie, z których wychodzą
   karty produktów — zawsze po stronie tego wycinka.

   Rysowane własną projekcją 3D na canvasie 2D (jak neuro-słup i sylwetki
   zespołu): zero zależności, pełna kontrola nad kolorem i timingiem. */

import { renderDpr, skipFrame } from './perf.js';

const GROUPS = ['a', 'b', 'c', 'd'];
// Który wycinek zajmuje która grupa (znak x, znak y w układzie ekranu).
// Strona kart wynika ze znaku x, więc wystarczy zmienić tę mapę, żeby przełożyć
// grupy między ćwiartkami — reszta (wybór kursorem, linie, podpisy) idzie za nią.
const QUAD = {
  c: { sx: 1, sy: 1 },    // Agenci i obsługa klienta — prawa góra
  d: { sx: 1, sy: -1 },   // Operacje i zarządzanie   — prawa dół
  a: { sx: -1, sy: -1 },  // Marketing i treści       — lewa dół
  b: { sx: -1, sy: 1 },   // Sprzedaż                 — lewa góra
};
for (const g of GROUPS) QUAD[g].side = QUAD[g].sx;
// kolejność auto-pokazu: zgodnie z ruchem wskazówek zegara, nie alfabetycznie
const ORDER = GROUPS.slice().sort((x, y) => {
  const ang = q => Math.atan2(-QUAD[q].sy, QUAD[q].sx);
  return ang(x) - ang(y);
});
const groupAt = (sx, sy) => GROUPS.find(g => QUAD[g].sx === sx && QUAD[g].sy === sy);
const TAU = Math.PI * 2;
const DOTS = 2600;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = t => 1 - Math.pow(1 - t, 3);

export function initHeroSphere() {
  const stage = document.getElementById('plStage');
  const cv = document.getElementById('plCanvas');
  if (!stage || !cv) return () => {};

  const ac = new AbortController();
  const { signal } = ac;
  const ctx = cv.getContext('2d', { alpha: true });
  const slide = stage.closest('.slide');
  // kulę rysujemy tylko, gdy scena jest w oknie (sekcje leżą w zwykłym dokumencie)
  let onScreen = true;
  const vis = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; })
    : null;
  if (vis) vis.observe(stage);
  const nodesBox = stage.querySelector('.pl-nodes');

  // Telefon: pod przyciskiem CTA stoją trzy przyciski NIEOTWARTYCH grup —
  // kula jest mała i nie każdy wpadnie na to, żeby w nią stukać (2026-09-11).
  const groupsBox = document.getElementById('plGroups');
  // ⚠️ Silnik startuje ponownie po przebudowie kart z katalogu, a przyciski
  // z poprzedniego przebiegu zostają w DOM-ie z martwymi słuchaczami (ich
  // `AbortController` już padł). Czyścimy kontener na starcie — inaczej klik
  // w grupę nic nie robi (złapane testem `groups-check`).
  if (groupsBox) groupsBox.innerHTML = '';

  const nodes = Array.from(stage.querySelectorAll('.pl-node'));
  const byGroup = GROUPS.map(g => nodes.filter(n => n.dataset.g === g));
  const nameEls = Array.from(stage.querySelectorAll('.pl-gname'));
  const labelOf = Object.fromEntries(nameEls.map(e => [e.dataset.g, e]));
  const names = Object.fromEntries(nameEls.map(e => [e.dataset.g, e.textContent.trim()]));

  const WEAK = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const DPR = renderDpr(WEAK ? 1.25 : 1.5);   // perf.js: dekoracja bez Retina 2×
  const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;   // telefon: leave nie gasi wyboru

  /* ===== punkty kuli (spirala golden-angle) ===== */
  const pts = [];
  for (let i = 0; i < DOTS; i++) {
    const y = 1 - (2 * (i + 0.5)) / DOTS;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.39996;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    // wycinek = ćwiartka (x, y); punkty przy samych cięciach pomijamy → widać szczelinę
    if (Math.abs(x) < 0.028 || Math.abs(y) < 0.028) continue;
    const g = groupAt(x > 0 ? 1 : -1, y > 0 ? 1 : -1);
    pts.push({ x, y, z, g, gi: GROUPS.indexOf(g) });
  }

  /* ===== stan ===== */
  let W = 0, H = 0, cx = 0, cy = 0, R = 0, mode = 'ring';
  let raf = 0, last = 0, frame = 0, t0 = performance.now();
  let active = null;                       // klucz grupy pod kursorem
  const prog = { a: 0, b: 0, c: 0, d: 0 }; // 0…1 — wysunięcie + rysowanie linii
  let anchors = [];                        // etykiety aktywnej grupy
  // Bezczynność: gdy przez 15 s nikt nic nie rusza, sekcja pokazuje grupy sama,
  // po kolei — dopóki użytkownik nie ruszy myszką.
  const IDLE_MS = 15000, DEMO_STEP = 14200;   // 15 s bezczynności, potem zmiana co ~14 s
  let lastAct = performance.now(), demo = false, demoAt = 0;
  let userHold = false;                    // grupę trzyma kursor (a nie auto-pokaz)
  let reveal = 0;                          // 0…1 — kolejne rysowanie linii i kart

  /* ===== rozmiar ===== */
  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // za mało miejsca w pionie (7 kart grupy D) → układ listy, tak jak na telefonie
    // lista tylko na wąskich ekranach (telefon) albo gdy scena jest skrajnie niska
    mode = (W < 560 || H < 260) ? 'list' : 'ring';
    stage.dataset.mode = mode;
    // Na telefonie karty mają być widoczne od razu — otwieramy „Sprzedaż" (ćwiartka B).
    // Bez tego widać samą kulę i trzeba zgadywać, że należy w nią stuknąć.
    if (mode === 'list' && !active) { active = GROUPS.indexOf('b') >= 0 ? 'b' : GROUPS[0]; stage.classList.add('picked'); }
    cx = W / 2;
    // ⚠️ strzałki biegną po okręgu 1,25 R wokół kuli — środek musi być niżej niż R*1.3,
    // inaczej górny łuk wychodzi poza canvas i jest ucięty
    R = mode === 'list'
      ? Math.min(W * 0.27, 104)
      : Math.min(W * 0.15, H * 0.39, 172);   // ten sam rozmiar co przed 2026-10-14 (scena niższa o miejsce na plakietkę „↓") (właściciel); satelity schodzą bliżej poziomu, gdy brak miejsca w pionie
    // Telefon: kula na górze, karty pod nią (rezerwuje je `padding-top` w `.pl-nodes`).
    // Zapas R*1.35 + 22 to miejsce na pierścień strzałek i podpis nad nim.
    cy = mode === 'list' ? R * 1.35 + 22 : H / 2;
    place();
    renderGroups();
  }

  /* ===== podpisy wycinków = małe kule-satelity (2026-10-14) =====
     Właściciel: bez ramek przy nazwach grup — nazwa ma stać na małej kuli, która
     WYLATUJE SPOD dużej przy najechaniu albo przy automatycznym otwarciu grupy.
     · nic nie jest otwarte → cztery satelity stoją w okienkach między łukami
       (przekątne), nazwa wycentrowana na kuli;
     · grupa otwarta → jej satelita wyłania się spod dużej kuli i leci nad
       kolumnę kart, pozostałe chowają się pod dużą kulę (maleją i gasną);
     · zamknięcie → wszystkie wylatują spod kuli na swoje miejsca.
     Silnik liczy tu tylko CELE; pozycję, skalę i jasność dociąga co klatkę
     `stepSats()` (tą samą sprężyną, co wysunięcie wycinków). */
  const sat = {};                         // stan bieżący: x, y (środek), s (skala), a (jasność)
  const tgt = {};                         // cel
  const satR = () => (mode === 'list' ? Math.max(20, R * 0.27) : clamp(R * 0.25, 26, 44));
  const labelBox = {};
  function placeLabels(colTop) {
    const rs = satR();
    for (const g of GROUPS) {
      const el = labelOf[g];
      if (!el) continue;
      const q = QUAD[g];
      el.classList.toggle('on', g === active);
      el.classList.toggle('docked', !!active && g !== active && mode !== 'list');
      const w = el.offsetWidth || 120, h = el.offsetHeight || 20;
      let t;
      if (g === active && mode !== 'list' && colTop) {
        // nad kolumną kart, wyrównany do jej krawędzi bliższej kuli
        const x0 = q.sx > 0 ? colTop.lx : colTop.lx + colTop.w - w;
        const x = clamp(x0, 4, Math.max(4, W - w - 4)) + w / 2;
        const y = clamp(colTop.y - h / 2 - 16, h / 2 + 4, H - h / 2 - 4);
        t = { x, y, s: 0.78, a: 1 };
      } else if (active && mode !== 'list') {
        // Pozostałe grupy NIE znikają — „siadają" na dużej kuli, każda na swojej
        // ćwiartce, mniejsze (właściciel 2026-10-14). Najechanie przełącza grupę.
        t = { x: cx + q.sx * R * 0.5, y: cy - q.sy * R * 0.5, s: 0.62, a: 1 };
      } else {
        // okienko między łukami, CAŁY satelita i napis poza pierścieniem strzałek.
        // Najpierw przekątna (45°); gdy scena jest niska i satelita wyszedłby za
        // górną/dolną krawędź — kąt bliżej poziomu (łuki kończą się na ~31°).
        const ring = R * 1.2 + (mode === 'list' ? 6 : 12);
        const hw = Math.max(w / 2, rs), hh = Math.max(h / 2, rs);
        let best = null;
        for (const deg of [45, 41, 37, 34, 31]) {
          const ca = Math.cos(deg * Math.PI / 180), sa = Math.sin(deg * Math.PI / 180);
          let d = ring + rs;
          for (let k = 0; k < 80; k++) {
            const ox = d * ca, oy = d * sa;
            // najbliższy środkowi punkt prostokąta (napis + kula) musi leżeć za pierścieniem
            const nx = Math.max(0, ox - hw), ny = Math.max(0, oy - hh);
            if (Math.hypot(nx, ny) >= ring) break;
            d += 3;
          }
          const x = cx + q.sx * d * ca, y = cy - q.sy * d * sa;
          best = { x, y };
          if (y - hh >= 2 && y + hh <= H - 2 && x - hw >= 2 && x + hw <= W - 2) break;
        }
        const x = clamp(best.x, hw + 2, W - hw - 2);
        const y = clamp(best.y, hh + 2, H - hh - 2);
        t = { x, y, s: 1, a: 1 };
      }
      tgt[g] = t;
      // pierwsze ułożenie: satelity startują spod kuli (efekt „wylatywania")
      if (!sat[g]) sat[g] = { x: cx, y: cy, s: 0.2, a: 0, px: -1, py: -1, pa: -1 };
    }
  }

  // świeżo otwarta grupa: jej satelita startuje spod dużej kuli
  function launchFromUnder(g) {
    if (!g || !sat[g]) return;
    const q = QUAD[g];
    Object.assign(sat[g], { x: cx + q.sx * R * 0.22, y: cy - q.sy * R * 0.22, s: 0.2, a: 0 });
  }

  function stepSats(step) {
    for (const g of GROUPS) {
      const el = labelOf[g], c = sat[g], t = tgt[g];
      if (!el || !c || !t) continue;
      c.x += (t.x - c.x) * step; c.y += (t.y - c.y) * step;
      c.s += (t.s - c.s) * step; c.a += (t.a - c.a) * step;
      const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
      const x = Math.round(c.x - w / 2), y = Math.round(c.y - h / 2);
      // DOM tylko przy realnej zmianie (zasada projektu)
      if (x !== c.px || y !== c.py) { el.style.transform = `translate3d(${x}px, ${y}px, 0)`; c.px = x; c.py = y; }
      const op = Math.round(clamp((c.a - 0.25) / 0.75, 0, 1) * 100) / 100;
      if (op !== c.pa) {
        el.style.opacity = String(op);
        el.style.pointerEvents = op < 0.5 ? 'none' : '';
        c.pa = op;
      }
      labelBox[g] = { x: c.x - w / 2, y: c.y - h / 2, w, h };
    }
  }

  function satSettled() {
    for (const g of GROUPS) {
      const c = sat[g], t = tgt[g];
      if (c && t && (Math.abs(c.x - t.x) > 0.4 || Math.abs(c.y - t.y) > 0.4 || Math.abs(c.a - t.a) > 0.01)) return false;
    }
    return true;
  }

  // kulka satelity: ~230 punktów spirali, obraca się szybciej niż duża kula
  const SAT_PTS = [];
  for (let i = 0; i < 230; i++) {
    const y = 1 - (2 * (i + 0.5)) / 230;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    SAT_PTS.push([Math.cos(i * 2.39996) * r, y, Math.sin(i * 2.39996) * r]);
  }
  function drawSat(g, now, under) {
    const c = sat[g];
    if (!c || c.a < 0.02) return;
    if ((c.s < 0.55) !== under) return;        // pod dużą kulą rysujemy PRZED nią
    const rs = satR() * c.s;
    const spin = now * 0.00045 + GROUPS.indexOf(g) * 1.3;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const hot = g === active ? 1 : 0;
    const front = [], back = [];
    for (const p of SAT_PTS) {
      const x = p[0] * cs + p[2] * sn, z = -p[0] * sn + p[2] * cs, y = p[1];
      const sx = c.x + x * rs, sy = c.y - y * rs;
      // pas pod napisem przygaszony — litery muszą być czytelne na kuli
      const band = Math.abs(y) < 0.3 ? 0.35 : 1;
      (z > 0 ? front : back).push(sx, sy, band);
    }
    const sz = Math.max(1.2, rs * 0.06);
    const paint = (arr, al) => {
      for (let i = 0; i < arr.length; i += 3) {
        ctx.globalAlpha = al * arr[i + 2] * c.a;
        ctx.fillRect(arr[i] - sz / 2, arr[i + 1] - sz / 2, sz, sz);
      }
    };
    ctx.fillStyle = hot ? '#C8FF3A' : '#A6E21C';
    paint(back, 0.22);
    paint(front, hot ? 0.95 : 0.75);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(184,255,0,${(0.28 * c.a).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c.x, c.y, rs, 0, TAU); ctx.stroke();
  }

  /* ===== rozstawienie kart aktywnej grupy ===== */
  function place() {
    anchors = [];
    nodes.forEach(n => n.classList.toggle('on', active !== null && n.dataset.g === active));
    if (!active) { placeLabels(null); return; }
    if (mode === 'list') {                       // telefon: karty w zwykłym potoku pod kulą
      byGroup[GROUPS.indexOf(active)].forEach((n, i) => {
        n.style.transform = '';
        n.style.setProperty('--d', i * 24 + 'ms');
        // w liście nie ma sekwencji rysowania linii, więc karty zapalamy od razu —
        // bez tego `.ready` nigdy nie przychodzi i na telefonie widać pustkę
        n.classList.add('ready');
      });
      placeLabels(null);
      return;
    }

    const list = byGroup[GROUPS.indexOf(active)] || [];
    const side = QUAD[active].side;
    const up = QUAD[active].sy;                       // 1 = góra, -1 = dół
    const M = list.length;
    if (!M) return;

    // Gęstość dobierana do wysokości sceny. Limit uwzględnia miejsce na nazwę
    // grupy u góry i margines na dole — inaczej ostatnia karta ucieka poza ekran.
    const TOPGAP = 62, BOTGAP = 10;   // TOPGAP: miejsce na satelitę z nazwą grupy nad kolumną
    let gap = 10;
    if (nodesBox) {
      const need = () => list.reduce((s2, n) => s2 + (n.offsetHeight || 60), 0) + (M - 1) * gap;
      const room = H - TOPGAP - BOTGAP;
      nodesBox.classList.remove('dense', 'tight', 'micro', 'nano');
      if (need() > room) { nodesBox.classList.add('dense'); gap = 6; }
      if (need() > room) { nodesBox.classList.add('tight'); gap = 5; }
      if (need() > room) { nodesBox.classList.add('micro'); gap = 4; }
      if (need() > room) { nodesBox.classList.add('nano'); gap = 3; }
    }
    const hs = list.map(n => n.offsetHeight || 60);
    const total = hs.reduce((s, h) => s + h, 0) + (M - 1) * gap;

    // karty startują od strony wycinka (górne grupy wyżej, dolne niżej), ale
    // zawsze w całości mieszczą się w scenie
    let y = up > 0 ? TOPGAP : H - total - BOTGAP;
    y = clamp(y, TOPGAP, Math.max(TOPGAP, H - total - BOTGAP));

    const lx = side > 0
      ? Math.min(W - (list[0].offsetWidth || 260) - 6, cx + R * 1.16 + 78)
      : Math.max(6, cx - R * 1.16 - 78 - (list[0].offsetWidth || 260));

    list.forEach((n, k) => {
      const h = hs[k];
      const midY = y + h / 2;
      n.classList.toggle('l', side < 0);
      n.classList.toggle('r', side > 0);
      n.style.setProperty('--d', k * 30 + 'ms');
      n.style.transform = `translate3d(${Math.round(lx)}px, ${Math.round(y)}px, 0)`;
      anchors.push({ node: n, lx, ly: midY, side, i: k });
      y += h + gap;
    });
    placeLabels({ lx, y: anchors[0].ly - hs[0] / 2, w: list[0].offsetWidth || 260 });

  }

  // po wybraniu grupy na telefonie zjeżdżamy do kart — inaczej użytkownik stuka
  // w kulę i nie widzi, że coś się pod nią zmieniło
  function scrollToCards() {
    requestAnimationFrame(() => {
      const list = byGroup[GROUPS.indexOf(active)] || [];
      const first = list[0];
      if (!first) return;
      // karty stoją NAD kulą, więc celujemy w ich początek (przewijanie w górę);
      // 84 px to wysokość paska z zapasem
      const top = Math.max(0, first.getBoundingClientRect().top + scrollY - 84);
      scrollTo({ top, behavior: 'smooth' });
    });
  }

  /* ===== telefon: przyciski pozostałych grup pod CTA =====
     Lista pokazuje ZAWSZE trzy grupy, których teraz nie widać — po kliknięciu
     wybrana się otwiera i znika z listy, a jej miejsce zajmuje ta, która była
     otwarta do tej pory. Kolejność zegarowa (ORDER), żeby nie skakały. */
  function renderGroups() {
    if (!groupsBox) return;
    if (mode !== 'list') { groupsBox.hidden = true; groupsBox.innerHTML = ''; return; }
    groupsBox.hidden = false;
    const want = ORDER.filter(g => g !== active && (byGroup[GROUPS.indexOf(g)] || []).length);
    const have = Array.from(groupsBox.children).map(b => b.dataset.g);
    if (have.join() === want.join()) return;          // nic się nie zmieniło — nie piszemy do DOM
    groupsBox.innerHTML = '';
    want.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pl-gbtn';
      b.dataset.g = g;
      b.textContent = names[g] || g.toUpperCase();
      b.addEventListener('click', () => {
        markAct();
        // `setActive` przewija do kart tylko przy zmianie grupy — tu przewijamy
        // zawsze, bo przycisk stoi pod nimi i inaczej nie widać, co się stało
        if (g === active) scrollToCards(); else setActive(g);
      }, { signal });
      groupsBox.appendChild(b);
    });
  }

  /* ===== wybór wycinka ===== */
  function setActive(g, byUser = true) {
    userHold = byUser && !!g;
    if (g === active) return;
    active = g;
    if (mode === 'list' && byUser && g) scrollToCards();
    stage.classList.toggle('picked', !!g);
    reveal = 0;                                        // każde wejście rysuje się od nowa
    nodes.forEach(n => n.classList.remove('ready'));
    place();
    if (g && mode !== 'list') launchFromUnder(g);
    renderGroups();
  }

  // kursor: ćwiartka liczona od środka kuli, z niewielkim marginesem poza obrys
  // Wybór grupy: najechanie na ćwiartkę kuli, na nazwę grupy albo na kartę.
  // Nic nie zwijamy w środku sceny — inaczej droga „kula → karta" gasiła produkty
  // w połowie ruchu. Zwijamy dopiero, gdy kursor opuści całą scenę.
  function pick(e) {
    if (e.target.closest && (e.target.closest('.pl-gname') || e.target.closest('.pl-node'))) return;
    const r = stage.getBoundingClientRect();
    const dx = e.clientX - r.left - cx;
    const dy = e.clientY - r.top - cy;
    const inside = Math.hypot(dx, dy) <= R * (mode === 'list' ? 1.35 : 1.18);
    if (!inside) return;                       // poza kulą — zostawiamy jak jest
    const g = groupAt(dx > 0 ? 1 : -1, dy < 0 ? 1 : -1);
    // Telefon: stuknięcie w OTWARTĄ już grupę nie zwija jej, tylko jeszcze raz
    // przewija do kart (właściciel: „нажимаешь на открытую группу — всё равно
    // скролит"). Zwijanie zabierało produkty komuś, kto tylko chciał je zobaczyć.
    if (mode === 'list' && e.type === 'pointerdown') {
      if (g === active) scrollToCards(); else setActive(g);
      return;
    }
    if (mode !== 'list') setActive(g);
  }

  // Ślad aktywności: każdy ruch/klawisz/scroll przerywa auto-pokaz i zwija karty.
  // (Przy przepisywaniu wyboru grupy te słuchacze wyleciały — bez nich automat
  //  po bezczynności zostawał włączony na zawsze.)
  function markAct() {
    lastAct = performance.now();
    if (demo) { demo = false; setActive(null); }
  }
  addEventListener('pointermove', markAct, { signal, passive: true });
  addEventListener('pointerdown', markAct, { signal, passive: true });
  addEventListener('keydown', markAct, { signal });
  addEventListener('wheel', markAct, { signal, passive: true });

  stage.addEventListener('pointermove', pick, { signal });
  stage.addEventListener('pointerdown', pick, { signal });
  stage.addEventListener('pointerleave', () => { if (!COARSE) setActive(null); }, { signal });
  // karty trzymają grupę otwartą, dopóki kursor jest na nich
  nodes.forEach(n => {
    n.addEventListener('pointerenter', () => setActive(n.dataset.g), { signal });
  });
  // klawiatura: karty są linkami do audytu, więc focus też pokazuje grupę
  nodes.forEach(n => n.addEventListener('focus', () => setActive(n.dataset.g), { signal }));
  // najechanie (albo tap) na nazwę grupy działa tak samo jak najechanie na wycinek
  nameEls.forEach(el => {
    el.addEventListener('pointerenter', () => setActive(el.dataset.g), { signal });
    el.addEventListener('pointerdown', () => setActive(el.dataset.g), { signal });
  });

  /* ===== rysowanie ===== */
  const LIGHT = (() => { const v = [-0.4, 0.5, 0.77]; const m = Math.hypot(...v); return v.map(c => c / m); })();

  function drawSphere(now) {
    const wob = Math.sin(now * 0.00022) * 0.09;        // lekkie kołysanie, ćwiartki zostają
    const pitch = -0.22 + Math.sin(now * 0.00017) * 0.05;
    const cw = Math.cos(wob), sw = Math.sin(wob);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const size = Math.max(1.3, R * 0.0165);

    // 8 paczek: 4 wycinki × (przygaszony / podświetlony) — tyle zmian fillStyle na klatkę
    const buckets = [[], [], [], [], [], [], [], []];
    for (let i = 0; i < pts.length; i += (WEAK ? 2 : 1)) {
      const p = pts[i];
      const k = prog[p.g];
      const q = QUAD[p.g];
      // rozsunięcie wycinków: bazowo mała szczelina, pod kursorem większa
      const off = (0.014 + k * 0.042) * R;
      const x1 = p.x * cw + p.z * sw;
      const z1 = -p.x * sw + p.z * cw;
      const y2 = p.y * cp - z1 * sp;
      const z2 = p.y * sp + z1 * cp;
      if (z2 <= 0.02) continue;
      const sx = cx + x1 * R + q.sx * off;
      const sy = cy - y2 * R - q.sy * off;
      const lum = Math.max(0, x1 * LIGHT[0] + y2 * LIGHT[1] + z2 * LIGHT[2]);
      const edge = Math.min(1, z2 * 3.2);
      const v = (0.3 + lum * 0.7) * edge;
      const band = v > 0.62 ? 1 : 0;
      buckets[p.gi * 2 + band].push(sx, sy, size * (0.6 + z2 * 0.6));
    }

    for (let b = 0; b < 8; b++) {
      const arr = buckets[b];
      if (!arr.length) continue;
      const g = GROUPS[b >> 1], hot = b & 1, k = prog[g];
      // przygaszona kula → pod kursorem kwasowa zieleń
      const base = hot ? [168, 196, 104] : [104, 122, 68];
      const acid = hot ? [206, 255, 90] : [150, 210, 40];
      const cR = Math.round(base[0] + (acid[0] - base[0]) * k);
      const cG = Math.round(base[1] + (acid[1] - base[1]) * k);
      const cB = Math.round(base[2] + (acid[2] - base[2]) * k);
      ctx.fillStyle = `rgba(${cR},${cG},${cB},${(hot ? 0.75 : 0.44) + k * 0.25})`;
      for (let i = 0; i < arr.length; i += 3) {
        const s = arr[i + 2];
        ctx.fillRect(arr[i] - s / 2, arr[i + 1] - s / 2, s, s);
      }
    }

    // szkielet kuli: równik i dwa południki — bez nich punkty czytają się jak chmura
    const ringA = (rx, ry, alpha) => {
      ctx.strokeStyle = `rgba(184,255,0,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      ctx.stroke();
    };
    ringA(R, R, 0.16);                                   // obrys kuli
    ringA(R, R * Math.abs(Math.sin(pitch)) + R * 0.06, 0.1); // równik w perspektywie
    ringA(R * Math.abs(Math.sin(wob)) + R * 0.05, R, 0.08);  // południk

    // Strzałki na granicach wycinków: wszystkie w jedną stronę (zgodnie ze
    // wskazówkami zegara), narysowane KROPKAMI jak cała kula, a po okręgu
    // przebiega świetlna fala — obszary „przekazują sobie" pracę.
    // Na telefonie łuki-strzałki wokół kuli odpuszczamy: przy 390 px podpisy grup
    // nie mieszczą się poza pierścieniem i zawsze na niego wchodzą. Zostaje
    // czytelna kula, podpisy w narożnikach i strzałka w dół do kart.
    const arrowR = R * 1.2;
    const wave = (now * 0.00028) % 1;
    const dot = (x, y, sz, alpha) => {
      ctx.fillStyle = `rgba(184,255,0,${alpha.toFixed(3)})`;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    };
    for (let i = 0; i < 4; i++) {
      const edge = -Math.PI / 2 + i * (Math.PI / 2);   // granice: góra, prawo, dół, lewo
      const span = 0.5;
      const gA = groupAt(Math.cos(edge - span) > 0 ? 1 : -1, Math.sin(edge - span) < 0 ? 1 : -1);
      const gB = groupAt(Math.cos(edge + span) > 0 ? 1 : -1, Math.sin(edge + span) < 0 ? 1 : -1);
      const hot = Math.max(prog[gA] || 0, prog[gB] || 0);

      const steps = 26;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const a = edge - span + t * (2 * span);
        const x = cx + Math.cos(a) * arrowR, y = cy + Math.sin(a) * arrowR;
        // pozycja punktu na całym okręgu → fala biegnie dookoła kuli
        const glob = ((i + t) / 4) % 1;
        const d0 = Math.abs(glob - wave);
        const d = Math.min(d0, 1 - d0);
        const w = Math.max(0, 1 - d * 7);
        dot(x, y, 2.1 + w * 1.9, 0.3 + 0.55 * w + 0.25 * hot);
      }

      // grot — też z kropek, na końcu łuku, zawsze w tę samą stronę (zegarowo)
      const aEnd = edge + span + 0.05;
      const tx = -Math.sin(aEnd), ty = Math.cos(aEnd);      // styczna (zgodnie z zegarem)
      const nx = Math.cos(aEnd), ny = Math.sin(aEnd);
      const px = cx + nx * arrowR, py = cy + ny * arrowR;
      const headGlow = Math.max(0, 1 - Math.min(Math.abs(((i + 1) / 4) - wave), 1 - Math.abs(((i + 1) / 4) - wave)) * 7);
      for (let r = 0; r < 4; r++) {
        const back = r * 4.6, spread = r * 2.7;
        const arms = r === 0 ? [0] : [-1, 1];
        for (const sg of arms) {
          dot(px + tx * (5 - back) + nx * spread * sg,
              py + ty * (5 - back) + ny * spread * sg,
              2.6, 0.55 + 0.4 * headGlow + 0.2 * hot);
        }
      }
    }

    // aktywny wycinek: łuk krawędzi + delikatna poświata (bez ciemnej plamy)
    for (const g of GROUPS) {
      const k = prog[g];
      if (k < 0.01) continue;
      const q = QUAD[g];
      const off = (0.014 + k * 0.042) * R;
      const a0 = q.sx > 0 ? (q.sy > 0 ? -Math.PI / 2 : 0) : (q.sy > 0 ? Math.PI : Math.PI / 2);
      ctx.save();
      ctx.translate(q.sx * off, -q.sy * off);
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.12);
      gl.addColorStop(0, 'rgba(184,255,0,0)');
      gl.addColorStop(0.75, `rgba(184,255,0,${0.07 * k})`);
      gl.addColorStop(1, 'rgba(184,255,0,0)');
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * 1.0, a0, a0 + Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = gl; ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(184,255,0,${0.55 * k})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.995, a0, a0 + Math.PI / 2);
      ctx.stroke();
      // dwie krawędzie cięcia — pokazują, że to wycinek, a nie plama
      // krawędzie cięcia: krótkie, przy samej powierzchni — pełne promienie robiły
      // z kuli „wycięty kwadrat"
      ctx.strokeStyle = `rgba(184,255,0,${0.22 * k})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const a of [a0, a0 + Math.PI / 2]) {
        ctx.moveTo(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55);
        ctx.lineTo(cx + Math.cos(a) * R * 0.99, cy + Math.sin(a) * R * 0.99);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // cienka linia od każdego podpisu do jego wycinka
  // telefon: zamiast wynośnych linii — kropkowana strzałka w dół, od kuli do kart
  function drawListArrow() {
    if (mode !== 'list' || !active) return;
    // start pod dolnymi podpisami (pierścień + wysokość podpisu + zapas)
    const top = cy + R * 1.2 + 52;
    const bottom = Math.min(H - 6, top + 40);
    ctx.save();
    for (let y = top; y < bottom - 10; y += 7) {
      const k = (y - top) / Math.max(1, bottom - top);
      ctx.fillStyle = `rgba(184,255,0,${(0.25 + 0.55 * k).toFixed(3)})`;
      ctx.fillRect(cx - 1.5, y, 3, 3);
    }
    ctx.strokeStyle = 'rgba(184,255,0,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 7, bottom - 9);
    ctx.lineTo(cx, bottom - 1);
    ctx.lineTo(cx + 7, bottom - 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawLabelLinks() {
    if (mode === 'list') { drawListArrow(); return; }
    for (const g of GROUPS) {
      const c = sat[g];
      if (!c || c.a < 0.05 || c.s < 0.5) continue;
      const q = QUAD[g];
      const k = prog[g];
      const off = (0.014 + k * 0.042) * R;
      const ang = Math.atan2(-q.sy, q.sx);
      const tx = cx + Math.cos(ang) * R * 1.02 + q.sx * off;
      const ty = cy + Math.sin(ang) * R * 1.02 - q.sy * off;
      // linia startuje z brzegu satelity, od strony dużej kuli
      const rs = satR() * c.s;
      const sx = c.x - q.sx * rs * Math.SQRT1_2;
      const sy = c.y + q.sy * rs * Math.SQRT1_2;
      const mx = (sx + tx) / 2;
      ctx.strokeStyle = `rgba(184,255,0,${((0.18 + 0.5 * k) * c.a).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(mx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = `rgba(184,255,0,${((0.35 + 0.55 * k) * c.a).toFixed(3)})`;
      ctx.fillRect(tx - 2, ty - 2, 4, 4);
    }
  }

  /* ===== pętla ===== */
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(64, now - (last || now));
    last = now;
    const visible = !document.hidden && onScreen;
    if (!visible) return;
    if (WEAK && (frame++ & 1)) return;

    // auto-pokaz po bezczynności (tylko gdy grań jest aktywna i karta widoczna)
    const live = slide ? slide.classList.contains('active') : true;
    if (live && mode !== 'list') {
      // Automat gaśnie tylko wtedy, gdy grupę trzyma KURSOR — inaczej wyłączał
      // sam siebie zaraz po pierwszym pokazanym wycinku i nic dalej nie zmieniał.
      if (userHold && demo) demo = false;
      if (!demo && !userHold && now - lastAct > IDLE_MS) { demo = true; demoAt = 0; }
      if (demo && now - demoAt > DEMO_STEP) {
        demoAt = now;
        const i = active ? (ORDER.indexOf(active) + 1) % ORDER.length : 0;
        setActive(ORDER[i], false);
      }
    } else if (demo) { demo = false; }

    const step = 1 - Math.pow(0.001, dt / 1000);
    if (active) {
      reveal = Math.min(1, reveal + dt / 500);             // ~0,5 s na całą sekwencję (3× szybciej, prośba właściciela)
      // karty zapalają się jedna po drugiej — bez linii, sam rytm
      const step2 = 0.85 / Math.max(1, anchors.length);
      anchors.forEach((a, i) => { if (reveal >= (i + 0.35) * step2) a.node.classList.add('ready'); });
    }
    let settled = satSettled() && (reveal >= 1 || !active);
    for (const g of GROUPS) {
      const target = g === active ? 1 : 0;
      if (Math.abs(target - prog[g]) > 0.004) settled = false;
      prog[g] += (target - prog[g]) * step;
    }
    // spoczynek (nic nie leci, nikt nie rusza myszą): co druga klatka — perf.js
    if (settled && skipFrame(now, 'sphere')) return;

    stepSats(step);
    ctx.clearRect(0, 0, W, H);
    for (const g of GROUPS) drawSat(g, now, true);     // pod dużą kulą
    drawSphere(now);
    drawLabelLinks();
    for (const g of GROUPS) drawSat(g, now, false);    // nad nią
  }

  /* ===== start ===== */
  resize();
  addEventListener('resize', resize, { signal });
  let ro = null;
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => resize()); ro.observe(stage); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!ac.signal.aborted) resize(); });
  addEventListener('fiq:content-ready', () => {
    nameEls.forEach(e => { names[e.dataset.g] = e.textContent.trim(); });
    requestAnimationFrame(resize);
  }, { signal });
  raf = requestAnimationFrame(tick);

  return function destroy() {
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    if (vis) vis.disconnect();
    ac.abort();
  };
}
