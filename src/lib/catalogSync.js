/* Katalog → gotowe audyty.
   Audyt zapisuje wybrane produkty w `audits.content` (nazwa, ceny, „co robi"),
   więc zmiana w katalogu sama z siebie nie dotarłaby do raportów już wygenerowanych.
   Ta synchronizacja przepisuje w nich WYŁĄCZNIE dane katalogowe (nazwa, tagline,
   grupa, zmysł, „co robi", ceny) i przelicza sumy pakietów — teksty od modelu
   (`why`, `effect`, `scope`, `example`, `kpi`, `tier`) zostają nietknięte.
   Dzięki temu poprawka nazwy nie wymaga ponownej analizy.

   `landing_hidden` jest tu celowo ignorowane: ukrycie produktu w hero to warstwa
   wizualna strony, audyt nadal ma prawo go proponować. */

// własny separator tysięcy — toLocaleString wstawia NBSP i psuje porównania w testach
export const fmtPln = (n) => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const implLabel = (n) => `od ${fmtPln(n)} zł`;
const subLabel = (n) => `od ${fmtPln(n)} zł / mies.`;
const yearLabel = (n) => `≈ ${fmtPln(n)} zł w 1. roku`;

/** Pola produktu w audycie, które pochodzą z katalogu. */
function fromCatalog(c) {
  return {
    id: c.id,
    name: c.name,
    tagline: c.tagline || '',
    group: c.group_name || '',
    sense: c.sense || '',
    does: Array.isArray(c.does) ? c.does : [],
    impl: c.impl_from == null ? null : +c.impl_from,
    sub: c.sub_from == null ? null : +c.sub_from,
    impl_label: c.impl_from == null ? '' : implLabel(c.impl_from),
    sub_label: c.sub_from == null ? '' : subLabel(c.sub_from),
  };
}

/**
 * Przepisuje jeden `content` audytu pod aktualny katalog.
 * @returns {{content: object, changed: boolean}}
 */
export function applyCatalogToContent(content, byId) {
  if (!content || typeof content !== 'object') return { content, changed: false };
  const before = JSON.stringify(content);
  const next = JSON.parse(before);

  if (Array.isArray(next.products)) {
    next.products = next.products
      .filter((p) => p && byId.has(+p.id))                 // produkt usunięty z katalogu wypada
      .map((p) => ({ ...p, ...fromCatalog(byId.get(+p.id)) }));
  }

  if (Array.isArray(next.packages)) {
    const alive = new Set((next.products || []).map((p) => +p.id));
    next.packages = next.packages.map((pk) => {
      if (!pk || !Array.isArray(pk.product_ids)) return pk;
      const ids = pk.product_ids.filter((id) => alive.has(+id));
      let impl = 0, sub = 0;
      for (const id of ids) {
        const c = byId.get(+id);
        impl += +(c?.impl_from || 0);
        sub += +(c?.sub_from || 0);
      }
      const year = impl + 12 * sub;
      return {
        ...pk,
        product_ids: ids,
        impl_from: impl, sub_from: sub, year_from: year,
        impl_label: implLabel(impl), sub_label: subLabel(sub), year_label: yearLabel(year),
      };
    });
  }

  const after = JSON.stringify(next);
  return { content: next, changed: after !== before };
}

/**
 * Przelicza wszystkie audyty pod aktualny katalog.
 * @param sb klient supabase-js zalogowanego redaktora (RLS: authenticated ma pełny dostęp)
 * @param catalog wiersze `audit_catalog`
 * @returns {Promise<{scanned:number, updated:number, error?:string}>}
 */
export async function syncAudits(sb, catalog) {
  const byId = new Map((catalog || []).map((c) => [+c.id, c]));
  const { data, error } = await sb.from('audits').select('id, content').not('content', 'is', null);
  if (error) return { scanned: 0, updated: 0, error: error.message };

  // `content` audytu to spory jsonb (~200 kB), a audytów bywa kilkanaście —
  // seryjne zapisy potrafiły trwać ponad pół minuty. Piszemy czwórkami.
  const todo = [];
  for (const a of data || []) {
    const r = applyCatalogToContent(a.content, byId);
    if (r.changed) todo.push({ id: a.id, content: r.content });
  }
  let updated = 0, failed = '';
  for (let i = 0; i < todo.length; i += 4) {
    const res = await Promise.all(todo.slice(i, i + 4).map((x) =>
      sb.from('audits').update({ content: x.content }).eq('id', x.id)));
    for (const { error: e2 } of res) { if (e2) failed = e2.message; else updated++; }
  }
  return { scanned: (data || []).length, updated, error: failed || undefined };
}
