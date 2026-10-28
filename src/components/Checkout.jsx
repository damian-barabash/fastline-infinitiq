import React, { useEffect, useRef, useState } from 'react';
import { PLANS, gross, money } from '../lib/plans.js';
import { billing } from '../lib/billing.js';
import checkoutCss from '../styles/checkout.css?inline';

/* Koszyk AI Doradcy (2026-10-28) — okno nad stroną produktu i /shop.
   Otwiera się kliknięciem w `[data-buy="start|wdrozenie"]` albo w stary link
   `/kontakt?plan=…` (przyciski LP), a także z linku „Dokończ zakup" z maila
   (`?kup=<plan>&z=<token zamówienia>`).

   Kolejność jak w Miro (3A): produkt i cena brutto → e-mail i osoba →
   NIP (dane firmy dociągają się z wykazu VAT MF i dopiero wtedy pokazują się
   pola adresu) → zgody → bramka płatności. Kwotę liczy serwer. */

const PLAN_FROM_HREF = { start: 'start', wdrozenie: 'wdrozenie' };
const nipDigits = (s) => String(s || '').replace(/\D/g, '').slice(0, 10);
function nipValid(d) {
  if (d.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  return w.reduce((s, k, i) => s + k * +d[i], 0) % 11 === +d[9];
}
const fmtNip = (d) => d.replace(/^(\d{3})(\d{0,3})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join('-'));

function planOf(el) {
  if (!el) return null;
  if (el.dataset && el.dataset.buy) return PLANS[el.dataset.buy] ? el.dataset.buy : null;
  const href = el.getAttribute && el.getAttribute('href');
  const m = href && href.match(/^\/kontakt\?plan=(\w+)/);
  return m && PLAN_FROM_HREF[m[1]] ? PLAN_FROM_HREF[m[1]] : null;
}

export default function Checkout() {
  const [plan, setPlan] = useState(null);       // klucz planu = okno otwarte
  const [resume, setResume] = useState('');
  const [f, setF] = useState({ email: '', contact_name: '', phone: '', nip: '', company_name: '', street: '', postal_code: '', city: '', regon: '' });
  const [nipState, setNipState] = useState('idle');   // idle | loading | found | manual | bad
  const [terms, setTerms] = useState(false);
  const [news, setNews] = useState(false);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const firstRef = useRef(null);
  const lastNip = useRef('');

  // otwieranie: klik w przycisk zakupu (faza capture — przed kurtyną `data-wipe`)
  useEffect(() => {
    const onClick = (e) => {
      const el = e.target.closest && e.target.closest('[data-buy], a[href^="/kontakt?plan="]');
      if (!el || document.body.classList.contains('fiq-edit')) return;
      const p = planOf(el);
      if (!p) return;
      e.preventDefault();
      e.stopPropagation();
      setPlan(p);
    };
    document.addEventListener('click', onClick, true);

    // link z maila „Dokończ zakup": ?kup=start&z=<token>
    const q = new URLSearchParams(location.search);
    const kup = q.get('kup');
    if (kup && PLANS[kup]) {
      setPlan(kup);
      const z = q.get('z');
      if (z) {
        setResume(z);
        billing('checkout.resume', { order: z }).then((r) => {
          if (!r || !r.ok) return;
          const c = r.customer || {};
          setF((s) => ({ ...s, ...c, email: r.email || s.email, nip: c.nip || s.nip }));
          if (c.nip) { lastNip.current = c.nip; setNipState('found'); }
        }).catch(() => {});
      }
    }
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // klawisz Esc, blokada przewijania strony pod oknem
  useEffect(() => {
    if (!plan) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) setPlan(null); };
    addEventListener('keydown', onKey);
    document.documentElement.classList.add('co-open');
    setTimeout(() => firstRef.current && firstRef.current.focus(), 60);
    return () => { removeEventListener('keydown', onKey); document.documentElement.classList.remove('co-open'); };
  }, [plan, busy]);

  // NIP: po 10 poprawnych cyfrach sami pytamy rejestr
  useEffect(() => {
    const d = nipDigits(f.nip);
    if (d.length < 10) { if (nipState === 'bad') setNipState('idle'); return; }
    if (!nipValid(d)) { setNipState('bad'); return; }
    if (d === lastNip.current) return;
    lastNip.current = d;
    setNipState('loading');
    billing('nip.lookup', { nip: d }).then((r) => {
      if (r && r.found) {
        setF((s) => ({ ...s, company_name: r.company_name || '', street: r.street || '', postal_code: r.postal_code || '', city: r.city || '', regon: r.regon || '' }));
        setNipState('found');
      } else setNipState('manual');
    }).catch(() => setNipState('manual'));
  }, [f.nip]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) return <style dangerouslySetInnerHTML={{ __html: checkoutCss }} />;

  const P = PLANS[plan];
  const monthlyGross = gross(P.monthly_net);
  const setupGross = gross(P.setup_net);
  const todayGross = Math.round((monthlyGross + setupGross) * 100) / 100;
  const showCompany = nipState === 'found' || nipState === 'manual';
  const set = (k) => (e) => { const v = k === 'nip' ? fmtNip(nipDigits(e.target.value)) : e.target.value; setF((s) => ({ ...s, [k]: v })); setErrs((x) => ({ ...x, [k]: false })); };

  async function submit(e) {
    e.preventDefault();
    const d = nipDigits(f.nip);
    const x = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) x.email = true;
    if (!f.contact_name.trim()) x.contact_name = true;
    if (!nipValid(d)) x.nip = true;
    if (showCompany) {
      if (!f.company_name.trim()) x.company_name = true;
      if (!f.street.trim()) x.street = true;
      if (!/^\d{2}-\d{3}$/.test(f.postal_code.trim())) x.postal_code = true;
      if (!f.city.trim()) x.city = true;
    }
    if (!terms) x.terms = true;
    setErrs(x);
    if (Object.keys(x).length) {
      const first = document.querySelector('.co-form .err');
      if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setBusy(true); setFail('');
    try {
      const r = await billing('checkout.create', {
        plan, email: f.email.trim(), resume,
        customer: { ...f, nip: d },
        consents: { terms: true, newsletter: news, at: new Date().toISOString() },
        source: location.pathname,
      });
      if (r && r.redirect) { location.href = r.redirect; return; }
      if (r && r.fields) setErrs(Object.fromEntries(r.fields.map((k) => [k, true])));
      setFail('Sprawdź zaznaczone pola.');
    } catch {
      setFail('Nie udało się połączyć z płatnością. Spróbuj za chwilę albo napisz do nas: infinitiq@fastline.pl');
    }
    setBusy(false);
  }

  const field = (k, label, props = {}) => (
    <label className={'co-f' + (errs[k] ? ' err' : '') + (props.half ? ' half' : '')}>
      <span>{label}</span>
      <input value={f[k]} onChange={set(k)} {...props.input} />
    </label>
  );

  return (
    <div className="co" role="dialog" aria-modal="true" aria-label={`Zakup: ${P.name}`} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setPlan(null); }}>
      <style dangerouslySetInnerHTML={{ __html: checkoutCss }} />
      <div className="co-box">
        <button type="button" className="co-x" aria-label="Zamknij" onClick={() => !busy && setPlan(null)}>×</button>

        <aside className="co-prod">
          <div className="co-cap">Twoje zamówienie</div>
          <h2>{P.product}</h2>
          <div className="co-plan">{plan === 'wdrozenie' ? 'Abonament + wdrożenie przez nas' : 'Abonament miesięczny'}</div>
          <ul className="co-lines">{P.lines.map((l) => <li key={l}>{l}</li>)}</ul>

          <div className="co-switch" role="tablist">
            {Object.values(PLANS).map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={p.key === plan} className={p.key === plan ? 'on' : ''} onClick={() => setPlan(p.key)}>
                {p.short}
              </button>
            ))}
          </div>

          <dl className="co-sum">
            <div><dt>Abonament</dt><dd>{money(P.monthly_net)} netto<small>{money(monthlyGross)} brutto / mies.</small></dd></div>
            {P.setup_net > 0 && <div><dt>Wdrożenie</dt><dd>{money(P.setup_net)} netto<small>{money(setupGross)} brutto, jednorazowo</small></dd></div>}
            <div className="tot"><dt>Dziś płacisz</dt><dd>{money(todayGross)}<small>brutto, w tym VAT 23%</small></dd></div>
          </dl>
          <p className="co-note">Potem {money(monthlyGross)} brutto co miesiąc. Anulujesz w panelu w każdej chwili — abonament działa do końca opłaconego miesiąca. Faktura VAT przychodzi mailem.</p>
        </aside>

        <form className="co-form" onSubmit={submit} noValidate>
          <div className="co-step"><b>01</b> Twoje dane</div>
          {field('email', 'E-mail (to będzie Twój login)', { input: { type: 'email', autoComplete: 'email', ref: firstRef, inputMode: 'email' } })}
          <div className="co-row">
            {field('contact_name', 'Imię i nazwisko', { half: true, input: { autoComplete: 'name' } })}
            {field('phone', 'Telefon (opcjonalnie)', { half: true, input: { type: 'tel', autoComplete: 'tel' } })}
          </div>

          <div className="co-step"><b>02</b> Dane do faktury</div>
          <label className={'co-f co-nip' + (errs.nip || nipState === 'bad' ? ' err' : '')}>
            <span>NIP firmy</span>
            <input value={f.nip} onChange={set('nip')} inputMode="numeric" autoComplete="off" placeholder="000-000-00-00" />
            <em className={'co-nipst ' + nipState}>
              {nipState === 'loading' && 'Sprawdzam w rejestrze…'}
              {nipState === 'found' && '✓ Dane z wykazu VAT'}
              {nipState === 'manual' && 'Brak w wykazie — wpisz dane'}
              {nipState === 'bad' && 'Błędny NIP'}
              {nipState === 'idle' && 'Dane firmy uzupełnimy sami'}
            </em>
          </label>

          {showCompany && (
            <div className="co-company">
              {field('company_name', 'Nazwa firmy')}
              {field('street', 'Ulica i numer')}
              <div className="co-row">
                {field('postal_code', 'Kod pocztowy', { half: true, input: { placeholder: '00-000', inputMode: 'numeric' } })}
                {field('city', 'Miasto', { half: true })}
              </div>
            </div>
          )}

          <div className="co-step"><b>03</b> Zgody</div>
          <label className={'co-check' + (errs.terms ? ' err' : '')}>
            <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErrs((x) => ({ ...x, terms: false })); }} />
            <i aria-hidden="true"></i>
            <span>Akceptuję <a href="/regulamin" target="_blank" rel="noopener">regulamin</a> i <a href="/polityka-prywatnosci" target="_blank" rel="noopener">politykę prywatności</a>. Chcę, żeby usługa ruszyła od razu po płatności.</span>
          </label>
          <label className="co-check">
            <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} />
            <i aria-hidden="true"></i>
            <span>Chcę dostawać nowości o produktach (opcjonalnie, raz na kilka tygodni).</span>
          </label>

          {fail && <p className="co-fail">{fail}</p>}
          <button className="co-pay" type="submit" disabled={busy}>
            {busy ? 'Łączę z płatnością…' : `Zapłać ${money(todayGross)}`}
          </button>
          <p className="co-safe">Płatność kartą, BLIK lub przelewem przez bezpieczną bramkę. Po płatności dostaniesz mailem login i hasło do panelu.</p>
        </form>
      </div>
    </div>
  );
}
