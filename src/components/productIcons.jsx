// Ikony produktów w hero (sekcja 00). Ścieżki i dobór po nazwie siedzą w
// `engine/productIcons.js` — ten sam zestaw używany jest przy renderze kart
// z katalogu, więc snapshot w markupie i wersja z bazy wyglądają identycznie.
import React from 'react';
import { ICON_PATHS, iconKey } from '../engine/productIcons.js';

export default function ProductIcon({ id, name }) {
  const paths = ICON_PATHS[iconKey(name, id)];
  if (!paths) return null;
  return (
    <svg className="pl-ic" viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((p, i) => <path key={i} {...p} />)}
    </svg>
  );
}
