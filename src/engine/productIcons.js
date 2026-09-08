/* Ikony produktów hero — jedno źródło dla Reacta (statyczny snapshot w LandingShell)
   i dla renderu w locie (karty budowane z katalogu `landing_products`).
   Ścieżki trzymamy jako dane, bo ten sam zestaw musi dać się skleić w string HTML.

   Dobór ikony idzie PO NAZWIE, nie po numerze: numery w katalogu zmieniają się przy
   każdej rewizji oferty (v1 → v4 przenumerowały prawie wszystko), a nazwa zostaje.
   Numer jest tylko awaryjnym kluczem dla snapshotu w markupie. */

// [{d, ...atrybuty}] — atrybuty inne niż `d` trafiają zarówno do JSX, jak i do stringa.
export const ICON_PATHS = {
  // 0 — awaryjna: nowy produkt o nazwie, której nie zna żadna reguła, i tak
  // dostaje znak, bo karta bez ikony wyłamuje się z rytmu pozostałych.
  0: [{ d: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z' }, { d: 'M12 8.4a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2z' }],
  1: [{ d: 'M4 20l1.5-5L17 3.5a2.1 2.1 0 013 3L8.5 18z' }, { d: 'M13.5 7l3 3' }],
  2: [{ d: 'M11 4a7 7 0 100 14 7 7 0 000-14z' }, { d: 'M4 11h14M11 4c2.6 3 2.6 11 0 14M11 4c-2.6 3-2.6 11 0 14' }, { d: 'M21 21l-4.3-4.3' }],
  3: [{ d: 'M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z' }, { d: 'M12 8.5l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z' }],
  4: [{ d: 'M12 4a8 8 0 100 16 8 8 0 000-16z' }, { d: 'M12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z' }, { d: 'M12 1.5v3.5M12 19v3.5M1.5 12h3.5M19 12h3.5' }],
  5: [{ d: 'M7 5.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z' }, { d: 'M17 5.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z' }, { d: 'M12 14.9a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z' }, { d: 'M8.9 9.8l2.1 5.2M15.1 9.8L13 15M9.6 8h4.8' }],
  6: [{ d: 'M6 3h8l4 4v14H6z' }, { d: 'M14 3v4h4' }, { d: 'M9.5 12h5M9.5 15.5h3.5' }],
  7: [{ d: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z' }, { d: 'M6.5 11.5h2.8l1.4-2.4 1.8 4.4 1.4-2h3.2' }],
  8: [{ d: 'M4 5h16v11H9l-5 4z' }, { d: 'M13 7.5l-3 4h2.6l-1.2 3.2 3.4-4.2h-2.5z' }],
  9: [{ d: 'M12 3a9 9 0 100 18 9 9 0 000-18z' }, { d: 'M15.5 8.5l-2 5-5 2 2-5z' }],
  10: [{ d: 'M3.5 4H7l1.8 4.3-2.2 1.4a11 11 0 004.9 4.9l1.4-2.2 4.3 1.8V18a2 2 0 01-2 2A15.6 15.6 0 013.5 6a2 2 0 012-2z' }, { d: 'M18 2.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z' }, { d: 'M18 4.4V6l1.2.8' }],
  11: [{ d: 'M3 20h18' }, { d: 'M6 20v-6M10.5 20V9M15 20v-8M19.5 20V5' }],
  12: [{ d: 'M3 8l9-5 9 5v8l-9 5-9-5z' }, { d: 'M3 8l9 5 9-5M12 13v8' }],
  13: [{ d: 'M12 3a9 9 0 100 18 9 9 0 000-18z' }, { d: 'M12 7a5 5 0 100 10 5 5 0 000-10z' }, { d: 'M12 12l6.2-3.4' }, { d: 'M17.4 6.2a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z', fill: 'currentColor', stroke: 'none' }],
  14: [{ d: 'M5 4h11v16H5z' }, { d: 'M8 8.5h5M8 12h5M8 15.5h3' }, { d: 'M18 13a3.5 3.5 0 100 7 3.5 3.5 0 000-7z' }, { d: 'M18 15v1.6l1.1.7' }],
  15: [{ d: 'M5 4.5A1.5 1.5 0 016.5 3H18v15H6.5A1.5 1.5 0 005 19.5z' }, { d: 'M5 19.5A1.5 1.5 0 016.5 18H18v3H6.5A1.5 1.5 0 015 19.5z' }, { d: 'M11.5 7.5v4M9.5 9.5h4' }],
  16: [{ d: 'M10 4.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z' }, { d: 'M4 19.5c.7-3.2 3-5 6-5 1.1 0 2.1.2 3 .7' }, { d: 'M17.5 14a3.5 3.5 0 100 7 3.5 3.5 0 000-7z' }, { d: 'M16 17.6l1.1 1.1 2-2.2' }],
  17: [{ d: 'M12 4l9 4.2-9 4.2-9-4.2z' }, { d: 'M7 10.4V16c0 1.7 2.4 3 5 3s5-1.3 5-3v-5.6' }, { d: 'M20.4 8.6V14' }],
  // kampanie reklamowe — megafon (klucz nazwany, bo produkt bywa przenumerowany)
  ads: [{ d: 'M4 10v4h3l7 4V6l-7 4z' }, { d: 'M7 14v4.5h2.5V14' }, { d: 'M17.5 9.5a3.5 3.5 0 010 5' }],
};

// nazwa produktu → klucz ikony. Kolejność ma znaczenie: „AI CRM" i „Customer Hub"
// to ten sam produkt po zmianie nazwy, a „AI Recepcja" nie może złapać się na „AI".
const BY_NAME = [
  [/kampani|reklam/i, 'ads'],
  [/fabryk|kontent|content/i, 1],
  [/seo|geo/i, 2],
  [/reputa/i, 3],
  [/łowca|lowca|lead/i, 4],
  [/crm|customer/i, 5],
  [/ofert|offer/i, 6],
  [/lojaln|loyal/i, 7],
  [/sprzedawc/i, 8],
  [/doradc/i, 9],
  [/recepcj|reception/i, 10],
  [/data ?hub|command/i, 11],
  [/magazyn|warehouse/i, 12],
  [/radar|market/i, 13],
  [/project manager|workpilot/i, 14],
  [/asystent|assistant/i, 15],
  [/rekrut|recruit/i, 16],
  [/academy|akademi/i, 17],
];

export function iconKey(name, id) {
  const n = String(name || '');
  for (const [re, key] of BY_NAME) if (re.test(n)) return key;
  return ICON_PATHS[id] ? id : 0;
}

const SVG_OPEN = '<svg class="pl-ic" viewBox="0 0 24 24" width="22" height="22" fill="none"'
  + ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

/** Ikona jako string HTML — dla kart budowanych poza Reactem. */
export function iconSvgHtml(name, id) {
  const paths = ICON_PATHS[iconKey(name, id)];
  if (!paths) return '';   // (iconKey zawsze zwraca istniejący klucz, 0 włącznie)
  return SVG_OPEN + paths.map((p) => {
    const extra = Object.keys(p).filter((k) => k !== 'd')
      .map((k) => ` ${k === 'strokeWidth' ? 'stroke-width' : k}="${p[k]}"`).join('');
    return `<path d="${p.d}"${extra} />`;
  }).join('') + '</svg>';
}
