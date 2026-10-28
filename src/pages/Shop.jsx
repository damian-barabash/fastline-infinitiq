import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShopShell from '../components/ShopShell.jsx';
import { productHref } from '../engine/heroProducts.js';
import { initKontakt } from '../engine/kontaktEngine.js';
import { wipeTo } from '../engine/wipe.js';
import { SB_URL, SB_KEY } from '../lib/supabase-config.js';
import kontaktCss from '../styles/kontakt.css?inline';
import shopCss from '../styles/shop.css?inline';
import siteCss from '../styles/site.css?inline';

/* /shop — witryna produktów. Dane z RPC `shop_products()` (security definer):
   aktywne produkty `audit_catalog` (hidden = false) z cenami „od". Sama tabela
   dla anona nadal nie oddaje cen — funkcja zwraca tylko pola witryny.
   SSG renderuje szkielet (stan 'loading'), lista dochodzi po hydracji. */

function toGroups(rows) {
  const seen = new Set();
  const map = new Map();
  // ten sam produkt bywa w katalogu dwa razy (np. „AI Sprzedawca") — zostaje wiersz z ceną
  const sorted = [...rows].sort((a, b) => (b.sub_from != null) - (a.sub_from != null));
  const keep = new Set();
  for (const r of sorted) {
    const k = r.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    keep.add(r.id);
  }
  for (const r of rows) {
    if (!keep.has(r.id)) continue;
    const g = (r.grp || '?').toLowerCase();
    // nazwa grupy = nazwa z pierwszego produktu grupy (tak samo jak podpisy na kuli)
    if (!map.has(g)) map.set(g, { key: g, name: r.group_name || g.toUpperCase(), items: [] });
    map.get(g).items.push({ ...r, name: r.name.replace(/\s+/g, ' ').trim() });
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/* Produkt w sprzedaży (dziś tylko AI Doradca) wychodzi z grupy na samą górę
   witryny, jako osobny, świecący blok. Reszta zostaje w grupach, na szaro. */
function splitLive(groups) {
  let live = null;
  const rest = groups.map((g) => {
    const items = g.items.filter((p) => {
      if (!live && productHref(p.name)) { live = { ...p, groupKey: g.key, groupName: g.name }; return false; }
      return true;
    });
    return { ...g, items };
  }).filter((g) => g.items.length);
  return { live, rest };
}

export default function Shop() {
  const navigate = useNavigate();
  const [data, setData] = useState({ live: null, rest: [] });
  const [state, setState] = useState('loading');

  useEffect(() => {
    document.title = 'Sklep — produkty AI | Fastline InfinitiQ';
    const destroy = initKontakt({ onNavigate: (to) => wipeTo(navigate, to) });
    let alive = true;
    fetch(`${SB_URL}/rest/v1/rpc/shop_products`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows) => {
        if (!alive) return;
        setData(splitLive(toGroups(Array.isArray(rows) ? rows : [])));
        setState('ready');
      })
      .catch(() => alive && setState('error'))
      // menu pod burgerem buduje spis z `data-msec` — dopiero gdy grupy są w DOM
      .finally(() => alive && requestAnimationFrame(() => window.dispatchEvent(new Event('fiq:content-ready'))));
    return () => { alive = false; destroy(); };
  }, [navigate]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: kontaktCss + shopCss + siteCss }} />
      <ShopShell groups={data.rest} live={data.live} state={state} />
    </>
  );
}
