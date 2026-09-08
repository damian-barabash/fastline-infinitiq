/* ═══ HERO — kula rozcięta na cztery wycinki ═══════════════════════════════
   Zamiast planety i zakładek: kula z punktów, przecięta na krzyż na cztery
   części — każda to jedna grupa produktów. Najechanie na wycinek podświetla go,
   wysuwa z kuli, pokazuje nazwę grupy, a potem RYSUJE linie, z których wychodzą
   karty produktów — zawsze po stronie tego wycinka.

   Rysowane własną projekcją 3D na canvasie 2D (jak neuro-słup i sylwetki
   zespołu): zero zależności, pełna kontrola nad kolorem i timingiem. */

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
  const nodesBox = stage.querySelector('.pl-nodes');

  const nodes = Array.from(stage.querySelectorAll('.pl-node'));
  const byGroup = GROUPS.map(g => nodes.filter(n => n.dataset.g === g));
  const nameEls = Array.from(stage.querySelectorAll('.pl-gname'));
  const labelOf = Object.fromEntries(nameEls.map(e => [e.dataset.g, e]));
  const names = Object.fromEntries(nameEls.map(e => [e.dataset.g, e.textContent.trim()]));

  const WEAK = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const DPR = Math.min(devicePixelRatio || 1, WEAK ? 1.5 : 2);
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
    cx = W / 2;
    cy = mode === 'list' ? Math.min(H * 0.5, 150) : H / 2;
    R = mode === 'list'
      ? Math.min(W * 0.36, 140)
      : Math.min(W * 0.15, H * 0.36, 172);
    place();
  }

  /* ===== podpisy wycinków ===== */
  // Podpis nieaktywnej grupy stoi przy swoim wycinku, aktywnej — nad kolumną kart
  // (inaczej karty by go zasłoniły). Do każdego biegnie linia do kuli.
  const labelBox = {};
  function placeLabels(colTop) {
    for (const g of GROUPS) {
      const el = labelOf[g];
      if (!el) continue;
      const q = QUAD[g];
      el.classList.toggle('l', q.sx < 0);
      el.classList.toggle('r', q.sx > 0);
      el.classList.toggle('on', g === active);
      const h = el.offsetHeight || 18;
      let x, y;
      if (g === active && mode !== 'list' && colTop) {
        // Podpis trzyma się krawędzi kolumny kart. Szerokość mierzymy po zdjęciu
        // sztywnej wartości — font-size zmienia się bez animacji, więc pomiar jest
        // wiarygodny, a długie nazwy nie wychodzą poza scenę.
        el.style.width = '';
        const lw = el.offsetWidth || colTop.w;
        x = clamp(QUAD[g].sx > 0 ? colTop.lx : colTop.lx + colTop.w - lw, 4, Math.max(4, W - lw - 4));
        y = clamp(colTop.y - h - 10, 4, Math.max(4, H - h - 10));
        el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
        labelBox[g] = { x, y, w: lw, h };
        continue;
      }
      el.style.width = '';
      const w = el.offsetWidth || 0;
      {
        // Gdy któraś grupa jest otwarta, pozostałe podpisy „wsysają się" do środka
        // kuli (i mają własną podkładkę, żeby dało się je czytać na punktach).
        const far = mode === 'list' ? 1.1 : (active ? 0.5 : 1.3);
        const d = R * far;
        x = cx + q.sx * d * (active && mode !== 'list' ? 0.62 : 0.78) - (q.sx > 0 ? 0 : w);
        y = cy - q.sy * d * (active && mode !== 'list' ? 0.62 : 0.78) - h / 2;
        el.classList.toggle('in', !!active && mode !== 'list');
      }
      if (g === active) el.classList.remove('in');
      x = clamp(x, 4, Math.max(4, W - w - 4));
      y = clamp(y, 4, Math.max(4, H - h - 10));
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      labelBox[g] = { x, y, w, h };
    }
  }

  /* ===== rozstawienie kart aktywnej grupy ===== */
  function place() {
    anchors = [];
    nodes.forEach(n => n.classList.toggle('on', active !== null && n.dataset.g === active));
    if (!active) { placeLabels(null); return; }
    if (mode === 'list') {                       // telefon: karty w zwykłym potoku pod kulą
      byGroup[GROUPS.indexOf(active)].forEach((n, i) => {
        n.style.transform = '';
        n.style.setProperty('--d', i * 70 + 'ms');
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
    const TOPGAP = 46, BOTGAP = 10;   // TOPGAP mieści nazwę grupy nad kolumną   // TOPGAP: miejsce na nazwę grupy nad kolumną
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
      n.style.setProperty('--d', k * 90 + 'ms');
      n.style.transform = `translate3d(${Math.round(lx)}px, ${Math.round(y)}px, 0)`;
      anchors.push({ node: n, lx, ly: midY, side, i: k });
      y += h + gap;
    });
    placeLabels({ lx, y: anchors[0].ly - hs[0] / 2, w: list[0].offsetWidth || 260 });

  }

  /* ===== wybór wycinka ===== */
  function setActive(g, byUser = true) {
    userHold = byUser && !!g;
    if (g === active) return;
    active = g;
    stage.classList.toggle('picked', !!g);
    reveal = 0;                                        // każde wejście rysuje się od nowa
    nodes.forEach(n => n.classList.remove('ready'));
    place();
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
    if (mode === 'list' && e.type === 'pointerdown') { setActive(g === active ? null : g); return; }
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
  function drawLabelLinks() {
    if (mode === 'list') return;
    for (const g of GROUPS) {
      const box = labelBox[g];
      if (!box) continue;
      const q = QUAD[g];
      const k = prog[g];
      const off = (0.014 + k * 0.042) * R;
      const ang = Math.atan2(-q.sy, q.sx);
      const tx = cx + Math.cos(ang) * R * 1.02 + q.sx * off;
      const ty = cy + Math.sin(ang) * R * 1.02 - q.sy * off;
      const sx = q.sx > 0 ? box.x : box.x + box.w;
      const sy = box.y + box.h / 2;
      const mx = (sx + tx) / 2;
      ctx.strokeStyle = `rgba(184,255,0,${0.18 + 0.5 * k})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(mx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = `rgba(184,255,0,${0.35 + 0.55 * k})`;
      ctx.fillRect(tx - 2, ty - 2, 4, 4);
    }
  }

  /* ===== pętla ===== */
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(64, now - (last || now));
    last = now;
    const visible = !document.hidden && (!slide || slide.classList.contains('shown'));
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
      reveal = Math.min(1, reveal + dt / 1500);            // ~1,5 s na całą sekwencję
      // karty zapalają się jedna po drugiej — bez linii, sam rytm
      const step2 = 0.85 / Math.max(1, anchors.length);
      anchors.forEach((a, i) => { if (reveal >= (i + 0.35) * step2) a.node.classList.add('ready'); });
    }
    for (const g of GROUPS) {
      const target = g === active ? 1 : 0;
      prog[g] += (target - prog[g]) * step;
    }

    ctx.clearRect(0, 0, W, H);
    drawSphere(now);
    drawLabelLinks();
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
    ac.abort();
  };
}
