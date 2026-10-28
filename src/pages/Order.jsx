import React, { useEffect, useState } from 'react';
import { billing } from '../lib/billing.js';
import { money } from '../lib/plans.js';
import checkoutCss from '../styles/checkout.css?inline';

/* Strony po koszyku (2026-10-28), bez SSG i noindex:
   /zamowienie/?o=<token>        — „Dziękujemy" + status konta (Miro 3A)
   /zaplac/?f=<token faktury>    — zaległa faktura z maila windykacyjnego
   /platnosc-testowa/?o=|?f=     — bramka testowa, dopóki nie ma prawdziwej
   /faktura/?t=<token faktury>   — podgląd i druk faktury (link z maila i z panelu)
   /platnosc/?o=|?f=             — płatność kartą przez widżet ING Pay (bramka produkcyjna) */

const BRAIN = 'https://brain.fastlineinfinitiq.pl';
const q = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

function Frame({ bad, children }) {
  return (
    <main className="ord">
      <style dangerouslySetInnerHTML={{ __html: checkoutCss }} />
      <div className={'ord-box' + (bad ? ' bad' : '')}>
        <div className="ord-in">
          <a href="/"><img className="ord-logo" src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" /></a>
          {children}
        </div>
      </div>
    </main>
  );
}

function ThankYou() {
  const o = q().get('o') || '';
  const [s, setS] = useState(null);
  const [resent, setResent] = useState('');

  useEffect(() => {
    let alive = true, n = 0, t = 0;
    const poll = () => billing('checkout.status', { order: o }).then((r) => {
      if (!alive) return;
      setS(r);
      // konto zakłada się w tle — dopytujemy do ~1 min
      if (r && r.status === 'paid' && r.account !== 'ready' && n++ < 30) t = setTimeout(poll, 2000);
      if (r && (r.status === 'pending' || r.status === 'new') && n++ < 30) t = setTimeout(poll, 2500);
    }).catch(() => alive && setS({ error: true }));
    poll();
    return () => { alive = false; clearTimeout(t); };
  }, [o]);

  if (!s) return <Frame><p><span className="ord-spin"></span>Sprawdzam płatność…</p></Frame>;
  if (s.error || s.status === undefined) return <Frame bad><h1>Nie znaleziono zamówienia</h1><p>Napisz do nas: <b>infinitiq@fastline.pl</b> — wyjaśnimy w kilka minut.</p></Frame>;

  if (s.status === 'failed' || s.status === 'expired' || s.status === 'canceled') {
    // Miro: „Płatność nieudana → ekran: spróbuj ponownie + mail z linkiem"
    return (
      <Frame bad>
        <div className="ord-cap" style={{ color: '#FF6B57' }}>Płatność nie przeszła</div>
        <h1>Spróbujmy jeszcze raz</h1>
        <p>Bank albo bramka odrzuciły płatność. Nic nie zostało pobrane. Twoje dane zostały zapisane — wystarczy ponowić.</p>
        <div className="ord-actions">
          <a className="ord-btn" href={`/ai-doradca/?kup=start&z=${o}`}>Spróbuj ponownie</a>
          <a className="ord-btn alt" href="/kontakt">Wolę porozmawiać</a>
        </div>
      </Frame>
    );
  }

  if (s.status !== 'paid') return <Frame><p><span className="ord-spin"></span>Czekamy na potwierdzenie z bramki płatności…</p></Frame>;

  const ready = s.account === 'ready';
  return (
    <Frame>
      <div className="ord-cap">Płatność przyjęta · {money(s.gross)}</div>
      <h1>Dziękujemy!</h1>
      <p>Zakładamy Twoje konto w panelu. <b>Sprawdź pocztę {s.email}</b> — wysłaliśmy login, hasło jednorazowe i fakturę.</p>
      <ol className="ord-steps">
        <li className="done">Płatność</li>
        <li className={ready ? 'done' : 'now'}>{ready ? 'Konto gotowe' : <><span className="ord-spin"></span>Zakładamy konto…</>}</li>
        <li className={ready ? 'now' : ''}>Mail z loginem i hasłem</li>
        <li>Pierwsze logowanie: ustawiasz hasło i podłączasz kanał</li>
      </ol>
      {s.account === 'delayed' && <p className="ord-small">Konto zakłada się dłużej niż zwykle — już nad tym pracujemy. Dostaniesz maila najpóźniej w ciągu godziny.</p>}
      <div className="ord-actions">
        <a className="ord-btn" href={s.login_url || `${BRAIN}/login`}>Przejdź do logowania</a>
        {ready && (
          <button type="button" className="ord-btn alt" disabled={!!resent} onClick={() => billing('checkout.resend', { order: o }).then((r) => setResent(r && r.ok ? 'ok' : 'err'))}>
            {resent === 'ok' ? 'Wysłane ponownie' : resent === 'err' ? 'Spróbuj za 2 min' : 'Nie doszedł mail?'}
          </button>
        )}
      </div>
      <p className="ord-small" style={{ marginTop: 18 }}>Nie widzisz maila? Zajrzyj do spamu albo kliknij „Nie doszedł mail?" — wyślemy nowe hasło jednorazowe.</p>
    </Frame>
  );
}

function PayInvoice() {
  const f = q().get('f') || '';
  const [s, setS] = useState(null);
  useEffect(() => { billing('invoice.pay', { invoice: f }).then(setS).catch(() => setS({ error: true })); }, [f]);
  if (!s) return <Frame><p><span className="ord-spin"></span>Przygotowuję płatność…</p></Frame>;
  if (s.error) return <Frame bad><h1>Nie znaleziono faktury</h1><p>Zaloguj się do panelu i otwórz zakładkę „Płatności".</p></Frame>;
  if (s.paid) return <Frame><div className="ord-cap">Faktura</div><h1>Już opłacona</h1><p>Dziękujemy — nic więcej nie trzeba robić.</p><a className="ord-btn" href={`${BRAIN}/platnosci`}>Przejdź do panelu</a></Frame>;
  return (
    <Frame>
      <div className="ord-cap">Faktura {s.number}</div>
      <h1>Do zapłaty {money(s.amount)}</h1>
      <p>Płatność kartą, BLIK lub przelewem. Po zaksięgowaniu AI Doradca pracuje dalej bez przerwy.</p>
      <a className="ord-btn" href={s.redirect}>Zapłać teraz</a>
    </Frame>
  );
}

function TestGateway() {
  const o = q().get('o'), f = q().get('f');
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { billing('test.info', o ? { order: o } : { invoice: f }).then(setInfo).catch(() => setInfo({ error: true })); }, [o, f]);
  const go = (ok) => {
    setBusy(true);
    billing('test.result', o ? { order: o, ok } : { invoice: f, ok }).then((r) => { if (r && r.back) location.href = r.back; else setBusy(false); });
  };
  if (!info) return <Frame><p><span className="ord-spin"></span>Bramka…</p></Frame>;
  if (info.error) return <Frame bad><h1>Bramka testowa wyłączona</h1><p>Płatności idą już przez prawdziwą bramkę.</p></Frame>;
  return (
    <Frame>
      <div className="ord-cap">Bramka testowa</div>
      <h1>{money(info.amount)}</h1>
      <p>{info.kind === 'order' ? `Zamówienie dla ${info.email}` : `Faktura ${info.number}`}</p>
      <div className="ord-actions">
        <button type="button" className="ord-btn" disabled={busy} onClick={() => go(true)}>Zapłać (sukces)</button>
        <button type="button" className="ord-btn bad" disabled={busy} onClick={() => go(false)}>Odrzuć płatność</button>
      </div>
      <p className="ord-test">To strona testowa: zastąpi ją bramka płatności, gdy podłączymy dane konta. Pieniądze nie są pobierane.</p>
    </Frame>
  );
}

const zl = (n) => Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

/* Faktura do podglądu i druku („Zapisz jako PDF" w oknie drukowania) — biała kartka. */
function InvoiceView() {
  const t = q().get('t') || '';
  const [inv, setInv] = useState(null);
  useEffect(() => { billing('invoice.get', { invoice: t }).then((r) => setInv(r && r.invoice ? r.invoice : { error: true })).catch(() => setInv({ error: true })); }, [t]);
  if (!inv) return <Frame><p><span className="ord-spin"></span>Wczytuję fakturę…</p></Frame>;
  if (inv.error) return <Frame bad><h1>Nie znaleziono faktury</h1><p>Wszystkie faktury znajdziesz w panelu, w zakładce „Płatności".</p></Frame>;
  const s = inv.seller, b = inv.buyer;
  return (
    <main className="fv">
      <style dangerouslySetInnerHTML={{ __html: checkoutCss }} />
      <div className="fv-bar">
        {inv.pdf_url
          ? <a className="ord-btn" href={inv.pdf_url}>Pobierz PDF (ING Księgowość)</a>
          : <button type="button" className="ord-btn" onClick={() => print()}>Drukuj / zapisz PDF</button>}
        {inv.pay_url && <a className="ord-btn alt" href={inv.pay_url}>Zapłać {zl(inv.gross)}</a>}
      </div>
      <article className="fv-page">
        <header className="fv-head">
          <img src="/assets/logo/LOGO.png" alt="" className="fv-logo" />
          <div>
            <h1>Faktura VAT nr {inv.number}</h1>
            <p>Data wystawienia: {inv.issue_date} · Data sprzedaży: {inv.sale_date} · Termin płatności: {inv.due_date}</p>
          </div>
          <span className={'fv-st ' + inv.status}>{inv.status === 'paid' ? 'Opłacona' : 'Do zapłaty'}</span>
        </header>
        <section className="fv-parties">
          <div><small>Sprzedawca</small><b>{s.name}</b><span>{s.street}</span><span>{s.postal_code} {s.city}</span><span>NIP {s.nip} · REGON {s.regon}</span><span>KRS {s.krs}</span></div>
          <div><small>Nabywca</small><b>{b.name}</b><span>{b.street}</span><span>{b.postal_code} {b.city}</span><span>NIP {b.nip}</span></div>
        </section>
        <table className="fv-table">
          <thead><tr><th>Lp.</th><th>Nazwa usługi</th><th>Ilość</th><th>Netto</th><th>VAT</th><th>Kwota VAT</th><th>Brutto</th></tr></thead>
          <tbody>{inv.items.map((l, i) => (
            <tr key={i}><td>{i + 1}</td><td>{l.name}</td><td>{l.qty} {l.unit}</td><td>{zl(l.net)}</td><td>{l.vat_rate}%</td><td>{zl(l.vat)}</td><td>{zl(l.gross)}</td></tr>
          ))}</tbody>
        </table>
        <div className="fv-sum">
          <div><span>Razem netto</span><b>{zl(inv.net)}</b></div>
          <div><span>VAT 23%</span><b>{zl(inv.vat)}</b></div>
          <div className="tot"><span>{inv.status === 'paid' ? 'Zapłacono' : 'Do zapłaty'}</span><b>{zl(inv.gross)}</b></div>
        </div>
        <p className="fv-pay">Sposób płatności: {inv.status === 'paid' ? 'płatność online' : `przelew na konto ${s.account} (${s.bank}) albo płatność online`}</p>
      </article>
    </main>
  );
}

/* Płatność kartą przez widżet ING Pay (zapisuje kartę do odnowień — profil recurring). */
function CardPay() {
  const q0 = q(); const o = q0.get('o'), f = q0.get('f');
  const [w, setW] = useState(null);
  useEffect(() => {
    billing('pay.widget', o ? { order: o } : { invoice: f }).then((r) => {
      if (r && r.paid && r.back) { location.href = r.back; return; }
      setW(r && r.attrs ? r : { error: true });
    }).catch(() => setW({ error: true }));
  }, [o, f]);
  useEffect(() => {
    if (!w || !w.attrs) return undefined;
    const s = document.createElement('script');
    s.id = 'imoje-widget__script';
    s.src = w.src;
    for (const [k, v] of Object.entries(w.attrs)) s.setAttribute(k, v);
    document.body.appendChild(s);
    return () => s.remove();
  }, [w]);
  if (!w) return <Frame><p><span className="ord-spin"></span>Łączę z bramką płatności…</p></Frame>;
  if (w.error) return <Frame bad><h1>Nie udało się otworzyć płatności</h1><p>Spróbuj za chwilę albo napisz do nas: <b>infinitiq@fastline.pl</b>.</p></Frame>;
  return (
    <Frame>
      <div className="ord-cap">{w.kind === 'order' ? 'Płatność kartą' : `Faktura ${w.number}`}</div>
      <h1>Do zapłaty {money(w.amount)}</h1>
      <p>Karta zostanie zapamiętana przez bank do automatycznego odnowienia abonamentu co miesiąc. Anulujesz w panelu w każdej chwili.</p>
      <div id="imoje-widget__wrapper" className="ord-widget"></div>
      <p className="ord-small">Płatność obsługuje ING Pay (ING Bank Śląski). Nie widzimy ani nie zapisujemy danych Twojej karty.</p>
    </Frame>
  );
}

export default function Order({ mode }) {
  useEffect(() => {
    document.title = mode === 'pay' ? 'Płatność — Fastline InfinitiQ' : mode === 'test' ? 'Bramka testowa' : mode === 'invoice' ? 'Faktura — Fastline InfinitiQ' : 'Dziękujemy — Fastline InfinitiQ';
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
    return () => m.remove();
  }, [mode]);
  if (mode === 'pay') return <PayInvoice />;
  if (mode === 'test') return <TestGateway />;
  if (mode === 'invoice') return <InvoiceView />;
  if (mode === 'card') return <CardPay />;
  return <ThankYou />;
}
