// Formularz kontaktu na /kontakt — dwa kroki zamiast jednego maila do skrzynki.
//
//   KROK 1  dane + adres strony (sprawdzany naprawdę, jak przy audycie) + produkty
//      ↓    „Dalej" → zielona sieć wciąga pola i kręci się, a w tle `brief-lead`
//           czyta stronę klienta i pisze, czym firma się zajmuje i jak pomożemy
//   KROK 2  ta analiza + kalendarz: klient sam wybiera dzień i godzinę rozmowy
//      ↓    „Potwierdź termin" → rezerwacja, e-mail z potwierdzeniem,
//           a godzinę przed rozmową cron dosyła przypomnienie
//
// Zgłoszenia widać w edytorze w zakładce „Briefingi" (`brief_leads`).
// W edytorze formularz jest żywy wizualnie, ale nie dotyka sieci — inaczej
// poprawianie treści zakładałoby prawdziwe terminy w kalendarzu.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SB_URL, SB_KEY } from '../lib/supabase-config.js';
import { runBriefFx } from '../engine/briefFx.js';
import { PAINS, UNSURE as UNSURE_PAIN } from '../engine/briefPains.js';

const FN = `${SB_URL}/functions/v1/brief-lead`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const LOOKS_LIKE_SITE = /^(https?:\/\/)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/.*)?$/i;
const UNSURE = UNSURE_PAIN.label;

// Klient wybiera PROBLEM, nie nazwę produktu — dobranie produktu to nasza robota
// (lista i mapa problem → produkty: `src/engine/briefPains.js`).
const PAIN_LABELS = PAINS.map((p) => p.label);

async function call(action, payload) {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    body: JSON.stringify({ action, ...payload }),
  });
  return await r.json().catch(() => ({ ok: false, reason: 'Brak odpowiedzi serwera' }));
}

// ⚠️ NIE `html.mode-flat`: na tej stronie to także zwykły widok mobilny.
const isEditor = () => typeof document !== 'undefined' && document.body.classList.contains('fiq-edit');

const DEMO = {
  profil: 'Podgląd w edytorze: tu pojawi się opis firmy klienta, przeczytany z jego strony.',
  pomoc: 'A tutaj — co konkretnie zrobi u niego wybrany produkt i co to zmieni.',
  produkt: 'AI Doradca',
  days: [{
    key: 'demo', label: 'pon., 00.00',
    slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map((label, i) => ({ iso: `demo-${i}`, label })),
  }],
};

export default function BriefForm() {
  const [step, setStep] = useState(1);            // 1 dane · 2 analiza + kalendarz · 3 gotowe
  const [form, setForm] = useState({ name: '', company: '', email: '', site: '' });
  const [picked, setPicked] = useState([]);       // wybrane produkty
  const [siteState, setSiteState] = useState({ s: 'idle' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fx, setFx] = useState(false);            // trwa animacja przejścia
  const [res, setRes] = useState(null);           // { lead_id, profil, pomoc, produkt, days }
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState('');
  const [booked, setBooked] = useState(null);     // { label }

  const cardRef = useRef(null);
  const fxCanvas = useRef(null);
  const fxRef = useRef(null);
  const checkSeq = useRef(0);
  const pending = useRef(null);

  /* ---- adres strony sprawdzany w locie ---- */
  const checkSite = useCallback(async (value) => {
    const v = String(value || '').trim();
    if (!LOOKS_LIKE_SITE.test(v)) { setSiteState({ s: 'idle' }); return; }
    if (isEditor()) { setSiteState({ s: 'ok', host: v, title: '' }); return; }
    const seq = ++checkSeq.current;
    setSiteState({ s: 'checking' });
    const d = await call('site.check', { site: v });
    if (seq !== checkSeq.current) return;
    setSiteState(d.ok ? { s: 'ok', host: d.host, title: d.title } : { s: 'bad', reason: d.reason });
  }, []);

  useEffect(() => {
    if (step !== 1) return undefined;
    const v = form.site.trim();
    if (!v) { setSiteState({ s: 'idle' }); return undefined; }
    const t = setTimeout(() => checkSite(v), 650);
    return () => clearTimeout(t);
  }, [form.site, step, checkSite]);

  useEffect(() => () => { if (fxRef.current) fxRef.current.stop(); }, []);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErr(''); };
  const toggle = (name) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : p.concat(name)));

  /* ---- krok 1 → animacja → krok 2 ---- */
  async function next(e) {
    e.preventDefault();
    if (busy || fx) return;
    if (!form.name.trim()) { setErr('Wpisz, jak się do Ciebie zwracać.'); return; }
    if (!EMAIL_RE.test(form.email.trim())) { setErr('Wpisz poprawny adres e-mail — na niego wyślemy potwierdzenie.'); return; }
    if (!LOOKS_LIKE_SITE.test(form.site.trim())) { setErr('Wpisz adres Waszej strony, np. moja-firma.pl'); return; }
    if (siteState.s === 'bad') { setErr(siteState.reason || 'Tej strony nie udało się otworzyć.'); return; }
    setErr('');

    // punkty animacji startują dokładnie tam, gdzie stoją pola
    const sources = [];
    const card = cardRef.current;
    if (card) {
      const base = card.getBoundingClientRect();
      card.querySelectorAll('.bf-field, .bf-pill.on, .bf-btn').forEach((el) => {
        const r = el.getBoundingClientRect();
        sources.push({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
      });
    }

    setFx(true);
    const started = Date.now();
    // zapytanie leci OD RAZU, animacja tylko przykrywa czekanie
    pending.current = isEditor()
      ? Promise.resolve({ ok: true, ...DEMO, lead_id: 'demo' })
      : call('analyze', {
        name: form.name.trim(), company: form.company.trim(), email: form.email.trim(),
        site: form.site.trim(), pains: picked.filter((p) => p !== UNSURE),
      });

    requestAnimationFrame(() => {
      fxRef.current = runBriefFx(fxCanvas.current, {
        sources,
        onDone: () => { setFx(false); setStep(2); },
      });
    });

    const d = await pending.current;
    const wait = Math.max(0, 2600 - (Date.now() - started));   // minimum, żeby animacja nie mrugnęła
    setTimeout(() => {
      if (!d || !d.ok) {
        setErr((d && d.reason) || 'Nie udało się przygotować analizy. Spróbuj jeszcze raz.');
        if (fxRef.current) fxRef.current.stop();
        setFx(false);
        return;
      }
      setRes(d);
      setDay(0);
      setSlot('');
      if (fxRef.current) fxRef.current.finish();
    }, wait);
  }

  /* ---- krok 2: rezerwacja ---- */
  async function book() {
    if (busy || !slot) return;
    setBusy(true); setErr('');
    if (isEditor()) { setBooked({ label: 'podgląd — termin nie został zapisany' }); setStep(3); setBusy(false); return; }
    const d = await call('book', { lead_id: res.lead_id, slot });
    setBusy(false);
    if (!d.ok) {
      setErr(d.reason || 'Nie udało się zarezerwować terminu.');
      if (d.days) { setRes((r) => ({ ...r, days: d.days })); setSlot(''); }
      return;
    }
    setBooked({ label: d.label, mailed: d.mailed });
    setStep(3);
  }

  const days = (res && res.days) || [];
  const activeDay = days[day] || null;

  return (
    <div className={`bf${fx ? ' bf-busy' : ''}`} ref={cardRef}>
      <div className="bf-head">
        <span className="bf-step-n">{String(Math.min(step, 3)).padStart(2, '0')}</span>
        <span className="bf-step-t">
          {step === 1 ? 'Twoje dane i strona' : step === 2 ? 'Analiza i termin' : 'Termin potwierdzony'}
        </span>
      </div>

      {step === 1 && (
        <form className="bf-body" onSubmit={next} noValidate>
          <div className="bf-grid">
            <label className="bf-field">
              <span className="bf-lab">Imię i nazwisko <em>*</em></span>
              <input type="text" value={form.name} onChange={set('name')} placeholder="Jan Kowalski" autoComplete="name" />
            </label>
            <label className="bf-field">
              <span className="bf-lab">Firma</span>
              <input type="text" value={form.company} onChange={set('company')} placeholder="Nazwa firmy" autoComplete="organization" />
            </label>
          </div>
          <div className="bf-grid">
          <label className="bf-field">
            <span className="bf-lab">E-mail <em>*</em></span>
            <input type="email" value={form.email} onChange={set('email')} placeholder="jan@firma.pl" autoComplete="email" inputMode="email" />
          </label>
          <label className="bf-field">
            <span className="bf-lab">Adres Waszej strony <em>*</em></span>
            <input
              type="text" value={form.site} onChange={set('site')} placeholder="moja-firma.pl"
              autoComplete="url" inputMode="url" spellCheck="false"
              className={siteState.s === 'bad' ? 'bad' : siteState.s === 'ok' ? 'good' : ''}
            />
            <span className={`bf-probe s-${siteState.s}`} aria-live="polite">
              {siteState.s === 'checking' && <><i className="bf-dot" />Sprawdzam, czy strona odpowiada…</>}
              {siteState.s === 'ok' && <><i className="bf-ok" />Strona działa{siteState.title ? ` — „${siteState.title}”` : ''}</>}
              {siteState.s === 'bad' && <><i className="bf-no" />{siteState.reason}</>}
              {siteState.s === 'idle' && 'Przeczytamy ją, zanim porozmawiamy.'}
            </span>
          </label>
          </div>

          <div className="bf-picks">
            <span className="bf-lab">Co u Was najbardziej uwiera?</span>
            <div className="bf-pills">
              {PAIN_LABELS.concat(UNSURE).map((name) => (
                <button
                  key={name} type="button"
                  className={`bf-pill${picked.includes(name) ? ' on' : ''}`}
                  onClick={() => toggle(name)}
                >{name}</button>
              ))}
            </div>
            <p className="bf-hint">Zaznacz, co Was boli — dobranie rozwiązania zostaw nam. Możesz też nic nie zaznaczać.</p>
          </div>

          <div className="bf-actions">
            <button className="bf-btn" type="submit" disabled={siteState.s === 'checking'}>Dalej →</button>
            <span className="bf-note">Bez zobowiązań · analiza zajmuje kilka sekund</span>
          </div>
        </form>
      )}

      {step === 2 && res && (
        <div className="bf-body">
          <div className="bf-analysis">
            <div className="bf-an-block">
              <span className="bf-cap">{'// co widzimy'}</span>
              <p>{res.profil}</p>
            </div>
            <div className="bf-an-block">
              <span className="bf-cap">{'// jak pomożemy'}</span>
              <p>{res.pomoc}</p>
            </div>
            {(res.produkt || (res.products && res.products.length > 0)) && (
              <div className="bf-chips">
                {res.produkt
                  ? <span className="bf-chip">Proponujemy start: <b>{res.produkt}</b></span>
                  : res.products.map((p) => <span className="bf-chip" key={p}>{p}</span>)}
              </div>
            )}
          </div>

          <div className="bf-cal">
            <span className="bf-lab">Wybierz termin 30-minutowej rozmowy</span>
            <div className="bf-days">
              {days.map((d, i) => (
                <button
                  key={d.key} type="button"
                  className={`bf-day${i === day ? ' on' : ''}`}
                  onClick={() => { setDay(i); setSlot(''); }}
                >{d.label}</button>
              ))}
            </div>
            <div className="bf-slots">
              {activeDay && activeDay.slots.map((s) => (
                <button
                  key={s.iso} type="button"
                  className={`bf-slot${slot === s.iso ? ' on' : ''}`}
                  onClick={() => setSlot(s.iso)}
                >{s.label}</button>
              ))}
              {activeDay && !activeDay.slots.length && <p className="bf-hint">Tego dnia nie ma już wolnych godzin.</p>}
            </div>
            <div className="bf-actions">
              <button className="bf-btn" type="button" onClick={book} disabled={!slot || busy}>
                {busy ? 'Rezerwuję…' : 'Potwierdź termin →'}
              </button>
              <span className="bf-note">Godzinę wcześniej przypomnimy mailem</span>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bf-body bf-done">
          <div className="bf-done-h"><i className="bf-ok big" />Termin potwierdzony</div>
          <p className="bf-done-when">{booked && booked.label}</p>
          <p className="bf-hint">
            Potwierdzenie poszło na <strong>{form.email}</strong>, a godzinę przed rozmową przyślemy przypomnienie.
            Dzwonimy my — nic nie musisz przygotowywać.
          </p>
        </div>
      )}

      {/* warstwa przejścia: sieć wciąga pola i kręci się, dopóki nie wróci analiza */}
      <div className={`bf-fx${fx ? ' on' : ''}`} aria-hidden={!fx}>
        <canvas ref={fxCanvas} className="bf-fx-c" />
        <div className="bf-fx-txt">
          <span className="bf-fx-dot" />
          <b>Dane są przetwarzane</b>
          <i>czytamy Waszą stronę i dobieramy rozwiązanie</i>
        </div>
      </div>

      {err && <p className="bf-err" role="alert">{err}</p>}
    </div>
  );
}
