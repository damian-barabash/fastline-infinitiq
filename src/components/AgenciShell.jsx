import React from 'react';
import {
  IcMessenger, IcInstagram, IcWhatsapp, IcPhone, IcCalendar, IcDoc,
  IcGlobe, IcSpark, IcCheck, IcArrow, IcUsers, IcClock, IcDotArrow,
} from './agentIcons.jsx';

/* Разметка страницы /agenci-ai — как LandingShell для главной: один и тот же
   DOM рендерят страница (3D-барабан слайдов) и редактор (mode-flat).
   Тексты — 1:1 z makiety właściciela (FQ_Agenci_LP_zbiorcza.pdf); własne są
   tylko sceny „w praktyce" (kanały, rozmowa, widget, asystent).
   Wszystkie teksty mają `data-edit` z prefiksem `ag_` i siedzą w wierszu
   `site_content` o id `agenci-ai`. */

export default function AgenciShell() {
  return (
    <>
      <canvas id="neural"></canvas>
      <div className="cursor-dot" id="cursorDot"></div>
      <div className="cursor-ring" id="cursorRing"></div>

      {/* Pełnoekranowe menu spod burgera (burger siedzi w nav) */}
      <div className="menu-overlay" id="fiqMenu" hidden>
        <div className="menu-inner">
          <div className="menu-col">
            <div className="menu-cap">{'// sekcje'}</div>
            <div className="menu-list" id="menuSections"></div>
          </div>
          <div className="menu-col">
            <div className="menu-cap">{'// produkty'}</div>
            {/* lista z katalogu (`landing_products`): produkt ze swoją stroną jest
                linkiem, pozostałe stoją na szaro — widać całą ofertę i to, co gotowe */}
            <div className="menu-list" id="menuProducts">
              <a className="menu-link" href="/agenci-ai" data-wipe><span className="menu-num">→</span><span>Agenci AI</span></a>
            </div>
            <a className="menu-cta" href="/#audyt" data-wipe>Darmowy audyt AI</a>
          </div>
        </div>
      </div>

      {/* NAV — как на главной: лого с клеймом по центру, CTA na audyt po prawej,
          po lewej powrót do wszystkich produktów */}
      <nav>
        <div className="nav-left">
        <button className="menu-btn" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false">
          <i></i><i></i><i></i>
        </button>
          <a href="/" data-wipe className="nav-back"><span className="nb-full" data-edit="ag_nav_back">Wszystkie produkty</span><span className="nb-short" data-edit="ag_nav_back_short">Produkty</span></a>
        </div>
        <div className="nav-brand">
          <a className="nav-logo" href="/" data-wipe aria-label="Fastline InfinitiQ">
            <img src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" data-edit="ag_nav_logo" data-edit-type="image" />
          </a>
          <div className="nav-claim" id="heroClaim">
            <span className="hc-word" data-edit="ag_claim_1">Data driven.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word" data-edit="ag_claim_2">Mind created.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word" data-edit="ag_claim_3">Unique executed.</span>
          </div>
        </div>
        <a href="/#audyt" data-wipe className="nav-cta"><span className="cta-full" data-edit="ag_nav_cta">Darmowy audyt AI</span><span className="cta-short" data-edit="ag_nav_cta_short">Audyt</span></a>
      </nav>

      {/* PROGRESS RAIL */}
      <div className="rail" id="rail" role="navigation" aria-label="Sekcje">
        <button className="rail-item" data-i="0"><span className="rail-name">Start</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="1"><span className="rail-name">W praktyce</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="2"><span className="rail-name">Co się zmienia</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="3"><span className="rail-name">Jak to działa</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="4"><span className="rail-name">Koszt</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="5"><span className="rail-name">Pytania</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="6"><span className="rail-name">Kontakt</span><span className="rail-tick"></span></button>
      </div>

      <div className="counter" id="counter"><span className="cur">01</span><span>/ 07</span></div>
      <div className="scroll-hint" id="scrollHint">Scroll</div>

      <div id="track"></div>

      <div id="stage">
        <div id="drum">

          {/* ===== 0 / HERO ===== */}
          <section className="slide" id="start">
            <div className="slide-inner ag-wrap">
              <div className="section-label rv rv1" data-edit="ag_label">Agenci AI · online 24/7</div>
              <h1 className="ag-h1 rv rv1" data-edit="ag_h1" data-edit-type="html">Zespół, który pracuje, kiedy Ty śpisz.</h1>
              <p className="ag-lead rv rv2" data-edit="ag_lead" data-edit-type="html">
                Stawiamy agentów AI, którzy odbierają telefon, odpisują na zapytania, doradzają klientowi
                i trzymają wiedzę firmy w jednym miejscu. Wybierz jednego albo zbuduj cały zespół —
                wytrenowany na Twojej ofercie, procesach i języku marki. Bez rekrutacji, bez drugiej zmiany,
                bez rotacji.
              </p>

              <div className="ag-actions rv rv3">
                <a href="/kontakt" data-wipe className="btn-primary" data-edit="ag_cta">Wypróbuj agenta sam</a>
                <a href="/kontakt" data-wipe className="btn-ghost" data-edit="ag_cta2" data-edit-type="html">Lub zostaw dane kontaktowe,<br />a my skontaktujemy się z Tobą</a>
              </div>

              {/* karty agentów siedzą w tej samej grani co hero — właściciel chce
                  je zobaczyć od razu, bez osobnego nagłówka „poznaj zespół" */}
              <div className="team-grid rv rv3" id="teamGrid">

                <article className="team-card" tabIndex={0} data-team="1" data-hideable="agent:sprzedawca" data-hide-label="Agent — Sprzedawca">
                  <div className="tm-visual">
                    <canvas className="tm-canvas" aria-hidden="true"></canvas>
                    <img className="tm-photo" src="/assets/team/kacper.webp" alt="AI Sprzedawca — Fastline InfinitiQ" data-edit="ag_a1_photo" data-edit-type="image" />
                    <span className="tm-frame" aria-hidden="true"></span>
                    <span className="tm-badge" data-edit="ag_a1_tag">● pierwsza linia</span>
                  </div>
                  <div className="tm-body">
                    <div className="ag-role" data-edit="ag_a1_role" data-edit-type="html">Agent sprzedaży —<br />zapytania i spotkania</div>
                    <h3 data-edit="ag_a1_name">AI Sprzedawca</h3>
                    <p data-edit="ag_a1_desc" data-edit-type="html">
                      Na bieżąco kontaktuje sie z leadami. Kwalifikuje, odpowiada z Twojego cennika
                      i wpisuje spotkanie do kalendarza. Żaden lead nie czeka do rana.
                    </p>
                    <div className="ag-chan" data-edit="ag_a1_chan">mail · whatsapp · kalendarz</div>
                  </div>
                </article>

                <article className="team-card" tabIndex={0} data-team="2" data-hideable="agent:doradca" data-hide-label="Agent — Doradca">
                  <div className="tm-visual">
                    <canvas className="tm-canvas" aria-hidden="true"></canvas>
                    <img className="tm-photo" src="/assets/team/maja.webp" alt="AI Doradca — Fastline InfinitiQ" data-edit="ag_a2_photo" data-edit-type="image" />
                    <span className="tm-frame" aria-hidden="true"></span>
                    <span className="tm-badge" data-edit="ag_a2_tag">● doradztwo</span>
                  </div>
                  <div className="tm-body">
                    <div className="ag-role" data-edit="ag_a2_role" data-edit-type="html">Doradca klienta —<br />wybór i oferta</div>
                    <h3 data-edit="ag_a2_name">AI Doradca</h3>
                    <p data-edit="ag_a2_desc" data-edit-type="html">
                      Pracuje na stronie, tam gdzie klient się waha. Identyfikuje faktyczną potrzebę klienta
                      i wskazuje jedno rozwiązanie z uzasadnieniem. Handlowiec dostaje gotowy kontekst.
                    </p>
                    <div className="ag-chan" data-edit="ag_a2_chan">strona · rekomendacja · lead</div>
                  </div>
                </article>

                <article className="team-card" tabIndex={0} data-team="3" data-hideable="agent:recepcja" data-hide-label="Agent — Recepcjonistka">
                  <div className="tm-visual">
                    <canvas className="tm-canvas" aria-hidden="true"></canvas>
                    <img className="tm-photo" src="/assets/team/adam.webp" alt="AI Recepcjonistka — Fastline InfinitiQ" data-edit="ag_a3_photo" data-edit-type="image" />
                    <span className="tm-frame" aria-hidden="true"></span>
                    <span className="tm-badge" data-edit="ag_a3_tag">● online 24/7</span>
                  </div>
                  <div className="tm-body">
                    <div className="ag-role" data-edit="ag_a3_role" data-edit-type="html">Recepcja telefoniczna —<br />połączenia i terminy</div>
                    <h3 data-edit="ag_a3_name">AI Recepcjonistka</h3>
                    <p data-edit="ag_a3_desc" data-edit-type="html">
                      Odbiera telefon zawsze, nawet wtedy kiedy byś nie mógł. Informuje o godzinach i cenach,
                      umawia wizyty, przekazuje tylko sprawy wymagające indywidualnego podejścia.
                    </p>
                    <div className="ag-chan" data-edit="ag_a3_chan">telefon · zapisy · kalendarz</div>
                  </div>
                </article>

                <article className="team-card" tabIndex={0} data-team="4" data-hideable="agent:asystent" data-hide-label="Agent — Asystent">
                  <div className="tm-visual">
                    <canvas className="tm-canvas" aria-hidden="true"></canvas>
                    <img className="tm-photo" src="/assets/team/natalia.webp" alt="AI Asystent — Fastline InfinitiQ" data-edit="ag_a4_photo" data-edit-type="image" />
                    <span className="tm-frame" aria-hidden="true"></span>
                    <span className="tm-badge" data-edit="ag_a4_tag">● wsparcie zespołu</span>
                  </div>
                  <div className="tm-body">
                    <div className="ag-role" data-edit="ag_a4_role" data-edit-type="html">Asystent wewnętrzny —<br />wiedza i dokumenty</div>
                    <h3 data-edit="ag_a4_name">AI Asystent</h3>
                    <p data-edit="ag_a4_desc" data-edit-type="html">
                      Ma dostęp do przekazanej wiedzy o firmie, zna ofertę, cenniki i procedury.
                      Odpowiada zespołowi na każde pytanie operacyjne w kilka sekund ze wskazaniem źródła.
                    </p>
                    <div className="ag-chan" data-edit="ag_a4_chan">wiedza · onboarding</div>
                  </div>
                </article>

              </div>
            </div>
          </section>

          {/* ===== 2 / W PRAKTYCE — sceny pracy agentów (poza makietą) ===== */}
          <section className="slide" id="praktyka" data-hideable="sec:praktyka" data-hide-label="Sekcja — W praktyce">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ag_p_label">{'// w praktyce'}</div>
                <h2 data-edit="ag_p_h2" data-edit-type="html">Tak wygląda ich praca</h2>
                <p className="sec-lead" data-edit="ag_p_lead" data-edit-type="html">
                  Podgląd rozmów: kanały klienta, telefon, strona i czat zespołu — na żywo, w Twoim tonie.
                </p>
              </div>

              <div className="dm-grid rv rv2">

                {/* --- kanały: Messenger / Instagram / WhatsApp --- */}
                <div className="dm-cell" data-hideable="dm:chat" data-hide-label="Scena — kanały klienta">
                  <div className="dm-cap" data-edit="ag_d1_cap">AI Sprzedawca · kanały klienta</div>
                  <div className="ag-demo dm" data-demo="chat">
                    <div className="dm-bar">
                      <span className="dm-live"><i></i><span data-edit="ag_d1_live">agent odpisuje</span></span>
                      <span className="dm-tabs">
                        <b className="dm-tab on" data-ch="fb"><IcMessenger /><span data-edit="ag_d1_tab1">Messenger</span></b>
                        <b className="dm-tab" data-ch="ig"><IcInstagram /><span data-edit="ag_d1_tab2">Instagram</span></b>
                        <b className="dm-tab" data-ch="wa"><IcWhatsapp /><span data-edit="ag_d1_tab3">WhatsApp</span></b>
                      </span>
                    </div>

                    <div className="dm-screen">
                      <div className="dm-ch on" data-ch="fb">
                        <div className="im-head">
                          <span className="im-av" aria-hidden="true"></span>
                          <span className="im-who"><b data-edit="ag_d1_fb_name">Twoja Firma</b><i data-edit="ag_d1_fb_state">Firma · aktywny teraz</i></span>
                          <span className="im-app">Messenger</span>
                        </div>
                        <div className="msg in" data-s="1"><span data-edit="ag_d1_fb1">Dzień dobry, robicie wycenę dla firmy? Ile to trwa?</span><i data-edit="ag_d1_fb1t">22:41</i></div>
                        <div className="msg typing" data-s="2"><span className="dots"><i></i><i></i><i></i></span></div>
                        <div className="msg out" data-s="3"><span data-edit="ag_d1_fb2">Dobry wieczór! Tak — wycena wraca w 24 h. Potrzebuję metrażu i terminu. Mam wolny wtorek 10:30 na krótkie omówienie.</span><i data-edit="ag_d1_fb2t">22:41</i></div>
                        <div className="msg in" data-s="4"><span data-edit="ag_d1_fb3">Wtorek pasuje.</span><i data-edit="ag_d1_fb3t">22:42</i></div>
                        <div className="dm-chip" data-s="5"><IcCalendar /><span data-edit="ag_d1_fbchip">Spotkanie wt. 10:30 — dodane do kalendarza</span></div>
                      </div>

                      <div className="dm-ch" data-ch="ig">
                        <div className="im-head">
                          <span className="im-av" aria-hidden="true"></span>
                          <span className="im-who"><b data-edit="ag_d1_ig_name">Twoja Firma</b><i data-edit="ag_d1_ig_state">Direct · widziane</i></span>
                          <span className="im-app">Instagram</span>
                        </div>
                        <div className="msg in" data-s="1"><span data-edit="ag_d1_ig1">Hej! Widziałam realizację na profilu — robicie takie u klienta?</span><i data-edit="ag_d1_ig1t">23:12</i></div>
                        <div className="msg typing" data-s="2"><span className="dots"><i></i><i></i><i></i></span></div>
                        <div className="msg out" data-s="3"><span data-edit="ag_d1_ig2">Cześć! Tak, to nasz standardowy zakres. Podeślę dwa warianty z cenami — na jaki metraż liczymy?</span><i data-edit="ag_d1_ig2t">23:12</i></div>
                        <div className="msg in" data-s="4"><span data-edit="ag_d1_ig3">Około 80 m².</span><i data-edit="ag_d1_ig3t">23:13</i></div>
                        <div className="dm-chip" data-s="5"><IcDoc /><span data-edit="ag_d1_igchip">Oferta wysłana · lead w CRM</span></div>
                      </div>

                      <div className="dm-ch" data-ch="wa">
                        <div className="im-head">
                          <span className="im-av" aria-hidden="true"></span>
                          <span className="im-who"><b data-edit="ag_d1_wa_name">Twoja Firma</b><i data-edit="ag_d1_wa_state">online</i></span>
                          <span className="im-app">WhatsApp</span>
                        </div>
                        <div className="msg in" data-s="1"><span data-edit="ag_d1_wa1">Dzień dobry, jesteście dostępni w sobotę?</span><i data-edit="ag_d1_wa1t">07:04</i></div>
                        <div className="msg typing" data-s="2"><span className="dots"><i></i><i></i><i></i></span></div>
                        <div className="msg out" data-s="3"><span data-edit="ag_d1_wa2">Dzień dobry! W soboty pracujemy 9:00–14:00. Zarezerwuję termin — potrzebuję adresu i numeru.</span><i data-edit="ag_d1_wa2t">07:04</i></div>
                        <div className="msg in" data-s="4"><span data-edit="ag_d1_wa3">Świetnie, wysyłam.</span><i data-edit="ag_d1_wa3t">07:05</i></div>
                        <div className="dm-chip" data-s="5"><IcCheck /><span data-edit="ag_d1_wachip">Termin sobota 11:00 — potwierdzony</span></div>
                      </div>
                    </div>

                    <div className="dm-foot"><IcClock /><span data-edit="ag_d1_foot">odpowiedź w 40 sekund · o 22:41, w niedzielę, w urlopie</span></div>
                  </div>
                </div>

                {/* --- widget doradcy na stronie --- */}
                <div className="dm-cell" data-hideable="dm:advisor" data-hide-label="Scena — widget na stronie">
                  <div className="dm-cap" data-edit="ag_d2_cap">AI Doradca · widget na stronie</div>
                  <div className="ag-demo dm" data-demo="advisor">
                    <div className="dm-bar">
                      <span className="dm-url"><IcGlobe /><span data-edit="ag_d2_url">twojafirma.pl/oferta</span></span>
                      <span className="dm-live"><i></i><span data-edit="ag_d2_live">doradca aktywny</span></span>
                    </div>

                    <div className="dm-screen dm-site">
                      <div className="site-skel" aria-hidden="true">
                        <span className="sk sk-h"></span>
                        <span className="sk sk-t"></span>
                        <span className="sk sk-t short"></span>
                        <div className="sk-cards"><span className="sk-card"></span><span className="sk-card"></span><span className="sk-card"></span></div>
                      </div>

                      <div className="adv-widget">
                        <div className="adv-head"><IcSpark /><span data-edit="ag_d2_head">Doradca AI</span></div>
                        <div className="msg in" data-s="1"><span data-edit="ag_d2_m1">Mam trzy warianty i nie wiem, który u nas zadziała.</span></div>
                        <div className="msg typing" data-s="2"><span className="dots"><i></i><i></i><i></i></span></div>
                        <div className="msg out" data-s="3"><span data-edit="ag_d2_m2">Ile zgłoszeń dostajecie w miesiącu i kto je dziś obsługuje?</span></div>
                        <div className="msg in" data-s="4"><span data-edit="ag_d2_m3">Około 200, dwie osoby na zmianę.</span></div>
                        <div className="adv-rec" data-s="5">
                          <b data-edit="ag_d2_rec_h">Rekomendacja: wariant Wzrost</b>
                          <span data-edit="ag_d2_rec_p">Przy 200 zgłoszeniach dwie osoby tracą wieczory. Wzrost przejmuje pierwszy kontakt i zostawia im tylko rozmowy decyzyjne.</span>
                        </div>
                        <div className="dm-chip" data-s="6"><IcUsers /><span data-edit="ag_d2_chip">Lead przekazany handlowcowi z kontekstem rozmowy</span></div>
                      </div>
                    </div>

                    <div className="dm-foot"><IcArrow /><span data-edit="ag_d2_foot">zamiast „skontaktujemy się" — jedna decyzja i konkretny powód</span></div>
                  </div>
                </div>

                {/* --- rozmowa telefoniczna --- */}
                <div className="dm-cell" data-hideable="dm:call" data-hide-label="Scena — telefon">
                  <div className="dm-cap" data-edit="ag_d3_cap">AI Recepcjonistka · telefon</div>
                  <div className="ag-demo dm" data-demo="call">
                    <div className="dm-bar">
                      <span className="dm-live"><i></i><span data-edit="ag_d3_live">połączenie przychodzące</span></span>
                      <span className="dm-timer" data-timer>00:00</span>
                    </div>

                    <div className="dm-screen dm-call">
                      <div className="call-top">
                        <span className="call-avatar"><IcPhone /></span>
                        <div>
                          <b className="call-num" data-edit="ag_d3_num">+48 501 ••• 218</b>
                          <span className="call-state" data-s="1" data-edit="ag_d3_state">odebrane po 1. sygnale · 22:58</span>
                        </div>
                        <span className="call-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
                      </div>

                      <div className="call-log">
                        <div className="line them" data-s="2"><b data-edit="ag_d3_r1">Klient</b><span data-edit="ag_d3_l1">Dzień dobry, czy da się jeszcze zapisać na środę?</span></div>
                        <div className="line ai" data-s="3"><b data-edit="ag_d3_r2">Agent</b><span data-edit="ag_d3_l2">Dzień dobry! Mam wolne 14:00 i 17:30 w środę. Które godziny pasują?</span></div>
                        <div className="line them" data-s="4"><b data-edit="ag_d3_r3">Klient</b><span data-edit="ag_d3_l3">14:00 poproszę. Ile to kosztuje?</span></div>
                        <div className="line ai" data-s="5"><b data-edit="ag_d3_r4">Agent</b><span data-edit="ag_d3_l4">Standardowa wizyta to 180 zł, płatne na miejscu. Zapisuję na środę 14:00 — potwierdzenie SMS-em.</span></div>
                      </div>

                      <div className="dm-chip" data-s="6"><IcCalendar /><span data-edit="ag_d3_chip">Wizyta śr. 14:00 — zapisana, SMS wysłany</span></div>
                    </div>

                    <div className="dm-foot"><IcPhone /><span data-edit="ag_d3_foot">nieodebrane połączenie to najdroższa rzecz w firmie usługowej</span></div>
                  </div>
                </div>

                {/* --- asystent wewnętrzny --- */}
                <div className="dm-cell" data-hideable="dm:assist" data-hide-label="Scena — czat zespołu">
                  <div className="dm-cap" data-edit="ag_d4_cap">AI Asystent · czat zespołu</div>
                  <div className="ag-demo dm" data-demo="assist">
                    <div className="dm-bar">
                      <span className="dm-live"><i></i><span data-edit="ag_d4_live">czat zespołu</span></span>
                      <span className="dm-src"><IcDoc /><span data-edit="ag_d4_src">148 dokumentów</span></span>
                    </div>

                    <div className="dm-screen dm-assist">
                      <div className="msg in" data-s="1"><span data-edit="ag_d4_m1" data-edit-type="html"><b>Ola, sprzedaż:</b> jaki mamy rabat dla stałego klienta przy trzecim zamówieniu?</span></div>
                      <div className="msg typing" data-s="2"><span className="dots"><i></i><i></i><i></i></span></div>
                      <div className="msg out" data-s="3">
                        <span data-edit="ag_d4_m2">10% od trzeciego zamówienia w roku, łączy się z rabatem ilościowym do 15%. Powyżej trzeba pytać zarząd.</span>
                      </div>
                      <div className="src-row" data-s="4"><IcDoc /><span data-edit="ag_d4_src_row" data-edit-type="html">źródło: <b>cennik_2026.pdf</b> · s. 3 · zaktualizowany 12.08</span></div>
                      <div className="msg in" data-s="5"><span data-edit="ag_d4_m3" data-edit-type="html"><b>Ola, sprzedaż:</b> a termin dla zamówień specjalnych?</span></div>
                      <div className="msg out" data-s="6"><span data-edit="ag_d4_m4">14 dni roboczych od potwierdzenia projektu.</span></div>
                      <div className="dm-chip" data-s="7"><IcClock /><span data-edit="ag_d4_chip">Odpowiedź w 4 sekundy — zamiast pytania na korytarzu</span></div>
                    </div>

                    <div className="dm-foot"><IcSpark /><span data-edit="ag_d4_foot">nowa osoba w zespole pyta agenta, nie kolegi obok</span></div>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* ===== 3 / PROBLEM → ROZWIĄZANIE ===== */}
          <section className="slide" id="zmiana" data-hideable="sec:zmiana" data-hide-label="Sekcja — Co się zmienia">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ag_c_label">{'// problem → rozwiązanie'}</div>
                <h2 data-edit="ag_c_h2" data-edit-type="html">Co się zmienia w firmie</h2>
              </div>

              <div className="chg-grid rv rv2">
                <div className="chg-col-h now" data-edit="ag_c_now">Teraz</div>
                <div className="chg-col-h" aria-hidden="true"></div>
                <div className="chg-col-h fix" data-edit="ag_c_fix">Z zespołem agentów</div>

                <div className="chg-now" data-edit="ag_c1_now">Telefon dzwoni w trakcie pracy. Nikt nie odbiera.</div>
                <div className="chg-arrow" aria-hidden="true"><IcDotArrow /></div>
                <div className="chg-fix" data-edit="ag_c1_fix">Każde połączenie odebrane, wizyta zapisana o 22:00.</div>

                <div className="chg-now" data-edit="ag_c2_now">Zapytanie z wieczora czeka do rana.</div>
                <div className="chg-arrow" aria-hidden="true"><IcDotArrow /></div>
                <div className="chg-fix" data-edit="ag_c2_fix">Odpowiedź w minutę, też w nocy i w weekend.</div>

                <div className="chg-now" data-edit="ag_c3_now">Klient przewija ofertę i wychodzi.</div>
                <div className="chg-arrow" aria-hidden="true"><IcDotArrow /></div>
                <div className="chg-fix" data-edit="ag_c3_fix">Dostaje jedną rekomendację i przechodzi do kontaktu.</div>

                <div className="chg-now" data-edit="ag_c4_now">„Kto wie, jak to się robi?” — pyta się kolegi.</div>
                <div className="chg-arrow" aria-hidden="true"><IcDotArrow /></div>
                <div className="chg-fix" data-edit="ag_c4_fix">Odpowiedź z Waszych dokumentów, ze wskazanym źródłem.</div>
              </div>
            </div>
          </section>

          {/* ===== 4 / JAK TO DZIAŁA ===== */}
          <section className="slide" id="jak" data-hideable="sec:jak" data-hide-label="Sekcja — Jak to działa">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ag_s_label">{'// jak to działa'}</div>
                <h2 data-edit="ag_s_h2" data-edit-type="html">Trzy kroki, resztę robimy my</h2>
              </div>

              <div className="steps rv rv2">
                <div className="step" data-hideable="step:1" data-hide-label="Krok 01">
                  <span className="step-num" data-edit="ag_s1_num">01</span>
                  <h3 data-edit="ag_s1_h">Wypróbuj i wybierz</h3>
                  <p data-edit="ag_s1_p" data-edit-type="html">Rozmawiasz z AI Doradcą, on podpowiada, od którego agenta zacząć u Ciebie.</p>
                </div>
                <div className="step" data-hideable="step:2" data-hide-label="Krok 02">
                  <span className="step-num" data-edit="ag_s2_num">02</span>
                  <h3 data-edit="ag_s2_h">Trening na Twojej firmie</h3>
                  <p data-edit="ag_s2_p" data-edit-type="html">Uczymy agentów Twojej oferty i procesów, podłączamy kanały, kalendarz i CRM.</p>
                </div>
                <div className="step" data-hideable="step:3" data-hide-label="Krok 03">
                  <span className="step-num" data-edit="ag_s3_num">03</span>
                  <h3 data-edit="ag_s3_h">Start i dopinanie</h3>
                  <p data-edit="ag_s3_p" data-edit-type="html">Uruchomienie w [do potwierdzenia] dni roboczych. Pierwsze dni obserwujemy rozmowy.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 5 / KOSZT ===== */}
          <section className="slide" id="koszt" data-hideable="sec:koszt" data-hide-label="Sekcja — Koszt">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ag_k_label">{'// koszt'}</div>
                <h2 data-edit="ag_k_h2" data-edit-type="html">Porównanie z etatem</h2>
              </div>

              <div className="cost-grid rv rv2">
                <div className="cost-card" data-hideable="cost:etat" data-hide-label="Koszt — karta „Jeden etat”">
                  <div className="cost-tag" data-edit="ag_k1_tag">Jeden etat</div>
                  <div className="cost-price" data-edit="ag_k1_price">~[X] zł / mies.</div>
                  <p data-edit="ag_k1_p" data-edit-type="html">Pensja i ZUS. Osiem godzin, pon–pt. Plus rekrutacja, urlopy, L4 i rotacja.</p>
                  <div className="cost-bar"><i style={{ width: '100%' }}></i></div>
                </div>

                <div className="cost-card acid" data-hideable="cost:agent" data-hide-label="Koszt — karta „Jeden agent AI”">
                  <div className="cost-tag" data-edit="ag_k2_tag">Jeden agent AI</div>
                  <div className="cost-price" data-edit="ag_k2_price">od [X] zł / mies.</div>
                  <p data-edit="ag_k2_p" data-edit-type="html">Stały abonament, [X]× taniej. Pracuje całą dobę, bez urlopu i bez zastępstw.</p>
                  <div className="cost-bar"><i style={{ width: '26%' }}></i></div>
                </div>
              </div>

              <p className="cost-note rv rv3" data-hideable="cost:note" data-hide-label="Koszt — podpis pod kartami" data-edit="ag_k_note" data-edit-type="html">Cały czteroosobowy zespół: od [X] zł / mies. — taniej niż każdy agent osobno.</p>
            </div>
          </section>

          {/* ===== 6 / PYTANIA ===== */}
          <section className="slide" id="faq" data-hideable="sec:faq" data-hide-label="Sekcja — Pytania">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ag_f_label">{'// pytania'}</div>
                <h2 data-edit="ag_f_h2" data-edit-type="html">Najczęstsze wątpliwości</h2>
              </div>

              <div className="faq-grid rv rv2">
                <div className="faq-item" data-hideable="faq:1" data-hide-label="Pytanie 01">
                  <span className="faq-num" aria-hidden="true">01</span>
                  <h3 data-edit="ag_f1_q">Muszę wdrażać wszystkich czterech?</h3>
                  <p data-edit="ag_f1_a" data-edit-type="html">Nie. Każdy działa samodzielnie. Zaczynasz od jednego i dokładasz kolejnych, kiedy chcesz.</p>
                </div>
                <div className="faq-item" data-hideable="faq:2" data-hide-label="Pytanie 02">
                  <span className="faq-num" aria-hidden="true">02</span>
                  <h3 data-edit="ag_f2_q">Czy klient pozna, że rozmawia z AI?</h3>
                  <p data-edit="ag_f2_a" data-edit-type="html">Nie poznasz tego. Agent przedstawia się jako asystent i oddaje rozmowę człowiekowi, tylko kiedy trzeba.</p>
                </div>
                <div className="faq-item" data-hideable="faq:3" data-hide-label="Pytanie 03">
                  <span className="faq-num" aria-hidden="true">03</span>
                  <h3 data-edit="ag_f3_q">Co, jeśli agent nie zna odpowiedzi?</h3>
                  <p data-edit="ag_f3_a" data-edit-type="html">Nie zmyśla. Przekazuje sprawę człowiekowi razem z całym kontekstem rozmowy.</p>
                </div>
                <div className="faq-item" data-hideable="faq:4" data-hide-label="Pytanie 04">
                  <span className="faq-num" aria-hidden="true">04</span>
                  <h3 data-edit="ag_f4_q">Podłączycie nasze narzędzia?</h3>
                  <p data-edit="ag_f4_a" data-edit-type="html">Tak — CRM, kalendarz, telefonię i kanały, z których już korzystacie.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 7 / KONTAKT — kwasowa płyta jak w makiecie ===== */}
          <section className="slide" id="kontakt" data-hideable="sec:kontakt" data-hide-label="Sekcja — Kontakt">
            <div className="slide-inner ag-wrap">
              <div className="ag-final rv rv1">
                <h2 data-edit="ag_final_h2" data-edit-type="html">Porozmawiaj z agentem, zanim go zatrudnisz.</h2>
                <p className="ag-final-note" data-edit="ag_final_note" data-edit-type="html">AI Doradca podpowie, od którego agenta zacząć — i ile to kosztuje.</p>
                <div className="ag-final-row">
                  <a href="/kontakt" data-wipe className="btn-dark" data-edit="ag_final_cta">Wypróbuj agenta sam</a>
                  <a href="/kontakt" data-wipe className="btn-dark ghost" data-edit="ag_final_alt" data-edit-type="html">Lub zostaw dane kontaktowe,<br />a my skontaktujemy się z Tobą</a>
                </div>
              </div>

              <footer className="ag-footer rv rv2" data-hideable="ag:footer" data-hide-label="Stopka">
                <span data-edit="ag_foot_l">© 2026 Fastline InfinitiQ · Zespół agentów AI · część Greywolf Group</span>
                <a href="/" data-wipe data-edit="ag_foot_r">fastlineinfinitiq.pl</a>
              </footer>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
