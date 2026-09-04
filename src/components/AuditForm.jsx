// Форма «darmowy audyt» в финальной секции лендинга (06 — Zacznij).
// Три шага ровно в том порядке, в каком их проходит человек:
//   01 e-mail → 02 adres strony (проверяется по-настоящему, edge открывает страницу)
//   → 03 kod 4-cyfrowy из письма → запуск генерации аудита.
// Бэкенд — edge-функция `audyt-lead` (Resend + очередь audit-run).
//
// В редакторе (html.mode-flat) форма живая визуально, но в сеть не ходит —
// иначе правка контента заводила бы реальные заявки.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SB_URL, SB_KEY } from '../lib/supabase-config.js';

const FN = `${SB_URL}/functions/v1/audyt-lead`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const LOOKS_LIKE_SITE = /^(https?:\/\/)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/.*)?$/i;

async function call(action, payload) {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    body: JSON.stringify({ action, ...payload }),
  });
  return await r.json().catch(() => ({ ok: false, reason: 'Brak odpowiedzi serwera' }));
}

const isEditor = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('mode-flat');

export default function AuditForm() {
  const [step, setStep] = useState(1);          // 1 mail · 2 strona · 3 kod · 4 gotowe
  const [email, setEmail] = useState('');
  const [site, setSite] = useState('');
  const [siteState, setSiteState] = useState({ s: 'idle' }); // idle|checking|ok|bad
  const [code, setCode] = useState(['', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lead, setLead] = useState(null);        // { id, host }
  const [again, setAgain] = useState(0);         // сек. до повторной отправки кода
  const [done, setDone] = useState(null);        // { status, slug }

  const siteRef = useRef(null);
  const codeRefs = useRef([]);
  const checkSeq = useRef(0);

  // ── шаг 1: e-mail ────────────────────────────────────────────────────────
  function submitEmail(e) {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) { setErr('Wpisz poprawny adres e-mail — na niego wyślemy raport.'); return; }
    setErr(''); setStep(2);
    setTimeout(() => siteRef.current && siteRef.current.focus(), 60);
  }

  // ── шаг 2: адрес страницы, проверяется сразу при вводе ───────────────────
  const checkSite = useCallback(async (value) => {
    const v = String(value || '').trim();
    if (!LOOKS_LIKE_SITE.test(v)) { setSiteState({ s: 'idle' }); return; }
    if (isEditor()) { setSiteState({ s: 'ok', host: v, title: '' }); return; }
    const seq = ++checkSeq.current;
    setSiteState({ s: 'checking' });
    const d = await call('site.check', { site: v });
    if (seq !== checkSeq.current) return;         // ответ от устаревшего запроса
    setSiteState(d.ok ? { s: 'ok', host: d.host, title: d.title } : { s: 'bad', reason: d.reason });
  }, []);

  useEffect(() => {
    if (step !== 2) return undefined;
    const v = site.trim();
    if (!v) { setSiteState({ s: 'idle' }); return undefined; }
    const t = setTimeout(() => checkSite(v), 650);
    return () => clearTimeout(t);
  }, [site, step, checkSite]);

  async function submitSite(e) {
    e.preventDefault();
    if (busy) return;
    if (!LOOKS_LIKE_SITE.test(site.trim())) { setErr('Wpisz adres strony, np. moja-firma.pl'); return; }
    if (siteState.s === 'bad') { setErr(siteState.reason || 'Tej strony nie udało się otworzyć.'); return; }
    setErr('');
    if (isEditor()) { setStep(3); return; }
    setBusy(true);
    const d = await call('code.send', { email: email.trim(), site: site.trim() });
    setBusy(false);
    if (!d.ok) {
      if (d.field === 'site') setSiteState({ s: 'bad', reason: d.reason });
      setErr(d.reason || 'Nie udało się wysłać kodu.');
      return;
    }
    setLead({ id: d.lead_id, host: d.host });
    setCode(['', '', '', '']);
    setStep(3);
    setAgain(60);
    setTimeout(() => codeRefs.current[0] && codeRefs.current[0].focus(), 80);
  }

  // ── шаг 3: код ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (again <= 0) return undefined;
    const t = setTimeout(() => setAgain((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [again]);

  function setDigit(i, raw) {
    const v = String(raw).replace(/\D/g, '');
    if (!v) { setCode((c) => c.map((d, j) => (j === i ? '' : d))); return; }
    setErr('');
    if (v.length > 1) {                            // вставка всего кода целиком
      const arr = ['', '', '', ''];
      v.slice(0, 4).split('').forEach((d, j) => { arr[j] = d; });
      setCode(arr);
      const last = Math.min(v.length, 4) - 1;
      if (codeRefs.current[last]) codeRefs.current[last].focus();
      if (v.length >= 4) verify(arr.join(''));
      return;
    }
    const next = code.map((d, j) => (j === i ? v : d));
    setCode(next);
    if (i < 3 && codeRefs.current[i + 1]) codeRefs.current[i + 1].focus();
    if (next.every(Boolean)) verify(next.join(''));
  }

  function codeKey(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0 && codeRefs.current[i - 1]) {
      e.preventDefault();
      setCode((c) => c.map((d, j) => (j === i - 1 ? '' : d)));
      codeRefs.current[i - 1].focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) codeRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 3) codeRefs.current[i + 1]?.focus();
  }

  async function verify(value) {
    if (busy) return;
    const c = String(value ?? code.join(''));
    if (c.length !== 4) { setErr('Wpisz cały 4-cyfrowy kod.'); return; }
    if (isEditor()) { setDone({ status: 'ready', slug: 'demo' }); setStep(4); return; }
    setBusy(true); setErr('');
    const d = await call('code.verify', { lead_id: lead?.id, code: c });
    setBusy(false);
    if (!d.ok) {
      setErr(d.reason || 'Kod się nie zgadza.');
      setCode(['', '', '', '']);
      if (d.expired) { setAgain(0); }
      setTimeout(() => codeRefs.current[0] && codeRefs.current[0].focus(), 40);
      return;
    }
    setDone({ status: d.status, slug: d.slug });
    setStep(4);
  }

  async function resend() {
    if (again > 0 || busy || isEditor()) return;
    setBusy(true); setErr('');
    const d = await call('code.send', { email: email.trim(), site: site.trim() });
    setBusy(false);
    if (!d.ok) { setErr(d.reason || 'Nie udało się wysłać kodu.'); return; }
    setLead({ id: d.lead_id, host: d.host });
    setCode(['', '', '', '']);
    setAgain(60);
    codeRefs.current[0]?.focus();
  }

  // ── шаг 4: ждём готовности отчёта ────────────────────────────────────────
  useEffect(() => {
    if (step !== 4 || !lead?.id || done?.status === 'ready' || isEditor()) return undefined;
    let alive = true;
    const t = setInterval(async () => {
      const d = await call('status', { lead_id: lead.id });
      if (!alive || !d.ok) return;
      setDone({ status: d.status, slug: d.slug });
      if (d.status === 'ready' || d.status === 'error') clearInterval(t);
    }, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [step, lead, done?.status]);

  const stepNames = ['E-mail', 'Strona', 'Kod'];

  return (
    <div className="af" data-af>
      {/* канвас «настоящего фроста»: рисует движок (frostCollect ищет .frost-c
          первым ребёнком). Держим его в React-разметке, а не даём движку
          вставлять свой — иначе чужой узел в контейнере, который React перерисовывает. */}
      <canvas className="frost-c" aria-hidden="true" />
      <div className="af-steps" aria-hidden="true">
        {stepNames.map((n, i) => (
          <div key={n} className={`af-step${step > i + 1 ? ' done' : ''}${step === i + 1 ? ' on' : ''}`}>
            <span className="af-step-n">{String(i + 1).padStart(2, '0')}</span>
            <span className="af-step-t">{n}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <form className="af-body" onSubmit={submitEmail} noValidate>
          <label className="af-lab" htmlFor="af-email">Twój adres e-mail</label>
          <div className="af-row">
            <input
              id="af-email" className="af-input" type="email" inputMode="email" autoComplete="email"
              placeholder="imie@twojafirma.pl" value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(''); }}
            />
            <button className="af-btn" type="submit">Dalej →</button>
          </div>
          <p className="af-hint">Na ten adres wyślemy link do gotowego audytu. Bez newslettera.</p>
        </form>
      )}

      {step === 2 && (
        <form className="af-body" onSubmit={submitSite} noValidate>
          <label className="af-lab" htmlFor="af-site">Adres strony Waszej firmy</label>
          <div className="af-row">
            <input
              id="af-site" className={`af-input${siteState.s === 'bad' ? ' bad' : ''}${siteState.s === 'ok' ? ' good' : ''}`}
              type="text" inputMode="url" autoComplete="url" spellCheck="false"
              placeholder="moja-firma.pl" value={site} ref={siteRef}
              onChange={(e) => { setSite(e.target.value); setErr(''); }}
            />
            <button className="af-btn" type="submit" disabled={busy || siteState.s === 'checking' || siteState.s === 'bad'}>
              {busy ? 'Wysyłam…' : 'Wyślij kod →'}
            </button>
          </div>
          <p className={`af-probe s-${siteState.s}`} aria-live="polite">
            {siteState.s === 'checking' && <><i className="af-dot" />Sprawdzam, czy strona odpowiada…</>}
            {siteState.s === 'ok' && <><i className="af-ok" />Strona działa{siteState.title ? ` — „${siteState.title}”` : ''}</>}
            {siteState.s === 'bad' && <><i className="af-no" />{siteState.reason}</>}
            {siteState.s === 'idle' && 'Sprawdzimy ją od razu — zanim wyślemy kod.'}
          </p>
          <button type="button" className="af-back" onClick={() => { setStep(1); setErr(''); }}>← zmień e-mail</button>
        </form>
      )}

      {step === 3 && (
        <div className="af-body">
          <label className="af-lab">Kod z wiadomości na {email}</label>
          <div className="af-code" onPaste={(e) => {
            const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
            if (t) { e.preventDefault(); setDigit(0, t); }
          }}>
            {code.map((d, i) => (
              <input
                key={i} ref={(el) => { codeRefs.current[i] = el; }}
                className={`af-cell${d ? ' filled' : ''}`} type="text" inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={4} value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => codeKey(i, e)}
                aria-label={`Cyfra ${i + 1}`}
              />
            ))}
          </div>
          <div className="af-row af-row-c">
            <button className="af-btn" type="button" onClick={() => verify()} disabled={busy}>
              {busy ? 'Sprawdzam…' : 'Uruchom audyt →'}
            </button>
          </div>
          <p className="af-hint">
            {again > 0
              ? `Nie ma maila? Sprawdź spam. Nowy kod za ${again} s.`
              : <>Nie ma maila? <button type="button" className="af-link" onClick={resend}>Wyślij kod ponownie</button></>}
          </p>
          <button type="button" className="af-back" onClick={() => { setStep(2); setErr(''); }}>← zmień adres strony</button>
        </div>
      )}

      {step === 4 && (
        <div className="af-body af-done">
          {done?.status === 'ready' ? (
            <>
              <div className="af-done-h"><i className="af-ok big" />Audyt jest gotowy</div>
              <p className="af-hint">Link poszedł też na {email} — możesz wrócić do niego później.</p>
              <a className="af-btn af-btn-a" href={`/audyt/${done.slug}`}>Otwórz swój audyt →</a>
            </>
          ) : done?.status === 'error' ? (
            <>
              <div className="af-done-h">Zajmiemy się tym ręcznie</div>
              <p className="af-hint">Automat nie domknął analizy tej strony. Odezwiemy się z raportem w ciągu 24 h roboczych.</p>
            </>
          ) : (
            <>
              <div className="af-done-h"><span className="af-pulse" />Analizujemy {lead?.host || site}</div>
              <div className="af-prog"><span /></div>
              <p className="af-hint">
                To trwa kilka minut: czytamy stronę i podstrony, mierzymy technikę, szukamy konkurencji
                i dobieramy plan. <strong>Raport przyjdzie na {email}</strong> — możesz spokojnie zamknąć tę stronę.
              </p>
            </>
          )}
        </div>
      )}

      {err && <p className="af-err" role="alert">{err}</p>}
    </div>
  );
}
