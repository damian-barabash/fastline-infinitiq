import React from 'react';

// Инлайн SVG-иконки страницы аудита (stroke, currentColor, 24×24).
const P = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /><rect x="10" y="10" width="4" height="4" /></>,
  chart: <><path d="M3 21h18" /><path d="M6 21V12M11 21V6M16 21V9M21 21V4" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  rocket: <><path d="M12 15c-2 0-5-1-5-1s1-6 4-9c2.5-2.5 7-3 7-3s-.5 4.5-3 7c-3 3-9 4-9 4" /><path d="M9 15l-3 6 6-3" /><circle cx="14" cy="10" r="1.6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  shield: <><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M8.5 12l2.5 2.5 4.5-4.5" /></>,
  robot: <><rect x="5" y="8" width="14" height="10" rx="2" /><path d="M12 8V4M9 4h6" /><circle cx="9.5" cy="12.5" r="1" fill="currentColor" stroke="none" /><circle cx="14.5" cy="12.5" r="1" fill="currentColor" stroke="none" /><path d="M9 15.5h6" /></>,
  pen: <><path d="M4 20l1.5-5L17 3.5a2.1 2.1 0 013 3L8.5 18z" /><path d="M13.5 7l3 3" /></>,
  box: <><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  message: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
  bolt: <><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.6" /></>,
  play: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></>,
  wrench: <><path d="M14.5 6.5a4.5 4.5 0 00-6.1 5.3L3 17.2a2 2 0 002.8 2.8l5.4-5.4a4.5 4.5 0 005.3-6.1l-2.9 2.9-2.3-.7-.7-2.3z" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><path d="M15.5 5.7a3.2 3.2 0 010 5.6M17.6 14.9c1.7.7 2.7 2.1 3 4.1" /></>,
  funnel: <><path d="M3 4h18l-7 8v7l-4-2v-5z" /></>,
  speed: <><path d="M4 17a8.5 8.5 0 0116 0" /><path d="M12 17l4.2-5.2" /><circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none" /><path d="M5.5 13.5l1 .6M18.5 13.5l-1 .6M12 8.5v1.2" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h13l-2.5 4L18 12H5" /></>,
  phone: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  heart: <><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></>,
  coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  tag: <><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" /></>,
  star: <><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>,
  book: <><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" /><path d="M4 19a2 2 0 012-2h13M8 7h7" /></>,
  cart: <><path d="M3 4h2l2.4 11h11l2-7H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  brain: <><path d="M9 4a3 3 0 00-3 3v1a3 3 0 00-2 3 3 3 0 002 3v1a3 3 0 003 3h3V4z" /><path d="M15 4a3 3 0 013 3v1a3 3 0 012 3 3 3 0 01-2 3v1a3 3 0 01-3 3h-3V4z" /><path d="M12 4v16" /></>,
  hand: <><path d="M8 12V6a1.5 1.5 0 013 0v5" /><path d="M11 11V4.5a1.5 1.5 0 013 0V11" /><path d="M14 11V6a1.5 1.5 0 013 0v7" /><path d="M17 13V9.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-2a6 6 0 01-5.2-3L4 13.5a1.5 1.5 0 012.5-1.5L8 14" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
};

// иконка + «зmysł» продукта из каталога FIQ (по id продукта)
const PRODUCT_ICON = { 1: 'robot', 2: 'phone', 3: 'target', 4: 'doc', 5: 'heart', 6: 'chart', 7: 'coins', 8: 'box', 9: 'clock', 10: 'tag', 11: 'pen', 12: 'search', 13: 'star', 14: 'play', 15: 'layers', 16: 'spark', 17: 'users', 18: 'book' };
const SENSE_ICON = { Brain: 'brain', Mind: 'spark', Hand: 'hand', Heart: 'heart', Eyes: 'eye' };
export function productIcon(id, name) { return PRODUCT_ICON[+id] || serviceIcon(name); }
export function senseIcon(sense) { return SENSE_ICON[sense] || 'chip'; }

export function Ic({ name, size = 22 }) {
  return (
    <svg className="au-ic" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] || P.spark}
    </svg>
  );
}

// подбор иконки под название AI-услуги
export function serviceIcon(name) {
  const n = String(name || '').toLowerCase();
  if (/agent|obsług|chat|klient/.test(n)) return 'robot';
  if (/copy|treś|content|tekst/.test(n)) return 'pen';
  if (/magazyn|logist|prognoz|stock/.test(n)) return 'box';
  if (/video|wideo|visual|wizual/.test(n)) return 'play';
  if (/crm|sprzedaż|lead|scoring/.test(n)) return 'target';
  if (/analit|analiz|raport|strateg|market/.test(n)) return 'chart';
  if (/automat/.test(n)) return 'bolt';
  return 'chip';
}

// шкала-пончик 0-100
export function Gauge({ value, label }) {
  const v = Math.max(0, Math.min(100, Math.round(+value || 0)));
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className="au-gauge">
      <svg viewBox="0 0 84 84">
        <circle className="au-gauge-bg" cx="42" cy="42" r={R} />
        <circle className="au-gauge-fg" cx="42" cy="42" r={R}
          strokeDasharray={`${(C * v / 100).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 42 42)" />
      </svg>
      <div className="au-gauge-val">{v}</div>
      <div className="au-gauge-label">{label}</div>
    </div>
  );
}

// декоративный «растущий график» (контакт-секция) — цвета из темы страницы
export function GrowthDeco() {
  return (
    <svg className="au-growth" viewBox="0 0 320 180" fill="none" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map(i => <line key={'h' + i} x1="0" y1={30 * i + 10} x2="320" y2={30 * i + 10} stroke="rgba(var(--fg-rgb),0.06)" />)}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <line key={'v' + i} x1={i * 45 + 5} y1="0" x2={i * 45 + 5} y2="180" stroke="rgba(var(--fg-rgb),0.04)" />)}
      <path d="M5 160 L50 150 L95 155 L140 120 L185 105 L230 70 L275 55 L315 20" stroke="var(--acc)" strokeWidth="2" />
      <path d="M5 160 L50 150 L95 155 L140 120 L185 105 L230 70 L275 55 L315 20 L315 180 L5 180 Z" fill="url(#auGrad)" stroke="none" />
      <defs>
        <linearGradient id="auGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--acc)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[[140, 120], [230, 70], [315, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="var(--bg)" stroke="var(--acc)" strokeWidth="2" />)}
    </svg>
  );
}
