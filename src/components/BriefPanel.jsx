import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sbAuth } from '../lib/supabase.js';

// Zakładka „Briefingi" w edytorze — zgłoszenia z formularza na /kontakt.
// Każdy wiersz to jedno wypełnienie: dane, strona, wybrane produkty, analiza
// napisana przez model w trakcie wypełniania i umówiony termin rozmowy.
// Tabela `brief_leads` (RLS: tylko zalogowany), edge `brief-lead` je zakłada.

const STATUS_LABEL = { new: 'Bez terminu', booked: 'Umówiony', done: 'Odbyty', canceled: 'Odwołany' };
const FILTERS = [
  { key: 'upcoming', label: 'Nadchodzące' },
  { key: 'booked', label: 'Umówione' },
  { key: 'new', label: 'Bez terminu' },
  { key: 'done', label: 'Odbyte' },
  { key: 'all', label: 'Wszystkie' },
];

const fmtSlot = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw', weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function BriefPanel() {
  const sb = sbAuth();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState('');
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    const { data, error } = await sb.from('brief_leads').select('*').order('created_at', { ascending: false });
    if (!error) setRows(data || []);
    else setMsg('Błąd wczytywania: ' + error.message);
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const list = rows || [];
    const now = Date.now();
    if (filter === 'all') return list;
    if (filter === 'upcoming') {
      return list.filter(r => r.status === 'booked' && r.slot_at && new Date(r.slot_at).getTime() > now - 3600_000)
        .sort((a, b) => new Date(a.slot_at) - new Date(b.slot_at));
    }
    return list.filter(r => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const list = rows || [];
    const now = Date.now();
    return {
      upcoming: list.filter(r => r.status === 'booked' && r.slot_at && new Date(r.slot_at).getTime() > now - 3600_000).length,
      booked: list.filter(r => r.status === 'booked').length,
      new: list.filter(r => r.status === 'new').length,
      done: list.filter(r => r.status === 'done').length,
      all: list.length,
    };
  }, [rows]);

  function note(text) { setMsg(text); setTimeout(() => setMsg(''), 3000); }

  async function patch(id, patchObj) {
    const { error } = await sb.from('brief_leads').update({ ...patchObj, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { note('Błąd zapisu: ' + error.message); return; }
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patchObj } : r)));
  }

  async function remove(r) {
    if (!confirm(`Usunąć zgłoszenie „${r.company || r.site_host || r.email}"? Tego nie da się cofnąć.`)) return;
    const { error } = await sb.from('brief_leads').delete().eq('id', r.id);
    if (error) { note('Błąd usuwania: ' + error.message); return; }
    setRows(prev => prev.filter(x => x.id !== r.id));
  }

  return (
    <div className="ap-wrap bp-wrap">
      <div className="ap-inner">
        <div className="ap-head">
          <div>
            <div className="ap-eyebrow">{'// briefingi'}</div>
            <h1 className="ap-title">Zgłoszenia z formularza kontaktu</h1>
          </div>
          <div className="ap-hint">Klient zostawia dane i stronę · model pisze analizę · klient sam wybiera termin</div>
        </div>

        <div className="bp-filters">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={'ap-btn' + (filter === f.key ? ' on' : '')}
              onClick={() => setFilter(f.key)}
              type="button"
            >{f.label} <span className="bp-count">{counts[f.key] ?? 0}</span></button>
          ))}
          <button className="ap-btn" type="button" onClick={load}>Odśwież</button>
        </div>

        {msg && <div className="ap-msg">{msg}</div>}
        {rows === null && <div className="ap-empty">Wczytuję…</div>}
        {rows !== null && !shown.length && <div className="ap-empty">Nic tu jeszcze nie ma.</div>}

        {shown.map(r => (
          <div key={r.id} className={'ap-card bp-card st-' + r.status}>
            <div className="ap-row">
              <div>
                <div className="ap-client">
                  {r.company || r.name || r.site_host || r.email}
                  <span className={'ap-status st-' + (r.status === 'booked' ? 'ready' : r.status === 'canceled' ? 'error' : '')}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
                <div className="ap-sub">
                  {r.slot_at && <><b className="bp-slot">{fmtSlot(r.slot_at)}</b><span className="ap-dot">·</span></>}
                  <span>{r.name}</span><span className="ap-dot">·</span>
                  <a className="ap-link" href={`mailto:${r.email}`}>{r.email}</a>
                  {r.site_url && <><span className="ap-dot">·</span>
                    <a className="ap-link" href={r.site_url} target="_blank" rel="noreferrer">{r.site_host}</a></>}
                  <span className="ap-dot">·</span><span>zgłoszenie {fmtDate(r.created_at)}</span>
                  {r.remind_mail_at && <><span className="ap-dot">·</span><span>przypomnienie wysłane</span></>}
                </div>
                {!!(r.pains && r.pains.length) && (
                  <div className="bp-tags">{r.pains.map(p => <span className="bp-tag pain" key={p}>{p}</span>)}</div>
                )}
                {!!(r.products && r.products.length) && (
                  <div className="bp-tags">{r.products.map(p => <span className="bp-tag" key={p}>{p}</span>)}</div>
                )}
                {r.rec_product && <div className="bp-tags"><span className="bp-tag rec">dobrane: {r.rec_product}</span></div>}
              </div>
              <div className="ap-actions">
                <button className="ap-btn" type="button" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  {open === r.id ? 'Zwiń' : 'Szczegóły'}
                </button>
                {r.status !== 'done' && <button className="ap-btn" type="button" onClick={() => patch(r.id, { status: 'done' })}>Odbyty</button>}
                {r.status !== 'canceled' && <button className="ap-btn" type="button" onClick={() => patch(r.id, { status: 'canceled' })}>Odwołaj</button>}
                <button className="ap-btn" type="button" onClick={() => remove(r)}>Usuń</button>
              </div>
            </div>

            {open === r.id && (
              <div className="bp-detail">
                {r.profil && <div className="bp-block"><span className="bp-cap">{'// profil firmy'}</span><p>{r.profil}</p></div>}
                {r.pomoc && <div className="bp-block"><span className="bp-cap">{'// jak pomożemy'}</span><p>{r.pomoc}</p></div>}
                <div className="bp-block">
                  <span className="bp-cap">{'// notatka wewnętrzna'}</span>
                  <textarea
                    className="bp-notes"
                    rows="3"
                    value={notes[r.id] ?? r.notes ?? ''}
                    onChange={(e) => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                    onBlur={(e) => patch(r.id, { notes: e.target.value })}
                    placeholder="Ustalenia z rozmowy, kontekst, następny krok…"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
