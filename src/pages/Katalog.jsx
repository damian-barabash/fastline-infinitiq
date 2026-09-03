import React, { useCallback, useEffect, useState } from 'react';
import { sbAuth } from '../lib/supabase.js';
import katalogCss from '../styles/katalog.css?inline';

// Edytor katalogu produktów AI (tabela audit_catalog). Z tego katalogu audyt dobiera
// produkty i liczy pakiety — zmiana ceny albo ukrycie produktu działa od następnej
// analizy, bez deployu. Wejście: przycisk „Katalog produktów" w zakładce Audyt.
const SENSES = ['Brain', 'Mind', 'Hand', 'Heart', 'Eyes'];
const SENSE_HINT = {
  Brain: 'wiedza i decyzje', Mind: 'twórczość i komunikacja', Hand: 'wykonanie',
  Heart: 'relacje z ludźmi', Eyes: 'obserwacja i kontrola',
};
const EMPTY = {
  name: '', group_name: '', group_letter: '', sense: 'Brain', tagline: '',
  problem: '', effect: '', does: [], impl_from: null, sub_from: null, hidden: false,
};
const money = (n) => (n == null || n === '' ? '—' : String(Math.round(+n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' zł');

export default function Katalog() {
  const sb = sbAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const note = (t) => { setMsg(t); setTimeout(() => setMsg(''), 4000); };

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
    if (error) { note('Nie udało się wczytać katalogu: ' + error.message); return; }
    setRows(data || []);
  }, [sb]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const edit = (row) => {
    setOpenId(row.id);
    setDraft({ ...row, does: Array.isArray(row.does) ? row.does.join('\n') : '' });
  };
  const addNew = () => {
    const nextId = Math.max(0, ...(rows || []).map((r) => +r.id || 0)) + 1;
    setOpenId('new');
    setDraft({ ...EMPTY, id: nextId, sort: nextId, does: '' });
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
      sort: draft.sort == null || draft.sort === '' ? +draft.id : Math.round(+draft.sort),
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('audit_catalog').upsert(payload, { onConflict: 'id' });
    setBusy(false);
    if (error) { note('Błąd zapisu: ' + error.message); return; }
    note('Zapisano — audyty od teraz liczą się z tym katalogiem.');
    setOpenId(null); setDraft(null);
    load();
  }

  async function toggleHidden(row) {
    const { error } = await sb.from('audit_catalog').update({ hidden: !row.hidden, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) { note('Błąd: ' + error.message); return; }
    load();
  }

  async function remove(row) {
    if (!confirm(`Usunąć produkt „${row.name}" z katalogu? Audyty przestaną go proponować.`)) return;
    const { error } = await sb.from('audit_catalog').delete().eq('id', row.id);
    if (error) { note('Błąd usuwania: ' + error.message); return; }
    note('Usunięto.');
    load();
  }

  const visible = (rows || []).filter((r) => !r.hidden);
  const sumImpl = visible.reduce((a, r) => a + (+r.impl_from || 0), 0);
  const sumSub = visible.reduce((a, r) => a + (+r.sub_from || 0), 0);

  return (
    <div className="kt-page">
      <style dangerouslySetInnerHTML={{ __html: katalogCss }} />
      <header className="kt-top">
        <a className="kt-back" href="/editor">← Wróć do panelu</a>
        <div className="kt-top-title">Katalog produktów AI</div>
        {msg && <div className="kt-msg">{msg}</div>}
      </header>

      {!ready || rows === null ? (
        <div className="kt-empty">Ładowanie katalogu…</div>
      ) : (
        <main className="kt-main">
          <div className="kt-head">
            <div>
              <h1>Produkty, z których liczy się audyt</h1>
              <p>
                Audyt dobiera produkty i sumuje pakiety <b>z tej listy</b>. Zmiana ceny, opisu albo ukrycie produktu
                działa od następnej analizy — bez wgrywania czegokolwiek. Ukryte produkty zostają w bazie, ale audyt
                ich nie proponuje.
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
                </div>
                <div className="kt-row-act">
                  <button className="kt-btn sm" onClick={() => toggleHidden(r)}>{r.hidden ? 'Pokaż' : 'Ukryj'}</button>
                  <button className="kt-btn sm" onClick={() => (openId === r.id ? (setOpenId(null), setDraft(null)) : edit(r))}>
                    {openId === r.id ? 'Zamknij' : 'Edytuj'}
                  </button>
                  <button className="kt-btn sm del" onClick={() => remove(r)}>✕</button>
                </div>

                {openId === r.id && draft && <Form draft={draft} set={set} save={save} busy={busy} onCancel={() => { setOpenId(null); setDraft(null); }} />}
              </div>
            ))}

            {openId === 'new' && draft && (
              <div className="kt-row open new">
                <div className="kt-row-main"><span className="kt-no">nowy</span><span className="kt-name">{draft.name || 'Nowy produkt'}</span></div>
                <Form draft={draft} set={set} save={save} busy={busy} onCancel={() => { setOpenId(null); setDraft(null); }} />
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

function Form({ draft, set, save, busy, onCancel }) {
  return (
    <div className="kt-form">
      <div className="kt-grid">
        <label className="kt-f"><span>Numer w katalogu</span><input type="number" value={draft.id ?? ''} onChange={set('id')} /></label>
        <label className="kt-f wide"><span>Nazwa produktu</span><input value={draft.name || ''} onChange={set('name')} placeholder="np. Lead Engine" /></label>
        <label className="kt-f"><span>Kolejność</span><input type="number" value={draft.sort ?? ''} onChange={set('sort')} /></label>
      </div>
      <div className="kt-grid">
        <label className="kt-f"><span>Grupa (litera)</span><input value={draft.group_letter || ''} onChange={set('group_letter')} maxLength={1} placeholder="A" /></label>
        <label className="kt-f wide"><span>Grupa (nazwa)</span><input value={draft.group_name || ''} onChange={set('group_name')} placeholder="np. Sprzedaż" /></label>
        <label className="kt-f">
          <span>Zmysł</span>
          <select value={draft.sense || 'Brain'} onChange={set('sense')}>
            {SENSES.map((s) => <option key={s} value={s}>{s} — {SENSE_HINT[s]}</option>)}
          </select>
        </label>
      </div>
      <label className="kt-f"><span>Jednym zdaniem (tagline)</span><input value={draft.tagline || ''} onChange={set('tagline')} /></label>
      <label className="kt-f"><span>Co robi — jeden punkt w linii</span>
        <textarea rows={5} value={draft.does || ''} onChange={set('does')} placeholder={'Odbiera telefon o każdej porze\nUmawia wizyty w kalendarzu\nWysyła SMS-przypomnienia'} />
      </label>
      <label className="kt-f"><span>Problem, który znika</span><textarea rows={3} value={draft.problem || ''} onChange={set('problem')} /></label>
      <label className="kt-f"><span>Efekt u klienta</span><textarea rows={3} value={draft.effect || ''} onChange={set('effect')} /></label>
      <div className="kt-grid">
        <label className="kt-f"><span>Wdrożenie od (zł netto)</span><input type="number" value={draft.impl_from ?? ''} onChange={set('impl_from')} /></label>
        <label className="kt-f"><span>Abonament od (zł netto / mies.)</span><input type="number" value={draft.sub_from ?? ''} onChange={set('sub_from')} /></label>
        <label className="kt-f check"><input type="checkbox" checked={!!draft.hidden} onChange={set('hidden')} /><span>Ukryty — audyt go nie proponuje</span></label>
      </div>
      <div className="kt-form-act">
        <button className="kt-btn primary" onClick={save} disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz produkt'}</button>
        <button className="kt-btn" onClick={onCancel}>Anuluj</button>
        <span className="kt-form-hint">Ceny wchodzą do sum pakietów Start / Wzrost / Skala w każdym nowym audycie.</span>
      </div>
    </div>
  );
}
