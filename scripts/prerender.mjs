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

// 404.html — SPA fallback (editor/login/audyt и любые прямые заходы), noindex
writeFileSync(resolve(dist, '404.html'), template.replace(HEAD_RE, FALLBACK_HEAD));

console.log('prerender done: /, /kontakt, /agenci-ai, 404.html');
