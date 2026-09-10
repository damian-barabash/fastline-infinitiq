import React from 'react';

// Własny zestaw ikon strony agentów (żadnych emoji — reguła projektu).
// Wszystkie 24×24, stroke = currentColor, więc kolor bierze się z CSS.

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IcMessenger = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <path {...S} d="M12 3.2c-4.8 0-8.5 3.5-8.5 8 0 2.5 1.2 4.7 3.1 6.1v3.5l3-1.6c.8.2 1.6.3 2.4.3 4.8 0 8.5-3.5 8.5-8s-3.7-8.3-8.5-8.3Z" />
    <path {...S} d="m7.4 13.6 3.1-3.3 2 2.1 3.1-3.3-3.1 3.3-2-2.1-3.1 3.3Z" />
  </svg>
);

export const IcInstagram = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <rect {...S} x="3.6" y="3.6" width="16.8" height="16.8" rx="4.6" />
    <circle {...S} cx="12" cy="12" r="4" />
    <circle cx="16.9" cy="7.1" r="1.1" fill="currentColor" />
  </svg>
);

export const IcWhatsapp = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <path {...S} d="M3.8 20.2 5 16.5A8 8 0 1 1 8 19.3l-4.2.9Z" />
    <path {...S} d="M9 9.3c.2 1 .7 2 1.5 2.8.8.8 1.8 1.4 2.8 1.6l.9-1.1 1.9.9-.3 1.4c-1.9.5-4-.4-5.6-2-1.6-1.6-2.3-3.5-1.9-5.3l1.4-.3.9 1.9L9 9.3Z" />
  </svg>
);

export const IcPhone = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <path {...S} d="M6.2 3.8h3l1.4 3.6-1.9 1.5a11 11 0 0 0 5.4 5.4l1.5-1.9 3.6 1.4v3c0 .9-.7 1.6-1.6 1.5C10.4 17.9 6.1 13.6 4.7 5.4c-.1-.9.6-1.6 1.5-1.6Z" />
  </svg>
);

export const IcCalendar = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <rect {...S} x="3.6" y="5.2" width="16.8" height="15.2" rx="2.4" />
    <path {...S} d="M3.6 9.8h16.8M8.2 3.6v3.2M15.8 3.6v3.2" />
    <path {...S} d="m9.4 14.6 1.8 1.8 3.4-3.6" />
  </svg>
);

export const IcDoc = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <path {...S} d="M6.2 3.6h7.4l4.2 4.2v12.6H6.2z" />
    <path {...S} d="M13.4 3.6v4.4h4.4M9 12.6h6M9 16h4.4" />
  </svg>
);

export const IcGlobe = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <circle {...S} cx="12" cy="12" r="8.4" />
    <path {...S} d="M3.6 12h16.8M12 3.6c2.2 2.3 3.4 5.3 3.4 8.4s-1.2 6.1-3.4 8.4c-2.2-2.3-3.4-5.3-3.4-8.4S9.8 5.9 12 3.6Z" />
  </svg>
);

export const IcSpark = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <path {...S} d="M12 3.4 13.8 9l5.6 1.8-5.6 1.8L12 18.2 10.2 12.6 4.6 10.8 10.2 9 12 3.4Z" />
  </svg>
);

export const IcCheck = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...p}>
    <path {...S} d="m4.6 12.4 4.6 4.6 10.2-11" />
  </svg>
);

export const IcArrow = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...p}>
    <path {...S} d="M4.4 12h15.2m-5.6-5.6L19.6 12l-5.6 5.6" />
  </svg>
);

export const IcUsers = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <circle {...S} cx="9.4" cy="8.4" r="3.4" />
    <path {...S} d="M3.6 20.4c0-3.2 2.6-5.8 5.8-5.8s5.8 2.6 5.8 5.8" />
    <path {...S} d="M16 5.4a3.4 3.4 0 0 1 0 6.6M17.4 14.9c1.8.8 3 2.6 3 4.6" />
  </svg>
);

export const IcClock = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>
    <circle {...S} cx="12" cy="12" r="8.4" />
    <path {...S} d="M12 7v5.4l3.4 2" />
  </svg>
);

/* Strzałka „z kropek" — ten sam język graficzny co łuki wokół kuli w hero. */
export const IcDotArrow = (p) => (
  <svg viewBox="0 0 44 16" width="44" height="16" aria-hidden="true" {...p}>
    {[0, 7, 14, 21].map((x, i) => (
      <rect key={x} x={x} y="6.5" width="3.4" height="3.4" fill="currentColor" opacity={0.45 + i * 0.16} />
    ))}
    <rect x="29" y="6.5" width="3.4" height="3.4" fill="currentColor" />
    <rect x="33.2" y="2.6" width="3.4" height="3.4" fill="currentColor" opacity="0.9" />
    <rect x="33.2" y="10.4" width="3.4" height="3.4" fill="currentColor" opacity="0.9" />
    <rect x="37.4" y="6.5" width="3.4" height="3.4" fill="currentColor" opacity="0.75" />
  </svg>
);
