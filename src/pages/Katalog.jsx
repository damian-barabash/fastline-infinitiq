import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sbAuth } from '../lib/supabase.js';
import { syncAudits } from '../lib/catalogSync.js';
import katalogCss from '../styles/katalog.css?inline';

// Edytor katalogu produktów AI (tabela audit_catalog) — jedno źródło prawdy dla
// audytu i dla hero na stronie głównej. Dwie zakładki:
//   • „Katalog audytu"  — nazwa, ceny, opisy; `hidden` = audyt nie proponuje;
//   • „Strona główna"   — kolejność w grupie i `landing_hidden` = tylko wygląd hero.
// Ukrycie w hero NIE ma wpływu na audyt i odwrotnie — to dwie osobne kolumny.
// Zapis nazwy/ceny przepisuje też gotowe audyty (bez ponownej analizy).
const SENSES = ['Brain', 'Mind', 'Hand', 'Heart', 'Eyes'];
const SENSE_HINT = {
  Brain: 'wiedza i decyzje', Mind: 'twórczość i komunikacja', Hand: 'wykonanie',
  Heart: 'relacje z ludźmi', Eyes: 'obserwacja i kontrola',
};
// Hero to kula rozcięta na cztery wycinki — mieszczą się dokładnie grupy A–D.
const HERO_GROUPS = ['a', 'b', 'c', 'd'];
const HERO_QUAD = { a: 'lewy dół', b: 'lewa góra', c: 'prawa góra', d: 'prawy dół' };
const HERO_MAX = 7;             // tyle kart mieści się w kolumnie na najniższych ekranach
const HERO_DESC_MAX = 70;       // dłuższy opis łamie się na 3 linie i karta rośnie

const EMPTY = {
  name: '', group_name: '', group_letter: '', sense: 'Brain', tagline: '',
  problem: '', effect: '', does: [], impl_from: null, sub_from: null, hidden: false,
  landing_hidden: false, landing_desc: '', landing_sort: null,
};
const money = (n) => (n == null || n === '' ? '—' : String(Math.round(+n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' zł');
const heroOrd = (r) => (r.landing_sort ?? r.sort ?? r.id);
const grpOf = (r) => String(r.group_letter || '').toLowerCase();
// polskie liczebniki — „3 kart" wygląda jak błąd, a to widok dla właściciela
const plForm = (n, one, few, many) => {
  const d = n % 10, s = n % 100;
  if (n === 1) return one;
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return few;
  return many;
};

export default function Katalog() {
  const sb = sbAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('audyt');
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  const note = (t) => { setMsg(t); setTimeout(() => setMsg(''), 5000); };

  useEffect(() => {
    document.title = 'Katalog produktów — Fastline InfinitiQ';
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data?.session) { location.replace('/login?auth=required'); return; }
      setReady(true);
    });
    return () => { alive = false; };
  }, [sb]);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('audit_catalog').select('*').order('sort', { ascending: true }).order('id', { ascending: true });
    if (error) { note('Nie udało się wczytać katalogu: ' + error.message); return null; }
    setRows(data || []);
    return data || [];
  }, [sb]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  // Po każdej zmianie danych katalogowych przepisujemy gotowe audyty — inaczej
  // raport wysłany klientowi zostałby ze starą nazwą albo starą ceną. Leci to
  // w tle: `content` audytu waży setki kilobajtów, a redaktor nie ma na co czekać.
  const pushToAudits = useCallback((fresh) => {
    setSyncing(true);
    return syncAudits(sb, fresh).then((r) => {
      setSyncing(false);
      if (r.error) { note('Katalog zapisany, ale audyty nie zostały odświeżone: ' + r.error); return; }
      if (r.updated) note(`Odświeżono ${r.updated} ${plForm(r.updated, 'audyt', 'audyty', 'audytów')} — bez ponownej analizy.`);
    }).catch((e) => { setSyncing(false); note('Audyty nie zostały odświeżone: ' + e.message); });
  }, [sb]);

  const edit = (row) => {
    setOpenId(row.id);
    setDraft({ ...row, does: Array.isArray(row.does) ? row.does.join('\n') : '' });
  };
  const addNew = () => {
    const nextId = Math.max(0, ...(rows || []).map((r) => +r.id || 0)) + 1;
    setOpenId('new');
    setDraft({ ...EMPTY, id: nextId, sort: nextId, landing_sort: nextId, does: '' });
  };
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDraft((d) => ({ ...d, [k]: v }));
  };

  async function save() {
    if (!draft?.name?.trim()) { note('Nazwa produktu jest wymagana.'); return; }
    setBusy(true);
    const payload = {
      id: +draft.id,
      name: draft.name.trim(),
      group_name: (draft.group_name || '').trim(),
      group_letter: (draft.group_letter || '').trim().toUpperCase().slice(0, 1),
      sense: SENSES.includes(draft.sense) ? draft.sense : 'Brain',
      tagline: (draft.tagline || '').trim(),
      problem: (draft.problem || '').trim(),
      effect: (draft.effect || '').trim(),
      does: String(draft.does || '').split('\n').map((s) => s.trim()).filter(Boolean),
      impl_from: draft.impl_from === '' || draft.impl_from == null ? null : Math.round(+draft.impl_from),
      sub_from: draft.sub_from === '' || draft.sub_from == null ? null : Math.round(+draft.sub_from),
      hidden: !!draft.hidden,
      landing_hidden: !!draft.landing_hidden,
      landing_desc: (draft.landing_desc || '').trim(),
      landing_sort: draft.landing_sort == null || draft.landing_sort === '' ? +draft.id : Math.round(+draft.landing_sort),
      sort: draft.sort == null || draft.sort === '' ? +draft.id : Math.round(+draft.sort),
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('audit_catalog').upsert(payload, { onConflict: 'id' });
    if (error) { setBusy(false); note('Błąd zapisu: ' + error.message); return; }
    setOpenId(null); setDraft(null);
    const fresh = await load();
    setBusy(false);
    note('Zapisano.');
    pushToAudits(fresh || []);
  }

  // `hidden` (audyt) i `landing_hidden` (hero) są rozdzielone celowo — to jedyny
  // sposób, żeby zdjąć produkt ze strony, nie zabierając go z ofert dla klientów.
  async function patch(row, fields, refreshAudits) {
    const { error } = await sb.from('audit_catalog').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) { note('Błąd: ' + error.message); return; }
    const fresh = await load();
    if (refreshAudits) pushToAudits(fresh || []);
  }

  async function remove(row) {
    if (!confirm(`Usunąć produkt „${row.name}" z katalogu? Zniknie z audytów i ze strony głównej.`)) return;
    const { error } = await sb.from('audit_catalog').delete().eq('id', row.id);
    if (error) { note('Błąd usuwania: ' + error.message); return; }
    const fresh = await load();
    note('Usunięto.');
    pushToAudits(fresh || []);
  }

  /* ===== hero: kolejność w obrębie grupy ===== */
  const heroByGroup = useMemo(() => {
    const out = { a: [], b: [], c: [], d: [], other: [] };
    for (const r of rows || []) {
      const g = grpOf(r);
      (HERO_GROUPS.includes(g) ? out[g] : out.other).push(r);
    }
    for (const g of HERO_GROUPS) out[g].sort((x, y) => heroOrd(x) - heroOrd(y));
    out.other.sort((x, y) => (x.sort ?? x.id) - (y.sort ?? y.id));
    return out;
  }, [rows]);

  // Numerację przepisujemy dla całej grupy naraz (grupa × 100 + pozycja), więc
  // kolejność jest stabilna i czytelna także wtedy, gdy produkty przenoszą się
  // między grupami. Audytów to nie dotyczy — `landing_sort` jest tylko dla hero.
  async function moveHero(group, index, dir) {
    const list = heroByGroup[group].slice();
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    const base = (HERO_GROUPS.indexOf(group) + 1) * 100;
    const updates = list.map((r, i) => ({ id: r.id, landing_sort: base + i + 1 }));
    setBusy(true);
    for (const u of updates) {
      const { error } = await sb.from('audit_catalog').update({ landing_sort: u.landing_sort }).eq('id', u.id);
      if (error) { setBusy(false); note('Błąd kolejności: ' + error.message); return; }
    }
    await load();
    setBusy(false);
  }

  const visible = (rows || []).filter((r) => !r.hidden);
  const sumImpl = visible.reduce((a, r) => a + (+r.impl_from || 0), 0);
  const sumSub = visible.reduce((a, r) => a + (+r.sub_from || 0), 0);
  const heroCount = (rows || []).filter((r) => !r.landing_hidden && HERO_GROUPS.includes(grpOf(r))).length;
  const groupOptions = useMemo(() => {
    const m = new Map();
    for (const r of rows || []) {
      const l = (r.group_letter || '').toUpperCase();
      if (l && !m.has(l)) m.set(l, r.group_name || '');
    }
    return Array.from(m, ([letter, name]) => ({ letter, name })).sort((x, y) => x.letter.localeCompare(y.letter));
  }, [rows]);

  return (
    <div className="kt-page">
      <style dangerouslySetInnerHTML={{ __html: katalogCss }} />
      <header className="kt-top">
        <a className="kt-back" href="/editor">← Wróć do panelu</a>
        <div className="kt-top-title">Katalog produktów AI</div>
        <nav className="kt-tabs">
          <button className={'kt-tab' + (tab === 'audyt' ? ' on' : '')} onClick={() => setTab('audyt')}>Katalog audytu</button>
          <button className={'kt-tab' + (tab === 'hero' ? ' on' : '')} onClick={() => setTab('hero')}>Strona główna</button>
        </nav>
        {syncing && <div className="kt-sync">Odświeżam audyty…</div>}
        {msg && <div className="kt-msg">{msg}</div>}
      </header>

      {!ready || rows === null ? (
        <div className="kt-empty">Ładowanie katalogu…</div>
      ) : tab === 'audyt' ? (
        <main className="kt-main">
          <div className="kt-head">
            <div>
              <h1>Produkty, z których liczy się audyt</h1>
              <p>
                Audyt dobiera produkty i sumuje pakiety <b>z tej listy</b>. Zmiana ceny, opisu albo ukrycie produktu
                działa od następnej analizy — bez wgrywania czegokolwiek. Ukryte produkty zostają w bazie, ale audyt
                ich nie proponuje. Nazwy, opisy „co robi" i ceny <b>przepisują się też do gotowych audytów</b>,
                bez ponownej analizy.
              </p>
            </div>
            <div className="kt-stats">
              <div><b>{visible.length}</b> aktywnych{rows.length - visible.length > 0 && <em> · {rows.length - visible.length} ukrytych</em>}</div>
              <div>suma wdrożeń <b>{money(sumImpl)}</b></div>
              <div>suma abonamentów <b>{money(sumSub)}</b>/mies.</div>
            </div>
            <button className="kt-btn primary" onClick={addNew}>＋ Nowy produkt</button>
          </div>

          <div className="kt-list">
            {rows.map((r) => (
              <div className={'kt-row' + (r.hidden ? ' hidden' : '') + (openId === r.id ? ' open' : '')} key={r.id}>
                <div className="kt-row-main" onClick={() => (openId === r.id ? (setOpenId(null), setDraft(null)) : edit(r))}>
                  <span className="kt-no">#{String(r.id).padStart(2, '0')}</span>
                  <span className="kt-name">{r.name}</span>
                  <span className="kt-sense">{r.sense}</span>
                  <span className="kt-group">{r.group_name}</span>
                  <span className="kt-price">{money(r.impl_from)} <em>/ {money(r.sub_from)} mies.</em></span>
                  {r.hidden && <span className="kt-badge">ukryty</span>}
                  {r.landing_hidden && !r.hidden && <span className="kt-badge alt">poza hero</span>}
                </div>
                <div className="kt-row-act">
                  <button className="kt-btn sm" onClick={() => patch(r, { hidden: !r.hidden }, false)}>{r.hidden ? 'Pokaż' : 'Ukryj'}</button>
                  <button className="kt-btn sm" onClick={() => (openId === r.id ? (setOpenId(null), setDraft(null)) : edit(r))}>
                    {openId === r.id ? 'Zamknij' : 'Edytuj'}
                  </button>
                  <button className="kt-btn sm del" onClick={() => remove(r)}>✕</button>
                </div>

                {openId === r.id && draft && (
                  <Form draft={draft} set={set} save={save} busy={busy} groups={groupOptions}
                    onCancel={() => { setOpenId(null); setDraft(null); }} />
                )}
              </div>
            ))}

            {openId === 'new' && draft && (
              <div className="kt-row open new">
                <div className="kt-row-main"><span className="kt-no">nowy</span><span className="kt-name">{draft.name || 'Nowy produkt'}</span></div>
                <Form draft={draft} set={set} save={save} busy={busy} groups={groupOptions}
                  onCancel={() => { setOpenId(null); setDraft(null); }} />
              </div>
            )}
          </div>
        </main>
      ) : (
        <main className="kt-main">
          <div className="kt-head">
            <div>
              <h1>Hero na stronie głównej</h1>
              <p>
                Kula w sekcji 01 jest rozcięta na cztery wycinki — to grupy <b>A–D</b>. Tu ustawiasz, co i w jakiej
                kolejności widzi klient. <b>Ukrycie w hero jest wyłącznie wizualne</b>: produkt zostaje w katalogu
                i audyt nadal może go zaproponować. Nazwę, opis „co robi" i ceny zmieniasz w zakładce
                <b> Katalog audytu</b> — hero bierze je z tego samego miejsca.
              </p>
            </div>
            <div className="kt-stats">
              <div><b>{heroCount}</b> {plForm(heroCount, 'karta', 'karty', 'kart')} w hero</div>
              <div>grupy <b>{HERO_GROUPS.filter((g) => heroByGroup[g].some((r) => !r.landing_hidden)).length}</b>/4</div>
              <div><a className="kt-back" href="/" target="_blank" rel="noreferrer">Zobacz stronę ↗</a></div>
            </div>
          </div>

          {HERO_GROUPS.map((g) => {
            const list = heroByGroup[g];
            const shown = list.filter((r) => !r.landing_hidden);
            return (
              <section className="kt-hgroup" key={g}>
                <header className="kt-hgroup-head">
                  <span className="kt-no">{g.toUpperCase()}</span>
                  <h2>{list[0]?.group_name || '—'}</h2>
                  <span className="kt-hquad">{HERO_QUAD[g]} kuli</span>
                  <span className={'kt-hcount' + (shown.length > HERO_MAX ? ' warn' : '')}>
                    {shown.length} {plForm(shown.length, 'karta', 'karty', 'kart')}
                    {shown.length > HERO_MAX && ` · powyżej ${HERO_MAX} karty robią się bardzo małe`}
                  </span>
                </header>

                {!list.length && <div className="kt-hempty">Brak produktów w tej grupie — wycinek kuli będzie pusty.</div>}

                {list.map((r, i) => (
                  <div className={'kt-hrow' + (r.landing_hidden ? ' off' : '')} key={r.id}>
                    <span className="kt-hord">{r.landing_hidden ? '—' : String(shown.indexOf(r) + 1).padStart(2, '0')}</span>
                    <div className="kt-hmove">
                      <button className="kt-btn sm" disabled={busy || i === 0} title="W górę" onClick={() => moveHero(g, i, -1)}>↑</button>
                      <button className="kt-btn sm" disabled={busy || i === list.length - 1} title="W dół" onClick={() => moveHero(g, i, 1)}>↓</button>
                    </div>
                    <div className="kt-hmain">
                      <b className="kt-name">{r.name}</b>
                      <HeroDesc row={r} onSave={(v) => patch(r, { landing_desc: v }, false)} />
                    </div>
                    <label className="kt-hgrp">
                      <span>Grupa</span>
                      <select value={(r.group_letter || '').toUpperCase()}
                        onChange={(e) => {
                          const letter = e.target.value;
                          const gr = groupOptions.find((o) => o.letter === letter);
                          patch(r, { group_letter: letter, group_name: gr ? gr.name : r.group_name }, true);
                        }}>
                        {groupOptions.map((o) => <option key={o.letter} value={o.letter}>{o.letter} — {o.name}</option>)}
                      </select>
                    </label>
                    <button className={'kt-btn sm' + (r.landing_hidden ? ' primary' : '')}
                      onClick={() => patch(r, { landing_hidden: !r.landing_hidden }, false)}>
                      {r.landing_hidden ? 'Pokaż w hero' : 'Ukryj w hero'}
                    </button>
                    {r.hidden && <span className="kt-badge">ukryty w audycie</span>}
                  </div>
                ))}
              </section>
            );
          })}

          {!!heroByGroup.other.length && (
            <section className="kt-hgroup">
              <header className="kt-hgroup-head">
                <span className="kt-no">—</span>
                <h2>Poza hero</h2>
                <span className="kt-hquad">grupa spoza A–D</span>
              </header>
              <div className="kt-hempty">
                Kula ma cztery wycinki, więc pokazujemy tylko grupy A–D. Te produkty działają w audycie normalnie;
                żeby trafiły na stronę, przypisz im jedną z grup A–D.
              </div>
              {heroByGroup.other.map((r) => (
                <div className="kt-hrow off" key={r.id}>
                  <span className="kt-hord">—</span>
                  <div className="kt-hmove" />
                  <div className="kt-hmain"><b className="kt-name">{r.name}</b><i className="kt-hdesc">grupa {r.group_letter || '?'} · {r.group_name || 'bez nazwy'}</i></div>
                  <label className="kt-hgrp">
                    <span>Grupa</span>
                    <select value={(r.group_letter || '').toUpperCase()}
                      onChange={(e) => {
                        const letter = e.target.value;
                        const gr = groupOptions.find((o) => o.letter === letter);
                        patch(r, { group_letter: letter, group_name: gr ? gr.name : r.group_name }, true);
                      }}>
                      <option value={(r.group_letter || '').toUpperCase()}>{(r.group_letter || '?').toUpperCase()} — {r.group_name || 'bez nazwy'}</option>
                      {groupOptions.filter((o) => o.letter !== (r.group_letter || '').toUpperCase())
                        .map((o) => <option key={o.letter} value={o.letter}>{o.letter} — {o.name}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </section>
          )}
        </main>
      )}
    </div>
  );
}

/* Opis w karcie hero. Osobne pole, nie tagline z katalogu: w kuli mieści się jedna
   krótka linia, a tagline jest pełnym zdaniem sprzedażowym (do ~110 znaków).
   Puste = strona pokazuje tagline. */
function HeroDesc({ row, onSave }) {
  const [v, setV] = useState(row.landing_desc || '');
  const [edit, setEdit] = useState(false);
  useEffect(() => { setV(row.landing_desc || ''); }, [row.landing_desc]);
  const over = v.length > HERO_DESC_MAX;

  if (!edit) {
    return (
      <i className="kt-hdesc" onClick={() => setEdit(true)} title="Kliknij, aby zmienić opis w hero">
        {row.landing_desc || <em>{row.tagline || 'brak opisu'} — z katalogu</em>}
      </i>
    );
  }
  return (
    <span className="kt-hedit">
      <input value={v} autoFocus maxLength={140}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(row.landing_desc || ''); setEdit(false); } }}
        onBlur={() => { setEdit(false); if (v.trim() !== (row.landing_desc || '')) onSave(v.trim()); }} />
      <em className={over ? 'warn' : ''}>{v.length}/{HERO_DESC_MAX}</em>
    </span>
  );
}

function Form({ draft, set, save, busy, onCancel, groups }) {
  return (
    <div className="kt-form">
      <div className="kt-grid">
        <label className="kt-f"><span>Numer w katalogu</span><input type="number" value={draft.id ?? ''} onChange={set('id')} /></label>
        <label className="kt-f wide"><span>Nazwa produktu</span><input value={draft.name || ''} onChange={set('name')} placeholder="np. AI Łowca Leadów" /></label>
        <label className="kt-f"><span>Kolejność</span><input type="number" value={draft.sort ?? ''} onChange={set('sort')} /></label>
      </div>
      <div className="kt-grid">
        <label className="kt-f">
          <span>Grupa (litera)</span>
          <input value={draft.group_letter || ''} onChange={set('group_letter')} maxLength={1} placeholder="A" list="kt-groups" />
          <datalist id="kt-groups">{(groups || []).map((g) => <option key={g.letter} value={g.letter}>{g.name}</option>)}</datalist>
        </label>
        <label className="kt-f wide"><span>Grupa (nazwa)</span><input value={draft.group_name || ''} onChange={set('group_name')} placeholder="np. Sprzedaż" /></label>
        <label className="kt-f">
          <span>Zmysł</span>
          <select value={draft.sense || 'Brain'} onChange={set('sense')}>
            {SENSES.map((s) => <option key={s} value={s}>{s} — {SENSE_HINT[s]}</option>)}
          </select>
        </label>
      </div>
      <label className="kt-f"><span>Jednym zdaniem (tagline)</span><input value={draft.tagline || ''} onChange={set('tagline')} /></label>
      <label className="kt-f">
        <span>Opis w hero na stronie głównej (puste = tagline)</span>
        <input value={draft.landing_desc || ''} onChange={set('landing_desc')} maxLength={140}
          placeholder="Krótka linia, do ok. 70 znaków" />
      </label>
      <label className="kt-f"><span>Co robi — jeden punkt w linii</span>
        <textarea rows={5} value={draft.does || ''} onChange={set('does')} placeholder={'Odbiera telefon o każdej porze\nUmawia wizyty w kalendarzu\nWysyła SMS-przypomnienia'} />
      </label>
      <label className="kt-f"><span>Problem, który znika</span><textarea rows={3} value={draft.problem || ''} onChange={set('problem')} /></label>
      <label className="kt-f"><span>Efekt u klienta</span><textarea rows={3} value={draft.effect || ''} onChange={set('effect')} /></label>
      <div className="kt-grid">
        <label className="kt-f"><span>Wdrożenie od (zł netto)</span><input type="number" value={draft.impl_from ?? ''} onChange={set('impl_from')} /></label>
        <label className="kt-f"><span>Abonament od (zł netto / mies.)</span><input type="number" value={draft.sub_from ?? ''} onChange={set('sub_from')} /></label>
      </div>
      <div className="kt-grid">
        <label className="kt-f check"><input type="checkbox" checked={!!draft.hidden} onChange={set('hidden')} /><span>Ukryty w audycie — analiza go nie proponuje</span></label>
        <label className="kt-f check"><input type="checkbox" checked={!!draft.landing_hidden} onChange={set('landing_hidden')} /><span>Ukryty w hero — nie widać go na stronie, audyt bez zmian</span></label>
      </div>
      <div className="kt-form-act">
        <button className="kt-btn primary" onClick={save} disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz produkt'}</button>
        <button className="kt-btn" onClick={onCancel}>Anuluj</button>
        <span className="kt-form-hint">Ceny wchodzą do sum pakietów Start / Wzrost / Skala — także w audytach już wygenerowanych.</span>
      </div>
    </div>
  );
}
