// Движок страницы kontakt: нейро-столп слева, курсор, nav shrink, форма→mailto.
// Перенос 1:1 из kontakt.html; адаптация: SPA-переходы + cleanup.
import { interceptInternalLinks } from './wipe.js';

export function initKontakt({ onNavigate }) {

  const ac = new AbortController();
  const signal = ac.signal;
  let rafId = 0;
  let destroyed = false;

  /* prefers-reduced-motion игнорируем сознательно (урок HORIN) */
  const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
  const small = matchMedia('(max-width: 1000px)').matches;
  const FLAT = coarse || small;
  document.documentElement.classList.add(FLAT ? 'mode-flat' : 'mode-3d');

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let vw = innerWidth, vh = innerHeight;

  interceptInternalLinks(onNavigate, signal);

  const mouse = { x: vw / 2, y: vh / 2, ix: vw / 2, iy: vh / 2, active: false };
  addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  }, { passive: true, signal });
  document.addEventListener('mouseleave', () => { mouse.active = false; }, { signal });

  /* nav shrink */
  const navEl = document.querySelector('nav');
  let navShrunk = false;
  addEventListener('scroll', () => {
    const s = scrollY > 40;
    if (s !== navShrunk) { navShrunk = s; navEl.classList.toggle('shrunk', s); }
  }, { passive: true, signal });

  /* cursor */
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  let rx = vw / 2, ry = vh / 2;
  if (!FLAT) {
    document.addEventListener('mouseover', e => {
      if (e.target.closest('a, button, input, textarea')) ring.classList.add('link');
    }, { signal });
    document.addEventListener('mouseout', e => {
      if (e.target.closest('a, button, input, textarea')) ring.classList.remove('link');
    }, { signal });
  }

  /* ===== neural column (слева, за текстом) ===== */
  const canvas = document.getElementById('neural');
  const ctx = canvas.getContext('2d');
  const WEAK = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  const DPR = Math.min(devicePixelRatio || 1, WEAK ? 1.5 : 2);
  const COUNT = FLAT ? (WEAK ? 50 : 70) : (WEAK ? 95 : 130);
  const nodes = [];
  for (let i = 0; i < COUNT; i++) {
    const t = i / COUNT;
    nodes.push({
      a: i * 2.39996,
      y: (t - 0.5),
      rr: 0.78 + 0.3 * Math.sin(i * 1.7),
      ph: Math.random() * Math.PI * 2,
      ox: 0, oy: 0, sx: 0, sy: 0, depth: 0
    });
  }

  function sizeCanvas() {
    vw = innerWidth; vh = innerHeight;
    canvas.width = vw * DPR;
    canvas.height = vh * DPR;
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  sizeCanvas();
  addEventListener('resize', sizeCanvas, { signal });

  const pulses = [];

  function drawNeural(time) {
    ctx.clearRect(0, 0, vw, vh);
    const cx = FLAT ? vw * 0.5 : vw * 0.30;
    const cy = vh * 0.5;
    const baseR = Math.min(vw, vh) * (FLAT ? 0.34 : 0.24);
    const H = vh * 1.4;
    const f = 900;
    const rot = scrollY / vh * 0.8 + time * 0.00005;

    for (const n of nodes) {
      const ang = n.a + rot;
      const r3 = baseR * n.rr;
      const x3 = Math.cos(ang) * r3;
      const z3 = Math.sin(ang) * r3;
      const s = f / (f + z3 + baseR * 1.4);
      let sx = cx + x3 * s;
      let sy = cy + n.y * H * s;
      if (!FLAT && mouse.active) {
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
        ctx.strokeStyle = `rgba(184,255,0,${(near * (0.05 + dep * 0.18)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
        if (!FLAT && pulses.length < 12 && Math.random() < 0.0012) {
          pulses.push({ i, j, t: 0, sp: 0.018 + Math.random() * 0.02 });
        }
      }
    }

    if (!FLAT && mouse.active) {
      const MR = 180, MR2 = MR * MR;
      for (const n of nodes) {
        const dx = n.sx - mouse.ix, dy = n.sy - mouse.iy;
        const d2 = dx * dx + dy * dy;
        if (d2 > MR2) continue;
        const near = 1 - Math.sqrt(d2) / MR;
        ctx.strokeStyle = `rgba(245,245,240,${(near * 0.2).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(mouse.ix, mouse.iy);
        ctx.lineTo(n.sx, n.sy);
        ctx.stroke();
      }
    }

    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k];
      p.t += p.sp;
      if (p.t >= 1) { pulses.splice(k, 1); continue; }
      const a = nodes[p.i], b = nodes[p.j];
      const tw = Math.sin(p.t * Math.PI);
      ctx.fillStyle = `rgba(184,255,0,${(tw * 0.9).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(lerp(a.sx, b.sx, p.t), lerp(a.sy, b.sy, p.t), 1.6 + tw * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const n of nodes) {
      const flicker = 0.65 + 0.35 * Math.sin(time * 0.0011 + n.ph);
      const a = (0.1 + n.depth * 0.5) * flicker;
      ctx.fillStyle = n.ph % 1 < 0.22
        ? `rgba(184,255,0,${a.toFixed(3)})`
        : `rgba(245,245,240,${(a * 0.8).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, 1 + n.depth * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(time) {
    if (destroyed) return;
    mouse.ix = lerp(mouse.ix, mouse.x, 0.2);
    mouse.iy = lerp(mouse.iy, mouse.y, 0.2);
    if (!FLAT) {
      dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;
      rx = lerp(rx, mouse.x, 0.16);
      ry = lerp(ry, mouse.y, 0.16);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    }
    drawNeural(time);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  /* ===== form ===== */
  const pillsBox = document.getElementById('pills');
  pillsBox.addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (pill) pill.classList.toggle('on');
  }, { signal });

  const form = document.getElementById('briefForm');
  const sentOk = document.getElementById('sentOk');

  function shake(el) {
    el.closest('.f-row').classList.add('err');
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' },
       { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' },
       { transform: 'translateX(0)' }],
      { duration: 320, easing: 'ease-out' }
    );
  }

  ['fName', 'fEmail', 'fMsg'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      e.target.closest('.f-row').classList.remove('err');
    }, { signal });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('fName');
    const company = document.getElementById('fCompany');
    const email = document.getElementById('fEmail');
    const msg = document.getElementById('fMsg');

    let bad = false;
    if (!name.value.trim()) { shake(name); bad = true; }
    if (!email.value.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { shake(email); bad = true; }
    if (!msg.value.trim()) { shake(msg); bad = true; }
    if (bad) return;

    const topics = Array.from(pillsBox.querySelectorAll('.pill.on'))
      .map(p => p.dataset.topic);

    const subject = `Briefing strategiczny — ${company.value.trim() || name.value.trim()}`;
    const body = [
      `Imię i nazwisko: ${name.value.trim()}`,
      `Firma: ${company.value.trim() || '—'}`,
      `E-mail: ${email.value.trim()}`,
      `Obszary: ${topics.length ? topics.join(', ') : '—'}`,
      '',
      'O marce:',
      msg.value.trim()
    ].join('\n');

    location.href = `mailto:infinitiq@fastline.pl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    sentOk.classList.add('show');
  }, { signal });

  return function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    ac.abort();
    document.documentElement.classList.remove('mode-3d', 'mode-flat');
  };
}
