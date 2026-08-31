import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sbAuth } from '../lib/supabase.js';

// Вкладка «Audyt» в редакторе: список аудитов + создание нового.
// Флоу: nazwa klienta + URL + slug → «Uruchom analizę» (edge audit-run, ~1 min)
// → статус ready → ручной ввод цен пакетов → готовая ссылка /audyt/<slug>.
const slugify = (s) => String(s || '')
  .toLowerCase()
  .replace(/[ąàá]/g, 'a').replace(/[ćč]/g, 'c').replace(/[ęèé]/g, 'e')
  .replace(/ł/g, 'l').replace(/[ńñ]/g, 'n').replace(/[óò]/g, 'o')
  .replace(/[śš]/g, 's').replace(/[żźž]/g, 'z').replace(/ü/g, 'u').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

const DEFAULT_PACKAGES = [
  { name: 'Podstawowy', price: '' },
  { name: 'Standard', price: '' },
  { name: 'Premium', price: '' },
];

const STATUS_LABEL = { new: 'Nowy', running: 'Analiza…', ready: 'Gotowy', error: 'Błąd' };

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export default function AudytPanel() {
  const sb = sbAuth();
  const [audits, setAudits] = useState(null);
  const [form, setForm] = useState({ client_name: '', site_url: '', slug: '', competitors: '' });
  const [compDraft, setCompDraft] = useState({});     // audit id → редактируемая строка конкурентов
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [openPrices, setOpenPrices] = useState(null);   // audit id с открытым редактором цен
  const [priceDraft, setPriceDraft] = useState(null);
  const [elapsed, setElapsed] = useState({});           // id → секунды анализа
  const timers = useRef({});

  const load = useCallback(async () => {
    const { data, error } = await sb.from('audits').select('*').order('created_at', { ascending: false });
    if (!error) setAudits(data || []);
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  // пока есть running — опрашиваем каждые 3 с и тикаем секундомер
  useEffect(() => {
    if (!audits || !audits.some(a => a.status === 'running')) return;
    const poll = setInterval(load, 3000);
    const tick = setInterval(() => {
      setElapsed(prev => {
        const next = { ...prev };
        audits.filter(a => a.status === 'running').forEach(a => { next[a.id] = (next[a.id] || 0) + 1; });
        return next;
      });
    }, 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [audits, load]);

  function note(text) {
    setMsg(text);
    clearTimeout(timers.current.msg);
    timers.current.msg = setTimeout(() => setMsg(''), 3200);
  }

  async function runAnalysis(id) {
    setElapsed(prev => ({ ...prev, [id]: 0 }));
    setAudits(prev => prev && prev.map(a => a.id === id ? { ...a, status: 'running', error: null } : a));
    try {
      const { error } = await sb.functions.invoke('audit-run', { body: { id } });
      if (error) throw error;
    } catch (e) {
      // статус подтянет poll — но покажем сразу
      note('Błąd analizy: ' + (e.message || e));
    }
    load();
  }

  async function createAudit(e) {
    e.preventDefault();
    const client_name = form.client_name.trim();
    const site_url = form.site_url.trim();
    const slug = slugify(form.slug || form.client_name);
    const competitors = form.competitors.trim() || null;
    if (!client_name || !site_url || !slug) { note('Uzupełnij nazwę klienta, adres strony i slug.'); return; }
    setBusy(true);
    const { data, error } = await sb.from('audits')
      .insert({ client_name, site_url, slug, competitors, prices: { packages: DEFAULT_PACKAGES, note: '' } })
      .select().single();
    setBusy(false);
    if (error) {
      note(/duplicate|unique/i.test(error.message) ? 'Ten slug jest już zajęty — wybierz inny.' : ('Błąd: ' + error.message));
      return;
    }
    setForm({ client_name: '', site_url: '', slug: '', competitors: '' });
    setSlugTouched(false);
    setAudits(prev => prev ? [data, ...prev] : [data]);
    runAnalysis(data.id);
  }

  async function removeAudit(a) {
    if (!confirm(`Usunąć audyt „${a.client_name}" (${a.slug})?`)) return;
    const { error } = await sb.from('audits').delete().eq('id', a.id);
    if (error) { note('Błąd usuwania: ' + error.message); return; }
    setAudits(prev => prev.filter(x => x.id !== a.id));
  }

  function openPriceEditor(a) {
    const p = (a.prices && Array.isArray(a.prices.packages) && a.prices.packages.length)
      ? a.prices : { packages: DEFAULT_PACKAGES, note: '' };
    setPriceDraft({ packages: p.packages.map(x => ({ ...x })), note: p.note || '' });
    setOpenPrices(a.id);
  }

  async function savePrices(a) {
    const { error } = await sb.from('audits').update({ prices: priceDraft }).eq('id', a.id);
    if (error) { note('Błąd zapisu cen: ' + error.message); return; }
    setAudits(prev => prev.map(x => x.id === a.id ? { ...x, prices: priceDraft } : x));
    setOpenPrices(null);
    note('Ceny zapisane ✓');
  }

  async function saveCompetitors(a) {
    const val = (compDraft[a.id] ?? a.competitors ?? '').trim();
    if ((a.competitors || '') === val) return;
    const { error } = await sb.from('audits').update({ competitors: val || null }).eq('id', a.id);
    if (error) { note('Błąd zapisu konkurentów: ' + error.message); return; }
    setAudits(prev => prev.map(x => x.id === a.id ? { ...x, competitors: val || null } : x));
    note(val ? 'Konkurenci zapisani — kliknij „Ponów analizę", żeby przeliczyć audyt.' : 'Konkurenci wyczyszczeni — AI dobierze ich automatycznie przy kolejnej analizie.');
  }

  function copyLink(slug) {
    const url = `${location.origin}/audyt/${slug}`;
    navigator.clipboard?.writeText(url).then(() => note('Link skopiowany: ' + url)).catch(() => note(url));
  }

  return (
    <div className="ap-wrap">
      <div className="ap-inner">
        <div className="ap-head">
          <div>
            <div className="ap-eyebrow">★ Audyty SEO · GEO</div>
            <h2 className="ap-title">Audyt dla klienta</h2>
          </div>
          <div className="ap-hint">analiza AI 3–5 min · produkty i pakiety z katalogu FIQ dobierają się same, ceny możesz nadpisać</div>
        </div>

        {/* nowy audyt */}
        <form className="ap-new" onSubmit={createAudit}>
          <div className="ap-field">
            <label>Nazwa klienta</label>
            <input value={form.client_name} placeholder="np. Greywolf Group"
              onChange={e => setForm(f => ({ ...f, client_name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))} />
          </div>
          <div className="ap-field">
            <label>Adres strony</label>
            <input value={form.site_url} placeholder="https://klient.pl"
              onChange={e => setForm(f => ({ ...f, site_url: e.target.value }))} />
          </div>
          <div className="ap-field">
            <label>Slug (link dla klienta)</label>
            <input value={form.slug} placeholder="np. greywolf-geo"
              onChange={e => { setSlugTouched(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })); }} />
          </div>
          <div className="ap-field">
            <label>Konkurenci (opcjonalnie)</label>
            <input value={form.competitors} placeholder="domeny po przecinku — puste = AI dobierze"
              onChange={e => setForm(f => ({ ...f, competitors: e.target.value }))} />
          </div>
          <button className="ap-create" disabled={busy} type="submit">{busy ? 'Tworzenie…' : '＋ Nowy audyt'}</button>
        </form>
        {form.slug && <div className="ap-slug-preview">→ {location.origin}/audyt/{form.slug}</div>}
        {msg && <div className="ap-msg">{msg}</div>}

        {/* lista */}
        {audits === null && <div className="ap-empty">Ładowanie…</div>}
        {audits && audits.length === 0 && <div className="ap-empty">Brak audytów — dodaj pierwszy powyżej.</div>}
        {audits && audits.map(a => (
          <div className={'ap-card st-' + a.status} key={a.id}>
            <div className="ap-row">
              <div className="ap-meta">
                <div className="ap-client">
                  {a.logo_url && <img className="ap-logo" src={a.logo_url} alt="" onError={e => { e.target.style.display = 'none'; }} />}
                  <span>{a.client_name}</span>
                  <span className={'ap-status st-' + a.status}>
                    {STATUS_LABEL[a.status] || a.status}
                    {a.status === 'running' && (elapsed[a.id] != null) && ` ${elapsed[a.id]}s`}
                  </span>
                </div>
                <div className="ap-sub">
                  <span className="ap-url">{a.site_url}</span>
                  <span className="ap-dot">·</span>
                  <span className="ap-link" onClick={() => copyLink(a.slug)} title="Kopiuj link">/audyt/{a.slug}</span>
                  <span className="ap-dot">·</span>
                  <span>{fmtDate(a.created_at)}</span>
                </div>
                {a.status === 'error' && <div className="ap-err">⚠ {a.error}</div>}
                <div className="ap-comp">
                  <span className="ap-comp-label">Konkurenci</span>
                  <input className="ap-comp-input"
                    value={compDraft[a.id] ?? a.competitors ?? ''}
                    placeholder="auto (AI dobierze) — albo domeny po przecinku"
                    onChange={e => setCompDraft(prev => ({ ...prev, [a.id]: e.target.value }))}
                    onBlur={() => saveCompetitors(a)}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} />
                </div>
              </div>
              <div className="ap-actions">
                {a.status === 'ready' && (
                  <a className="ap-btn" href={`/audyt/${a.slug}`} target="_blank" rel="noopener">Otwórz</a>
                )}
                {a.status === 'ready' && (
                  <button className="ap-btn" onClick={() => copyLink(a.slug)}>Kopiuj link</button>
                )}
                {a.status === 'ready' && (
                  <button className={'ap-btn' + (openPrices === a.id ? ' on' : '')} onClick={() => openPrices === a.id ? setOpenPrices(null) : openPriceEditor(a)}>Ceny</button>
                )}
                {(a.status === 'new' || a.status === 'error' || a.status === 'ready') && (
                  <button className="ap-btn primary" onClick={() => runAnalysis(a.id)}>
                    {a.status === 'ready' ? 'Ponów analizę' : 'Uruchom analizę'}
                  </button>
                )}
                {a.status === 'running' && <span className="ap-running">● analiza w toku…</span>}
                <button className="ap-btn del" onClick={() => removeAudit(a)} title="Usuń">✕</button>
              </div>
            </div>

            {openPrices === a.id && priceDraft && (
              <div className="ap-prices">
                <div className="ap-prices-head">Pakiety i inwestycja (widoczne na stronie audytu)</div>
                {Array.isArray(a.content?.packages) && a.content.packages.length > 0 && (
                  <div className="ap-prices-auto">
                    Pakiety Start / Wzrost / Skala liczą się automatycznie z cen katalogu produktów FIQ — puste pole = suma katalogowa
                    ({a.content.packages.map(p => `${p.name}: ${p.sub_label || ''}`).join(' · ')}). Wpisz cenę, żeby nadpisać.
                  </div>
                )}
                {priceDraft.packages.map((p, i) => (
                  <div className="ap-price-row" key={i}>
                    <input className="ap-pname" value={p.name} placeholder="Nazwa pakietu"
                      onChange={e => setPriceDraft(d => { const n = { ...d, packages: d.packages.map((x, k) => k === i ? { ...x, name: e.target.value } : x) }; return n; })} />
                    <input className="ap-pprice" value={p.price} placeholder={Array.isArray(a.content?.packages) && a.content.packages.length ? 'puste = suma z katalogu' : 'np. 4 800 zł netto'}
                      onChange={e => setPriceDraft(d => { const n = { ...d, packages: d.packages.map((x, k) => k === i ? { ...x, price: e.target.value } : x) }; return n; })} />
                  </div>
                ))}
                <input className="ap-pnote" value={priceDraft.note} placeholder={'Notatka pod cenami (opcjonalnie), np. „ceny netto, oferta ważna 14 dni"'}
                  onChange={e => setPriceDraft(d => ({ ...d, note: e.target.value }))} />
                <div className="ap-prices-actions">
                  <button className="ap-btn primary" onClick={() => savePrices(a)}>Zapisz ceny</button>
                  <button className="ap-btn" onClick={() => setOpenPrices(null)}>Anuluj</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
