// Секция «Zespół AI»: силуэты из точек, построенные ИЗ САМОГО ПОРТРЕТА
// (альфа-маска + детализация), 3D-проекция как у нейро-столпа, связи с курсором,
// по ховеру сетка гаснет и проявляется фотография.
//
// Почему облако считается в рантайме, а не лежит готовым JSON: портрет
// редактируется через CMS — при замене фото сетка обязана совпасть с новым лицом.

const RW = 220;               // ширина растра для сэмплирования (raster units)
const F = 520;                // фокус перспективы (в px канваса)
const Z_AMP = 16;             // «выпуклость» силуэта к зрителю (raster units)

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ===== Построение облака точек из картинки с альфой ===== */
function buildCloud(img, budget, seed) {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) return null;
  const rw = RW, rh = Math.max(8, Math.round(rw * nh / nw));
  const c = document.createElement('canvas');
  c.width = rw; c.height = rh;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, rw, rh);
  let data;
  try { data = g.getImageData(0, 0, rw, rh).data; }
  catch (e) { return null; }                       // canvas «протух» из-за CORS
  const n = rw * rh;

  const A = new Float32Array(n), L = new Float32Array(n);
  let solid = 0, topY = rh;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] / 255;
    A[i] = a;
    if (a > 0.35) {
      solid++;
      const y = (i / rw) | 0; if (y < topY) topY = y;
      L[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    }
  }
  // нет альфы (обычный JPEG из CMS) или пустая картинка — сетку не строим
  if (solid < n * 0.02 || solid > n * 0.93) return null;

  // градиенты: E — детали внутри (лицо, лацканы), S — контур силуэта
  const E = new Float32Array(n), S = new Float32Array(n);
  for (let y = 1; y < rh - 1; y++) {
    for (let x = 1; x < rw - 1; x++) {
      const i = y * rw + x;
      if (A[i] < 0.4) continue;
      E[i] = Math.min(1, (Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + rw] - L[i - rw])) * 2.6);
      S[i] = Math.min(1, (Math.abs(A[i + 1] - A[i - 1]) + Math.abs(A[i + rw] - A[i - rw])) * 1.4);
    }
  }

  // distance transform (чемфер в два прохода): глубина внутрь силуэта → z
  const D = new Float32Array(n);
  const BIG = 1e6;
  for (let i = 0; i < n; i++) D[i] = A[i] > 0.5 ? BIG : 0;
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = y * rw + x; if (!D[i]) continue;
    let v = D[i];
    if (x > 0) v = Math.min(v, D[i - 1] + 1);
    if (y > 0) v = Math.min(v, D[i - rw] + 1);
    if (x > 0 && y > 0) v = Math.min(v, D[i - rw - 1] + 1.41);
    if (x < rw - 1 && y > 0) v = Math.min(v, D[i - rw + 1] + 1.41);
    D[i] = v;
  }
  for (let y = rh - 1; y >= 0; y--) for (let x = rw - 1; x >= 0; x--) {
    const i = y * rw + x; if (!D[i]) continue;
    let v = D[i];
    if (x < rw - 1) v = Math.min(v, D[i + 1] + 1);
    if (y < rh - 1) v = Math.min(v, D[i + rw] + 1);
    if (x < rw - 1 && y < rh - 1) v = Math.min(v, D[i + rw + 1] + 1.41);
    if (x > 0 && y < rh - 1) v = Math.min(v, D[i + rw - 1] + 1.41);
    D[i] = v;
  }

  // ===== сэмплирование: плотнее там, где детали; минимальная дистанция через грид
  const rnd = mulberry32(seed);
  const CELL = 4.8;
  const gw = Math.ceil(rw / CELL), gh = Math.ceil(rh / CELL);
  const grid = new Array(gw * gh);
  const pts = [];
  const tries = budget * 40;
  for (let t = 0; t < tries && pts.length < budget; t++) {
    const x = 1 + rnd() * (rw - 2), y = 1 + rnd() * (rh - 2);
    const i = ((y | 0) * rw + (x | 0));
    if (A[i] < 0.55) continue;
    const det = Math.min(1, E[i] * 0.95 + S[i] * 1.3);
    // голова — верхняя треть силуэта: там сетка должна быть заметно плотнее,
    // иначе лицо не читается (кожа почти без градиентов)
    const head = Math.max(0, 1 - (y - topY) / (rh * 0.36));
    if (rnd() > 0.10 + det * 0.72 + head * 0.42) continue;
    let md = (4.6 - 2.9 * det) * (1 - 0.46 * head);
    if (S[i] > 0.45) md = Math.min(md, 1.45);   // контур силуэта — плотной строчкой
    const gx = (x / CELL) | 0, gy = (y / CELL) | 0;
    let ok = true;
    for (let ny = gy - 1; ny <= gy + 1 && ok; ny++) {
      if (ny < 0 || ny >= gh) continue;
      for (let nx = gx - 1; nx <= gx + 1 && ok; nx++) {
        if (nx < 0 || nx >= gw) continue;
        const cell = grid[ny * gw + nx]; if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          const p = pts[cell[k]];
          const dx = p.x - x, dy = p.y - y;
          const lim = Math.min(md, p.md);
          if (dx * dx + dy * dy < lim * lim) { ok = false; break; }
        }
      }
    }
    if (!ok) continue;
    const depth = Math.min(1, D[i] / 19);
    const idx = pts.length;
    pts.push({
      x, y,
      z: -Z_AMP * Math.sqrt(depth),                 // внутрь силуэта = ближе к зрителю
      sil: S[i], det, lum: L[i],
      md,
      ph: rnd() * Math.PI * 2,
      acc: rnd() < 0.72,                            // кислотный / белёсый
      sx: 0, sy: 0, dep: 0, ox: 0, oy: 0,
      jx: (rnd() * 2 - 1), jy: (rnd() * 2 - 1),     // разлёт для intro
    });
    const key = gy * gw + gx;
    (grid[key] || (grid[key] = [])).push(idx);
  }
  if (pts.length < 40) return null;

  // ===== связи: до 3 ближайших соседей (треугольная сетка как в референсе)
  const CE = 6.2;
  const ew = Math.ceil(rw / CE), eh = Math.ceil(rh / CE);
  const eg = new Array(ew * eh);
  pts.forEach((p, i) => {
    const k = ((p.y / CE) | 0) * ew + ((p.x / CE) | 0);
    (eg[k] || (eg[k] = [])).push(i);
  });
  const edges = [];
  const seen = new Set();
  const MAXD2 = 6.8 * 6.8;
  const cand = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    cand.length = 0;
    const gx = (p.x / CE) | 0, gy = (p.y / CE) | 0;
    for (let ny = gy - 1; ny <= gy + 1; ny++) {
      if (ny < 0 || ny >= eh) continue;
      for (let nx = gx - 1; nx <= gx + 1; nx++) {
        if (nx < 0 || nx >= ew) continue;
        const cell = eg[ny * ew + nx]; if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          const j = cell[k]; if (j === i) continue;
          const q = pts[j];
          const d2 = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
          if (d2 < MAXD2) cand.push([d2, j]);
        }
      }
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < cand.length && k < 3; k++) {
      const j = cand[k][1];
      const key = i < j ? i * 100000 + j : j * 100000 + i;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(i, j);
    }
  }
  return { pts, edges: Int32Array.from(edges), rw, rh };
}

/* ===== Инициализация секции ===== */
export function initTeam({ signal, coarse, weak, mouse }) {
  const cards = Array.from(document.querySelectorAll('.team-card'));
  if (!cards.length) return null;

  const DPR = Math.min(devicePixelRatio || 1, weak ? 1.5 : 2);
  const BUD_MIN = coarse ? 260 : 420;
  const BUD_MAX = weak ? 700 : (coarse ? 900 : 1200);
  const DENSITY = weak ? 0.0052 : 0.0078;         // точек на CSS-px² канваса
  const budgetFor = (w, h) => Math.max(BUD_MIN, Math.min(BUD_MAX, Math.round(w * h * DENSITY)));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const items = cards.map((card, i) => {
    const item = {
      card,
      canvas: card.querySelector('.tm-canvas'),
      img: card.querySelector('.tm-photo'),
      cloud: null, src: '',
      w: 0, h: 0, ctx: null,
      hover: 0, hoverTarget: 0,
      intro: 0, introRun: false,
      rect: null,
      seed: 1013 + i * 977,
      phase: i * 2.1,
    };
    if (item.canvas) item.ctx = item.canvas.getContext('2d');
    return item;
  }).filter(it => it.ctx && it.img);

  /* ---- размеры канвасов ---- */
  function sizeAll() {
    items.forEach(it => {
      const w = it.canvas.clientWidth, h = it.canvas.clientHeight;
      if (!w || !h) return;
      if (it.w === w && it.h === h) return;
      it.w = w; it.h = h;
      it.canvas.width = Math.round(w * DPR);
      it.canvas.height = Math.round(h * DPR);
      it.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    });
    refreshRects();
  }
  function refreshRects() {
    items.forEach(it => { it.rect = it.canvas.getBoundingClientRect(); });
  }

  /* ---- построение облака (в т.ч. после подмены фото из CMS) ---- */
  function ensureCloud(it) {
    const src = it.img.getAttribute('src') || '';
    if (!src || src === it.src) return;
    it.src = src;
    const sameOrigin = src.indexOf('data:') === 0 ||
      src.indexOf('/') === 0 ||
      src.indexOf(location.origin) === 0;
    const source = sameOrigin ? it.img : new Image();
    const run = () => {
      const cloud = buildCloud(source, budgetFor(it.w || 340, it.h || 300), it.seed);
      if (cloud) {
        it.cloud = cloud;
        it.card.classList.remove('tm-static');
      } else {
        // CORS/пустая альфа — сетку не строим, показываем фото как есть
        it.cloud = null;
        it.card.classList.add('tm-static');
      }
    };
    if (sameOrigin) {
      if (it.img.complete && it.img.naturalWidth) run();
      else it.img.addEventListener('load', run, { once: true, signal });
    } else {
      source.crossOrigin = 'anonymous';
      source.addEventListener('load', run, { once: true, signal });
      source.addEventListener('error', () => it.card.classList.add('tm-static'), { once: true, signal });
      source.src = src;
    }
  }
  function rebuild() { items.forEach(ensureCloud); }

  /* ---- ховер / тап ---- */
  // Где наводить нечем — лица показываются по очереди сами.
  // Условие не только `coarse`: узкое окно = одноколоночная раскладка (и это же
  // единственный способ посмотреть мобильный вид на десктопе), там ховера тоже нет.
  const AUTO_P = 3800, AUTO_SHOW = 2800;
  let autoT0 = 0, autoUntil = 0, userIdx = -1, hoverHold = false;
  const autoOn = () => coarse || innerWidth <= 900;
  function autoFaces(time, visible) {
    if (!autoOn() || !visible || hoverHold) { autoT0 = 0; return; }
    if (time < autoUntil) return;             // юзер только что тронул — не мешаем
    if (!autoT0) autoT0 = time;
    const el = (time - autoT0) % (AUTO_P * items.length);
    const idx = Math.floor(el / AUTO_P);
    const on = (el % AUTO_P) < AUTO_SHOW;
    for (let i = 0; i < items.length; i++) items[i].hoverTarget = (on && i === idx) ? 1 : 0;
  }
  // пауза автопоказа после действия юзера (тап/ховер/фокус)
  function holdAuto(ms) { autoUntil = performance.now() + ms; autoT0 = 0; }

  items.forEach((it, i) => {
    if (coarse) {
      it.card.addEventListener('click', () => {
        // тап по карточке всегда показывает именно её (даже если её лицо уже
        // показывал автопоказ); повторный тап по своей же — прячет
        const off = userIdx === i && it.hoverTarget > 0.5;
        items.forEach(o => { o.hoverTarget = 0; });
        it.hoverTarget = off ? 0 : 1;
        userIdx = off ? -1 : i;
        holdAuto(8000);
      }, { signal });
    } else {
      it.card.addEventListener('mouseenter', () => {
        hoverHold = true;
        items.forEach(o => { if (o !== it) o.hoverTarget = 0; });
        it.hoverTarget = 1;
      }, { signal });
      it.card.addEventListener('mouseleave', () => {
        hoverHold = false; it.hoverTarget = 0; holdAuto(2500);
      }, { signal });
    }
    it.card.addEventListener('focus', () => { hoverHold = true; it.hoverTarget = 1; }, { signal });
    it.card.addEventListener('blur', () => { hoverHold = false; it.hoverTarget = 0; holdAuto(2500); }, { signal });
    it.card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); it.hoverTarget = it.hoverTarget > 0.5 ? 0 : 1; }
    }, { signal });
  });

  /* ---- отрисовка одной карточки ---- */
  const EDGE_A = [0.05, 0.10, 0.18, 0.28];
  const PT_A = [0.20, 0.46, 0.88];
  const PT_S = [1.0, 1.3, 1.7];

  function drawCard(it, time) {
    const { ctx, w, h } = it;
    ctx.clearRect(0, 0, w, h);
    const cloud = it.cloud;
    if (!cloud) return;
    const { pts, edges, rw, rh } = cloud;

    // раскладка 1:1 с CSS object-fit: contain у .tm-photo
    const S = Math.min(w / rw, h / rh);
    const offX = (w - rw * S) / 2, offY = (h - rh * S) / 2;
    const cxp = w / 2, cyp = h / 2;

    const hv = it.hover;
    if (!(w > 0) || !(h > 0)) return;
    // лёгкое вращение вокруг вертикали: силуэт обязан оставаться читаемым
    const ang = 0.13 * Math.sin(time * 0.00019 + it.phase) + (it.parallax || 0);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    // размах камерной глубины: горизонтальный параллакс + собственная толщина силуэта
    const zSpan = Math.max(1, (w * 0.5) * Math.abs(sa) * 2 + Z_AMP * S * 2);
    const intro = it.intro;
    const introE = intro >= 1 ? 1 : 1 - Math.pow(1 - intro, 3);

    // локальные координаты курсора
    let mx = -9999, my = -9999;
    if (!coarse && mouse.active && it.rect) {
      mx = mouse.ix - it.rect.left;
      my = mouse.iy - it.rect.top;
    }
    const MR = 118, MR2 = MR * MR;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const bx = (offX + p.x * S) - cxp;
      const by = (offY + p.y * S) - cyp;
      const bz = p.z * S;
      const xr = bx * ca - bz * sa;
      const zr = bx * sa + bz * ca;
      const s = F / (F + zr);
      let sx = cxp + xr * s;
      let sy = cyp + by * s;

      // «дыхание» — небольшое, чтобы силуэт не рассыпался
      const br = 1 - hv * 0.75;
      sx += Math.sin(time * 0.0011 + p.ph) * 0.9 * br;
      sy += Math.cos(time * 0.0009 + p.ph * 1.7) * 0.7 * br;

      // курсор расталкивает точки (слабо) — сеть «живая»
      if (mx > -9000) {
        const dx = sx + p.ox - mx, dy = sy + p.oy - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < MR2 && d2 > 1) {
          const d = Math.sqrt(d2);
          const force = (1 - d / MR) * 6.5 * (1 - hv);
          p.ox += (dx / d) * force * 0.16;
          p.oy += (dy / d) * force * 0.16;
        }
      }
      p.ox *= 0.87; p.oy *= 0.87;
      sx += p.ox; sy += p.oy;

      // intro: точки собираются из разлёта
      if (introE < 1) {
        const local = clamp(introE * 1.55 - (i / pts.length) * 0.55, 0, 1);
        const k = 1 - (local >= 1 ? 1 : 1 - Math.pow(1 - local, 3));
        sx += p.jx * 46 * k;
        sy += p.jy * 34 * k;
      }

      p.sx = sx; p.sy = sy;
      p.dep = clamp(0.5 - zr / zSpan, 0, 1);
      p.vis = introE < 1 ? clamp(introE * 1.8 - (i / pts.length) * 0.8, 0, 1) : 1;
    }

    // ---- связи (4 пачки по альфе — один stroke на пачку)
    const meshK = (1 - hv * 0.88) * introE;
    if (meshK > 0.02) {
      ctx.lineWidth = 1;
      for (let b = 0; b < 4; b++) {
        ctx.beginPath();
        let any = false;
        for (let e = 0; e < edges.length; e += 2) {
          const a = pts[edges[e]], q = pts[edges[e + 1]];
          const dep = (a.dep + q.dep) * 0.5;
          const bi = dep < 0.3 ? 0 : dep < 0.55 ? 1 : dep < 0.78 ? 2 : 3;
          if (bi !== b) continue;
          const v = Math.min(a.vis, q.vis);
          if (v < 0.15) continue;
          if ((a.lum + q.lum) * 0.5 < 0.045 && bi < 2) continue;
          any = true;
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(q.sx, q.sy);
        }
        if (!any) continue;
        ctx.strokeStyle = `rgba(184,255,0,${(EDGE_A[b] * meshK).toFixed(3)})`;
        ctx.stroke();
      }
    }

    // ---- точки (3 пачки по глубине × 2 цвета)
    for (let b = 0; b < 3; b++) {
      const alpha = PT_A[b] * introE;
      if (alpha < 0.004) continue;
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = col === 0
          ? `rgba(184,255,0,${alpha.toFixed(3)})`
          : `rgba(245,245,240,${(alpha * 0.8).toFixed(3)})`;
        const sz = PT_S[b];
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const bi = p.dep < 0.34 ? 0 : p.dep < 0.68 ? 1 : 2;
          if (bi !== b) continue;
          if ((p.acc ? 0 : 1) !== col) continue;
          if (p.vis < 0.15) continue;
          // по ховеру контур остаётся, заливка уходит — фото «дышит» сквозь сетку
          const k = 1 - hv;
          if (k < 0.06) continue;
          const flick = 0.72 + 0.28 * Math.sin(time * 0.0013 + p.ph);
          // светимость точки = светимость пикселя портрета: лицо и рубашка читаются,
          // тёмный костюм уходит в тень — силуэт «портретный», а не плоский
          const lumK = Math.min(1.45, 0.52 + 1.02 * p.lum);
          const a2 = alpha * k * flick * p.vis * lumK;
          if (a2 < 0.02) continue;
          ctx.globalAlpha = a2 / alpha;
          ctx.fillRect(p.sx - sz / 2, p.sy - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
      }
    }

    // ---- синапсы к курсору
    if (mx > -9000 && hv < 0.75) {
      const k = (1 - hv) * introE;
      ctx.strokeStyle = `rgba(245,245,240,${(0.16 * k).toFixed(3)})`;
      ctx.beginPath();
      let cnt = 0;
      for (let i = 0; i < pts.length && cnt < 16; i++) {
        const p = pts[i];
        const dx = p.sx - mx, dy = p.sy - my;
        if (dx * dx + dy * dy > MR2) continue;
        cnt++;
        ctx.moveTo(mx, my);
        ctx.lineTo(p.sx, p.sy);
      }
      if (cnt) ctx.stroke();
    }
  }

  /* ---- кадр: рисуем только пока секция рядом с вьюпортом ---- */
  let sized = false, lastRectKey = -1, rectAge = 0;
  function tick(time, visible, scrollKey, centered) {
    if (!sized) { sizeAll(); sized = true; }
    if (!visible) {
      // ничего не пишем в DOM, пока действительно нечего менять (правило проекта)
      for (const it of items) {
        if (it.hoverTarget || it.hover) { it.hoverTarget = 0; it.hover = 0; }
        if (it.card.classList.contains('on')) it.card.classList.remove('on');
      }
      autoFaces(time, false);
      return;
    }
    // rect'ы: при скролле — сразу, дальше редкой ревизией (грид доезжает
    // на CSS-переходе reveal уже после того, как барабан встал)
    if (scrollKey !== lastRectKey || ++rectAge > 20) { lastRectKey = scrollKey; rectAge = 0; refreshRects(); }
    autoFaces(time, true);
    for (const it of items) {
      ensureCloud(it);
      if ((!it.w || !it.h) && it.canvas.clientWidth) sizeAll();
      if (!it.introRun && centered) { it.introRun = true; it.intro = 0; }
      if (it.introRun && it.intro < 1) it.intro = Math.min(1, it.intro + 0.014);
      it.hover = lerp(it.hover, it.hoverTarget, 0.11);
      if (Math.abs(it.hover - it.hoverTarget) < 0.004) it.hover = it.hoverTarget;
      const on = it.hover > 0.5;
      if (on !== it.card.classList.contains('on')) it.card.classList.toggle('on', on);
      // лёгкий параллакс поворота от курсора по X
      if (!coarse && it.rect) {
        const rel = clamp((mouse.ix - it.rect.left) / Math.max(1, it.rect.width), 0, 1) - 0.5;
        it.parallax = lerp(it.parallax || 0, rel * 0.22, 0.06);
      }
      drawCard(it, time);
    }
  }

  addEventListener('fiq:content-ready', rebuild, { signal });
  addEventListener('resize', () => { sized = false; }, { signal });

  return { tick, rebuild, resize: () => { sized = false; } };
}
