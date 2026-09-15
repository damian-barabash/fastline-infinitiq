import React, { useEffect, useState } from 'react';

/* Firmowy komunikat o cookies — pokazywany RAZ, potwierdzenie w localStorage.
   Strona nie stawia cookies śledzących (patrz /polityka-cookies), więc to informacja,
   nie zgoda: jeden przycisk „Rozumiem". Montowany w App poza stronami narzędziowymi
   (edytor, logowanie, audyt, katalog). Styl inline — komunikat żyje na każdej stronie,
   a arkusze są per-page. Cursor: `.ck-btn` jest na liście ACID silników (czarny kursor). */

const KEY = 'fiq_cookie_ack';
const CSS = `
  .ck { position: fixed; left: 20px; bottom: 20px; z-index: 1200; width: min(420px, calc(100vw - 40px));
    background: rgba(16,17,13,0.94); color: #F5F5F0; border: 1px solid rgba(184,255,0,0.28);
    box-shadow: 0 18px 50px rgba(0,0,0,0.55); padding: 20px 22px 18px; font-family: 'Schibsted Grotesk', sans-serif;
    transform: translateY(24px); opacity: 0; transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease; }
  .ck.on { transform: none; opacity: 1; }
  .ck i { position: absolute; width: 12px; height: 12px; border: 0 solid #B8FF00; }
  .ck i:nth-child(1) { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
  .ck i:nth-child(2) { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
  .ck-cap { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase; color: #B8FF00; margin-bottom: 8px; }
  .ck-cap::before { content: ''; display: inline-block; width: 6px; height: 6px; background: #B8FF00; margin-right: 8px; vertical-align: 1px; animation: ckBlink 1.6s steps(2) infinite; }
  @keyframes ckBlink { 50% { opacity: .2; } }
  .ck p { font-size: 13.5px; line-height: 1.55; color: rgba(245,245,240,0.86); margin: 0 0 14px; }
  .ck p a { color: #B8FF00; text-decoration: none; border-bottom: 1px solid rgba(184,255,0,0.4); }
  .ck-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .ck-btn { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase;
    background: #B8FF00; color: #0D0D0D; border: 1px solid #B8FF00; padding: 11px 18px; cursor: pointer; }
  .ck-btn:hover { box-shadow: 0 0 22px rgba(184,255,0,0.45); }
  .ck-more { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: rgba(245,245,240,0.6); text-decoration: none; }
  .ck-more:hover { color: #B8FF00; }
  @media (max-width: 600px) { .ck { left: 12px; right: 12px; bottom: 12px; width: auto; padding: 16px 16px 14px; } .ck p { font-size: 13px; } }
`;

export function cookieAcknowledged() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // brak dostępu do localStorage (tryb prywatny) — nie męczymy komunikatem przy każdym wejściu
  }
}

export default function CookieNotice() {
  const [show, setShow] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (cookieAcknowledged()) return undefined;
    let t;
    // na stronie głównej najpierw schodzi preloader (#fiqLoader) — komunikat wjeżdża dopiero po nim,
    // inaczej wyskakiwałby pod siatką ładowania i klik trafiałby w overlay
    const arm = () => {
      if (document.getElementById('fiqLoader')) { t = setTimeout(arm, 200); return; }
      setShow(true);
      t = setTimeout(() => setOn(true), 700);
    };
    arm();
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;
  const accept = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch { /* prywatny tryb — po prostu chowamy */ }
    setOn(false);
    setTimeout(() => setShow(false), 400);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`ck${on ? ' on' : ''}`} role="dialog" aria-live="polite" aria-label="Informacja o cookies" data-cookie-notice>
        <i></i><i></i>
        <div className="ck-cap">Cookies</div>
        <p>
          Ta strona nie używa cookies śledzących ani reklamowych. W przeglądarce zapisujemy tylko to, że widziałeś ten komunikat.
          Szczegóły w <a href="/polityka-cookies" data-wipe>Polityce cookies</a>.
        </p>
        <div className="ck-row">
          <button type="button" className="ck-btn" onClick={accept} data-cookie-ok>Rozumiem</button>
          <a className="ck-more" href="/polityka-prywatnosci" data-wipe>Polityka prywatności</a>
        </div>
      </div>
    </>
  );
}
