import React from 'react';
import { LEGAL_LINKS } from '../content/legal.js';

/* Strona dokumentu prawnego — ta sama rama co /kontakt (nagłówek z burgerem, logo
   z claimem, CTA na audyt, siatka #neural), treść z `src/content/legal.js`.
   Bez CMS: dokumenty są statyczne i pełne w SSG (Meta/Google czytają je bez JS).
   Sekcje mają `data-msec`, więc menu pod burgerem buduje z nich spis treści. */

export default function LegalShell({ doc, slug }) {
  return (
    <>
      <canvas id="neural"></canvas>
      <div className="cursor-dot" id="cursorDot"></div>
      <div className="cursor-ring" id="cursorRing"></div>

      <div className="menu-overlay" id="fiqMenu" hidden>
        <div className="menu-inner">
          <div className="menu-col">
            <div className="menu-cap">{'// sekcje'}</div>
            <div className="menu-list" id="menuSections"></div>
          </div>
          <div className="menu-col">
            <div className="menu-cap">{'// produkty'}</div>
            <div className="menu-list" id="menuProducts">
              <a className="menu-link" href="/agenci-ai" data-wipe><span className="menu-num">→</span><span>Agenci AI</span></a>
            </div>
            <a className="menu-cta" href="/#audyt" data-wipe>Darmowy audyt AI</a>
          </div>
        </div>
      </div>

      <nav>
        <div className="nav-left">
          <button className="menu-btn" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false">
            <i></i><i></i><i></i>
          </button>
          <a href="/" data-wipe className="nav-back">
            <span className="nb-full">Strona główna</span>
            <span className="nb-short">Główna</span>
          </a>
        </div>
        <div className="nav-brand">
          <a className="nav-logo" href="/" data-wipe aria-label="Fastline InfinitiQ">
            <img src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" />
          </a>
          <div className="nav-claim" id="heroClaim">
            <span className="hc-word">Data driven.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word">Mind created.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word">Unique executed.</span>
          </div>
        </div>
        <a href="/#audyt" data-wipe className="nav-cta">
          <span className="cta-full">Darmowy audyt AI</span>
          <span className="cta-short">{'Audyt\ndla Ciebie'}</span>
        </a>
      </nav>

      <main className="legal">
        <article className="legal-doc">
          <header className="legal-head" data-msec={doc.title}>
            <div className="section-label in in1">{doc.label}</div>
            <h1 className="in in1">{doc.title}</h1>
            <p className="lead in in2">{doc.lead}</p>
            <p className="legal-meta in in2">Obowiązuje od {doc.updated}</p>
          </header>

          {doc.sections.map((s, i) => (
            <section className="legal-sec in in2" key={i} data-msec={s.h} id={`s${i + 1}`}>
              <h2><span className="legal-num">{String(i + 1).padStart(2, '0')}</span>{s.h}</h2>
              {s.p.map((t, j) => <p key={j}>{linkify(t)}</p>)}
            </section>
          ))}

          <div className="legal-links in in2" role="navigation" aria-label="Dokumenty">
            {LEGAL_LINKS.map(([href, name]) => (
              <a key={href} href={href} data-wipe className={href === `/${slug}` ? 'on' : ''}>{name}</a>
            ))}
          </div>
        </article>
      </main>

      <footer>
        <p>© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
        <p>Data driven. Mind created. <span style={{ color: 'var(--green)' }}>AI executed.</span></p>
      </footer>
    </>
  );
}

// adresy „/usuwanie-danych", e-maile i domeny w tekście → linki (tekst jest nasz, nie z zewnątrz)
function linkify(text) {
  const re = /(\/[a-z-]+(?=[\s.,)]|$)|[\w.+-]+@[\w-]+\.[\w.]+|ec\.europa\.eu\/[\w/]+)/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const v = m[0];
    if (v.startsWith('/')) out.push(<a key={m.index} href={v} data-wipe>{v}</a>);
    else if (v.includes('@')) out.push(<a key={m.index} href={`mailto:${v}`}>{v}</a>);
    else out.push(<a key={m.index} href={`https://${v}`} target="_blank" rel="noopener">{v}</a>);
    last = m.index + v.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
