import React from 'react';
import { IcGlobe, IcCheck, IcUsers, IcCalendar, IcClock, IcDoc, IcSpark, IcArrow } from './agentIcons.jsx';

/* Разметка страницы /ai-doradca — первая отдельная LP продукта (AI Doradca).
   Тот же каркас, что у /agenci-ai: шапка, меню, барабан граней, движок
   `agenciEngine`; стили = `agenci.css` + `doradca.css` (только секции этой страницы).
   Teksty 1:1 ze struktury właściciela (2026-10-12). Wszystkie mają `data-edit`
   z prefiksem `ad_` i siedzą w wierszu `site_content` o id `ai-doradca`.

   Adresy przycisków zakupu trzyma `BUY` — koszyka jeszcze nie ma, więc do czasu
   bramki płatności oba prowadzą do /kontakt z parametrem `plan` (strona pokazuje
   wtedy, co klient zamawia). Gdy powstanie koszyk, zmienia się tylko ta stała. */

export const BUY = {
  call: '/kontakt',
  now: '/kontakt?plan=start',
  setup: '/kontakt?plan=wdrozenie',
};

export default function DoradcaShell() {
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
          <a href="/" data-wipe className="nav-back"><span className="nb-full" data-edit="ad_nav_back">Wszystkie produkty</span><span className="nb-short" data-edit="ad_nav_back_short">Produkty</span></a>
        </div>
        <div className="nav-brand">
          <a className="nav-logo" href="/" data-wipe aria-label="Fastline InfinitiQ">
            <img src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" data-edit="ad_nav_logo" data-edit-type="image" />
          </a>
          <div className="nav-claim" id="heroClaim">
            <span className="hc-word" data-edit="ad_claim_1">Data driven.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word" data-edit="ad_claim_2">Mind created.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word" data-edit="ad_claim_3">Unique executed.</span>
          </div>
        </div>
        <a href={BUY.call} data-wipe className="nav-cta"><span className="cta-full" data-edit="ad_nav_cta">Umów 30 minut</span><span className="cta-short" data-edit="ad_nav_cta_short">{'Umów\n30 minut'}</span></a>
      </nav>

      <div className="rail" id="rail" role="navigation" aria-label="Sekcje">
        <button className="rail-item" data-i="0"><span className="rail-name">Start</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="1"><span className="rail-name">Problem</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="2"><span className="rail-name">Jak działa</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="3"><span className="rail-name">Demo</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="4"><span className="rail-name">Jak zacząć</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="5"><span className="rail-name">Cennik</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="6"><span className="rail-name">Pytania</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="7"><span className="rail-name">Zacznij</span><span className="rail-tick"></span></button>
      </div>

      <div className="counter" id="counter"><span className="cur">01</span><span>/ 08</span></div>
      <div className="scroll-hint" id="scrollHint">Scroll</div>
      {/* strzałka „dalej": nazwę następnej sekcji wpisuje silnik (agenciEngine) */}
      <button type="button" className="next-hint" id="nextHint" aria-label="Następna sekcja">
        <span className="nh-cap">Dalej</span>
        <span className="nh-name" data-next>problem</span>
        <svg className="nh-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v15M5.5 12.5 12 19l6.5-6.5" /></svg>
      </button>

      <div id="track"></div>

      <div id="stage">
        <div id="drum">

          {/* ===== 1 / HERO ===== */}
          <section className="slide" id="start">
            <div className="slide-inner ag-wrap">
              <div className="ad-hero">
                <div className="ad-hero-txt">
                  <div className="section-label rv rv1" data-edit="ad_label">AI Doradca · na Twojej stronie 24/7</div>
                  <h1 className="ag-h1 rv rv1" data-edit="ad_h1" data-edit-type="html">Ilu klientów wyszło dziś z Twojej strony <em>bez pytania?</em></h1>
                  <p className="ag-lead rv rv2" data-edit="ad_lead" data-edit-type="html">
                    Nie wiesz, bo nigdzie się nie zapisali. AI Doradca zagaduje ich pierwszy,
                    dobiera wariant i zostawia Ci kontakt.
                  </p>

                  <div className="ag-actions ad-actions rv rv3">
                    <a href={BUY.call} data-wipe className="btn-primary" data-edit="ad_cta1">Umów 30 minut</a>
                    <a href={BUY.now} data-wipe className="btn-primary" data-edit="ad_cta2">Kup teraz — 490 zł/mies.</a>
                    <a href={BUY.setup} data-wipe className="btn-primary" data-edit="ad_cta3">Kup z podłączeniem</a>
                  </div>

                  <ul className="ag-checks ad-checks rv rv3">
                    <li data-hideable="ad:check1" data-hide-label="Hero — punkt 1"><IcCheck /><span data-edit="ad_check1">Uruchomienie tego samego dnia</span></li>
                    <li data-hideable="ad:check2" data-hide-label="Hero — punkt 2"><IcCheck /><span data-edit="ad_check2">Umowa na miesiąc</span></li>
                    <li data-hideable="ad:check3" data-hide-label="Hero — punkt 3"><IcCheck /><span data-edit="ad_check3">Bez programowania</span></li>
                  </ul>
                </div>

                {/* karta agenta jak na /agenci-ai: zdjęcie, po najechaniu chmura punktów
                    (silnik `team.js` szuka kart po `#teamGrid`); obok „żywe" dymki rozmowy */}
                <div className="ad-hero-vis rv rv2">
                  <canvas className="ad-neuro" data-n="34" aria-hidden="true"></canvas>
                  <div className="team-grid ad-team" id="teamGrid">
                    <article className="team-card" tabIndex={0} data-team="2">
                      <div className="tm-visual">
                        <canvas className="tm-canvas" aria-hidden="true"></canvas>
                        <img className="tm-photo" crossOrigin="anonymous" src="/assets/team/maja.webp" fetchpriority="high" decoding="async" alt="AI Doradca — Fastline InfinitiQ" data-edit="ad_card_photo" data-edit-type="image" />
                        <span className="tm-frame" aria-hidden="true"></span>
                        <span className="tm-badge" data-edit="ad_card_tag">● doradztwo</span>
                      </div>
                      <div className="tm-body">
                        <div className="ag-role" data-edit="ad_card_role" data-edit-type="html">Doradca klienta —<br />wybór i oferta</div>
                        <h3 data-edit="ad_card_name">AI Doradca</h3>
                        <p data-edit="ad_card_desc" data-edit-type="html">
                          Pracuje na stronie, tam gdzie klient się waha. Identyfikuje faktyczną potrzebę klienta
                          i wskazuje jedno rozwiązanie z uzasadnieniem. Handlowiec dostaje gotowy kontekst.
                        </p>
                        <div className="ag-chan" data-edit="ad_card_chan">strona · rekomendacja · lead</div>
                      </div>
                    </article>
                  </div>
                  <div className="ad-float" data-hideable="ad:hero-float" data-hide-label="Hero — dymki przy karcie">
                    <span className="hb hb-q" data-edit="ad_hb1">Który wariant dla 6 osób?</span>
                    <span className="hb hb-a" data-edit="ad_hb2">Polecam Standard. Start w tydzień.</span>
                    <span className="hb hb-c"><IcUsers /><span data-edit="ad_hb3">Kontakt w Twojej skrzynce</span></span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 2 / PROBLEM ===== */}
          <section className="slide" id="problem" data-hideable="sec:problem" data-hide-label="Sekcja — Problem">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ad_p_label">{'// problem'}</div>
                <h2 data-edit="ad_p_h2" data-edit-type="html">Gdzie tracisz klientów</h2>
              </div>

              <div className="ad-leaks rv rv2">
                <div className="ad-leak" data-hideable="leak:1" data-hide-label="Problem 01">
                  <div className="lk-vis lk-variants" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><b>×</b></div>
                  <span className="ad-leak-num" aria-hidden="true">01</span>
                  <h3 data-edit="ad_p1_h" data-edit-type="html">Wchodzi na ofertę, widzi pięć wariantów, zamyka kartę.</h3>
                  <p data-edit="ad_p1_p" data-edit-type="html">Nie odpadł przez cenę, tylko przez wybór.</p>
                </div>
                <div className="ad-leak" data-hideable="leak:2" data-hide-label="Problem 02">
                  <div className="lk-vis lk-repeat" aria-hidden="true"><i></i><i></i><i></i><b>×100</b></div>
                  <span className="ad-leak-num" aria-hidden="true">02</span>
                  <h3 data-edit="ad_p2_h" data-edit-type="html">Te same trzy pytania wracają codziennie.</h3>
                  <p data-edit="ad_p2_p" data-edit-type="html">Ktoś z zespołu odpowiada na nie po raz setny.</p>
                </div>
                <div className="ad-leak" data-hideable="leak:3" data-hide-label="Problem 03">
                  <div className="lk-vis lk-clock" aria-hidden="true"><em>21:00</em><span><i></i></span><em>9:30</em></div>
                  <span className="ad-leak-num" aria-hidden="true">03</span>
                  <h3 data-edit="ad_p3_h" data-edit-type="html">Pytanie o 21:00, odpowiedź o 9:30.</h3>
                  <p data-edit="ad_p3_p" data-edit-type="html">O 9:30 klient czyta już ofertę konkurencji.</p>
                </div>
                <div className="ad-leak" data-hideable="leak:4" data-hide-label="Problem 04">
                  <div className="lk-vis lk-funnel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
                  <span className="ad-leak-num" aria-hidden="true">04</span>
                  <h3 data-edit="ad_p4_h" data-edit-type="html">Formularz wypełnia garstka.</h3>
                  <p data-edit="ad_p4_p" data-edit-type="html">Reszta chciała zapytać o jedną rzecz.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 3 / JAK DZIAŁA ===== */}
          <section className="slide" id="jak" data-hideable="sec:jak" data-hide-label="Sekcja — Jak działa">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ad_s_label">{'// jak działa'}</div>
                <h2 data-edit="ad_s_h2" data-edit-type="html">Doradza tak, jak zrobiłby to dobry sprzedawca</h2>
              </div>

              <div className="ad-how rv rv2">
              <div className="ad-how-steps">
              <canvas className="ad-synapse" id="adSynapse" aria-hidden="true"></canvas>
              <div className="steps ad-steps">
                <div className="step" data-hideable="how:1" data-hide-label="Jak działa 01">
                  <span className="step-num" data-edit="ad_s1_num">01</span>
                  <h3 data-edit="ad_s1_h">Pyta, zanim zarekomenduje</h3>
                  <p data-edit="ad_s1_p" data-edit-type="html">Zaczyna od sytuacji klienta, nie od katalogu.</p>
                </div>
                <div className="step" data-hideable="how:2" data-hide-label="Jak działa 02">
                  <span className="step-num" data-edit="ad_s2_num">02</span>
                  <h3 data-edit="ad_s2_h">Zna ofertę do końca</h3>
                  <p data-edit="ad_s2_p" data-edit-type="html">Cennik, warianty, terminy, wyjątki.</p>
                </div>
                <div className="step" data-hideable="how:3" data-hide-label="Jak działa 03">
                  <span className="step-num" data-edit="ad_s3_num">03</span>
                  <h3 data-edit="ad_s3_h">Nie zmyśla</h3>
                  <p data-edit="ad_s3_p" data-edit-type="html">Na pytanie spoza bazy mówi, że nie wie, i przekazuje kontakt do człowieka.</p>
                </div>
                <div className="step" data-hideable="how:4" data-hide-label="Jak działa 04">
                  <span className="step-num" data-edit="ad_s4_num">04</span>
                  <h3 data-edit="ad_s4_h">Domyka albo przekazuje</h3>
                  <p data-edit="ad_s4_p" data-edit-type="html">Prowadzi do koszyka, formularza albo kalendarza. Rozmowa trafia do Twojej skrzynki.</p>
                </div>
              </div>
              </div>
              {/* scena: doradca na stronie klienta (ten sam silnik scen co na /agenci-ai) */}
              <div className="ad-scene rv rv2" data-hideable="ad:scene" data-hide-label="Jak działa — scena rozmowy">
                <div className="ag-demo dm" data-demo="advisor">
                  <div className="dm-bar">
                    <span className="dm-url"><IcGlobe /><span data-edit="ad_h_url">twojafirma.pl/oferta</span></span>
                    <span className="dm-live"><i></i><span data-edit="ad_h_live">23:04 · doradca aktywny</span></span>
                  </div>
                  <div className="dm-screen dm-site">
                    <div className="site-skel" aria-hidden="true">
                      <span className="sk sk-h"></span>
                      <span className="sk sk-t"></span>
                      <span className="sk sk-t short"></span>
                    </div>
                    <div className="adv-widget">
                      <div className="adv-head"><img className="adv-fav" src="/assets/favicon/favicon-192.png" alt="" aria-hidden="true" /><span data-edit="ad_h_head">Doradca AI</span></div>
                      <div className="msg out" data-s="1"><span data-edit="ad_h_m1">Dobry wieczór! Widzę, że porównujesz warianty. Do czego ma służyć na co dzień?</span></div>
                      <div className="msg in" data-s="2"><span data-edit="ad_h_m2">Dla zespołu 6 osób, zaczynamy od stycznia.</span></div>
                      <div className="msg typing" data-s="3"><span className="dots"><i></i><i></i><i></i></span></div>
                      <div className="adv-rec" data-s="4">
                        <b data-edit="ad_h_rec_h">Polecam wariant Standard</b>
                        <span data-edit="ad_h_rec_p">Mieści 6 osób i startuje w tydzień. Premium opłaci się dopiero powyżej 10.</span>
                      </div>
                      <div className="msg in" data-s="5"><span data-edit="ad_h_m3">Brzmi dobrze. Proszę o kontakt jutro rano.</span></div>
                      <div className="dm-chip" data-s="6"><IcUsers /><span data-edit="ad_h_chip">Kontakt i cała rozmowa w Twojej skrzynce</span></div>
                    </div>
                  </div>
                  <div className="dm-foot"><IcClock /><span data-edit="ad_h_foot">klient o 23:04 dostał odpowiedź, a Ty rano gotowy kontakt</span></div>
                </div>
              </div>
              </div>
            </div>
          </section>

          {/* ===== 4 / DEMO ===== */}
          <section className="slide" id="demo" data-hideable="sec:demo" data-hide-label="Sekcja — Demo">
            <div className="slide-inner ag-wrap">
              <div className="ad-demo">
                <div className="ad-demo-txt rv rv1">
                  <div className="section-label" data-edit="ad_d_label">{'// demo'}</div>
                  <h2 className="ad-h2" data-edit="ad_d_h2" data-edit-type="html">Zapytaj go sam</h2>
                  <p className="ad-demo-lead" data-edit="ad_d_lead" data-edit-type="html">
                    Poniżej ten sam agent, którego dostajesz, nauczony naszej oferty. Potraktuj go jak
                    klienta, który trafił na Twoją stronę o 23:00.
                  </p>
                  <div className="ad-ask" data-hideable="ad:ask" data-hide-label="Demo — podpowiedzi pytań">
                    <span className="ad-ask-cap" data-edit="ad_d_ask">Zapytaj na przykład</span>
                    <span className="ad-ask-q" data-edit="ad_d_q1">Ile to kosztuje przy 800 rozmowach?</span>
                    <span className="ad-ask-q" data-edit="ad_d_q2">Mam sklep na WooCommerce, zadziała?</span>
                    <span className="ad-ask-q" data-edit="ad_d_q3">Co, jeśli klient zapyta o coś spoza oferty?</span>
                  </div>
                </div>

                {/* Okno demo. `data-live` = miejsce na żywy czat (iframe z Brain, gdy
                    w Doradca.jsx jest ustawiony klucz kanału); bez klucza i w edytorze
                    zostaje odgrywana scena poniżej. */}
                <div className="ad-demo-wrap rv rv2">
                <canvas className="ad-neuro" data-n="40" aria-hidden="true"></canvas>
                <div className="ad-demo-win" id="adDemo">
                  <div className="ad-win-bar">
                    <span className="ad-win-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                    <span className="ad-win-title"><img className="adv-fav" src="/assets/favicon/favicon-192.png" alt="" aria-hidden="true" /><span data-edit="ad_d_win">AI Doradca · Fastline InfinitiQ</span></span>
                    <span className="dm-live"><i></i><span data-edit="ad_d_live">online</span></span>
                  </div>
                  <div className="ad-win-body" data-live>
                    <div className="dm ad-script" data-demo="assist">
                      <div className="dm-screen dm-assist">
                      <div className="msg out" data-s="1"><span data-edit="ad_d_m1">Dzień dobry! Jestem doradcą Fastline InfinitiQ. Czego szukasz dla swojej firmy?</span></div>
                      <div className="msg in" data-s="2"><span data-edit="ad_d_m2">Ile kosztuje AI Doradca i czy muszę coś programować?</span></div>
                      <div className="msg typing" data-s="3"><span className="dots"><i></i><i></i><i></i></span></div>
                      <div className="msg out" data-s="4"><span data-edit="ad_d_m3">490 zł netto miesięcznie, w tym 500 rozmów. Na stronie wklejasz jedną linijkę kodu. Ile zapytań miesięcznie dostajesz teraz?</span></div>
                      <div className="msg in" data-s="5"><span data-edit="ad_d_m4">Około 300, głównie wieczorami.</span></div>
                      <div className="msg out" data-s="6"><span data-edit="ad_d_m5">To mieścisz się w pakiecie z zapasem. Możesz ruszyć dziś sam albo zlecić podłączenie nam. Co wolisz?</span></div>
                      <div className="dm-chip" data-s="7"><IcCalendar /><span data-edit="ad_d_chip">Dalej: koszyk albo termin rozmowy</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 5 / TRZY DROGI ===== */}
          <section className="slide" id="drogi" data-hideable="sec:drogi" data-hide-label="Sekcja — Trzy drogi">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ad_w_label">{'// jak zacząć'}</div>
                <h2 data-edit="ad_w_h2" data-edit-type="html">Wybierz, jak chcesz zacząć</h2>
              </div>

              <div className="ad-ways rv rv2">
                <article className="ad-way" data-hideable="way:1" data-hide-label="Droga — Kup teraz">
                  <div className="way-vis way-code" aria-hidden="true"><code>&lt;script src="doradca.js"&gt;</code><i></i></div>
                  <span className="ad-way-tag" data-edit="ad_w1_tag">Sam, dziś</span>
                  <h3 data-edit="ad_w1_h">Kup teraz</h3>
                  <div className="ad-way-price"><b data-edit="ad_w1_price">490 zł</b><span data-edit="ad_w1_unit">/ mies. netto</span></div>
                  <p data-edit="ad_w1_p" data-edit-type="html">Wrzucasz cennik, kreator prowadzi krok po kroku, wklejasz jedną linijkę kodu.</p>
                  <div className="ad-way-when"><IcClock /><span data-edit="ad_w1_when">Start tego samego dnia</span></div>
                  <a href={BUY.now} data-wipe className="btn-primary" data-edit="ad_w1_cta">Kup teraz</a>
                </article>

                <article className="ad-way hot" data-hideable="way:2" data-hide-label="Droga — Kup z podłączeniem">
                  <span className="ad-way-badge" data-edit="ad_w2_badge">Polecamy</span>
                  <div className="way-vis way-list" aria-hidden="true"><span><IcCheck />Katalog</span><span><IcCheck />Ton marki</span><span><IcCheck />Osadzenie</span></div>
                  <span className="ad-way-tag" data-edit="ad_w2_tag">Robimy za Ciebie</span>
                  <h3 data-edit="ad_w2_h">Kup z podłączeniem</h3>
                  <div className="ad-way-price two"><b data-edit="ad_w2_price">490 zł</b><span data-edit="ad_w2_per">/ mies. netto</span><i className="brk" aria-hidden="true"></i><b className="plus" data-edit="ad_w2_plus">+ 1 490 zł</b><span data-edit="ad_w2_once">jednorazowo</span></div>
                  <p data-edit="ad_w2_p" data-edit-type="html">Konfigurację, katalog, ton marki i osadzenie na stronie robimy my.</p>
                  <div className="ad-way-when"><IcClock /><span data-edit="ad_w2_when">Start do 5 dni roboczych</span></div>
                  <a href={BUY.setup} data-wipe className="btn-primary" data-edit="ad_w2_cta">Kup z podłączeniem</a>
                </article>

                <article className="ad-way" data-hideable="way:3" data-hide-label="Droga — Umów 30 minut">
                  <div className="way-vis way-cal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b>30 min</b></div>
                  <span className="ad-way-tag" data-edit="ad_w3_tag">Najpierw zobacz</span>
                  <h3 data-edit="ad_w3_h">Umów 30 minut</h3>
                  <div className="ad-way-price"><b data-edit="ad_w3_price">Bezpłatnie</b><span data-edit="ad_w3_unit"></span></div>
                  <p data-edit="ad_w3_p" data-edit-type="html">Pokazujemy agenta na Twojej ofercie i mówimy wprost, czy to się u Ciebie spina.</p>
                  <div className="ad-way-when"><IcCalendar /><span data-edit="ad_w3_when">Termin wybierasz sam</span></div>
                  <a href={BUY.call} data-wipe className="btn-primary" data-edit="ad_w3_cta">Umów rozmowę</a>
                </article>
              </div>
            </div>
          </section>

          {/* ===== 6 / CENNIK ===== */}
          <section className="slide" id="cennik" data-hideable="sec:cennik" data-hide-label="Sekcja — Cennik">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ad_c_label">{'// cennik'}</div>
                <h2 data-edit="ad_c_h2" data-edit-type="html">Jedna cena, bez gwiazdek</h2>
              </div>

              <div className="ad-price rv rv2">
                <div className="ad-price-main">
                  <canvas className="ad-neuro" data-n="30" aria-hidden="true"></canvas>
                  <div className="ad-price-big"><b data-edit="ad_c_price">490 zł</b><span data-edit="ad_c_unit">/ mies. netto</span></div>
                  <ul className="ad-incl">
                    <li data-hideable="incl:1" data-hide-label="W cenie 1"><IcCheck /><span data-edit="ad_c_i1">500 rozmów miesięcznie</span></li>
                    <li data-hideable="incl:2" data-hide-label="W cenie 2"><IcCheck /><span data-edit="ad_c_i2">Kanał: strona internetowa</span></li>
                    <li data-hideable="incl:3" data-hide-label="W cenie 3"><IcCheck /><span data-edit="ad_c_i3">Katalog do 200 pozycji</span></li>
                    <li data-hideable="incl:4" data-hide-label="W cenie 4"><IcCheck /><span data-edit="ad_c_i4">Rekomendacja wariantu i przekazanie kontaktu</span></li>
                    <li data-hideable="incl:5" data-hide-label="W cenie 5"><IcCheck /><span data-edit="ad_c_i5">Raport miesięczny</span></li>
                  </ul>
                  <a href={BUY.now} data-wipe className="btn-primary" data-edit="ad_c_cta">Kup teraz</a>
                </div>

                <div className="ad-price-side">
                  <dl className="ad-terms">
                    <div data-hideable="term:1" data-hide-label="Warunek 1"><dt data-edit="ad_c_t1">Rozmowy ponad limit</dt><dd data-edit="ad_c_d1">0,49 zł za rozmowę</dd></div>
                    <div data-hideable="term:2" data-hide-label="Warunek 2"><dt data-edit="ad_c_t2">Umowa</dt><dd data-edit="ad_c_d2">Na miesiąc, bez okresu wypowiedzenia</dd></div>
                    <div data-hideable="term:3" data-hide-label="Warunek 3"><dt data-edit="ad_c_t3">Wdrożenie po naszej stronie</dt><dd data-edit="ad_c_d3">1 490 zł jednorazowo. Opcjonalne, można dokupić później</dd></div>
                    <div data-hideable="term:4" data-hide-label="Warunek 4"><dt data-edit="ad_c_t4">Większy katalog, konfigurator, integracja z e-commerce</dt><dd data-edit="ad_c_d4">Wycena indywidualna</dd></div>
                  </dl>

                  <div className="ad-vs" data-hideable="ad:vs" data-hide-label="Cennik — porównanie z etatem">
                    <span className="ad-vs-cap" data-edit="ad_c_vs_cap">Dla porównania</span>
                    <p data-edit="ad_c_vs" data-edit-type="html">Osoba odpowiadająca na pytania o ofertę to <b>5–7 tys. zł miesięcznie</b> i osiem godzin dziennie.</p>
                    <div className="ad-vs-bars" aria-hidden="true">
                      <div className="ad-vs-row"><span>Etat</span><i style={{ width: '100%' }}></i></div>
                      <div className="ad-vs-row acid"><span>AI Doradca</span><i style={{ width: '8%' }}></i></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 7 / FAQ ===== */}
          <section className="slide" id="faq" data-hideable="sec:faq" data-hide-label="Sekcja — Pytania">
            <div className="slide-inner ag-wrap">
              <div className="sec-head rv rv1">
                <div className="section-label" data-edit="ad_f_label">{'// pytania'}</div>
                <h2 data-edit="ad_f_h2" data-edit-type="html">Zanim zapytasz</h2>
              </div>

              <div className="faq-grid ad-faq rv rv2">
                <div className="faq-item" data-hideable="faq:1" data-hide-label="Pytanie 01">
                  <span className="faq-num" aria-hidden="true"><IcDoc />01</span>
                  <h3 data-edit="ad_f1_q">Skąd będzie znał moją ofertę?</h3>
                  <p data-edit="ad_f1_a" data-edit-type="html">Z materiałów, które nam dasz: strony, cennika, PDF-ów. Odpowiada wyłącznie z tej bazy.</p>
                </div>
                <div className="faq-item" data-hideable="faq:2" data-hide-label="Pytanie 02">
                  <span className="faq-num" aria-hidden="true"><IcCheck />02</span>
                  <h3 data-edit="ad_f2_q">Czy zmyśli cenę albo termin?</h3>
                  <p data-edit="ad_f2_a" data-edit-type="html">Nie. Zakres tego, co wolno mu obiecać, ustalasz Ty na starcie.</p>
                </div>
                <div className="faq-item" data-hideable="faq:3" data-hide-label="Pytanie 03">
                  <span className="faq-num" aria-hidden="true"><IcSpark />03</span>
                  <h3 data-edit="ad_f3_q">Czy muszę coś programować?</h3>
                  <p data-edit="ad_f3_a" data-edit-type="html">Jedna linijka kodu na stronie. Albo wybierasz wariant z podłączeniem i robimy to za Ciebie.</p>
                </div>
                <div className="faq-item" data-hideable="faq:4" data-hide-label="Pytanie 04">
                  <span className="faq-num" aria-hidden="true"><IcGlobe />04</span>
                  <h3 data-edit="ad_f4_q">Co z danymi?</h3>
                  <p data-edit="ad_f4_a" data-edit-type="html">Serwery w Unii Europejskiej, umowa powierzenia. Rozmowy należą do Ciebie.</p>
                </div>
                <div className="faq-item" data-hideable="faq:5" data-hide-label="Pytanie 05">
                  <span className="faq-num" aria-hidden="true"><IcCalendar />05</span>
                  <h3 data-edit="ad_f5_q">Co, jeśli nie zadziała?</h3>
                  <p data-edit="ad_f5_a" data-edit-type="html">Umowa na miesiąc. Rezygnujesz z końcem opłaconego okresu, bez kar.</p>
                </div>
                <div className="faq-item" data-hideable="faq:6" data-hide-label="Pytanie 06">
                  <span className="faq-num" aria-hidden="true"><IcArrow />06</span>
                  <h3 data-edit="ad_f6_q">Czym to się różni od czatu, który już mam?</h3>
                  <p data-edit="ad_f6_a" data-edit-type="html">Czat zbiera adresy. Doradca rekomenduje wariant i doprowadza do zakupu albo do kalendarza.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 8 / CTA KOŃCOWY ===== */}
          <section className="slide" id="kontakt" data-hideable="sec:kontakt" data-hide-label="Sekcja — CTA końcowy">
            <div className="slide-inner ag-wrap">
              <div className="ag-final rv rv1">
                <canvas className="ad-neuro" data-n="46" data-ink="dark" aria-hidden="true"></canvas>
                <h2 data-edit="ad_final_h2" data-edit-type="html">Trzydzieści minut albo jedno kliknięcie</h2>
                <p className="ag-final-note" data-edit="ad_final_note" data-edit-type="html">
                  Umów brief i zobacz agenta na swojej ofercie. Albo pomiń rozmowę i uruchom go dziś —
                  umowa i tak jest na miesiąc.
                </p>
                <div className="ag-final-row">
                  <a href={BUY.call} data-wipe className="btn-dark" data-edit="ad_final_cta1">Umów 30 minut</a>
                  <a href={BUY.now} data-wipe className="btn-dark" data-edit="ad_final_cta2">Kup teraz</a>
                  <a href={BUY.setup} data-wipe className="btn-dark" data-edit="ad_final_cta3">Kup z podłączeniem</a>
                </div>
              </div>

              <footer className="ag-footer rv rv2" data-hideable="ad:footer" data-hide-label="Stopka">
                <span data-edit="ad_foot_l">© 2026 Fastline InfinitiQ · AI Doradca · część Greywolf Group</span>
                <a href="/" data-wipe data-edit="ad_foot_r">fastlineinfinitiq.pl</a>
                <span className="footer-legal"><a href="/polityka-prywatnosci" data-wipe>Polityka prywatności</a><a href="/polityka-cookies" data-wipe>Cookies</a><a href="/regulamin" data-wipe>Regulamin</a></span>
              </footer>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
