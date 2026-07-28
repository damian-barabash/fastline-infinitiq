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
<link rel="canonical" href="https://infinitiq.fastline.pl/kontakt">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fastline InfinitiQ">
<meta property="og:title" content="Kontakt — Fastline InfinitiQ">
<meta property="og:description" content="Umów briefing strategiczny — bez umów, bez zobowiązań.">
<meta property="og:url" content="https://infinitiq.fastline.pl/kontakt">
<meta property="og:image" content="https://infinitiq.fastline.pl/assets/logo/LOGO.png">
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

// 404.html — SPA fallback (editor/login/audyt и любые прямые заходы), noindex
writeFileSync(resolve(dist, '404.html'), template.replace(HEAD_RE, FALLBACK_HEAD));

console.log('prerender done: /, /kontakt, 404.html');
