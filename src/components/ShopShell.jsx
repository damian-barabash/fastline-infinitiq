import React from 'react';
import ProductIcon from './productIcons.jsx';
import { productHref } from '../engine/heroProducts.js';

/* Witryna /shop — wszystkie aktywne produkty katalogu z cenami „od".
   Sprzedaż jeszcze nie ruszyła: każda karta jest wyszarzona, a przycisk
   zakupu nieaktywny („Wkrótce w sprzedaży").
   Rama jak na /kontakt i dokumentach prawnych (burger, logo z claimem, siatka).
   Grupy mają `data-msec`, więc menu pod burgerem buduje z nich spis sekcji. */

const fmt = (n) => String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function ShopShell({ groups, state }) {
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
              <a className="menu-link" href="/ai-doradca" data-wipe><span className="menu-num">→</span><span>AI Doradca</span></a>
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

      <main className="shop">
        <header className="shop-head" data-msec="Sklep">
          <div className="section-label in in1">Sklep</div>
          <h1 className="in in1">Wszystkie produkty AI</h1>
          <p className="lead in in2">
            Pełna oferta Fastline InfinitiQ w jednym miejscu. Sprzedaż online ruszy wkrótce,
            na razie każdy produkt uruchamiamy po krótkiej rozmowie.
          </p>
          <p className="shop-note in in2">Ceny netto · wdrożenie jednorazowo · abonament miesięcznie</p>
        </header>

        {state === 'error' && (
          <p className="shop-empty">Nie udało się wczytać listy produktów. Odśwież stronę za chwilę.</p>
        )}

        {state === 'loading' && (
          <div className="shop-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => <div className="shop-card skel" key={i}></div>)}
          </div>
        )}

        {groups.map((g) => (
          <section className="shop-group" key={g.key} data-msec={g.name}>
            <h2 className="shop-gname"><span className="shop-gletter">{g.key.toUpperCase()}</span>{g.name}</h2>
            <div className="shop-grid">
              {g.items.map((p) => {
                const href = productHref(p.name);
                const priced = p.impl_from != null || p.sub_from != null;
                return (
                  <article className="shop-card off" key={p.id} aria-disabled="true">
                    <div className="shop-top">
                      <span className="shop-ic"><ProductIcon id={p.id} name={p.name} /></span>
                      <span className="shop-badge">Niedostępny</span>
                    </div>
                    <h3>{p.name}</h3>
                    <p className="shop-desc">{p.descr}</p>
                    <dl className="shop-price">
                      {priced ? (
                        <>
                          {p.sub_from != null && (
                            <div><dt>Abonament</dt><dd><small>od</small> {fmt(p.sub_from)} zł<small> / mies.</small></dd></div>
                          )}
                          {p.impl_from != null && (
                            <div><dt>Wdrożenie</dt><dd><small>od</small> {fmt(p.impl_from)} zł</dd></div>
                          )}
                        </>
                      ) : (
                        <div><dt>Cena</dt><dd className="shop-ask">wycena indywidualna</dd></div>
                      )}
                    </dl>
                    <button className="shop-buy" type="button" disabled>Wkrótce w sprzedaży</button>
                    {href && <a className="shop-more" href={href} data-wipe>Więcej o produkcie →</a>}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <div className="shop-cta in in2">
          <p>Chcesz uruchomić produkt już teraz?</p>
          <a className="btn-primary" href="/kontakt" data-wipe>Umów briefing</a>
        </div>
      </main>

      <footer>
        <p>© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
        <p>Data driven. Mind created. <span style={{ color: 'var(--green)' }}>AI executed.</span></p>
      </footer>
    </>
  );
}
