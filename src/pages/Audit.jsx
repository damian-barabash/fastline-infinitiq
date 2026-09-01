import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sbPublic } from '../lib/supabase.js';
import { Ic, Gauge, Radar, Bar, Segments, Corners, Spark, GrowthDeco, Orbit, serviceIcon, productIcon, senseIcon, metricIcon } from '../components/auditIcons.jsx';
import { LogoFull, LogoMark, LogoMarkStroke } from '../components/logoSvg.jsx';
import auditCss from '../styles/audit.css?inline';

// Публичная страница аудита для клиента (v2, 2026-08-31): крупная контрастная типографика,
// большие диаграммы (gauge/radar/bars/segments), SVG-графика и анимации в каждой секции,
// инлайн-SVG лого FIQ как декор. Данные: public.audits (RLS: аноним видит только ready).
const SCOPE = {
  basic: [
    'Audyt techniczny i naprawa indeksacji',
    'Meta title / description dla kluczowych stron',
    'Dane strukturalne Schema.org (Organization, usługi, FAQ)',
    'Open Graph i podgląd w social / komunikatorach',
    'Mapa strony XML + robots.txt (w tym boty AI)',
    'Optymalizacja szybkości i Core Web Vitals',
  ],
  geo: [
    'Treści pod pytania, które klienci zadają AI',
    'llms.txt i dostęp dla botów AI (GPTBot, ClaudeBot, Perplexity)',
    'Strony odpowiedzi: FAQ + treści eksperckie',
    'Spójne dane firmy w źródłach, z których korzysta AI',
    'Monitoring cytowań w ChatGPT / Gemini / Perplexity',
    'Raport widoczności i plan kolejnych kroków',
  ],
};

const TIER_LABEL = { 1: 'Start', 2: 'Wzrost', 3: 'Skala' };
const DIAG_ICONS = ['search', 'eye', 'layers'];
const WHY_ICONS = ['bolt', 'rocket', 'clock'];
const POT_W = { wysoki: 100, 'średni': 62, sredni: 62, niski: 30 };

// Co oznaczają cztery wskaźniki z hero (opis stały — tłumaczy wykresy).
const SCORE_LEGEND = [
  ['Widoczność w Google', 'search', 'Na ile strona jest przygotowana, by wyszukiwarka rozumiała ofertę i pokazywała ją na zapytania klientów: tytuły, opisy, nagłówki, struktura adresów, treści odpowiadające na realne pytania.'],
  ['Widoczność w AI', 'robot', 'Czy ChatGPT, Gemini, Perplexity i podsumowania AI w Google mają z czego zbudować odpowiedź o Waszej firmie: dane strukturalne, jednoznaczny opis oferty, treści w formie pytań i odpowiedzi, dostęp dla botów AI.'],
  ['Technika strony', 'chip', 'Fundament, którego klient nie widzi, a robot ocenia w pierwszej kolejności: szybkość, wersja mobilna, adresy kanonicze, poprawny kod, brak błędów blokujących indeksację.'],
  ['Jakość treści', 'pen', 'Ile realnej, konkretnej treści jest na stronie: opisy usług, ceny, odpowiedzi na pytania, dowody (opinie, realizacje, blog). To z tego materiału korzystają zarówno Google, jak i modele AI.'],
];

// Słownik: co znaczą pojęcia użyte w audycie (sekcja metodologii).
const TERMS = [
  ['SEO', 'search', 'Widoczność w klasycznej wyszukiwarce — wszystko, co sprawia, że Google rozumie stronę i pokazuje ją wysoko na zapytania klientów.'],
  ['GEO', 'robot', 'Widoczność w odpowiedziach modeli AI (ChatGPT, Gemini, Perplexity, AI Overviews w Google). Model nie linkuje katalogu — cytuje źródło, które rozumie. Jeśli Waszej firmy nie da się jednoznacznie opisać danymi, po prostu nie pada w odpowiedzi.'],
  ['Schema.org', 'chip', 'Dane strukturalne — ukryte w kodzie „etykiety”, które mówią maszynie wprost: to jest firma, to usługa, to cena, to opinia, to pytanie i odpowiedź. Główne źródło, z którego AI buduje wiedzę o firmie.'],
  ['Open Graph', 'layers', 'Zestaw znaczników decydujących o tym, jak wygląda link do strony wklejony na Facebooku, LinkedInie, WhatsAppie czy w Messengerze: tytuł, opis i obrazek. Brak = goły, nieklikalny link.'],
  ['Canonical', 'check', 'Adres uznawany za „oryginał” danej podstrony. Bez niego ta sama treść pod kilkoma adresami rozbija siłę strony na duplikaty.'],
  ['Hreflang', 'globe', 'Informacja o wersjach językowych. Bez niej wyszukiwarka nie wie, komu pokazać wersję polską, a komu angielską — istotne przy sprzedaży za granicę.'],
  ['Core Web Vitals', 'speed', 'Zestaw pomiarów szybkości i stabilności strony na telefonie, którymi Google ocenia komfort użytkownika. Realnie wpływają na pozycje i na to, ilu klientów nie doczeka się załadowania oferty.'],
  ['LCP', 'clock', 'Czas, po którym widać największy element ekranu — moment, w którym klient uznaje, że strona się otworzyła. Norma Google: do 2,5 s.'],
  ['TTFB', 'bolt', 'Czas odpowiedzi serwera na pierwsze żądanie. Wysoki TTFB opóźnia całą resztę, zanim cokolwiek zdąży się narysować.'],
  ['CLS', 'layers', 'Miara „skakania” układu podczas ładowania. Wysoki CLS to przyciski uciekające spod palca i porzucone formularze.'],
];

// Skąd wzięliśmy dane (metodologia).
const SOURCES = [
  ['Kod i treść strony', 'doc', 'Pobraliśmy stronę główną wraz z podstronami i przeanalizowaliśmy nagłówki, treść, dane strukturalne, znaczniki oraz elementy sprzedażowe — dokładnie tak, jak robi to robot wyszukiwarki.'],
  ['Google PageSpeed Insights', 'speed', 'Oficjalne narzędzie Google: pomiar Core Web Vitals w wersji mobilnej, uzupełniony naszymi pomiarami odpowiedzi serwera i wagi kodu.'],
  ['Wyszukiwarka', 'users', 'Konkurentów nie zgadujemy — wpisujemy w wyszukiwarkę zapytania, którymi realnie szuka Wasz klient, i mierzymy strony, które wychodzą wysoko.'],
  ['Katalog produktów Fastline InfinitiQ', 'brain', 'Osiemnaście gotowych systemów AI z cenami katalogowymi. Do audytu dobieramy tylko te, które odpowiadają na konkretne braki znalezione na Waszej stronie.'],
];

// Wyjaśnienia metryk „punktu wyjścia” — dopasowanie po nazwie metryki.
const METRIC_EXPLAIN = [
  [/faq/i, 'Pytania i odpowiedzi opisane w kodzie znacznikiem FAQ to materiał, który AI i Google najchętniej cytują w gotowych odpowiedziach — klient dostaje odpowiedź z Waszym nazwiskiem, zanim wejdzie na stronę.'],
  [/schema|dane strukt/i, 'Dane strukturalne Schema.org tłumaczą treść na język maszyn: kto jest firmą, jaka jest oferta, gdzie działacie, ile kosztuje. Bez nich model AI musi zgadywać — i najczęściej pomija.'],
  [/open ?graph|og:/i, 'Open Graph decyduje, jak wygląda link do Waszej strony wysłany w wiadomości lub wrzucony na social media. Bez niego zamiast miniatury z ofertą klient widzi surowy adres.'],
  [/canonical/i, 'Adres kanoniczny wskazuje wyszukiwarce wersję główną podstrony i zapobiega rozbijaniu siły strony na duplikaty.'],
  [/hreflang|wersj.*języ|języki/i, 'Znaczniki wersji językowych mówią wyszukiwarce, którą wersję pokazać któremu klientowi — bez nich zagraniczny ruch trafia na przypadkową wersję albo nie trafia wcale.'],
  [/rezerw|umów|zapis|booking/i, 'Rezerwacja online zdejmuje z klienta konieczność dzwonienia w godzinach pracy. Każdy dodatkowy krok między decyzją a zapisem to realnie utracone zgłoszenia — najwięcej wieczorami i w weekendy.'],
  [/chat|czat|agent/i, 'Czat lub agent na stronie łapie pytania w momencie największego zainteresowania. Bez niego klient z pytaniem wraca do wyszukiwarki — najczęściej do konkurencji, która odpowiedziała od razu.'],
  [/mapa|google maps|lokaliz/i, 'Mapa i spójny adres to sygnał lokalny: na jego podstawie Google decyduje, czy pokazać Was w wynikach „w pobliżu” i w wizytówce firmy.'],
  [/blog|aktual|artyk|treś/i, 'Regularne treści to jedyny materiał, z którego wyszukiwarka i modele AI mogą zbudować obraz eksperta. Strona bez świeżych treści z czasem znika z wyników na frazy poradnikowe.'],
  [/newsletter|mail/i, 'Zapis na newsletter zamienia anonimowy ruch w kontakt, do którego możecie wrócić bez płacenia za reklamę po raz drugi.'],
  [/cen|cennik|price/i, 'Widoczne ceny odsiewają przypadkowe zapytania i budują zaufanie. Modele AI chętnie cytują strony, które mówią o cenach konkretnie.'],
  [/opini|recenz|ocen|review/i, 'Opinie z oznaczeniem w kodzie potrafią wyświetlić gwiazdki przy wyniku w Google i są jednym z najmocniejszych argumentów, które AI powtarza w odpowiedzi.'],
  [/telefon|kontakt|phone/i, 'Dane kontaktowe widoczne na każdej podstronie skracają drogę od decyzji do zgłoszenia i są sygnałem wiarygodności dla wyszukiwarki.'],
  [/szybk|speed|ładow|wydajn/i, 'Szybkość ładowania na telefonie jest oficjalnym czynnikiem rankingowym Google — i pierwszym powodem, dla którego klient zamyka stronę przed zobaczeniem oferty.'],
  [/mobil|responsyw|viewport/i, 'Wersja mobilna jest wersją podstawową: Google ocenia stronę tak, jak wygląda na telefonie, bo tam trafia większość ruchu.'],
  [/h1|nagłów|tytuł|title|meta ?opis|description/i, 'Tytuł, opis i nagłówki to pierwsze zdanie, jakie strona mówi o sobie wyszukiwarce. Puste albo powielone — kasują szansę na trafne dopasowanie do zapytania.'],
  [/sklep|koszyk|e-?commerce/i, 'Funkcje sklepowe pozwalają domknąć sprzedaż bez rozmowy — a wyszukiwarce pokazać produkty wraz z cenami i dostępnością.'],
  [/analit|pixel|tag manager/i, 'Bez analityki nie da się powiedzieć, które działanie przyniosło klienta — a więc ani powtórzyć tego, co działa, ani odciąć tego, co przepala budżet.'],
];
// polska odmiana rzeczownika po liczbie (1 adres / 2-4 adresy / 5+ adresów)
const plForm = (n, one, few, many) => {
  const a = Math.abs(+n || 0), d = a % 10, h = a % 100;
  if (a === 1) return one;
  return (d >= 2 && d <= 4 && !(h >= 12 && h <= 14)) ? few : many;
};
const explainMetric = (label) => (METRIC_EXPLAIN.find(([re]) => re.test(String(label || '')))?.[1]) || null;

// Definicje pomiarów szybkości (podpowiedź pod każdym słupkiem).
const CWV_HINT = {
  lcp: 'Największy element ekranu — moment, w którym klient uznaje, że strona się otworzyła. Norma Google: do 2,5 s.',
  fcp: 'Pierwszy widoczny fragment treści. Do tej chwili klient patrzy na puste tło.',
  tbt: 'Czas, w którym strona jest narysowana, ale nie reaguje na dotyk — kliknięcia „nie działają”. Norma: poniżej 200 ms.',
  cls: 'Skakanie układu podczas ładowania. Powyżej 0,1 klient trafia palcem w element, który właśnie się przesunął.',
  ttfb: 'Czas odpowiedzi serwera na pierwsze żądanie — opóźnia wszystko, co dzieje się dalej. Norma: do 500 ms.',
  html: 'Waga samego kodu strony (bez zdjęć). Im więcej kodu i skryptów, tym dłużej telefon składa stronę do kupy.',
};

// Rodzaje intencji wyszukiwania (legenda pod tabelą fraz).
const INTENT_LEGEND = [
  ['lokalna', 'compass', 'Klient szuka usługi u siebie — z nazwą miasta albo z „w pobliżu”. Decyzję podejmuje szybko, zwykle wybiera jedną z trzech pierwszych firm.'],
  ['zakupowa', 'cart', 'Klient wie, czego chce, i szuka miejsca zakupu. Najkrótsza droga do pieniędzy, ale i największa konkurencja.'],
  ['porównawcza', 'layers', 'Klient zestawia opcje: „X czy Y”, „ranking”, „opinie”. Tu wygrywa ten, kto ma treść porównawczą i konkretne dane.'],
  ['informacyjna', 'book', 'Klient dopiero zbiera wiedzę. Odpowiadając na te pytania, budujecie zaufanie zanim pojawi się potrzeba zakupu — i to te treści najczęściej cytuje AI.'],
];

// Model sprzedaży / zasięg — rozwinięcie skrótów z analizy.
const MODEL_LABEL = {
  b2c: 'B2C — sprzedaż do klienta końcowego',
  b2b: 'B2B — sprzedaż do firm',
  'b2b+b2c': 'B2B + B2C — firmy i klienci końcowi',
  'b2c+b2b': 'B2B + B2C — firmy i klienci końcowi',
};

const nzObj = (a) => Array.isArray(a) ? a.filter(x => x && Object.values(x).some(v => String(v || '').trim())) : [];
const nzStr = (a) => Array.isArray(a) ? a.filter(s => String(s || '').trim()) : [];

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Заголовок секции: номер + большой H2 + лид
function SecHead({ no, label, title, lead, icon }) {
  return (
    <div className="au-sh">
      <div className="au-label">{no} — {label}</div>
      <div className="au-sh-row">
        {icon && <div className="au-sh-ic"><Ic name={icon} size={30} sw={1.4} /></div>}
        <div>
          <h2 className="au-h2">{title}</h2>
          {lead && <p className="au-lead">{lead}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Audit() {
  const { slug } = useParams();
  const [audit, setAudit] = useState(undefined);

  useEffect(() => {
    document.title = 'Audyt SEO · GEO — Fastline InfinitiQ';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    let alive = true;
    sbPublic().from('audits').select('*').eq('slug', slug).eq('status', 'ready').maybeSingle()
      .then(({ data }) => { if (alive) setAudit(data || null); })
      .catch(() => { if (alive) setAudit(null); });
    return () => { alive = false; meta.remove(); };
  }, [slug]);

  // reveal по скроллу + count-up чисел (data-to) при появлении секции
  useEffect(() => {
    if (!audit) return;
    const timers = [];
    const countUp = (root) => {
      root.querySelectorAll('.au-count[data-to]').forEach(el => {
        if (el.dataset.done) return;
        el.dataset.done = '1';
        const to = +el.dataset.to || 0;
        const t0 = performance.now();
        const dur = 1100;
        const step = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(to * e));
          if (p < 1) timers.push(requestAnimationFrame(step));
        };
        timers.push(requestAnimationFrame(step));
      });
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('au-vis'); countUp(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.au-section, .au-hero').forEach(el => io.observe(el));
    return () => { io.disconnect(); timers.forEach(cancelAnimationFrame); };
  }, [audit]);

  const c = audit?.content || {};
  const prices = audit?.prices || {};
  const packages = (Array.isArray(prices.packages) ? prices.packages : []).filter(p => (p.name || '').trim());
  const hasPrices = packages.some(p => (p.price || '').trim());
  const diagnosis = nzObj(c.diagnosis);
  const metrics = nzObj(c.metrics);
  const plus = nzStr(c.plus);
  const minus = nzStr(c.minus);
  const keywords = nzObj(c.keywords);
  const aiPrompts = nzObj(c.ai_prompts).map(g => ({ ...g, prompts: nzStr(g.prompts) })).filter(g => g.prompts.length);
  const whyNow = nzObj(c.why_now);
  const plan = nzObj(c.plan);
  const services = nzObj(c.ai_services);
  const products = nzObj(c.products).filter(p => p.id && p.name).map(p => ({ ...p, scope: nzStr(p.scope), kpi: nzStr(p.kpi) }));
  const autoPackages = (Array.isArray(c.packages) ? c.packages : []).filter(p => p && Array.isArray(p.product_ids) && p.product_ids.length);
  const faq = nzObj(c.faq).filter(f => (f.q || '').trim() && (f.a || '').trim());
  const scores = c.scores && typeof c.scores === 'object' ? c.scores : null;
  const competitors = nzObj(c.competitors);
  const matrix = c.competitor_matrix && Array.isArray(c.competitor_matrix.rivals) && c.competitor_matrix.rivals.length
    ? c.competitor_matrix : null;
  const lostQueries = nzObj(c.lost_queries);
  const speedTips = nzStr(c.speed_tips);
  const recs = nzObj(c.recommendations);
  const speed = c.speed && typeof c.speed === 'object' ? c.speed : null;
  const psi = speed?.psi || null;
  const perf = speed?.local || null;
  const sm = audit?.site_meta || {};
  const sig = sm.signals && typeof sm.signals === 'object' ? sm.signals : null;
  const subpages = Array.isArray(sm.subpages) ? sm.subpages : [];
  // gdzie znaleziono dany sygnał (np. „/cennik") — zapisuje to edge przy skanie stron
  const scan = sm.scan && typeof sm.scan === 'object' ? sm.scan : null;
  const foundOn = (key) => (scan?.src?.[key] && scan.src[key] !== '/' ? scan.src[key] : '');
  const oferta = nzStr(c.oferta);
  // pełna inwentaryzacja sygnałów znalezionych w kodzie strony (fakty, nie opinie)
  const signalRows = !sig ? [] : [
    ['Meta description', !!sm.desc, '', 'desc'],
    ['Dane strukturalne Schema.org', !!sig.hasSchema, nzStr(sig.schemaTypes).join(', ') || 'obecne', 'schema'],
    ['Schema FAQ (pytania i odpowiedzi)', !!sig.faqSchema, '', 'faqSchema'],
    ['Open Graph (podgląd linku)', !!sig.hasOg, '', 'og'],
    ['Adres kanoniczny (canonical)', !!sig.hasCanonical, '', 'canonical'],
    ['Wersje językowe (hreflang)', !!sig.hasHreflang, nzStr(sig.langs).join(', '), 'hreflang'],
    ['Wersja mobilna (viewport)', !!sig.viewport, '', 'viewport'],
    ['Blog / aktualności', !!sig.blog, '', 'blog'],
    ['Funkcje sklepu / koszyk', !!sig.ecommerce, '', 'ecommerce'],
    ['Rezerwacja online', !!sig.booking, '', 'booking'],
    ['Czat lub agent na stronie', !!sig.chatWidget, String(sig.chatWidget || ''), 'chatWidget'],
    ['WhatsApp', !!sig.whatsapp, '', 'whatsapp'],
    ['Messenger', !!sig.messenger, '', 'messenger'],
    ['Mapa Google', !!sig.maps, '', 'maps'],
    ['Formularze kontaktowe', +sig.forms > 0, +sig.forms ? `${sig.forms}` : '', 'forms'],
    ['Zapis na newsletter', !!sig.newsletter, '', 'newsletter'],
    ['Ceny widoczne na stronie', !!sig.pricesOnSite, '', 'pricesOnSite'],
    ['Opinie klientów', !!sig.reviewsWidget || !!sig.reviews, '', 'reviewsWidget'],
    ['Materiały wideo', !!sig.video, '', 'video'],
    ['Analityka ruchu', !!sig.analytics, '', 'analytics'],
    ['Pixel reklamowy', !!sig.pixel, '', 'pixel'],
    ['Baner zgód (cookies)', !!sig.cookieBanner, '', 'cookieBanner'],
    ['Numery telefonu w kodzie', nzStr(sig.phones).length > 0, nzStr(sig.phones).length ? `${nzStr(sig.phones).length}` : '', 'phones'],
    ['Adresy e-mail', nzStr(sig.emails).length > 0, nzStr(sig.emails).length ? `${nzStr(sig.emails).length}` : '', 'emails'],
    ['Profile w social media', nzStr(sig.socials).length > 0, nzStr(sig.socials).join(', '), 'socials'],
    ['System zarządzania treścią (CMS)', !!sig.cms, String(sig.cms || ''), 'cms'],
  ];
  const sigOn = signalRows.filter(r => r[1]).length;
  const rate = (v, good, poor) => v == null ? '' : v <= good ? ' m-good' : v <= poor ? ' m-mid' : ' m-poor';
  const rateTone = (v, good, poor) => v == null ? '' : v <= good ? 'good' : v <= poor ? 'mid' : 'poor';
  const goodCount = plus.length, badCount = minus.length;
  const metricsBad = metrics.filter(m => /brak|nie|false|0/i.test(String(m.value || ''))).length;

  // тема в цветах сайта клиента
  const hexRgb = (h) => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(h || '').trim());
    return m ? { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) } : null;
  };
  const theme = audit?.site_meta?.theme || null;
  let themeStyle;
  if (theme) {
    const bg = hexRgb(theme.bg), acc = hexRgb(theme.accent);
    if (bg && acc) {
      const lumOf = (x) => (0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b) / 255;
      const fgHex = hexRgb(theme.fg) ? theme.fg : (lumOf(bg) > 0.5 ? '#141414' : '#F5F5F0');
      const fg = hexRgb(fgHex);
      themeStyle = {
        '--bg': theme.bg, '--bg-rgb': `${bg.r}, ${bg.g}, ${bg.b}`,
        '--fg': fgHex, '--fg-rgb': `${fg.r}, ${fg.g}, ${fg.b}`,
        '--acc': theme.accent, '--acc-rgb': `${acc.r}, ${acc.g}, ${acc.b}`,
        '--acc-ink': lumOf(acc) > 0.5 ? '#0D0D0D' : '#FFFFFF',
      };
    }
  }
  let sectionNo = 0;
  const no = () => String(++sectionNo).padStart(2, '0');
  const yn = (v) => v
    ? <span className="au-mx-yes"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M7 12.5l3.2 3.2L17 9" /></svg></span>
    : <span className="au-mx-no"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg></span>;
  const SIGNALS = ['hasDesc', 'hasSchema', 'hasOg', 'hasCanonical', 'hasHreflang', 'hasChat', 'hasBlog', 'hasBooking'];
  const sigCount = (x) => SIGNALS.reduce((a, k) => a + (x?.[k] ? 1 : 0), 0);

  return (
    <div className="au-page" style={themeStyle}>
      <style dangerouslySetInnerHTML={{ __html: auditCss }} />

      <header className="au-top">
        <div className="au-fiq-logo"><LogoFull /></div>
        <div className="au-top-label">Audyt SEO · GEO</div>
        {audit && <div className="au-top-date">{fmtDate(audit.generated_at || audit.created_at)}</div>}
      </header>

      {audit === undefined && <div className="au-gate">Ładowanie audytu…</div>}
      {audit === null && (
        <div className="au-gate">
          <div className="au-gate-title">Nie znaleziono audytu</div>
          <div>Sprawdź link lub skontaktuj się: <a href="mailto:infinitiq@fastline.pl">infinitiq@fastline.pl</a></div>
        </div>
      )}

      {audit && (
        <main className="au-main">
          {/* ===== HERO ===== */}
          <section className="au-hero">
            <div className="au-hero-mark"><LogoMarkStroke /><LogoMark /></div>
            <div className="au-hero-inner">
              {audit.logo_url && (
                <div className={'au-client-logo' + (audit.site_meta?.logo_light ? ' dark' : '') + (audit.site_meta?.logo_small ? ' small' : '')}>
                  <img src={audit.logo_url} alt={audit.client_name} onError={e => { e.target.parentNode.style.display = 'none'; }} />
                </div>
              )}
              <div className="au-eyebrow"><span className="au-dot" /> Audyt SEO · GEO — {audit.client_name} · oferta ważna 14 dni</div>
              <h1 className="au-h1">{c.hero?.headline || `Widoczność ${audit.client_name} w Google i w AI`}</h1>
              {c.hero?.sub && <p className="au-sub">{c.hero.sub}</p>}
              {scores && (
                <div className="au-scoreboard">
                  <div className="au-gauges">
                    <Gauge value={scores.google} label="Widoczność w Google" />
                    <Gauge value={scores.ai} label="Widoczność w AI" />
                    <Gauge value={scores.technika} label="Technika strony" />
                    <Gauge value={scores.tresc} label="Jakość treści" />
                  </div>
                  <div className="au-radar-wrap">
                    <Radar scores={scores} />
                    <div className="au-radar-cap">Profil widoczności · 0–100</div>
                  </div>
                </div>
              )}
              {scores && (
                <div className="au-legend">
                  <div className="au-legend-head"><Ic name="compass" size={18} /> Jak czytać te cztery wskaźniki</div>
                  <div className="au-legend-grid">
                    {SCORE_LEGEND.map(([t, ic, txt], i) => (
                      <div className="au-legend-item" key={i}>
                        <div className="au-legend-title"><Ic name={ic} size={17} /> {t}</div>
                        <p>{txt}</p>
                      </div>
                    ))}
                  </div>
                  <p className="au-legend-foot">
                    Skala 0–100 opisuje gotowość strony, a nie sympatię do marki. Wynik poniżej 45 oznacza, że w tym obszarze
                    tracicie klientów już dziś; 45–70 — fundament jest, ale nie pracuje na pełnych obrotach; powyżej 70 — obszar
                    działa i warto go utrzymać. Każdą z tych ocen rozkładamy na czynniki w kolejnych sekcjach.
                  </p>
                </div>
              )}
              <div className="au-hero-note"><LogoMark className="au-inline-mark" /> Przygotowane przez Fastline InfinitiQ · AI-Native Agency</div>
            </div>
          </section>

          {/* ===== ZAKRES ANALIZY ===== */}
          {(subpages.length > 0 || signalRows.length > 0) && (
            <section className="au-section">
              <SecHead no={no()} label="Zakres analizy" icon="doc" title="Co dokładnie sprawdziliśmy"
                lead={`Ten audyt nie jest opinią ani szablonem. ${fmtDate(audit.generated_at || audit.created_at)} pobraliśmy Waszą stronę${subpages.length ? ` wraz z ${subpages.length} ${plForm(subpages.length, 'podstroną', 'podstronami', 'podstronami')}` : ''} i przeczytaliśmy ją tak, jak czyta ją robot wyszukiwarki oraz model AI: kod, nagłówki, dane strukturalne, elementy sprzedażowe i pomiary wydajności. Wszystko, co niżej, ma źródło w tym, co realnie znaleźliśmy — dlatego pokazujemy również surowe fakty, a nie tylko wnioski.`} />
              <div className="au-scan">
                <div className="au-scan-col">
                  <div className="au-scan-head"><Ic name="layers" size={18} /> Przeanalizowane adresy</div>
                  <ul className="au-scan-list">
                    <li><span className="au-scan-ic"><Ic name="globe" size={16} /></span><span>{sm.finalUrl || audit.site_url}<em>strona główna</em></span></li>
                    {subpages.map((u, i) => (
                      <li key={i}><span className="au-scan-ic"><Ic name="arrow" size={16} /></span><span>{u}</span></li>
                    ))}
                  </ul>
                  <p className="au-scan-note">
                    Podstrony wybraliśmy tak, jak robi to wyszukiwarka: najpierw te, które opisują ofertę, cennik i kontakt.
                    Z każdej pobraliśmy tytuł, nagłówki i treść — to na ich podstawie powstała diagnoza, dobór fraz i zapytań do wyszukiwarki.
                  </p>
                </div>
                <div className="au-scan-col">
                  <div className="au-scan-head"><Ic name="message" size={18} /> Co strona mówi o sobie</div>
                  {sm.title && (
                    <div className="au-scan-field">
                      <div className="au-scan-label">Tytuł strony (widoczny w Google)</div>
                      <p className="au-scan-quote">{sm.title}</p>
                    </div>
                  )}
                  <div className="au-scan-field">
                    <div className="au-scan-label">Opis strony (meta description)</div>
                    {sm.desc
                      ? <p className="au-scan-quote">{sm.desc}</p>
                      : <p className="au-scan-quote empty">Brak — Google układa opis sam z przypadkowego fragmentu treści, a to on decyduje, czy klient kliknie właśnie Wasz wynik.</p>}
                  </div>
                  {perf && (
                    <p className="au-scan-note">
                      Pomiary techniczne strony głównej: kod waży {perf.htmlKb} KB, na stronie {perf.imgs} obrazów
                      {perf.lazyImgs ? `, w tym ${perf.lazyImgs} ładowanych dopiero przy przewijaniu` : ', żaden nie jest ładowany dopiero przy przewijaniu'}
                      , format WebP {perf.webp ? 'jest używany' : 'nie jest używany'}, doliczyliśmy się {perf.scripts} skryptów.
                      Serwer odpowiada w {perf.ttfbMs} ms.
                    </p>
                  )}
                </div>
              </div>
              {signalRows.length > 0 && (
                <>
                  <div className="au-sig-head">
                    <div className="au-sig-title"><Ic name="chip" size={18} /> Sygnały znalezione w kodzie strony</div>
                    <Segments value={sigOn} total={signalRows.length} label="elementów obecnych na stronie" />
                  </div>
                  <div className="au-sig">
                    {signalRows.map(([name, on, extra, key], i) => {
                      const where = on ? foundOn(key) : '';
                      return (
                        <div className={'au-sig-row' + (on ? ' on' : '')} key={i}>
                          <span className="au-sig-mark">{on ? <Ic name="check" size={19} /> : <Ic name="warn" size={19} />}</span>
                          <span className="au-sig-name">{name}{where && <em className="au-sig-where">znaleziono na {where}</em>}</span>
                          <span className="au-sig-val">{on ? (extra || 'jest') : 'nie znaleziono'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="au-note">
                    To inwentaryzacja, nie ocena — nie każda firma potrzebuje wszystkich elementów. W kolejnych sekcjach
                    tłumaczymy, które z tych braków realnie kosztują Was klientów, a które można spokojnie zostawić na później.
                  </div>
                  <div className="au-note">
                    <b>Jak to czytamy:</b> sprawdziliśmy kod {scan?.pages?.length || 1 + subpages.length}{' '}
                    {plForm(scan?.pages?.length || 1 + subpages.length, 'strony', 'stron', 'stron')} — przy elementach
                    znalezionych poza stroną główną piszemy, na której podstronie są.
                    {scan?.jsHeavy
                      ? ` „Nie znaleziono" znaczy dokładnie tyle: tego elementu nie ma w kodzie, który serwer wysyła przed uruchomieniem JavaScriptu. Wasza strona (${scan.builder || 'kreator stron'}) dorysowuje sporą część treści skryptem — w kodzie widać tylko ${scan.visibleChars} znaków tekstu. Google zwykle taki JavaScript wykona, ale roboty modeli AI (ChatGPT, Perplexity) najczęściej nie — i dla nich ta część strony po prostu nie istnieje. To nie jest błąd audytu, tylko realny problem widoczności w AI.`
                      : ' „Nie znaleziono" znaczy, że elementu nie ma w kodzie żadnej z tych stron — a więc nie widzi go ani wyszukiwarka, ani model AI. Jeśli element jest na stronie, ale dorysowuje go skrypt, dla botów AI zwykle nie istnieje.'}
                  </div>
                </>
              )}
            </section>
          )}

          {/* ===== DIAGNOZA ===== */}
          {diagnosis.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Diagnoza" icon="search" title="Jak rozumiemy Waszą sytuację"
                lead="Zanim zaproponujemy cokolwiek do wdrożenia, opisujemy, jak z zewnątrz — okiem klienta, wyszukiwarki i modelu AI — wygląda dziś Wasza firma. Poniżej profil odczytany wprost z treści strony oraz trzy obserwacje, które najmocniej wpływają na to, ilu klientów Was znajduje." />
              {(c.firma || c.branza || c.model || c.zasieg || c.lokalizacja || c.klient_docelowy || oferta.length > 0) && (
                <div className="au-profile">
                  <div className="au-profile-head"><Ic name="target" size={18} /> Profil firmy odczytany ze strony</div>
                  <div className="au-profile-rows">
                    {c.firma && <div className="au-profile-row"><span>Firma</span><b>{c.firma}</b></div>}
                    {c.branza && <div className="au-profile-row"><span>Branża</span><b>{c.branza}</b></div>}
                    {c.model && <div className="au-profile-row"><span>Model sprzedaży</span><b>{MODEL_LABEL[String(c.model).toLowerCase()] || c.model}</b></div>}
                    {c.zasieg && <div className="au-profile-row"><span>Zasięg działania</span><b>{c.zasieg}</b></div>}
                    {c.lokalizacja && <div className="au-profile-row"><span>Lokalizacja</span><b>{c.lokalizacja}</b></div>}
                    {c.klient_docelowy && <div className="au-profile-row"><span>Klient docelowy</span><b>{c.klient_docelowy}</b></div>}
                  </div>
                  {oferta.length > 0 && (
                    <div className="au-profile-offer">
                      <div className="au-profile-offer-label">Oferta, którą znaleźliśmy na stronie</div>
                      <div className="au-chips">{oferta.map((o, i) => <span key={i}><Ic name="check" size={14} /> {o}</span>)}</div>
                    </div>
                  )}
                  <p className="au-profile-note">
                    Ten profil jest punktem odniesienia dla całego audytu: na jego podstawie dobieramy frazy, szukamy
                    konkurentów w wyszukiwarce i wybieramy produkty z katalogu. Jeśli któryś element opisuje Was
                    nieprecyzyjnie — to pierwszy sygnał, że strona mówi o firmie coś innego, niż zamierzacie.
                  </p>
                </div>
              )}
              <div className="au-grid3">
                {diagnosis.map((d, i) => (
                  <div className="au-card" key={i}>
                    <Corners />
                    <div className="au-card-ic"><Ic name={DIAG_ICONS[i % DIAG_ICONS.length]} size={30} sw={1.4} /></div>
                    <div className="au-card-no">0{i + 1}</div>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PUNKT WYJŚCIA ===== */}
          {metrics.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Punkt wyjścia" icon="chip" title="Co widzą dziś Google i AI"
                lead={`${metrics.length - metricsBad} z ${metrics.length} sprawdzanych sygnałów działa${metricsBad ? `, ${metricsBad} wymaga naprawy` : ''}. To nie są opinie, tylko elementy, których obecność da się sprawdzić w kodzie strony w kilka sekund — i które w pierwszej kolejności decydują o tym, czy wyszukiwarka i model AI w ogóle rozumieją, co sprzedajecie. Przy każdym tłumaczymy, co konkretnie oznacza dla Waszej sprzedaży.`} />
              <div className="au-metrics">
                {metrics.map((m, i) => {
                  const bad = /brak|nie|false|0/i.test(String(m.value || ''));
                  const exp = explainMetric(m.label);
                  return (
                    <div className={'au-metric' + (bad ? ' bad' : ' good')} key={i}>
                      <div className="au-metric-ic"><Ic name={metricIcon(m.label)} size={26} sw={1.5} /></div>
                      <div className="au-metric-val">{m.value}</div>
                      <div className="au-metric-label">{m.label}</div>
                      {exp && <p className="au-metric-exp">{exp}</p>}
                      <div className="au-metric-state">{bad ? <><Ic name="warn" size={14} /> do naprawy</> : <><Ic name="check" size={14} /> działa</>}</div>
                    </div>
                  );
                })}
              </div>
              <div className="au-note">
                Każdy z tych elementów naprawia się raz i pracuje bezterminowo — to najtańsza część odzyskiwania widoczności.
                Kolejność wdrożenia proponujemy w sekcji rekomendacji, patrząc na to, co najszybciej przełoży się na zapytania od klientów.
              </div>
            </section>
          )}

          {/* ===== ANALIZA +/- ===== */}
          {(plus.length > 0 || minus.length > 0) && (
            <section className="au-section">
              <SecHead no={no()} label="Analiza obecnego stanu" icon="eye" title="Co działa, a co kosztuje widoczność"
                lead="Po lewej to, co już macie i na czym da się budować — tego nie ruszamy, tylko wzmacniamy. Po prawej rzeczy, które dziś kosztują Was zapytania: każdy punkt to konkret znaleziony na stronie, a nie ogólna uwaga o „potrzebie SEO”." />
              <div className="au-pm-bar">
                <div className="au-pm-bar-track">
                  <i className="ok" style={{ '--w': `${Math.round(goodCount / Math.max(1, goodCount + badCount) * 100)}%` }} />
                  <i className="warn" style={{ '--w': `${Math.round(badCount / Math.max(1, goodCount + badCount) * 100)}%` }} />
                </div>
                <div className="au-pm-bar-cap"><span><b>{goodCount}</b> atuty</span><span><b>{badCount}</b> do poprawy</span></div>
              </div>
              <div className="au-pm">
                <div className="au-pm-col">
                  <div className="au-pm-head plus"><Ic name="shield" size={20} /> Na plus</div>
                  {plus.map((t, i) => (
                    <div className="au-pm-item" key={i}>
                      <svg className="au-pm-mark ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M7 12.5l3.2 3.2L17 9" /></svg>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="au-pm-col">
                  <div className="au-pm-head minus"><Ic name="bolt" size={20} /> Do poprawy</div>
                  {minus.map((t, i) => (
                    <div className="au-pm-item" key={i}>
                      <svg className="au-pm-mark warn" viewBox="0 0 24 24"><path d="M12 3l9.5 17h-19z" /><path d="M12 9.5v4.5" /><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" /></svg>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ===== SZYBKOŚĆ ===== */}
          {(psi || perf) && (
            <section className="au-section">
              <SecHead no={no()} label="Szybkość strony" icon="speed" title="Jak szybko ładuje się strona na telefonie"
                lead="Google mierzy Core Web Vitals na urządzeniach mobilnych i traktuje je jako czynnik rankingowy — wolna strona traci pozycje, zanim ktokolwiek oceni ofertę. Drugi, dużo droższy skutek widać w sprzedaży: klient z telefonu rzadko czeka dłużej niż kilka sekund, a wraca do wyników wyszukiwania, gdzie czeka konkurencja. Poniżej każdy pomiar z progiem Google i wyjaśnieniem, co realnie oznacza." />
              <div className="au-speed">
                {psi && <div className="au-speed-score"><Gauge value={psi.score} label="PageSpeed · mobile" size={190} /></div>}
                <div className="au-speed-metrics">
                  {psi?.lcp?.ms != null && <Bar label="LCP · największy element" value={Math.min(psi.lcp.ms, 6000)} max={6000} text={psi.lcp.text} tone={rateTone(psi.lcp.ms, 2500, 4000)} hint={CWV_HINT.lcp} />}
                  {psi?.fcp?.ms != null && <Bar label="FCP · pierwsza treść" value={Math.min(psi.fcp.ms, 5000)} max={5000} text={psi.fcp.text} tone={rateTone(psi.fcp.ms, 1800, 3000)} hint={CWV_HINT.fcp} />}
                  {psi?.tbt?.ms != null && <Bar label="TBT · blokada wątku" value={Math.min(psi.tbt.ms, 1200)} max={1200} text={psi.tbt.text} tone={rateTone(psi.tbt.ms, 200, 600)} hint={CWV_HINT.tbt} />}
                  {psi?.cls?.val != null && <Bar label="CLS · stabilność układu" value={Math.min(psi.cls.val, 0.5)} max={0.5} text={psi.cls.text} tone={rateTone(psi.cls.val, 0.1, 0.25)} hint={CWV_HINT.cls} />}
                  {perf && <Bar label="TTFB · odpowiedź serwera" value={Math.min(perf.ttfbMs, 2500)} max={2500} text={`${perf.ttfbMs} ms`} tone={rateTone(perf.ttfbMs, 500, 1200)} hint={CWV_HINT.ttfb} />}
                  {perf && <Bar label={`Waga HTML · skryptów: ${perf.scripts}`} value={Math.min(perf.htmlKb, 1500)} max={1500} text={`${perf.htmlKb} KB`} tone={rateTone(perf.htmlKb, 300, 800)} hint={CWV_HINT.html} />}
                </div>
              </div>
              {speedTips.length > 0 && (
                <div className="au-tips">
                  {speedTips.map((t, i) => (
                    <div className="au-tip" key={i}><span className="au-tip-ic"><Ic name="wrench" size={20} /></span><span>{t}</span></div>
                  ))}
                </div>
              )}
              <div className="au-note">Pomiar: Google PageSpeed Insights (mobile){perf ? ' + pomiary własne serwera' : ''}. Zielony = w normie Google, żółty = do poprawy, czerwony = krytycznie.</div>
            </section>
          )}

          {/* ===== KONKURENCJA ===== */}
          {(competitors.length > 0 || matrix) && (
            <section className="au-section">
              <SecHead no={no()} label="Analiza konkurencji" icon="users" title="Kto dziś zbiera Waszych klientów"
                lead={matrix
                  ? `Konkurentów nie zgadujemy. ${matrix.search?.queries?.length ? 'Wpisaliśmy w wyszukiwarkę zapytania, którymi realnie szuka Wasz klient, odsialiśmy katalogi, portale i marketplace’y, a strony, które zostały, pobraliśmy i zmierzyliśmy' : 'Wskazane strony pobraliśmy i zmierzyliśmy'} tymi samymi narzędziami co Waszą. Poniżej porównanie oparte na twardych danych — plus opis tego, czym każdy z nich dziś wygrywa i gdzie zostawia Wam otwarte drzwi.`
                  : 'Nie znaleźliśmy stron, które moglibyśmy uczciwie zmierzyć jako Waszą bezpośrednią konkurencję — zamiast wymyślać nazwy firm, opisujemy typy graczy, z którymi realnie konkurujecie o tego samego klienta w Google i w odpowiedziach AI. Każdy typ ma inną przewagę i inną lukę, którą możecie wykorzystać.'} />
              {matrix && (() => {
                const cols = [matrix.client, ...matrix.rivals];
                const best = (vals, lowIsBetter) => {
                  const nums = vals.filter(v => typeof v === 'number');
                  if (!nums.length) return null;
                  return lowIsBetter ? Math.min(...nums) : Math.max(...nums);
                };
                const bTtfb = best(cols.map(x => x.ttfbMs), true);
                const bKb = best(cols.map(x => x.htmlKb), true);
                const maxTtfb = Math.max(...cols.map(x => x.ttfbMs || 0), 1);
                const num = (v, b, unit) => <span className={'au-mx-num' + (v === b ? ' best' : '')}>{v}{unit}</span>;
                const ROWS = [
                  ['Meta description', x => yn(x.hasDesc)],
                  ['Schema.org (dane dla AI)', x => yn(x.hasSchema)],
                  ['Open Graph', x => yn(x.hasOg)],
                  ['Canonical', x => yn(x.hasCanonical)],
                  ['Wersje językowe (hreflang)', x => yn(x.hasHreflang)],
                  ['Chat / agent na stronie', x => yn(x.hasChat)],
                  ['Blog / aktualności', x => yn(x.hasBlog)],
                  ['Odpowiedź serwera (TTFB)', x => num(x.ttfbMs, bTtfb, ' ms')],
                  ['Waga HTML', x => num(x.htmlKb, bKb, ' KB')],
                ];
                return (
                  <>
                    {nzStr(matrix.search?.queries).length > 0 && (
                      <div className="au-queries">
                        <div className="au-queries-head"><Ic name="search" size={18} /> Zapytania, którymi szukaliśmy konkurencji</div>
                        <div className="au-chips">{nzStr(matrix.search.queries).map((q, i) => <span key={i}><Ic name="search" size={14} /> {q}</span>)}</div>
                        <p className="au-queries-note">
                          To zapytania klienta końcowego, nie nazwy firm. Sprawdziliśmy, kto wychodzi na nich wysoko
                          {matrix.search?.candidates ? `, przejrzeliśmy ${matrix.search.candidates} ${plForm(matrix.search.candidates, 'adres', 'adresy', 'adresów')}` : ''} i odrzuciliśmy katalogi
                          firm, portale ogłoszeniowe, media oraz strony z Waszej własnej grupy. Zostały firmy, które realnie
                          zabierają Wam to samo zapytanie.
                        </p>
                      </div>
                    )}
                    <div className="au-mx-cards">
                      {cols.map((x, i) => (
                        <div className={'au-mx-card' + (i === 0 ? ' me' : '')} key={i}>
                          <div className="au-mx-card-name">{i === 0 ? audit.client_name : x.domain}{i === 0 && <span className="au-mx-you">Wy</span>}</div>
                          {i > 0 && x.title && <div className="au-mx-card-title">{x.title}</div>}
                          <Segments value={sigCount(x)} total={SIGNALS.length} label="sygnałów widoczności" />
                          <Bar label="TTFB" value={x.ttfbMs || 0} max={maxTtfb} text={`${x.ttfbMs ?? '—'} ms`} tone={rateTone(x.ttfbMs, 500, 1200)} />
                        </div>
                      ))}
                    </div>
                    <p className="au-p au-mx-intro">
                      Osiem sygnałów widoczności w kartach wyżej to elementy, po których wyszukiwarka i model AI poznają
                      stronę: opis, dane strukturalne, Open Graph, adres kanoniczny, wersje językowe, czat, blog i rezerwacja
                      online. Im więcej z nich ma konkurent, tym łatwiej maszynie opowiedzieć o nim klientowi. Pełne
                      zestawienie punkt po punkcie:
                    </p>
                    <div className="au-table-wrap au-mx-wrap">
                      <table className="au-table au-mx">
                        <thead>
                          <tr>
                            <th>Czynnik (pomiar rzeczywisty)</th>
                            {cols.map((x, i) => <th key={i} className={i === 0 ? 'au-mx-client' : ''}>{i === 0 ? audit.client_name : x.domain}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {ROWS.map(([label, fn], ri) => (
                            <tr key={ri}>
                              <td className="au-mx-factor">{label}</td>
                              {cols.map((x, i) => <td key={i} className={i === 0 ? 'au-mx-client' : ''}>{fn(x)}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="au-note">Zmierzone przez nas bezpośrednio na stronach ({new Date(audit.generated_at || audit.created_at).toLocaleDateString('pl-PL')}).</div>
                  </>
                );
              })()}
              {Array.isArray(c.competitor_matrix?.unmeasured) && c.competitor_matrix.unmeasured.length > 0 && (
                <div className="au-note">
                  {c.competitor_matrix.unmeasured.map(u =>
                    u.domain + (u.alive ? ' — strona aktywna, ale blokuje automatyczny pomiar (ochrona przed botami); analiza jakościowa poniżej' : ' — strona nie odpowiadała w czasie pomiaru')
                  ).join(' · ')}
                </div>
              )}
              {competitors.length > 0 && (
                <>
                <p className="au-p au-comp-intro">
                  {matrix
                    ? 'Liczby pokazują, kto jest lepiej przygotowany technicznie. Poniżej druga strona tego samego obrazu: czym każdy z tych graczy realnie przyciąga klienta i gdzie zostawia lukę, w którą możecie wejść.'
                    : 'Poniżej typy firm, które dziś odbierają zapytania od Waszych klientów. Przy każdym opisujemy, na czym stoi jego przewaga i którą jej częścią da się podważyć — bo w większości przypadków wygrywa nie lepsza usługa, tylko lepiej opisana.'}
                </p>
                <div className="au-comp">
                  {competitors.map((k, i) => {
                    const rival = matrix?.rivals?.find(r => String(r.domain || '').toLowerCase() === String(k.name || '').toLowerCase());
                    return (
                    <div className="au-comp-card" key={i}>
                      <Corners />
                      <div className="au-comp-name"><span className="au-comp-ic"><Ic name="users" size={22} /></span> <span>{k.name}</span></div>
                      {rival?.title && <div className="au-comp-title">{rival.title}</div>}
                      {k.profile && <div className="au-comp-profile">{k.profile}</div>}
                      <Spark seed={i + 3} up={i % 2 === 0} />
                      <div className="au-comp-block">
                        <div className="au-comp-tag"><Ic name="trend" size={13} /> Czym dziś wygrywa</div>
                        <p>{k.strengths}</p>
                      </div>
                      <div className="au-comp-block gap">
                        <div className="au-comp-tag"><Ic name="target" size={13} /> Wasza szansa</div>
                        <p>{k.gap}</p>
                      </div>
                    </div>
                    );
                  })}
                </div>
                </>
              )}
            </section>
          )}

          {/* ===== FRAZY ===== */}
          {keywords.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Frazy" icon="search" title="Czym szukają Was klienci"
                lead={`${keywords.length} ${plForm(keywords.length, 'zapytanie, które', 'zapytania, które', 'zapytań, które')} realni klienci wpisują w wyszukiwarkę, szukając takiej oferty jak Wasza. Nie są to frazy z Waszej strony — to język klienta, który jeszcze Was nie zna. Intencja mówi, na jakim etapie decyzji jest pytający, a potencjał — ile realnego zainteresowania stoi za frazą w Waszej branży i lokalizacji.`} />
              <div className="au-kw">
                {keywords.map((k, i) => (
                  <div className="au-kw-row" key={i}>
                    <div className="au-kw-phrase"><span className="au-kw-no">{String(i + 1).padStart(2, '0')}</span>{k.phrase}</div>
                    <div className="au-kw-intent"><Ic name={/lokal/i.test(k.intent) ? 'compass' : /zakup/i.test(k.intent) ? 'cart' : /porówn/i.test(k.intent) ? 'layers' : 'book'} size={15} /> {k.intent}</div>
                    <div className="au-kw-pot">
                      <div className="au-kw-bar"><i style={{ '--w': (POT_W[String(k.potential || '').toLowerCase()] || 30) + '%' }} /></div>
                      <span className={'au-pot p-' + (k.potential || '')}>{k.potential}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="au-legend au-legend-flat">
                <div className="au-legend-head"><Ic name="compass" size={18} /> Co oznaczają intencje w tabeli</div>
                <div className="au-legend-grid">
                  {INTENT_LEGEND.map(([t, ic, txt], i) => (
                    <div className="au-legend-item" key={i}>
                      <div className="au-legend-title"><Ic name={ic} size={17} /> {t}</div>
                      <p>{txt}</p>
                    </div>
                  ))}
                </div>
                <p className="au-legend-foot">
                  Kolejność nie jest przypadkowa: zaczynamy od fraz o wysokim potencjale i jasnej intencji zakupowej lub
                  lokalnej, bo tam najszybciej widać efekt w liczbie zapytań. Frazy informacyjne budują widoczność
                  w dłuższym horyzoncie — i to one najczęściej trafiają do odpowiedzi modeli AI.
                </p>
              </div>
              <div className="au-note">Szacunek na podstawie analizy AI — pełne wolumeny dostarczamy po podpięciu narzędzi w etapie 1.</div>
            </section>
          )}

          {/* ===== GDZIE UCIEKAJĄ KLIENCI ===== */}
          {lostQueries.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Utracone zapytania" icon="funnel" title="Zapytania, na których dziś tracicie klientów"
                lead="Klient pyta — a odpowiedź znajduje gdzie indziej. Każdy wiersz to konkretny wyciek z lejka i konkretna naprawa." />
              <div className="au-lost">
                <div className="au-lost-head">
                  <div>Zapytanie</div><div>Dlaczego klient trafia gdzie indziej</div><div>Co wdrożyć</div>
                </div>
                {lostQueries.map((q, i) => (
                  <div className="au-lost-row" key={i}>
                    <div className="au-lost-q"><span className="au-lost-ic"><Ic name="funnel" size={18} /></span>„{q.query}"</div>
                    <div className="au-lost-why">{q.why}</div>
                    <div className="au-lost-fix"><Ic name="arrow" size={16} /> <span>{q.fix}</span></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PROMPTY AI ===== */}
          {aiPrompts.length > 0 && (
            <section className="au-section">
              <div className="au-prompts-head">
                <SecHead no={no()} label="Jak klienci pytają AI" icon="robot" title="Decyzje zakupowe zaczynają się w ChatGPT"
                  lead="Coraz więcej decyzji zaczyna się nie w Google, a w ChatGPT, Gemini czy Perplexity. Jeśli model o Was nie wie — nie istniejecie w tej rozmowie. Tak wyglądają realne pytania w Waszej branży:" />
                <Orbit />
              </div>
              <div className="au-prompts">
                {aiPrompts.map((g, i) => (
                  <div className="au-prompt-group" key={i}>
                    <div className="au-prompt-cat"><Ic name="message" size={18} /> {g.category}</div>
                    {g.prompts.map((p, k) => (
                      <div className="au-prompt" key={k}>
                        <span className="au-prompt-bot"><Ic name="robot" size={18} /></span>
                        <span>„{p}"</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== DLACZEGO TERAZ ===== */}
          {whyNow.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Dlaczego teraz" icon="clock" title="Dlaczego warto działać teraz"
                lead="Widoczność nie znika z dnia na dzień — i tak samo nie wraca. Efekty pracy nad stroną narastają miesiącami, więc każdy kwartał zwłoki to nie tylko stracone zapytania dziś, ale i późniejszy start narastania jutro. Do tego dochodzi zmiana, która dzieje się właśnie teraz: część ruchu przenosi się z listy linków do gotowych odpowiedzi AI, a w nich miejsc jest znacznie mniej niż na pierwszej stronie Google." />
              <div className="au-grid3">
                {whyNow.map((d, i) => (
                  <div className="au-card" key={i}>
                    <Corners />
                    <div className="au-card-ic"><Ic name={WHY_ICONS[i % WHY_ICONS.length]} size={30} sw={1.4} /></div>
                    <div className="au-card-no">0{i + 1}</div>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PLAN ===== */}
          {plan.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Plan działania" icon="compass" title="Trzy etapy — od fundamentu do skali"
                lead="Pracujemy etapami, bo kolejność ma znaczenie: treści publikowane na niesprawnej technicznie stronie nie zdążą zapracować, a skalowanie bez pomiaru to przepalanie budżetu. Każdy etap kończy się czymś, co widać — nie prezentacją, tylko działającym elementem i liczbą, którą można porównać z punktem wyjścia." />
              <div className="au-plan">
                {plan.map((s, i) => (
                  <div className="au-step" key={i}>
                    <div className="au-step-rail">
                      <div className="au-step-node">{String(i + 1).padStart(2, '0')}</div>
                      {i < plan.length - 1 && <div className="au-step-line" />}
                    </div>
                    <div className="au-step-body">
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                      {s.effect && <div className="au-step-effect"><Ic name="chart" size={18} /> {s.effect}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== REKOMENDACJE ===== */}
          {recs.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Rekomendacje" icon="flag" title="Co zmienić w pierwszej kolejności"
                lead="Uporządkowane według wpływu na widoczność i sprzedaż. Wysoki priorytet = robimy w pierwszym miesiącu." />
              <div className="au-recs">
                {recs.map((r, i) => (
                  <div className={'au-rec pr-' + String(r.priority || '').toLowerCase()} key={i}>
                    <div className="au-rec-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="au-rec-body">
                      <div className="au-rec-head">
                        <h3>{r.title}</h3>
                        <span className={'au-pot p-' + (r.priority || '')}><Ic name="flag" size={12} /> {r.priority}</span>
                      </div>
                      <p>{r.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PRODUKTY Z KATALOGU FIQ ===== */}
          {products.length > 0 && (
            <section className="au-section au-products-sec">
              <div className="au-watermark"><LogoMark /></div>
              <SecHead no={no()} label="Produkty AI" icon="brain" title={`Produkty AI dopasowane do ${audit.client_name}`}
                lead={`Fastline InfinitiQ to 18 gotowych systemów AI, które sprzedają, obsługują i zarządzają. Z katalogu wybraliśmy ${products.length} produktów, które odpowiadają na to, co widzimy na Waszej stronie i w Waszej branży — każdy opisany pod Wasz biznes, z ceną katalogową.`} />
              <div className="au-products">
                {products.map((p) => (
                  <article className={'au-prod tier-' + (p.tier || 2)} key={p.id}>
                    <div className="au-prod-head">
                      <div className="au-prod-ic"><Ic name={productIcon(p.id, p.name)} size={34} sw={1.4} /></div>
                      <div className="au-prod-meta">
                        <div className="au-prod-tags">
                          <span className="au-prod-no">#{String(p.id).padStart(2, '0')}</span>
                          <span className="au-prod-group">{p.group}</span>
                          {p.sense && <span className="au-prod-sense"><Ic name={senseIcon(p.sense)} size={13} /> {p.sense}</span>}
                          <span className={'au-prod-tier t' + (p.tier || 2)}>{TIER_LABEL[p.tier] || 'Wzrost'}</span>
                        </div>
                        <h3>{p.name}</h3>
                        {p.tagline && <div className="au-prod-tagline">{p.tagline}</div>}
                      </div>
                      <div className="au-prod-price">
                        <div className="au-prod-price-row"><span>Wdrożenie</span><b>{p.impl_label}</b></div>
                        <div className="au-prod-price-row main"><span>Abonament</span><b>{p.sub_label}</b></div>
                      </div>
                    </div>
                    <div className="au-prod-body">
                      <div className="au-prod-col">
                        <div className="au-prod-tag"><Ic name="target" size={14} /> Dlaczego u Was</div>
                        <p>{p.why}</p>
                        {p.example && <div className="au-prod-example"><span className="au-prod-example-ic"><Ic name="message" size={18} /></span><span>{p.example}</span></div>}
                      </div>
                      <div className="au-prod-col">
                        <div className="au-prod-tag"><Ic name="wrench" size={14} /> Co wdrażamy u Was</div>
                        <ul className="au-prod-scope">
                          {(p.scope.length ? p.scope : nzStr(p.does)).map((s, k) => <li key={k}>{s}</li>)}
                        </ul>
                        {p.scope.length > 0 && nzStr(p.does).length > 0 && (
                          <div className="au-prod-does">
                            <div className="au-prod-does-label"><Ic name="box" size={13} /> Standardowy zakres produktu</div>
                            <ul>{nzStr(p.does).map((s, k) => <li key={k}>{s}</li>)}</ul>
                          </div>
                        )}
                      </div>
                      <div className="au-prod-col">
                        <div className="au-prod-tag"><Ic name="trend" size={14} /> Efekt</div>
                        <p>{p.effect}</p>
                        {p.kpi.length > 0 && (
                          <div className="au-prod-kpi">
                            <div className="au-prod-kpi-label"><Ic name="chart" size={14} /> Mierzymy</div>
                            {p.kpi.map((k, i) => <span key={i}>{k}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="au-note">Ceny netto z katalogu produktów Fastline InfinitiQ (segment MŚP): wdrożenie jednorazowe + abonament miesięczny, „od” — finalna wycena po rozmowie. InfinitiQ Secure (prywatna warstwa AI, RODO i EU AI Act) w cenie każdego produktu.</div>
            </section>
          )}

          {/* starsze audyty bez katalogu */}
          {products.length === 0 && services.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Usługi AI" icon="brain" title={`Co możemy zbudować z AI dla ${audit.client_name}`} />
              <div className="au-services">
                {services.map((s, i) => (
                  <div className="au-service" key={i}>
                    <div className="au-service-ic"><Ic name={serviceIcon(s.name)} size={30} /></div>
                    <div className="au-service-body">
                      <h3>{s.name}</h3>
                      <p>{s.desc}</p>
                      {s.effect && <div className="au-service-effect">→ {s.effect}</div>}
                      {s.example && <div className="au-service-example">Przykład: {s.example}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PAKIETY ===== */}
          {autoPackages.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Pakiety i inwestycja" icon="layers" title="Trzy drogi wejścia — jeden ekosystem"
                lead="Nie trzeba brać wszystkiego naraz. Zaczynacie od pakietu, który zamyka najpilniejszy problem, a kolejne produkty dokładacie, gdy zobaczycie wynik — wszystkie podpinają się do tej samej bazy wiedzy, jednego głosu marki i jednej warstwy InfinitiQ Secure." />
              <div className="au-packages au-packs">
                {autoPackages.map((pk, i) => {
                  const manual = (packages[i]?.price || '').trim();
                  const items = pk.product_ids.map(id => products.find(p => p.id === id)).filter(Boolean);
                  const maxSub = Math.max(...autoPackages.map(x => x.sub_from || 0), 1);
                  return (
                    <div className={'au-pack' + (i === 1 ? ' feat' : '')} key={pk.key || i}>
                      <Corners />
                      {i === 1 && <div className="au-pack-tag">Najczęściej wybierany</div>}
                      <div className="au-pack-level">{[0, 1, 2].map(b => <i key={b} className={b <= i ? 'on' : ''} />)}</div>
                      <div className="au-pack-name">{pk.name}</div>
                      {pk.subtitle && <div className="au-pack-subtitle">{pk.subtitle}</div>}
                      {pk.goal && <p className="au-pack-goal">{pk.goal}</p>}
                      <ul className="au-pack-items">
                        {items.map(p => (
                          <li key={p.id}>
                            <span className="au-pack-item-ic"><Ic name={productIcon(p.id, p.name)} size={18} /></span>
                            <span className="au-pack-item-name">{p.name}</span>
                            <em>{p.sub_label}</em>
                          </li>
                        ))}
                      </ul>
                      <div className="au-pack-total">
                        <div className="au-pack-price">{manual || pk.sub_label}</div>
                        {!manual && (
                          <>
                            <div className="au-pack-costbar"><i style={{ '--w': Math.round((pk.sub_from || 0) / maxSub * 100) + '%' }} /></div>
                            <div className="au-pack-sub"><span>wdrożenie <b>{pk.impl_label}</b></span><span>{pk.year_label}</span></div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="au-scope au-scope-after">
                <div className="au-scope-col">
                  <div className="au-scope-head"><Ic name="chip" size={20} /> W każdym pakiecie: fundament techniczny</div>
                  {SCOPE.basic.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
                </div>
                <div className="au-scope-col">
                  <div className="au-scope-head"><Ic name="robot" size={20} /> W każdym pakiecie: widoczność w AI (GEO)</div>
                  {SCOPE.geo.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
                </div>
              </div>
              {prices.note && <div className="au-note">{prices.note}</div>}
              <div className="au-note">Sumy pakietów = ceny katalogowe „od” wybranych produktów (netto). Wdrożenie, integracje i utrzymanie są po naszej stronie — model: wdrożenie jednorazowe + abonament miesięczny. Szacunek pierwszego roku = wdrożenie + 12 abonamentów.</div>
            </section>
          )}

          {/* starsze audyty: pakiety ręczne */}
          {autoPackages.length === 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Zakres i inwestycja" icon="layers" title="Zakres współpracy" />
              <div className="au-scope">
                <div className="au-scope-col">
                  <div className="au-scope-head"><Ic name="chip" size={20} /> Fundament techniczny</div>
                  {SCOPE.basic.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
                </div>
                <div className="au-scope-col">
                  <div className="au-scope-head"><Ic name="robot" size={20} /> Widoczność w AI (GEO)</div>
                  {SCOPE.geo.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
                </div>
              </div>
              <div className="au-packages">
                {(packages.length ? packages : [{ name: 'Podstawowy' }, { name: 'Standard' }, { name: 'Premium' }]).map((p, i) => (
                  <div className={'au-pack' + (i === 1 ? ' feat' : '')} key={i}>
                    {i === 1 && <div className="au-pack-tag">Najczęściej wybierany</div>}
                    <div className="au-pack-name">{p.name}</div>
                    <div className="au-pack-price">{(p.price || '').trim() || 'wycena indywidualna'}</div>
                    <div className="au-pack-level">{[0, 1, 2].map(b => <i key={b} className={b <= i ? 'on' : ''} />)}</div>
                  </div>
                ))}
              </div>
              {prices.note && <div className="au-note">{prices.note}</div>}
              {!hasPrices && <div className="au-note">Szczegółową wycenę przedstawiamy po rozmowie — zakres dopasowujemy do celów.</div>}
            </section>
          )}

          {/* ===== METODOLOGIA I SŁOWNIK ===== */}
          <section className="au-section au-method">
            <SecHead no={no()} label="Metodologia" icon="book" title="Skąd wzięliśmy te wnioski"
              lead="Audyt ma sens tylko wtedy, gdy da się sprawdzić, na czym stoi. Dlatego opisujemy wprost źródła danych i tłumaczymy każde pojęcie, którego użyliśmy — żeby ta rozmowa nie wymagała tłumacza z języka technicznego i żeby dało się nas rozliczyć z tego, co obiecujemy." />
            <div className="au-sources">
              {SOURCES.map(([t, ic, txt], i) => (
                <div className="au-source" key={i}>
                  <div className="au-source-ic"><Ic name={ic} size={28} sw={1.4} /></div>
                  <div>
                    <h3>{t}</h3>
                    <p>{txt}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="au-terms-head"><Ic name="book" size={18} /> Słownik pojęć użytych w audycie</div>
            <div className="au-terms">
              {TERMS.map(([t, ic, txt], i) => (
                <div className="au-term" key={i}>
                  <div className="au-term-name"><Ic name={ic} size={17} /> {t}</div>
                  <p>{txt}</p>
                </div>
              ))}
            </div>
            <div className="au-note">
              Czego ten audyt nie zawiera: danych z Waszej analityki i Search Console (nie mamy do nich dostępu przed
              rozpoczęciem współpracy) oraz dokładnych wolumenów wyszukiwań z płatnych narzędzi. Te liczby podpinamy
              w pierwszym etapie współpracy — wtedy każdą rekomendację da się dodatkowo zważyć realnym ruchem.
            </div>
          </section>

          {/* ===== FAQ ===== */}
          {faq.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="FAQ" icon="message" title="Najczęstsze pytania"
                lead="Pytania, które najczęściej padają na pierwszej rozmowie — odpowiadamy na nie od razu, żeby nie trzeba było na nie czekać." />
              <div className="au-faq">
                {faq.map((f, i) => (
                  <details className="au-faq-item" key={i}>
                    <summary><span className="au-faq-q"><Ic name="message" size={20} /> {f.q}</span><span className="au-faq-plus">＋</span></summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* ===== KONTAKT ===== */}
          <section className="au-section au-contact">
            <GrowthDeco />
            <div className="au-watermark right"><LogoMark /></div>
            <div className="au-label">{no()} — Co dalej</div>
            <h2 className="au-h2 big">Porozmawiajmy o wdrożeniu.</h2>
            <p className="au-lead">
              Ten dokument jest punktem wyjścia, nie ofertą do podpisania. Na rozmowie przechodzimy przez rekomendacje
              po kolei, ustalamy, co robimy najpierw, a co spokojnie może poczekać, i doprecyzowujemy zakres pod Wasz
              budżet oraz tempo. Jeśli po tej rozmowie uznacie, że część rzeczy zrobicie sami — dostaniecie od nas
              konkretną listę zamiast prezentacji. Pierwsza rozmowa jest bez zobowiązań i bez kosztu.
            </p>
            <a className="au-cta" href="mailto:infinitiq@fastline.pl?subject=Audyt%20SEO%20%C2%B7%20GEO">Napisz do nas → infinitiq@fastline.pl</a>
          </section>

          <footer className="au-footer">
            <div className="au-footer-logo"><LogoFull /></div>
            <p>© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
            <p>Data driven. Mind created. <span className="au-acc">AI executed.</span></p>
          </footer>
        </main>
      )}
    </div>
  );
}
