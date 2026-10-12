// SSG-пререндер: / и /kontakt рендерятся в статический HTML (SEO),
// остальные роуты обслуживает 404.html (SPA fallback GH Pages, noindex).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const template = readFileSync(resolve(dist, 'index.html'), 'utf8');
const { render } = await import(resolve(root, 'dist-ssr', 'entry-server.js'));

const HEAD_RE = /<!--head-->[\s\S]*?<!--\/head-->/;

const KONTAKT_HEAD = `<!--head-->
<title>Kontakt — Fastline InfinitiQ</title>
<meta name="description" content="Umów briefing strategiczny z Fastline InfinitiQ. Pierwsze spotkanie bez umów i zobowiązań — sprawdzamy, czy do siebie pasujemy.">
<link rel="canonical" href="https://fastlineinfinitiq.pl/kontakt">
<meta name="theme-color" content="#0D0D0D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fastline InfinitiQ">
<meta property="og:title" content="Kontakt — Fastline InfinitiQ">
<meta property="og:description" content="Umów briefing strategiczny — bez umów, bez zobowiązań.">
<meta property="og:url" content="https://fastlineinfinitiq.pl/kontakt">
<meta property="og:image" content="https://fastlineinfinitiq.pl/assets/og/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pl_PL">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Kontakt — Fastline InfinitiQ">
<meta name="twitter:description" content="Umów briefing strategiczny — bez umów, bez zobowiązań.">
<meta name="twitter:image" content="https://fastlineinfinitiq.pl/assets/og/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ContactPage","@id":"https://fastlineinfinitiq.pl/kontakt#page","url":"https://fastlineinfinitiq.pl/kontakt","name":"Kontakt — Fastline InfinitiQ","inLanguage":"pl-PL","about":{"@type":"Organization","@id":"https://fastlineinfinitiq.pl/#org","name":"Fastline InfinitiQ","email":"infinitiq@fastline.pl"}}</script>
<!--/head-->`;


const AGENCI_HEAD = `<!--head-->
<title>Agenci AI — zespół, który pracuje, kiedy Ty śpisz | Fastline InfinitiQ</title>
<meta name="description" content="AI Sprzedawca, AI Doradca, AI Recepcjonistka i AI Asystent — agenci wytrenowani na Twojej ofercie. Odbierają telefon, odpisują na zapytania i umawiają spotkania 24/7.">
<link rel="canonical" href="https://fastlineinfinitiq.pl/agenci-ai">
<meta name="theme-color" content="#0D0D0D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fastline InfinitiQ">
<meta property="og:title" content="Agenci AI — zespół, który pracuje, kiedy Ty śpisz">
<meta property="og:description" content="Jeden agent albo cały zespół: sprzedaż, doradztwo, recepcja telefoniczna i asystent wewnętrzny. Bez rekrutacji, bez drugiej zmiany.">
<meta property="og:url" content="https://fastlineinfinitiq.pl/agenci-ai">
<meta property="og:image" content="https://fastlineinfinitiq.pl/assets/og/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pl_PL">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Agenci AI — zespół, który pracuje, kiedy Ty śpisz">
<meta name="twitter:description" content="Sprzedaż, doradztwo, recepcja 24/7 i asystent wewnętrzny — agenci AI wytrenowani na Twojej firmie.">
<meta name="twitter:image" content="https://fastlineinfinitiq.pl/assets/og/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","@id":"https://fastlineinfinitiq.pl/agenci-ai#product","name":"Agenci AI — zespół agentów Fastline InfinitiQ","url":"https://fastlineinfinitiq.pl/agenci-ai","description":"Zespół agentów AI: AI Sprzedawca, AI Doradca, AI Recepcjonistka i AI Asystent. Wytrenowani na ofercie, procesach i języku marki klienta.","brand":{"@type":"Organization","@id":"https://fastlineinfinitiq.pl/#org","name":"Fastline InfinitiQ"},"category":"Agenci AI dla firm","hasVariant":[{"@type":"Product","name":"AI Sprzedawca","description":"Kwalifikuje leady, odpowiada z cennika i wpisuje spotkanie do kalendarza."},{"@type":"Product","name":"AI Doradca","description":"Na stronie identyfikuje potrzebę klienta i wskazuje jedno rozwiązanie z uzasadnieniem."},{"@type":"Product","name":"AI Recepcjonistka","description":"Odbiera telefon 24/7, informuje o cenach i godzinach, umawia wizyty."},{"@type":"Product","name":"AI Asystent","description":"Odpowiada zespołowi na pytania operacyjne ze wskazaniem źródła w dokumentach firmy."}]},{"@type":"FAQPage","@id":"https://fastlineinfinitiq.pl/agenci-ai#faq","mainEntity":[{"@type":"Question","name":"Muszę wdrażać wszystkich czterech?","acceptedAnswer":{"@type":"Answer","text":"Nie. Każdy działa samodzielnie. Zaczynasz od jednego i dokładasz kolejnych, kiedy chcesz."}},{"@type":"Question","name":"Czy klient pozna, że rozmawia z AI?","acceptedAnswer":{"@type":"Answer","text":"Agent przedstawia się jako asystent i oddaje rozmowę człowiekowi, tylko kiedy trzeba."}},{"@type":"Question","name":"Co, jeśli agent nie zna odpowiedzi?","acceptedAnswer":{"@type":"Answer","text":"Nie zmyśla. Przekazuje sprawę człowiekowi razem z całym kontekstem rozmowy."}},{"@type":"Question","name":"Podłączycie nasze narzędzia?","acceptedAnswer":{"@type":"Answer","text":"Tak — CRM, kalendarz, telefonię i kanały, z których już korzystacie."}}]}]}</script>
<!--/head-->`;

const DORADCA_HEAD = `<!--head-->
<title>AI Doradca — doradza klientom na Twojej stronie 24/7 | Fastline InfinitiQ</title>
<meta name="description" content="AI Doradca zagaduje klienta na stronie, dobiera wariant oferty i zostawia Ci kontakt. 490 zł/mies. netto, start tego samego dnia, umowa na miesiąc, bez programowania.">
<link rel="canonical" href="https://fastlineinfinitiq.pl/ai-doradca">
<meta name="theme-color" content="#0D0D0D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fastline InfinitiQ">
<meta property="og:title" content="AI Doradca — doradza klientom na Twojej stronie 24/7">
<meta property="og:description" content="Agent AI, który doradza jak dobry sprzedawca: pyta, rekomenduje wariant, przekazuje kontakt. 490 zł/mies., umowa na miesiąc.">
<meta property="og:url" content="https://fastlineinfinitiq.pl/ai-doradca">
<meta property="og:image" content="https://fastlineinfinitiq.pl/assets/og/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pl_PL">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="AI Doradca — doradza klientom na Twojej stronie 24/7">
<meta name="twitter:description" content="Agent AI, który doradza jak dobry sprzedawca: pyta, rekomenduje wariant, przekazuje kontakt. 490 zł/mies., umowa na miesiąc.">
<meta name="twitter:image" content="https://fastlineinfinitiq.pl/assets/og/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","@id":"https://fastlineinfinitiq.pl/ai-doradca#product","name":"AI Doradca — Fastline InfinitiQ","url":"https://fastlineinfinitiq.pl/ai-doradca","description":"Agent AI na stronie internetowej: zagaduje klienta, dobiera wariant oferty i przekazuje kontakt. 500 rozmów miesięcznie, katalog do 200 pozycji, raport miesięczny.","brand":{"@type":"Organization","@id":"https://fastlineinfinitiq.pl/#org","name":"Fastline InfinitiQ"},"category":"Agenci AI dla firm","offers":{"@type":"Offer","price":"490","priceCurrency":"PLN","url":"https://fastlineinfinitiq.pl/ai-doradca","availability":"https://schema.org/InStock","priceSpecification":{"@type":"UnitPriceSpecification","price":"490","priceCurrency":"PLN","valueAddedTaxIncluded":false,"billingDuration":"P1M"}}},{"@type":"FAQPage","@id":"https://fastlineinfinitiq.pl/ai-doradca#faq","mainEntity":[{"@type":"Question","name":"Skąd będzie znał moją ofertę?","acceptedAnswer":{"@type":"Answer","text":"Z materiałów, które nam dasz: strony, cennika, PDF-ów. Odpowiada wyłącznie z tej bazy."}},{"@type":"Question","name":"Czy zmyśli cenę albo termin?","acceptedAnswer":{"@type":"Answer","text":"Nie. Zakres tego, co wolno mu obiecać, ustalasz Ty na starcie."}},{"@type":"Question","name":"Czy muszę coś programować?","acceptedAnswer":{"@type":"Answer","text":"Jedna linijka kodu na stronie. Albo wybierasz wariant z podłączeniem i robimy to za Ciebie."}},{"@type":"Question","name":"Co z danymi?","acceptedAnswer":{"@type":"Answer","text":"Serwery w Unii Europejskiej, umowa powierzenia. Rozmowy należą do Ciebie."}},{"@type":"Question","name":"Co, jeśli nie zadziała?","acceptedAnswer":{"@type":"Answer","text":"Umowa na miesiąc. Rezygnujesz z końcem opłaconego okresu, bez kar."}},{"@type":"Question","name":"Czym to się różni od czatu, który już mam?","acceptedAnswer":{"@type":"Answer","text":"Czat zbiera adresy. Doradca rekomenduje wariant i doprowadza do zakupu albo do kalendarza."}}]}]}</script>
<!--/head-->`;

// dokumenty prawne — tytuł/description z treści, canonical, bez JSON-LD
const LEGAL_META = {
  'polityka-prywatnosci': ['Polityka prywatności — Fastline InfinitiQ', 'Jakie dane przetwarzamy, po co i jak długo — strona, panel klienta i agenci AI. Administrator, podwykonawcy, prawa użytkownika.'],
  'polityka-cookies': ['Polityka cookies — Fastline InfinitiQ', 'Nie używamy cookies reklamowych ani analitycznych. Co zapisujemy w przeglądarce i jak tym zarządzać.'],
  regulamin: ['Regulamin serwisu — Fastline InfinitiQ', 'Zasady korzystania ze strony, formularzy i bezpłatnego audytu AI.'],
  'usuwanie-danych': ['Usuwanie danych — Fastline InfinitiQ', 'Jak usunąć dane przetwarzane przez aplikację Infinitiq (Messenger, Instagram) i agentów AI. Żądanie e-mailem, realizacja do 30 dni.'],
};
const legalHead = (slug) => `<!--head-->
<title>${LEGAL_META[slug][0]}</title>
<meta name="description" content="${LEGAL_META[slug][1]}">
<link rel="canonical" href="https://fastlineinfinitiq.pl/${slug}">
<meta name="theme-color" content="#0D0D0D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fastline InfinitiQ">
<meta property="og:title" content="${LEGAL_META[slug][0]}">
<meta property="og:description" content="${LEGAL_META[slug][1]}">
<meta property="og:url" content="https://fastlineinfinitiq.pl/${slug}">
<meta property="og:image" content="https://fastlineinfinitiq.pl/assets/og/og.jpg">
<meta property="og:locale" content="pl_PL">
<!--/head-->`;

const FALLBACK_HEAD = `<!--head-->
<title>Fastline InfinitiQ — AI-Native Agency</title>
<meta name="robots" content="noindex">
<!--/head-->`;

function page(url, head) {
  let html = template;
  if (head) html = html.replace(HEAD_RE, head);
  return html.replace('<!--app-html-->', render(url));
}

// / — главная (дефолтный head из шаблона)
writeFileSync(resolve(dist, 'index.html'), page('/'));

// /kontakt/
mkdirSync(resolve(dist, 'kontakt'), { recursive: true });
writeFileSync(resolve(dist, 'kontakt', 'index.html'), page('/kontakt', KONTAKT_HEAD));

// /agenci-ai/ — strona produktowa zbiorcza (czterej agenci)
mkdirSync(resolve(dist, 'agenci-ai'), { recursive: true });
writeFileSync(resolve(dist, 'agenci-ai', 'index.html'), page('/agenci-ai', AGENCI_HEAD));

// /ai-doradca/ — LP produktu AI Doradca
mkdirSync(resolve(dist, 'ai-doradca'), { recursive: true });
writeFileSync(resolve(dist, 'ai-doradca', 'index.html'), page('/ai-doradca', DORADCA_HEAD));

// dokumenty prawne
for (const slug of Object.keys(LEGAL_META)) {
  mkdirSync(resolve(dist, slug), { recursive: true });
  writeFileSync(resolve(dist, slug, 'index.html'), page(`/${slug}`, legalHead(slug)));
}

// 404.html — SPA fallback (editor/login/audyt и любые прямые заходы), noindex
writeFileSync(resolve(dist, '404.html'), template.replace(HEAD_RE, FALLBACK_HEAD));

console.log('prerender done: /, /kontakt, /agenci-ai, /ai-doradca, 4 dokumenty prawne, 404.html');
