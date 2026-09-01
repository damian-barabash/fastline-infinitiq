// audit-run v24 — generuje audyt SEO/GEO strony klienta przez Barabash AI.
// Wywoływane z edytora (wymagany zalogowany user). Zapisuje wynik do public.audits.
//
// Co robi (kolejność):
//  1. pobiera stronę klienta + do 5 podstron (o nas / oferta / produkty / cennik / kontakt),
//     wyciąga sygnały techniczne i biznesowe (schema, OG, kanały kontaktu, chat, booking,
//     e-commerce, blog, opinie…), logo (kandydaci + realna weryfikacja obrazka) i favicon
//  2. AI para 1: diagnoza (+ zapytania do wyszukiwarki) ‖ oferta (frazy, prompty, plan, FAQ)
//  3. KONKURENCI: realne wyszukiwanie w sieci (Brave → DDG → Bing) po zapytaniach z p1,
//     scoring domen, filtry (media/katalogi/social/marketplace/własna grupa/parking),
//     pomiar sygnałów na stronach kandydatów; AI wybiera bezpośrednich
//  4. AI para 2: produkty z katalogu FIQ (6 dopasowanych, szczegółowo) ‖ konkurencja + naprawy
//  5. pakiety Start / Wzrost / Skala liczone w kodzie z cen katalogowych (nie przez AI)
// Ograniczenia: max 2 równoległe wywołania AI (wspólny gateway), model z env AUDIT_MODEL.
// Izolat edge żyje ~150 s → audyt jedzie w 3 etapach (funkcja woła samą siebie), panel polluje status.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = (Deno.env.get("BARABASH_AI_URL") ?? "https://barabash-ai.tailcd3444.ts.net/v1").replace(/\/+$/, "");
const AI_KEY = Deno.env.get("BARABASH_AI_KEY") ?? "";
const AI_MODEL = Deno.env.get("AUDIT_MODEL") ?? "qwen3.5:9b";
// klucz do wywołań wewnętrznych (etapy 2/3 + debug) — secret AUDIT_INTERNAL_KEY
const INTERNAL_KEY = Deno.env.get("AUDIT_INTERNAL_KEY") ?? "";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

// ======================= KATALOG PRODUKTÓW FIQ (z PDF Katalog MŚP, 08.2026) =======================
// Ceny netto PLN: wdrożenie jednorazowe + abonament miesięczny ("od"). InfinitiQ Secure w cenie.
type Product = {
  id: number; name: string; group: string; sense: "Brain" | "Mind" | "Hand" | "Heart" | "Eyes";
  tagline: string; does: string[]; problem: string; effect: string; impl: number; sub: number;
};
const CATALOG: Product[] = [
  { id: 1, name: "AI Agents Suite", group: "Agenci i obsługa klienta", sense: "Brain",
    tagline: "Trzej agenci AI na czacie, w social, na WhatsAppie i na telefonie.",
    does: ["Agent Sprzedawca: łapie zapytanie w sekundę i prowadzi rozmowę do zamknięcia albo umówionego spotkania", "Agent Doradca: dobiera wariant oferty do potrzeb, rozbraja wątpliwości, prowadzi przez zakup", "Agent Asystent: wewnętrzna baza wiedzy dla zespołu"],
    problem: "leady giną wieczorem i w weekend, klient czeka na odpowiedź i pisze do konkurencji, a każdy człowiek na pierwszej linii to rekrutacja, koszt i rotacja",
    effect: "sprzedaż i obsługa działają non-stop, w każdym kanale, bez powiększania zespołu", impl: 6000, sub: 3000 },
  { id: 2, name: "AI Reception", group: "Agenci i obsługa klienta", sense: "Heart",
    tagline: "Głosowy agent, który odbiera telefon 24/7 i prowadzi kalendarz wizyt.",
    does: ["Odbiera i umawia na telefonie naturalnym głosem o każdej porze (rezerwacje, przełożenia, odwołania)", "Synchronizuje się z grafikiem zespołu — bez podwójnych rezerwacji", "Wysyła SMS-przypomnienia przed wizytą — tnie nieobecności"],
    problem: "telefon dzwoni, gdy nikt nie może odebrać (wieczór, weekend, zabieg), klient idzie do konkurencji; recepcja tonie w telefonach; no-showy zżerają grafik",
    effect: "żaden telefon nie zostaje bez odpowiedzi, kalendarz zapełnia się sam, przypomnienia tną nieobecności", impl: 3000, sub: 1500 },
  { id: 3, name: "Quality Relationship Intelligence", group: "Sprzedaż", sense: "Eyes",
    tagline: "Więcej niż CRM: strategia relacji z każdym klientem plus kontrola jakości 100% rozmów.",
    does: ["Indywidualna strategia prowadzenia każdego klienta: gdzie jesteśmy, dokąd zmierzamy, następny cel", "Gotowa komunikacja, cele i argumentacja dla handlowca pod konkretnego człowieka", "Kolejka priorytetów: kogo ruszyć i kiedy", "Kontrola jakości 100% rozmów, czatów i maili — wskazuje, gdzie zespół traci sprzedaż", "Pętla ucząca: najlepsze rozmowy stają się wzorcem"],
    problem: "CRM przechowuje historię, ale handlowiec sam wymyśla, co z nią zrobić; nikt nie sprawdza, jak poszła rozmowa, więc te same błędy powtarzają się miesiącami",
    effect: "każdy klient prowadzony jak przez najlepszego stratega w firmie; sprzedaż przestaje zależeć od tego, kto ma dobry dzień", impl: 8000, sub: 3500 },
  { id: 4, name: "AI Instant Offer Engine", group: "Sprzedaż", sense: "Hand",
    tagline: "Oferta z briefu w kilka minut, z trackingiem otwarć i automatycznym follow-upem.",
    does: ["Składa wycenioną ofertę z briefu w minuty — dobór produktów, kalkulacja, skład w identyfikacji marki", "Śledzi, kto otworzył ofertę, ile czytał i gdzie się zatrzymał", "Sam pilnuje follow-upu, gdy klient milczy"],
    problem: "oferta powstaje ręcznie dzień lub trzy po rozmowie, klient stygnie, a po wysyłce wpada do czarnej dziury",
    effect: "oferta wychodzi tego samego dnia, wygląda profesjonalnie i sama się pilnuje; handlowiec dzwoni, kiedy klient realnie czyta", impl: 3000, sub: 1500 },
  { id: 5, name: "Loyalty OS", group: "Sprzedaż", sense: "Heart",
    tagline: "Własna aplikacja lojalnościowa w Twoim brandingu, instalowana z linku/QR, z gamifikacją i AI push.",
    does: ["Aplikacja pod marką klienta instalowana z linku lub QR — bez App Store i Google Play, bez prowizji", "Panel: punkty, nagrody, kupony, segmenty; AI układa kampanie push do właściwych klientów we właściwym momencie", "Gamifikacja: punkty, wyzwania, poziomy", "Mechanika dopasowana do branży (klinika, gastro, retail, usługi)"],
    problem: "klient kupuje raz i przepada, a jedyny kanał powrotu to płatne social media, gdzie za dotarcie do własnych klientów płaci się co miesiąc",
    effect: "klient wraca częściej, jego wartość w czasie rośnie, firma ma własny bezpłatny kanał kontaktu niezależny od Meta i Google", impl: 5000, sub: 2200 },
  { id: 6, name: "Command Center", group: "Operacje i zarządzanie", sense: "Brain",
    tagline: "Rozmawiaj z danymi swojej firmy: pytasz zwykłym językiem, dostajesz odpowiedź, wykres albo akcję.",
    does: ["AI podpięte do CRM, baz danych i stanów magazynowych — odpowiedź i wykres na żądanie", "Widzi do przodu: zauważa, co się kończy, i domyka (np. zamawia z wyprzedzeniem)", "Jedno źródło prawdy dla całej firmy"],
    problem: "dane siedzą w kilku systemach i arkuszach; decyzje zapadają na przeczucie albo za późno, po raporcie w piątek",
    effect: "zarząd dostaje odpowiedź w minutę, firma pracuje na jednym źródle prawdy, rutyna dzieje się sama", impl: 6000, sub: 2500 },
  { id: 7, name: "AI CFO", group: "Operacje i zarządzanie", sense: "Brain",
    tagline: "Dyrektor finansowy na zawołanie, z data hubem i kontekstem z rynku.",
    does: ["Odpowiada na każde pytanie o pieniądze natychmiast: rentowność, marża, koszty, płynność, scenariusze co-jeśli", "Data hub spina dane firmy + sygnały z rynku (sezon, trendy, pogoda)", "Prognozuje lukę w kasie, pilnuje marży, sam wysyła monity za przeterminowane faktury"],
    problem: "właściciel podejmuje decyzje finansowe na czuja albo czeka na zamknięcie miesiąca; na etat dyrektora finansowego mała firma nie idzie",
    effect: "dyrektor finansowy 24/7 na danych firmy i kontekście rynku; decyzje o pieniądzach przestają być zgadywaniem", impl: 5000, sub: 2500 },
  { id: 8, name: "Warehouse Autopilot", group: "Operacje i zarządzanie", sense: "Hand",
    tagline: "AI przejmuje zakupy i stany: prognoza rotacji, dostawcy, automatyczne zamówienia.",
    does: ["Prognozuje rotację i sezon — zakupy pod realny popyt", "Znajduje i porównuje dostawców, pokazuje, gdzie kupić taniej lub szybciej", "Zamawia automatycznie z wyprzedzeniem dopasowanym do czasu dostawy"],
    problem: "albo brakuje towaru i tracisz sprzedaż, albo magazyn jest zapchany, a gotówka zamrożona; jedno i drugie liczone ręcznie w Excelu",
    effect: "mniej braków na półce i mniej kapitału zamrożonego w towarze; zakupy prowadzą się same", impl: 5000, sub: 2200 },
  { id: 9, name: "WorkPilot", group: "Operacje i zarządzanie", sense: "Hand",
    tagline: "Twój project manager AI: zna zadania i terminy, przypomina zawczasu, sam rozdziela pracę.",
    does: ["Przypomina zawczasu, nie po fakcie, i dopytuje, czy zrobione", "Codzienny raport dla zarządu: zrobione kontra zaległe", "Rozdziela zadania automatycznie do właściwych osób"],
    problem: "terminy wiszą na pamięci ludzi; szef nie wie, co zrobione, dopóki nie zapyta; ktoś ręcznie przypomina i spina — i to jest wąskie gardło",
    effect: "projekty płyną, zespół dostaje zadania i przypomnienia sam, zarząd ma obraz na bieżąco", impl: 3000, sub: 1500 },
  { id: 10, name: "AI Dynamic Pricing", group: "Operacje i zarządzanie", sense: "Eyes",
    tagline: "Ceny nadążają za rynkiem: monitoring konkurencji i popytu, symulacja marży, auto-zmiana w Twoich regułach.",
    does: ["Śledzi ceny konkurencji i popyt na żywo", "Rekomenduje cenę i marżę, symuluje skutek zmiany, zanim ją wdrożysz", "Zmienia ceny automatycznie w ustalonych regułach i granicach"],
    problem: "cenę ustawia się raz i zostaje na lata; firma traci marżę na hitach i sprzedaż na produktach za drogich; konkurencja zmienia ceny co tydzień",
    effect: "cena nadąża za rynkiem bez ręcznej pracy, marża pilnowana na bieżąco", impl: 4000, sub: 2200 },
  { id: 11, name: "AI Content Factory", group: "Marketing i treści", sense: "Mind",
    tagline: "Copy i grafiki sprzedażowe w tonie Twojej marki, z planem publikacji na miesiąc.",
    does: ["Pisze teksty pod posty, promocje i kampanie w tonie marki (kontekst z Brand Voice Core)", "Robi grafiki sprzedażowe w identyfikacji marki — bez stocków i czekania na grafika", "Układa plan publikacji na miesiąc do przodu"],
    problem: "treści trzeba produkować stale, a nie ma tego kto robić — profil zamiera; generyczne AI brzmi jak wszyscy",
    effect: "stała produkcja treści i grafik w tonie marki, z planem, bez zespołu i wąskiego gardła", impl: 3000, sub: 1800 },
  { id: 12, name: "SEO & GEO Autopilot", group: "Marketing i treści", sense: "Mind",
    tagline: "Auto-blog pod Google i widoczność w odpowiedziach AI (GEO), instalacja w jednym kliknięciu.",
    does: ["Audyt i mapa słów kluczowych na start", "Pisze i publikuje bloga w harmonogramie, w tonie marki", "Optymalizuje pod pozycje w Google i cytowania w ChatGPT, Perplexity, Google AI Overviews (GEO)"],
    problem: "content trzeba produkować stale, a blog stoi; drugi front: klient pyta AI, a jeśli model o firmie nie wie — firma nie istnieje w tej rozmowie",
    effect: "stały dopływ darmowego ruchu organicznego plus obecność w odpowiedziach AI, na autopilocie", impl: 3000, sub: 1800 },
  { id: 13, name: "AI Reputation Management", group: "Marketing i treści", sense: "Eyes",
    tagline: "Monitoring i obsługa opinii w Google, social i portalach branżowych, głosem marki.",
    does: ["Odpowiada na każdą opinię w kilka minut, w tonie marki", "Alarmuje przy negatywie i sygnale kryzysu", "Sam prosi zadowolonych klientów o opinię — ocena rośnie"],
    problem: "opinie decydują o zakupie, ale nikt ich nie pilnuje; negatyw wisi tygodniami; zadowoleni milczą, bo nikt ich nie poprosił",
    effect: "ocena marki rośnie, każda opinia ma odpowiedź, negatyw gaszony wcześnie", impl: 2000, sub: 1200 },
  { id: 14, name: "AI Creative Director", group: "Marketing i treści", sense: "Mind",
    tagline: "Asystent, który dobiera najlepsze narzędzia AI i robi foto oraz wideo spójne z marką.",
    does: ["Dobiera narzędzie AI do zadania (gadająca głowa, foto produktowe, cięcia)", "Produkuje od konceptu do gotowca: awatary, UGC, foto produktowe, wersje pod Reels/TikTok/Meta/YouTube", "Pilnuje spójności marki; dubbing i napisy na rynki zagraniczne"],
    problem: "narzędzi AI do foto i wideo są dziesiątki, każde robi coś innego — wideo w ogóle nie powstaje, bo nikt nie ma czasu tego poskładać",
    effect: "foto i wideo powstają na zawołanie, spójne z marką, w każdym formacie i języku", impl: 3000, sub: 2200 },
  { id: 15, name: "AI Channel Director", group: "Marketing i treści", sense: "Mind",
    tagline: "Dyrygent komunikacji: strategia, dobór kanałów i publikacja, w 100% automatycznie.",
    does: ["Układa strategię i dobiera kanały pod cel", "Bierze gotowe treści z Content Factory i Creative Director", "Publikuje sam, w optymalnym momencie i formacie każdej platformy"],
    problem: "firma wie, że trzeba być w kanałach, ale nie ma strategii — posty lecą chaotycznie albo wcale; ktoś musi ręcznie wrzucać na pięć platform",
    effect: "komunikacja spójna, regularna i na właściwych kanałach, bez zespołu i ręcznej publikacji", impl: 3000, sub: 2200 },
  { id: 16, name: "Brand Voice Core", group: "Marketing i treści", sense: "Brain",
    tagline: "Rdzeń języka marki, który zasila wszystkie produkty treściowe.",
    does: ["Jeden ton głosu we wszystkich kanałach: post, mail, czat, odpowiedź na recenzję", "Słownik i lista zakazów — bez wpadek i obietnic, których marka nie składa", "Wersjonowanie i kontrola jakości każdej wypowiedzi"],
    problem: "każdy pisze inaczej (handlowiec, marketing, bot, agencja) — marka brzmi jak kilka różnych firm",
    effect: "marka brzmi jednym, rozpoznawalnym głosem wszędzie; fundament dla wszystkich produktów AI", impl: 2500, sub: 500 },
  { id: 17, name: "AI Recruiter", group: "Zespół i fundament", sense: "Heart",
    tagline: "Od CV do pierwszego dnia: screening, ranking, głosowa rozmowa wstępna, przekazanie do onboardingu.",
    does: ["Przesiewa i rankinguje CV według kryteriów roli", "Sam prowadzi głosową rozmowę wstępną o każdej porze i ocenia odpowiedzi", "Przekazuje wybranego kandydata do onboardingu (spięte z AI Academy)"],
    problem: "rekrutacja zżera tygodnie na przesiewanie CV i rozmowy, które nic nie wnoszą; między akceptacją oferty a pierwszym dniem panuje cisza",
    effect: "krótsza rekrutacja, do rozmowy trafiają tylko dopasowani, nowy płynnie wchodzi w onboarding", impl: 4000, sub: 2000 },
  { id: 18, name: "AI Academy", group: "Zespół i fundament", sense: "Brain",
    tagline: "Onboarding od pierwszego dnia plus kursy, testy i certyfikaty z wiedzy Twojej firmy.",
    does: ["Onboarding: dokumenty, dostępy, plan pierwszego tygodnia i baza wiedzy gotowe przed startem", "Ścieżka szkoleniowa pod każde stanowisko", "Testy i certyfikaty; mikroszkolenia dokładnie tam, gdzie luka"],
    problem: "wiedza firmy tkwi w głowach kilku osób i wychodzi z nimi; onboarding zżera czas seniorów; nowy wchodzi w rolę tygodniami",
    effect: "wiedza zostaje w firmie, nowy jest produktywny od pierwszego dnia, luki domykają się same", impl: 5000, sub: 2000 },
];
const CONTENT_IDS = new Set([11, 12, 13, 14, 15]); // produkty treściowe → wymagają Brand Voice Core (16)
const fmtPln = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " zł";
function catalogBrief(): string {
  return CATALOG.map(p =>
    `#${p.id} ${p.name} [${p.group} · ${p.sense}] — ${p.tagline} Co robi: ${p.does.join("; ")}. Problem: ${p.problem}. Efekt: ${p.effect}. Wdrożenie od ${fmtPln(p.impl)}, abonament od ${fmtPln(p.sub)}/mies.`
  ).join("\n");
}

// ======================= narzędzia HTML =======================
function absUrl(src: string, base: string): string {
  src = String(src || "").trim();
  if (!src || /^(data|javascript|mailto|tel):/i.test(src)) return "";
  try { return new URL(src, base).href; } catch { return ""; }
}
function extract(re: RegExp, html: string): string {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}
function extractAll(re: RegExp, html: string, max = 40): string[] {
  const out: string[] = [];
  let m;
  while ((m = re.exec(html)) && out.length < max) out.push(m[1].trim());
  return out;
}
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&oacute;/g, "ó").replace(/&Oacute;/g, "Ó")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return " "; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return " "; } })
    .replace(/&[a-z]+;/gi, " ");
}
function stripCode(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}
function stripTags(html: string): string {
  return decodeEntities(stripCode(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function metaContent(html: string, key: string, attr = "name"): string {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, "i");
  return decodeEntities(extract(re1, html) || extract(re2, html));
}
async function fetchText(url: string, ms: number, headers: Record<string, string> = {}, maxBytes = 2_500_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal, redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "pl,en;q=0.8", Accept: "text/html,application/xhtml+xml,*/*;q=0.8", ...headers },
    });
    const ttfbMs = Date.now() - t0;
    const text = ((await res.text().catch(() => "")) || "").slice(0, maxBytes);
    return { res, text, ttfbMs };
  } finally { clearTimeout(t); }
}

// ======================= LOGO + FAVICON =======================
type LogoCand = { url: string; score: number; kind: string };
function collectLdJson(html: string): unknown[] {
  const out: unknown[] = [];
  for (const raw of extractAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, html, 10)) {
    try { out.push(JSON.parse(raw)); } catch { /* zepsuty ld+json — pomiń */ }
  }
  return out;
}
function walkLd(node: unknown, fn: (o: Record<string, unknown>) => void, depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) { node.forEach(n => walkLd(n, fn, depth + 1)); return; }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    fn(o);
    for (const k of ["@graph", "publisher", "brand", "about", "isPartOf", "provider", "author"]) if (o[k]) walkLd(o[k], fn, depth + 1);
  }
}
function ldLogo(ld: unknown[], base: string): string {
  let found = "";
  for (const doc of ld) walkLd(doc, (o) => {
    if (found) return;
    const logo = o.logo ?? o.image;
    const t = String(o["@type"] ?? "");
    if (!/Organization|LocalBusiness|Corporation|Store|Brand|Dentist|Restaurant|Hotel|Clinic|Physician|AutoDealer|School/i.test(t)) return;
    const u = typeof logo === "string" ? logo : (logo && typeof logo === "object" ? String((logo as Record<string, unknown>).url ?? "") : "");
    if (u) found = absUrl(u, base);
  });
  return found;
}
function svgIsLight(svg: string): boolean {
  const cols = [...svg.matchAll(/(?:fill|stroke)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\)|white|black)/gi)].map(m => m[1].toLowerCase());
  const real = cols.filter(c => c !== "none");
  if (!real.length) return false;
  const lums = real.map(c => {
    if (c === "white") return 1; if (c === "black") return 0;
    const p = parseColor(c); return p ? lum(p) : 0.5;
  });
  return lums.every(l => l > 0.8);
}
// Sprawdza, czy URL naprawdę oddaje obrazek (content-type / sygnatura). Zwraca też flagę "jasne logo".
async function probeImage(url: string): Promise<{ ok: boolean; light: boolean; small: boolean }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.5" } });
    if (!r.ok) return { ok: false, light: false, small: false };
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length < 80) return { ok: false, light: false, small: false };
    const head = new TextDecoder("latin1").decode(buf.slice(0, 512));
    const isSvg = ct.includes("svg") || /<svg[\s>]/i.test(head) || /<\?xml/i.test(head) && /\.svg(\?|$)/i.test(url);
    const isRaster = ct.startsWith("image/") || /^\x89PNG|^GIF8|^\xff\xd8\xff|^RIFF|^BM|^\x00\x00\x01\x00/.test(head);
    if (isSvg) {
      const svg = new TextDecoder().decode(buf.slice(0, 200_000));
      if (!/<svg[\s>]/i.test(svg)) return { ok: false, light: false, small: false };
      return { ok: true, light: svgIsLight(svg), small: false };
    }
    if (!isRaster) return { ok: false, light: false, small: false };
    // wymiary z nagłówka PNG/GIF — favicon/mała ikonka renderuje się rozmyta w dużym rozmiarze
    let w = 0, h = 0;
    if (head.startsWith("\x89PNG") && buf.length > 24) { w = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19]; h = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23]; }
    else if (head.startsWith("GIF8") && buf.length > 10) { w = buf[6] | (buf[7] << 8); h = buf[8] | (buf[9] << 8); }
    const small = ct.includes("icon") || /\.ico(\?|$)/i.test(url) || (w > 0 && w <= 64 && h > 0 && h <= 64);
    return { ok: true, light: /white|light|bia[lł]|jasn|-w\.|_w\./i.test(url), small };
  } catch { return { ok: false, light: false, small: false }; } finally { clearTimeout(t); }
}
async function pickLogo(body: string, html: string, base: string, ld: unknown[]): Promise<{ logo: string; light: boolean; small: boolean; favicon: string }> {
  const cands: LogoCand[] = [];
  const push = (url: string, score: number, kind: string) => { if (url && !cands.some(c => c.url === url)) cands.push({ url, score, kind }); };
  const headerEnd = (() => { const m = /<\/header>/i.exec(body); return m ? m.index : Math.min(body.length, 60_000); })();
  const footerStart = (() => { const m = /<footer[\s>]/i.exec(body); return m ? m.index : body.length; })();
  const l = ldLogo(ld, base);
  if (l) push(l, 90, "ld+json");
  let idx = 0;
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    if (idx++ > 400) break;
    const tag = m[0];
    const at = m.index ?? 0;
    let src = extract(/\ssrc=["']([^"']+)["']/i, tag);
    if (!src || /^data:/i.test(src)) src = extract(/\sdata-(?:lazy-)?src=["']([^"']+)["']/i, tag) || (extract(/\s(?:data-)?srcset=["']([^"']+)["']/i, tag).split(",")[0] || "").trim().split(/\s+/)[0] || "";
    const url = absUrl(src, base);
    if (!url || /pixel|tracking|1x1|spacer|blank\.gif/i.test(url)) continue;
    const attrs = tag.replace(/\ssrc=["'][^"']*["']/i, "");
    let score = 0;
    const isLogoWord = /logo/i.test(url) || /logo/i.test(attrs);
    if (isLogoWord) score += 50;
    if (at < headerEnd) score += 18;
    if (at >= footerStart) score -= 20;
    if (/partner|klien|client|certyf|certif|\biso\b|award|nagrod|badge|sponsor|payment|p[lł]atno|visa|mastercard|paypal|przelewy|blik|google|facebook|instagram|youtube|linkedin/i.test(url + " " + attrs)) score -= 45;
    const w = +extract(/\swidth=["']?(\d+)/i, tag) || 0, h = +extract(/\sheight=["']?(\d+)/i, tag) || 0;
    if ((w && w < 40) || (h && h < 18)) score -= 30;
    if (/white|light|bia[lł]|jasn/i.test(url)) score -= 6;
    score += Math.max(0, 8 - idx * 0.05);
    if (score >= 30) push(url, score, "img");
  }
  const ogLogo = metaContent(html, "og:logo", "property");
  if (ogLogo) push(absUrl(ogLogo, base), 45, "og:logo");
  const touch = extract(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i, html) ||
    extract(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/i, html);
  if (touch) push(absUrl(touch, base), 30, "apple-touch-icon");
  // ikony: największy rozmiar wygrywa
  const icons: { url: string; size: number }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["'][^"']*\bicon\b/i.test(tag) || /apple-touch/i.test(tag)) continue;
    const href = extract(/href=["']([^"']+)["']/i, tag);
    const size = +(extract(/sizes=["'](\d+)x/i, tag) || 0);
    const u = absUrl(href, base);
    if (u) icons.push({ url: u, size });
  }
  icons.sort((a, b) => b.size - a.size);
  icons.forEach((ic, i) => push(ic.url, 25 - i, "icon"));
  const ogImage = metaContent(html, "og:image", "property");
  if (ogImage) push(absUrl(ogImage, base), 12, "og:image");
  try { push(new URL("/favicon.ico", base).href, 4, "favicon.ico"); } catch { /* noop */ }
  cands.sort((a, b) => b.score - a.score);

  // favicon: apple-touch-icon → największa ikona → /favicon.ico (bez weryfikacji — to tylko dodatek)
  const favicon = (touch && absUrl(touch, base)) || icons[0]?.url || (() => { try { return new URL("/favicon.ico", base).href; } catch { return ""; } })();

  // weryfikacja realnego obrazka: max 5 prób, w kolejności score
  let probes = 0;
  for (const c of cands) {
    if (probes++ >= 5) break;
    const p = await probeImage(c.url);
    if (p.ok) { console.log("logo:", c.kind, c.url, p.light ? "(jasne)" : "", p.small ? "(małe)" : ""); return { logo: c.url, light: p.light, small: p.small, favicon }; }
  }
  return { logo: "", light: false, small: false, favicon };
}

// ======================= STRONA KLIENTA: pobranie + sygnały =======================
type SubPage = { url: string; title: string; h1: string[]; h2: string[]; text: string; scan: PageScan };

// Sygnały, których szukamy na KAŻDEJ pobranej stronie, nie tylko na głównej.
// Powód: mapa siedzi zwykle na /kontakt, a ceny na /cennik — skan wyłącznie strony
// głównej pokazywał „BRAK" przy elementach, które na stronie realnie są.
type PageScan = {
  maps: boolean; prices: boolean; booking: boolean; chat: string; whatsapp: boolean; messenger: boolean;
  ecommerce: boolean; video: boolean; newsletter: boolean; reviewsWidget: boolean; forms: number;
  analytics: boolean; pixel: boolean; faqSchema: boolean; cms: string;
  phones: string[]; emails: string[]; socials: string[]; city: string;
};

function detectCms(lc: string): string {
  if (/wp-content|wp-includes|wp-json/.test(lc)) return "WordPress";
  if (/shopify/.test(lc)) return "Shopify";
  if (/prestashop/.test(lc)) return "PrestaShop";
  if (/wix\.com|wixstatic/.test(lc)) return "Wix";
  if (/squarespace/.test(lc)) return "Squarespace";
  if (/webflow/.test(lc)) return "Webflow";
  if (/joomla/.test(lc)) return "Joomla";
  if (/webwave|ww_element|ww_google|w-object/.test(lc)) return "WebWave";
  if (/dudamobile|dudaone|\bduda\b|irp\.cdn-website|_dm_/.test(lc)) return "Duda";
  if (/tilda\.(cc|ws)|tildacdn/.test(lc)) return "Tilda";
  if (/jimdo/.test(lc)) return "Jimdo";
  if (/weebly/.test(lc)) return "Weebly";
  if (/godaddy|websitebuilder/.test(lc)) return "GoDaddy";
  if (/shoper|sky-shop|idosell|iai-shop|shoplo|selly/.test(lc)) return "sklep SaaS (PL)";
  return "";
}

function scanPage(html: string, body: string): PageScan {
  // ⚠️ Kluczowa lekcja z audytu Pony Academy (01.09): elementy STRUKTURALNE szukamy
  // w `body` (bez <script>/<style>), a nie w surowym HTML. Kreatory stron (WebWave,
  // Duda, Wix) doklejają do KAŻDEJ podstrony ten sam globalny bundle, w którym siedzi
  // np. `ww_googleMaps_element` — szukanie w surowym HTML „znajdowało" mapę wszędzie.
  // Skrypty zewnętrzne (czat, analityka, piksel, CMS) odwrotnie — tylko w surowym HTML.
  const lc = html.toLowerCase();
  const text = stripTags(body);
  return {
    maps: /data-element-type=["']googlemaps["']|ww_googlemaps|maps\.google|google\.com\/maps|maps\.googleapis|\/maps\/embed|openstreetmap|mapbox-gl|leaflet-container|class=["'][^"']*google-?map/i.test(body),
    prices: /\d[\d\s]{0,7}(?:[.,]\d{2})?\s*(?:zł|pln)\b/i.test(text),
    booking: /booksy|calendly|zencal|bookero|nakiedy|reservio|moment\.pl|planfy|versum/i.test(html) ||
      /zarezerwuj|rezerwuj online|umów wizyt|umow wizyt|rezerwacja online|zapisz się na (?:zajęcia|trening|kurs)/i.test(text),
    chat: /tawk\.to|tidio|smartsupp|livechat|crisp\.chat|intercom|drift\.com|zendesk|hubspot.*chat|fb-customerchat|callpage|thulium|botpress|manychat/i.test(html)
      ? (html.match(/tawk|tidio|smartsupp|livechat|crisp|intercom|drift|zendesk|callpage|thulium|manychat/i)?.[0] ?? "tak")
      : "",
    whatsapp: /wa\.me\/|api\.whatsapp\.com/i.test(body),
    messenger: /m\.me\/|messenger\.com/i.test(body),
    ecommerce: /woocommerce|shopify|prestashop|idosell|shoper/i.test(html) || /add-to-cart|dodaj do koszyka|\/koszyk|\/cart\b|\/checkout/i.test(body),
    video: /youtube\.com\/embed|youtu\.be|player\.vimeo|<video/i.test(body),
    newsletter: /newsletter|zapisz się do|zapisz sie do|subscribe/i.test(text),
    reviewsWidget: /trustpilot|opineo|elfsight.*review|widget.*opini/i.test(html) || /opinie klientów|referencje/i.test(text),
    forms: (body.match(/<form\b/gi) || []).length,
    analytics: /gtag\(|googletagmanager|google-analytics|fbq\(|facebook\.net\/.*fbevents|hotjar|clarity\.ms/i.test(html),
    pixel: /fbq\(|fbevents\.js/i.test(html),
    faqSchema: /"@type"\s*:\s*"FAQPage"/i.test(html),
    cms: detectCms(lc),
    phones: [...phonesOf(body)],
    emails: [...new Set((body.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map((e) => e.toLowerCase()).filter((e) => !/example|sentry|wixpress|webwave|duda|\.png|\.jpg|\.svg|\.webp/.test(e)))],
    socials: [...new Set((body.match(/https?:\/\/(?:www\.)?(facebook|instagram|linkedin|youtube|tiktok|x|twitter)\.com\/[^"'\s<)]+/gi) || []).map((u) => u.match(/(facebook|instagram|linkedin|youtube|tiktok|x|twitter)\.com/i)![1].toLowerCase().replace("twitter", "x")))],
    city: (() => {
      const m = text.match(/\b\d{2}-\d{3}\s+((?:Nowy|Nowa|Nowe|Stary|Stara|Stare|Biała|Biały|Zielona|Dąbrowa|Ostrowiec|Piotrków|Tomaszów|Gorzów|Rawa|Sucha|Wysokie|Konstancin|Józefów)\s[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+|[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:-[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)?)/);
      return m ? m[1] : "";
    })(),
  };
}
const SUB_HINTS = /o-nas|about|o-firmie|firma|oferta|offer|uslugi|usługi|services|produkt|product|cennik|pricing|ceny|kontakt|contact|realizacje|portfolio|dla-firm|b2b|wspolpraca|współpraca|sklep|shop|opinie|reviews|faq|blog|aktualnosci|news|formularz|zgloszenie|zgłoszenie|zapisy|zapisz|rezerwacj|booking|dojazd|lokalizacja/i;
// Adresy z sitemapy — tak robi wyszukiwarka i tylko tak da się znaleźć podstrony
// stron budowanych kreatorem: menu bywa rysowane skryptem, więc w kodzie NIE MA
// do nich żadnego linku (audyt Pony Academy: 6 linków w kodzie vs 11 w sitemapie).
async function sitemapUrls(base: string, host: string): Promise<string[]> {
  const out = new Set<string>();
  const candidates = new Set<string>([`${base.replace(/\/+$/, "")}/sitemap.xml`, `${base.replace(/\/+$/, "")}/sitemap_index.xml`]);
  try {
    const { res, text } = await fetchText(`${base.replace(/\/+$/, "")}/robots.txt`, 8000, {}, 200_000);
    if (res.ok) for (const m of text.matchAll(/^\s*sitemap:\s*(\S+)/gim)) candidates.add(m[1].trim());
  } catch { /* brak robots.txt to nie błąd */ }

  const readSitemap = async (url: string, depth = 0): Promise<void> => {
    if (depth > 1 || out.size > 80) return;
    try {
      const { res, text } = await fetchText(url, 9000, {}, 2_000_000);
      if (!res.ok) return;
      const locs = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
      const isIndex = /<sitemapindex/i.test(text);
      for (const loc of locs.slice(0, isIndex ? 5 : 200)) {
        if (isIndex) await readSitemap(loc, depth + 1);
        else {
          try {
            const u = new URL(loc);
            if (u.hostname.replace(/^www\./, "") === host) out.add(u.origin + u.pathname.replace(/\/+$/, ""));
          } catch { /* pomijamy śmieci */ }
        }
      }
    } catch { /* sitemapa może nie istnieć */ }
  };
  for (const c of [...candidates].slice(0, 4)) await readSitemap(c);
  return [...out];
}

async function fetchSubpages(body: string, base: string, host: string): Promise<SubPage[]> {
  const seen = new Set<string>();
  const links: { url: string; prio: number }[] = [];
  for (const m of body.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    const u = absUrl(m[1], base);
    if (!u) continue;
    let uo: URL;
    try { uo = new URL(u); } catch { continue; }
    if (uo.hostname.replace(/^www\./, "") !== host) continue;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|xml|css|js)(\?|$)/i.test(uo.pathname)) continue;
    if (/wp-admin|wp-login|\/tag\/|\/author\/|\/feed|\/cart|\/koszyk|\/my-account|\/checkout|\?add-to-cart|\/page\/\d|\/en\/|\/de\/|\/ru\/|\/ua\/|\/cs\//i.test(uo.pathname + uo.search)) continue;
    const path = uo.pathname.replace(/\/+$/, "");
    if (!path || path === "/index.html") continue;
    const key = uo.origin + path;
    if (seen.has(key)) continue;
    seen.add(key);
    const depth = path.split("/").filter(Boolean).length;
    const hint = SUB_HINTS.test(path);
    // priorytet: podstrony 1. poziomu z nazwą-podpowiedzią; blog/aktualności niżej
    let prio = (hint ? 10 : 0) - depth * 2 - (/blog|aktualnosci|news|kariera|career|polityka|privacy|regulamin|cookies|rodo/i.test(path) ? 8 : 0);
    if (/o-nas|about|oferta|uslugi|usługi|services|produkt|product|cennik|pricing|kontakt|contact/i.test(path)) prio += 4;
    // strony z sygnałami biznesowymi: formularz zapisu, rezerwacja, opinie, FAQ, dojazd
    // (bez nich raportowaliśmy „brak formularza", choć formularz był o jedno kliknięcie dalej)
    if (/formularz|zgloszenie|zgłoszenie|zapisy|rezerwacj|opinie|faq|dojazd/i.test(path)) prio += 5;
    links.push({ url: key, prio });
  }
  // dołączamy adresy z sitemapy, których nie ma w kodzie strony (menu z JS)
  const fromSitemap = await sitemapUrls(base, host);
  let orphans = 0;
  for (const u of fromSitemap) {
    let uo: URL;
    try { uo = new URL(u); } catch { continue; }
    const path = uo.pathname.replace(/\/+$/, "");
    if (!path) continue;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|xml|css|js)(\?|$)/i.test(path)) continue;
    if (/wp-admin|wp-login|\/tag\/|\/author\/|\/feed|\/cart|\/koszyk|\/checkout/i.test(path)) continue;
    const key = uo.origin + path;
    if (seen.has(key)) continue;
    seen.add(key);
    orphans++;
    const depth = path.split("/").filter(Boolean).length;
    let prio = (SUB_HINTS.test(path) ? 10 : 1) - depth * 2;
    if (/o-nas|about|oferta|uslugi|usługi|services|produkt|product|cennik|pricing|kontakt|contact/i.test(path)) prio += 4;
    if (/formularz|zgloszenie|zgłoszenie|zapisy|rezerwacj|opinie|faq|dojazd/i.test(path)) prio += 5;
    links.push({ url: key, prio });
  }
  console.log("linki: w kodzie", links.length - orphans, "| z sitemapy dodatkowo", orphans);

  links.sort((a, b) => b.prio - a.prio);
  const pick = links.slice(0, 7); // pobieramy równolegle, więc szerszy skan nie kosztuje czasu
  const pages = await Promise.all(pick.map(async (l) => {
    try {
      const { res, text } = await fetchText(l.url, 16000, {}, 1_500_000);
      if (!res.ok) { console.log("podstrona", l.url, res.status); return null; }
      const b = stripCode(text);
      return {
        url: l.url,
        title: decodeEntities(extract(/<title[^>]*>([\s\S]*?)<\/title>/i, text)).slice(0, 120),
        h1: extractAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, b, 3).map(stripTags).filter(Boolean),
        h2: extractAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, b, 8).map(stripTags).filter(Boolean),
        text: stripTags(b.replace(/<(header|nav|footer)[\s\S]*?<\/\1>/gi, " ")).slice(0, 1700),
        scan: scanPage(text, b),
      } as SubPage;
    } catch (e) { console.log("podstrona", l.url, "błąd:", e instanceof Error ? e.message : String(e)); return null; }
  }));
  console.log("podstrony:", pick.length, "wybrane,", pages.filter(Boolean).length, "pobrane");
  return pages.filter(Boolean) as SubPage[];
}

function phonesOf(html: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:\+?48|tel[:.\s]|phone|telefon)[\s.-]{0,3}(\d[\d\s.\-()]{7,14}\d)/gi)) {
    const digits = m[1].replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 12) out.add(digits.slice(-9));
  }
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const digits = m[1].replace(/\D/g, "");
    if (digits.length >= 9) out.add(digits.slice(-9));
  }
  return out;
}

async function fetchSite(url: string) {
  const { res, text: html, ttfbMs } = await fetchText(url, 15000, {}, 2_500_000);
  if (!res.ok) throw new Error(`Strona klienta odpowiedziała ${res.status}`);
  const base = res.url || url;
  const host = new URL(base).hostname.replace(/^www\./, "");
  const body = stripCode(html);
  const ld = collectLdJson(html);

  const title = decodeEntities(extract(/<title[^>]*>([\s\S]*?)<\/title>/i, html));
  const desc = metaContent(html, "description");
  const ogTitle = metaContent(html, "og:title", "property");
  const h1 = extractAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, body, 6).map(stripTags).filter(Boolean);
  const h2 = extractAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, body, 24).map(stripTags).filter(Boolean);
  const h3 = extractAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, body, 24).map(stripTags).filter(Boolean);
  const navLabels = [...new Set(extractAll(/(<(?:nav|header)[\s\S]*?<\/(?:nav|header)>)/gi, body, 3).join(" ").match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)?.map(a => stripTags(a)).filter(s => s && s.length < 40) ?? [])].slice(0, 30);
  const text = stripTags(body.replace(/<(header|nav|footer)[\s\S]*?<\/\1>/gi, " ")).slice(0, 5200);

  // typy schema.org + ocena
  const schemaTypes = new Set<string>();
  let rating: { value: number; count: number } | null = null;
  let faqSchema = false;
  let city = "";
  for (const doc of ld) walkLd(doc, (o) => {
    const t = o["@type"]; if (Array.isArray(t)) t.forEach(x => schemaTypes.add(String(x))); else if (t) schemaTypes.add(String(t));
    if (String(t) === "FAQPage") faqSchema = true;
    const ar = o.aggregateRating as Record<string, unknown> | undefined;
    if (ar && !rating) rating = { value: +(ar.ratingValue ?? 0), count: +(ar.reviewCount ?? ar.ratingCount ?? 0) };
    const addr = o.address as Record<string, unknown> | undefined;
    if (addr && !city && addr.addressLocality) city = String(addr.addressLocality);
  });
  if (!city) city = decodeEntities(extract(/addressLocality["']?\s*[:>]\s*["']?([^"',<]{2,40})/i, html)).trim();
  if (!city) {
    const m = html.match(/\b\d{2}-\d{3}\s+((?:Nowy|Nowa|Nowe|Stary|Stara|Stare|Biała|Biały|Zielona|Dąbrowa|Ostrowiec|Piotrków|Tomaszów|Gorzów|Rawa|Sucha|Wysokie|Konstancin|Józefów)\s[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+|[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:-[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)?)/);
    if (m) city = m[1];
  }

  const emails = [...new Set((body.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(e => e.toLowerCase()).filter(e => !/example|sentry|wixpress|\.png|\.jpg|\.svg|\.webp/.test(e)))].slice(0, 4);
  const phones = [...phonesOf(html)].slice(0, 4);
  const socials = [...new Set((html.match(/https?:\/\/(?:www\.)?(facebook|instagram|linkedin|youtube|tiktok|x|twitter)\.com\/[^"'\s<)]+/gi) || []).map(u => u.match(/(facebook|instagram|linkedin|youtube|tiktok|x|twitter)\.com/i)![1].toLowerCase().replace("twitter", "x")))];
  const lc = html.toLowerCase();
  const signals = {
    hasSchema: /application\/ld\+json/i.test(html),
    schemaTypes: [...schemaTypes].slice(0, 10),
    faqSchema,
    hasOg: /property=["']og:/i.test(html),
    hasCanonical: /rel=["']canonical["']/i.test(html),
    hasHreflang: /hreflang=/i.test(html),
    langs: [...new Set(extractAll(/hreflang=["']([a-zA-Z-]+)["']/gi, html, 12))].filter(l => l !== "x-default"),
    lang: extract(/<html[^>]+lang=["']([a-zA-Z-]+)["']/i, html) || "",
    viewport: /name=["']viewport["']/i.test(html),
    htmlKb: Math.round(html.length / 1024),
    cms: /wp-content|wp-includes/i.test(html) ? "WordPress" : /shopify/i.test(lc) ? "Shopify" : /prestashop/i.test(lc) ? "PrestaShop" : /wix\.com|wixstatic/i.test(lc) ? "Wix" : /squarespace/i.test(lc) ? "Squarespace" : /webflow/i.test(lc) ? "Webflow" : /joomla/i.test(lc) ? "Joomla" : /shoper|sky-shop|idosell|iai-shop/i.test(lc) ? "sklep SaaS (PL)" : "",
    ecommerce: /woocommerce|add-to-cart|dodaj do koszyka|\/koszyk|\/cart\b|shopify|prestashop|idosell|shoper|checkout/i.test(html),
    chatWidget: /tawk\.to|tidio|smartsupp|livechat|crisp\.chat|intercom|drift\.com|zendesk|hubspot.*chat|messenger.*plugin|fb-customerchat|callpage|thulium|chatbot|botpress|manychat/i.test(html) ? (html.match(/tawk|tidio|smartsupp|livechat|crisp|intercom|drift|zendesk|callpage|thulium|manychat|messenger|chatbot/i)?.[0] ?? "tak") : "",
    booking: /booksy|calendly|zencal|bookero|nakiedy|reservio|moment\.pl|planfy|versum|zarezerwuj|rezerwuj online|umów wizyt|umow wizyt/i.test(html),
    whatsapp: /wa\.me\/|api\.whatsapp\.com|whatsapp/i.test(html),
    messenger: /m\.me\/|messenger\.com/i.test(html),
    analytics: /gtag\(|googletagmanager|google-analytics|fbq\(|facebook\.net\/.*fbevents|hotjar|clarity\.ms/i.test(html),
    pixel: /fbq\(|fbevents\.js/i.test(html),
    maps: /maps\.google|google\.com\/maps|maps\.googleapis|openstreetmap/i.test(html),
    video: /youtube\.com\/embed|youtu\.be|vimeo\.com|<video/i.test(html),
    forms: (body.match(/<form\b/gi) || []).length,
    blog: /\/blog|\/aktualnosci|\/news|\/artykuly|\/poradnik/i.test(body),
    reviews: rating as { value: number; count: number } | null,
    reviewsWidget: /trustpilot|opineo|ceneo\.pl\/.*opinie|google.*reviews|elfsight.*review|widget.*opini/i.test(html),
    cookieBanner: /cookie|ciasteczk|rodo/i.test(lc),
    newsletter: /newsletter|zapisz się|subscribe/i.test(lc),
    pricesOnSite: /\d[\d\s]{1,7}(?:,\d{2})?\s*(?:zł|pln)/i.test(text),
    phones, emails, socials, city, navLabels,
  };

  const perf = {
    ttfbMs,
    htmlKb: signals.htmlKb,
    scripts: (html.match(/<script/gi) || []).length,
    imgs: (html.match(/<img/gi) || []).length,
    lazyImgs: (html.match(/loading=["']lazy["']/gi) || []).length,
    webp: /\.webp/i.test(html),
  };

  const [logoInfo, subpages] = await Promise.all([pickLogo(body, html, base, ld), fetchSubpages(body, base, host)]);

  // ── scalenie sygnałów ze wszystkich pobranych stron ────────────────────────
  // Do wersji z 01.09 sygnały liczyliśmy wyłącznie ze strony głównej, więc mapa
  // z /kontakt i ceny z /cennik raportowane były jako „BRAK". Teraz bierzemy sumę
  // ze wszystkich stron i ZAPAMIĘTUJEMY, na której stronie element znaleziono —
  // dzięki temu w audycie widać „jest · /cennik", a nie gołe „jest".
  const pageOf = (u: string) => { try { return new URL(u).pathname || "/"; } catch { return u; } };
  const scans: { where: string; scan: PageScan }[] = [
    { where: "/", scan: scanPage(html, body) },
    ...subpages.map((sp) => ({ where: pageOf(sp.url), scan: sp.scan })),
  ];
  const src: Record<string, string> = {};
  const firstWith = (key: keyof PageScan, sigKey: string): string => {
    const hit = scans.find(({ scan }) => {
      const v = scan[key];
      return typeof v === "number" ? v > 0 : Array.isArray(v) ? v.length > 0 : Boolean(v);
    });
    if (hit) src[sigKey] = hit.where;
    return hit ? hit.where : "";
  };
  const anyBool = (key: keyof PageScan, sigKey: string) => Boolean(firstWith(key, sigKey));
  const uniq = (key: "phones" | "emails" | "socials") =>
    [...new Set(scans.flatMap(({ scan }) => scan[key] as string[]))];

  signals.maps = anyBool("maps", "maps");
  signals.pricesOnSite = anyBool("prices", "pricesOnSite");
  signals.booking = anyBool("booking", "booking");
  signals.ecommerce = anyBool("ecommerce", "ecommerce");
  signals.video = anyBool("video", "video");
  signals.newsletter = anyBool("newsletter", "newsletter");
  signals.reviewsWidget = anyBool("reviewsWidget", "reviewsWidget");
  signals.whatsapp = anyBool("whatsapp", "whatsapp");
  signals.messenger = anyBool("messenger", "messenger");
  signals.analytics = anyBool("analytics", "analytics");
  signals.pixel = anyBool("pixel", "pixel");
  signals.faqSchema = signals.faqSchema || anyBool("faqSchema", "faqSchema");
  const chatHit = scans.find(({ scan }) => scan.chat);
  if (chatHit) { signals.chatWidget = chatHit.scan.chat; src.chatWidget = chatHit.where; }
  const formHit = scans.find(({ scan }) => scan.forms > 0);
  if (formHit) { signals.forms = Math.max(signals.forms, formHit.scan.forms); src.forms = formHit.where; }
  const cmsHit = scans.find(({ scan }) => scan.cms);
  if (!signals.cms && cmsHit) { signals.cms = cmsHit.scan.cms; src.cms = cmsHit.where; }
  const cityHit = scans.find(({ scan }) => scan.city);
  if (!signals.city && cityHit) signals.city = cityHit.scan.city;
  signals.phones = uniq("phones").slice(0, 6);
  signals.emails = uniq("emails").slice(0, 4);
  signals.socials = uniq("socials");
  if (signals.phones.length) firstWith("phones", "phones");
  if (signals.emails.length) firstWith("emails", "emails");
  if (signals.socials.length) firstWith("socials", "socials");

  // Ile treści strona pokazuje bez JS. Kreatory stron potrafią dorysowywać sekcje
  // skryptem — wtedy ani my, ani boty AI nie widzą ich w kodzie, i trzeba to napisać
  // wprost zamiast raportować „brak".
  const visibleText = stripTags(body).replace(/\s+/g, " ").trim().length;
  const jsHeavy = visibleText < 1200 || visibleText / Math.max(1, html.length) < 0.012;
  const scanInfo = {
    pages: scans.map((x) => x.where),
    src,
    jsHeavy,
    visibleChars: visibleText,
    builder: signals.cms || "",
  };
  console.log("sygnały scalone z", scans.length, "stron; jsHeavy:", jsHeavy, "; źródła:", JSON.stringify(src));

  return { finalUrl: base, host, title, desc, ogTitle, h1, h2, h3, text, perf, html, body, signals, subpages, scanInfo, ...logoInfo };
}
type SiteMeta = Awaited<ReturnType<typeof fetchSite>>;

// ======================= paleta klienta (tło + akcent z CSS strony) =======================
type RGB = { r: number; g: number; b: number };
function parseColor(s: string): RGB | null {
  s = String(s || "").trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{6})\b/);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
  m = s.match(/^#([0-9a-f]{3})\b/);
  if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
  m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return null;
}
const lum = (c: RGB) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
const sat = (c: RGB) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - mn) / mx; };
const hex = (c: RGB) => "#" + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

async function fetchCss(url: string): Promise<string> {
  try { const { res, text } = await fetchText(url, 6000, {}, 300_000); return res.ok ? text : ""; } catch { return ""; }
}
async function extractTheme(html: string, base: string) {
  let css = extractAll(/<style[^>]*>([\s\S]*?)<\/style>/gi, html, 10).join("\n");
  const rawHrefs = extractAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi, html, 12)
    .concat(extractAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi, html, 12));
  const seen = new Set<string>();
  const hrefs: string[] = [];
  for (const h of rawHrefs) {
    if (h.includes("fonts.") || seen.has(h)) continue;
    seen.add(h);
    const u = absUrl(h, base);
    if (u) hrefs.push(u);
    if (hrefs.length >= 6) break;
  }
  const sheets = await Promise.all(hrefs.map(fetchCss));
  css += "\n" + sheets.join("\n");

  const themeColor = parseColor(metaContent(html, "theme-color"));
  const bodyBg = parseColor(extract(/(?:^|[}\s])(?:body|html)[^{]*\{[^}]*?background(?:-color)?\s*:\s*([^;}!]+)/i, css));
  const counts = new Map<string, { c: RGB; n: number }>();
  const reC = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([\d\s,./]+\)/gi;
  let mm: RegExpExecArray | null;
  while ((mm = reC.exec(css))) {
    const before = css.slice(Math.max(0, mm.index - 220), mm.index);
    if (/--[\w-]+\s*:\s*[^;{]*$/.test(before)) continue;
    const c = parseColor(mm[0]);
    if (!c) continue;
    const w = /(?:^|[;{])\s*(?:color|background(?:-color)?|border[^:]*|fill|stroke)\s*:\s*[^;{]*$/i.test(before) ? 3 : 1;
    const k = hex(c);
    const e = counts.get(k);
    if (e) e.n += w; else counts.set(k, { c, n: w });
  }
  for (const m of html.matchAll(/(?:style|fill|color)=["'][^"']*?(#[0-9a-f]{6}\b|#[0-9a-f]{3}\b)/gi)) {
    const c = parseColor(m[1]);
    if (!c) continue;
    const k = hex(c);
    const e = counts.get(k);
    if (e) e.n += 2; else counts.set(k, { c, n: 2 });
  }
  const all = [...counts.values()].sort((a, b) => b.n - a.n);
  let bg = bodyBg || themeColor || null;
  if (!bg) bg = all.find(e => lum(e.c) > 0.9)?.c ?? all.find(e => lum(e.c) < 0.1)?.c ?? null;
  if (!bg) return null;
  const bgL = lum(bg);
  const JUNK = new Set([
    "#0693e3", "#8ed1fc", "#eb144c", "#ff6900", "#fcb900", "#7bdcb5", "#00d084",
    "#abb8c3", "#9b51e0", "#f78da7", "#cf2e2e", "#313131", "#6495ed", "#3858e9",
    "#1890ff", "#40a9ff", "#69c0ff", "#91d5ff", "#bae7ff", "#e6f7ff", "#096dd9",
    "#0050b3", "#0d6efd", "#007bff", "#0dcaf0", "#20c997", "#6c757d", "#428bca", "#337ab7",
    "#34e2e4", "#4721fb", "#ab1dfe", "#faaca8", "#fdd79a", "#1877f2", "#e4405f", "#ff0000", "#0a66c2",
  ]);
  const ok = (e: { c: RGB; n: number }, minSat: number, minDiff: number, minN: number) =>
    !JUNK.has(hex(e.c)) && e.n >= minN && sat(e.c) >= minSat &&
    Math.abs(lum(e.c) - bgL) >= minDiff && lum(e.c) > 0.03 && lum(e.c) < 0.97;
  let accent = all.find(e => ok(e, 0.35, 0.2, 5))?.c ?? all.find(e => ok(e, 0.3, 0.18, 3))?.c ?? all.find(e => ok(e, 0.25, 0.15, 2))?.c ?? null;
  if (!accent) accent = bgL > 0.5 ? { r: 20, g: 20, b: 20 } : { r: 184, g: 255, b: 0 };
  if (Math.abs(lum(accent) - bgL) < 0.18) {
    const k = bgL > 0.5 ? 0.55 : 1.6;
    accent = { r: accent.r * k, g: accent.g * k, b: accent.b * k };
  }
  const fg = bgL > 0.5 ? "#141414" : "#F5F5F0";
  return { bg: hex(bg), accent: hex(accent), fg };
}

// ======================= WYSZUKIWARKA (konkurenci) =======================
type SearchHit = { url: string; domain: string; title: string; snippet: string; rank: number; engine: string };
function normDomain(s: string): string {
  return String(s || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").replace(/:\d+$/, "");
}
function sameSite(a: string, b: string): boolean {
  a = normDomain(a); b = normDomain(b);
  return !!a && !!b && (a === b || a.endsWith("." + b) || b.endsWith("." + a));
}
// portale, media, katalogi, social, marketplace — nigdy nie są "konkurentem" firmy
const NOISE_DOMAINS = /(^|\.)(google|youtube|facebook|instagram|tiktok|linkedin|x|twitter|pinterest|wikipedia|wikimedia|allegro|olx|amazon|aliexpress|alibaba|ebay|ceneo|otomoto|otodom|gratka|oferteo|fixly|panoramafirm|pkt|aleo|gowork|firmy|znanylekarz|booksy|pracuj|indeed|glassdoor|nowiny|onet|wp|interia|gazeta|wyborcza|rp|money|bankier|businessinsider|forbes|spidersweb|naszemiasto|trojmiasto|krakow|wroclaw|poznan|warszawa|dziennik|tvn|tvp|polsat|rmf|radiozet|pap|niebezpiecznik|wykop|reddit|quora|medium|pl\.wiktionary|prezentmarzen|wyjatkowyprezent|katalogmarzen|groupon|tripadvisor|zomato|pyszne|glovo|ubereats|apple|microsoft|yelp|trustpilot|opineo|mapy|targeo|zumi|yellowpages|europages|kompass|sklep\.premium|aftermarket|sedo|dan|godaddy|home|nazwa|ovh|shoper|wix|wordpress|blogspot|yably|clutch|sortlist|goodfirms|designrush|semstorm|similarweb|firmy|biznesfinder|targeo|zumi|pkt|cylex|kolejowy|place|tumblr|issuu|scribd|slideshare|calameo|archive|gov|edu|mil|europa|eu|nfz|ceidg|krs|regon|nip|gus|infor|bip|bazafirm|rejestr|cylex|firmy\.net|4elements|e-kolo|salon24|kb|pomoc|support)\.(pl|com|org|net|eu|de|uk|info|io)$/i;
const NOISE_HOST = /^(m|mobile|shop|sklep|blog|news|forum|katalog|mapa|maps|wiki|www2)\./i;
// tytuł wyniku zdradza katalog/ranking/portal, nawet gdy domena wygląda "firmowo"
const NOISE_TITLE = /\b\d+\s+najlepsz|najlepsz\w*\s+\d+|ranking|top\s*\d+|lista firm|katalog firm|baza firm|porównaj|porównanie|opinie o firmach|firmy w [a-ząćęłńóśźż]+ -|wikipedia|encyklopedia|słownik|definicja|oferty pracy|praca:|forum|allegro|olx/i;
function isNoiseDomain(d: string): boolean {
  d = normDomain(d);
  return !d || !d.includes(".") || NOISE_DOMAINS.test(d) || /\.(gov|edu|mil)\.pl$/i.test(d) || /^[\d.]+$/.test(d) ||
    /forum|katalog|portal|ranking|opinie|porownyw|porównyw|prezent|kupon|promocj|blog|wiki|news|gazeta|magazyn|tv$/i.test(d.split(".")[0]);
}
const enc = encodeURIComponent;
async function searchBrave(q: string): Promise<SearchHit[]> {
  let { res, text } = await fetchText(`https://search.brave.com/search?q=${enc(q)}&source=web&country=pl&lang=pl`, 12000, { Accept: "text/html" }, 1_500_000);
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 1800));
    ({ res, text } = await fetchText(`https://search.brave.com/search?q=${enc(q)}&source=web`, 12000, { Accept: "text/html" }, 1_500_000));
  }
  if (!res.ok) { console.log("search brave", res.status); return []; }
  const parts = text.split('data-type="web"').slice(1);
  const out: SearchHit[] = [];
  parts.forEach((p, i) => {
    const seg = p.slice(0, 8000);
    const href = extract(/<a href="(https?:\/\/[^"]+)"/i, seg);
    if (!href) return;
    const title = stripTags(extract(/search-snippet-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i, seg)).slice(0, 140);
    const snippet = stripTags(extract(/generic-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i, seg)).slice(0, 220);
    out.push({ url: href, domain: normDomain(href), title, snippet, rank: i + 1, engine: "brave" });
  });
  return out;
}
async function searchDDG(q: string): Promise<SearchHit[]> {
  const { res, text } = await fetchText(`https://html.duckduckgo.com/html/?q=${enc(q)}&kl=pl-pl`, 12000, { Accept: "text/html" }, 800_000);
  if (res.status !== 200) { console.log("search ddg", res.status); return []; }
  const out: SearchHit[] = [];
  const blocks = text.split(/class="result\b/).slice(1);
  blocks.forEach((b, i) => {
    const raw = extract(/class="result__a"[^>]*href="([^"]+)"/i, b);
    if (!raw) return;
    let href = raw;
    const m = raw.match(/uddg=([^&]+)/);
    if (m) { try { href = decodeURIComponent(m[1]); } catch { /* noop */ } }
    if (!/^https?:\/\//i.test(href)) return;
    const title = stripTags(extract(/class="result__a"[^>]*>([\s\S]*?)<\/a>/i, b)).slice(0, 140);
    const snippet = stripTags(extract(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i, b)).slice(0, 220);
    out.push({ url: href, domain: normDomain(href), title, snippet, rank: i + 1, engine: "ddg" });
  });
  return out;
}
async function searchBing(q: string): Promise<SearchHit[]> {
  const { res, text } = await fetchText(`https://www.bing.com/search?q=${enc(q)}&cc=PL&setlang=pl&mkt=pl-PL`, 12000,
    { Accept: "text/html", Cookie: "_EDGE_CD=m=pl-pl&u=pl-pl; SRCHHPGUSR=SRCHLANG=pl" }, 1_500_000);
  if (!res.ok) { console.log("search bing", res.status); return []; }
  const out: SearchHit[] = [];
  const blocks = text.split(/<li class="b_algo"/).slice(1);
  blocks.forEach((b, i) => {
    const seg = b.slice(0, 6000);
    let href = extract(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"/i, seg) || extract(/<a[^>]*href="(https?:\/\/[^"]+)"/i, seg);
    if (!href) return;
    href = href.replace(/&amp;/g, "&");
    const u = href.match(/[?&]u=a1([A-Za-z0-9_-]+)/);
    if (u) { try { href = atob(u[1].replace(/-/g, "+").replace(/_/g, "/")); } catch { /* noop */ } }
    if (!/^https?:\/\//i.test(href)) return;
    const title = stripTags(extract(/<h2[^>]*>([\s\S]*?)<\/h2>/i, seg)).slice(0, 140);
    const snippet = stripTags(extract(/<p[^>]*>([\s\S]*?)<\/p>/i, seg)).slice(0, 220);
    out.push({ url: href, domain: normDomain(href), title, snippet, rank: i + 1, engine: "bing" });
  });
  return out;
}
async function searchYahoo(q: string): Promise<SearchHit[]> {
  const { res, text } = await fetchText(`https://pl.search.yahoo.com/search?p=${enc(q)}&vl=lang_pl`, 12000, { Accept: "text/html" }, 1_500_000);
  if (!res.ok) { console.log("search yahoo", res.status); return []; }
  const out: SearchHit[] = [];
  const seen = new Set<string>();
  // wynik organiczny = <div class="dd … algo algo-sr …">; tytuł w <h3 … class="title"><a aria-label="…" href="…RU=<url>…">,
  // opis w <div class="compText …"><p>…</p>
  const blocks = text.split(/<div class="[^"]*\balgo\b[^"]*"/).slice(1);
  for (const raw of blocks) {
    const seg = raw.slice(0, 7000);
    const h3 = extract(/(<h3[^>]*class="title"[^>]*>[\s\S]*?<\/h3>)/i, seg) || seg;
    const ru = h3.match(/RU=([^/"&]+)/) || seg.match(/RU=([^/"&]+)/);
    if (!ru) continue;
    let href = "";
    try { href = decodeURIComponent(ru[1]); } catch { continue; }
    if (!/^https?:\/\//i.test(href) || /yahoo\.com/i.test(href) || seen.has(href)) continue;
    seen.add(href);
    const title = decodeEntities(extract(/aria-label="([^"]+)"/i, h3)) || stripTags(h3).replace(/^[^ ]+\s›[^A-ZĄĆĘŁŃÓŚŹŻ]*/, "");
    const snippet = stripTags(extract(/class="compText[^"]*"[^>]*>([\s\S]*?)<\/div>/i, seg)).slice(0, 220);
    if (/Wyszukiwania związane|Powiązane wyszukiwania/i.test(title)) continue;
    out.push({ url: href, domain: normDomain(href), title: title.slice(0, 140), snippet, rank: out.length + 1, engine: "yahoo" });
  }
  return out;
}
const ENGINES: Array<[string, (q: string) => Promise<SearchHit[]>]> = [["brave", searchBrave], ["yahoo", searchYahoo]];
// Jedno zapytanie: łączymy wyniki wszystkich żywych silników (Brave = jakość, Yahoo = zasięg).
// Silnik, który padł (429/blokada/błąd), jest pomijany przy kolejnych zapytaniach w tym uruchomieniu.
// Bing i DDG wyrzucone: z IP edge Bing oddaje losowe wyniki, DDG — challenge (202).
const deadEngines = new Set<string>();
async function webSearch(q: string): Promise<SearchHit[]> {
  const out: SearchHit[] = [];
  for (const [name, fn] of ENGINES) {
    if (deadEngines.has(name)) continue;
    try {
      const hits = await fn(q);
      if (!hits.length) { deadEngines.add(name); continue; }
      out.push(...hits);
    } catch (e) { console.log("search err", name, e instanceof Error ? e.message : String(e)); deadEngines.add(name); }
  }
  return out;
}
// zapytania po kolei (równoległe → 429 u Brave/Yahoo)
async function webSearchAll(queries: string[]): Promise<SearchHit[][]> {
  const out: SearchHit[][] = [];
  for (const q of queries) {
    out.push(await webSearch(q));
    if (out.length < queries.length) await new Promise(r => setTimeout(r, 900));
  }
  return out;
}

// ======================= konkurenci: pobranie + walidacja =======================
const PARKED_RE = /domena (jest |zosta[lł]a )?(na sprzeda|do kupienia|wystawiona|zarejestrowana w serwisie)|:: domena|domain (is )?for sale|kup t[eę] domen|aftermarket\.pl|sklep\.premium\.pl|sedo\.|parkingcrew|dan\.com|afternic|domenomania|bodis\.|skenzo|domainpark|strona w budowie|strona w przygotowaniu|konto.{0,20}zawieszone|account suspended|hosting wygas/i;
const CF_RE = /just a moment|cf-browser-verification|_cf_chl|challenge-platform|attention required|enable javascript and cookies/i;

type Rival = {
  domain: string; measured: boolean; alive: boolean;
  ttfbMs?: number; htmlKb?: number; hasDesc?: boolean; hasSchema?: boolean; hasOg?: boolean;
  hasCanonical?: boolean; hasHreflang?: boolean; h1?: number; hasChat?: boolean; hasBlog?: boolean; hasBooking?: boolean;
  title?: string; desc?: string; h1s?: string[]; snippet?: string; html?: string;
  searchScore?: number; hits?: number; reason?: string;
};
async function fetchRival(domain: string, manual = false): Promise<Rival | null> {
  const d = normDomain(domain);
  if (!d || !d.includes(".") || /\s/.test(d)) return null;
  let protectedAlive = false;
  for (const u of [`https://${d}/`, `https://www.${d}/`, `http://${d}/`, `http://www.${d}/`]) {
    let r: Awaited<ReturnType<typeof fetchText>>;
    try { r = await fetchText(u, 12000, {}, 900_000); } catch { continue; }
    const { res, text: html, ttfbMs } = r;
    if (!res.ok) {
      if ([403, 429, 503].includes(res.status) && (CF_RE.test(html) || html.length < 40_000)) protectedAlive = true;
      continue;
    }
    let finalHost = d;
    try { finalHost = new URL(res.url || u).hostname; } catch { /* noop */ }
    const title = decodeEntities(extract(/<title[^>]*>([\s\S]*?)<\/title>/i, html));
    const body = stripCode(html);
    const text = stripTags(body);
    if (!sameSite(finalHost, d) && !manual) { console.log("rival", d, "odpada: redirect →", finalHost); return null; }
    if (PARKED_RE.test(title + " " + html.slice(0, 30000) + " " + text.slice(0, 1500))) {
      console.log("rival", d, "odpada: parking domen");
      return manual ? { domain: d, measured: false, alive: false } : null;
    }
    if (text.length < 700 && !manual) { console.log("rival", d, "odpada: cienka treść", text.length); return null; }
    const desc = metaContent(html, "description");
    const h1s = extractAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, body, 4).map(stripTags);
    return {
      domain: d, measured: true, alive: true, ttfbMs,
      htmlKb: Math.round(html.length / 1024),
      hasDesc: !!desc,
      hasSchema: /application\/ld\+json/i.test(html),
      hasOg: /property=["']og:/i.test(html),
      hasCanonical: /rel=["']canonical["']/i.test(html),
      hasHreflang: /hreflang=/i.test(html),
      hasChat: /tawk\.to|tidio|smartsupp|livechat|crisp\.chat|intercom|callpage|thulium|manychat|fb-customerchat|chatbot/i.test(html),
      hasBlog: /\/blog|\/aktualnosci|\/news|\/poradnik/i.test(body),
      hasBooking: /booksy|calendly|zencal|bookero|reservio|rezerwuj online|umów wizyt/i.test(html),
      h1: h1s.length, title, desc, h1s,
      snippet: text.slice(0, 500), html,
    };
  }
  if (protectedAlive) return { domain: d, measured: false, alive: true };
  return manual ? { domain: d, measured: false, alive: false } : null;
}

// Google PageSpeed Insights (mobile)
async function fetchPSI(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const key = Deno.env.get("PSI_API_KEY");
    const r = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${enc(url)}&strategy=mobile&category=performance${key ? `&key=${key}` : ""}`,
      { signal: ctrl.signal },
    );
    if (!r.ok) return null;
    const d = await r.json();
    const lh = d?.lighthouseResult;
    if (!lh) return null;
    const a = lh.audits ?? {};
    const pick = (k: string) => ({ text: a[k]?.displayValue ?? null, ms: typeof a[k]?.numericValue === "number" ? Math.round(a[k].numericValue) : null });
    return {
      score: Math.round((lh.categories?.performance?.score ?? 0) * 100),
      fcp: pick("first-contentful-paint"), lcp: pick("largest-contentful-paint"),
      cls: { text: a["cumulative-layout-shift"]?.displayValue ?? null, val: a["cumulative-layout-shift"]?.numericValue ?? null },
      tbt: pick("total-blocking-time"), si: pick("speed-index"),
    };
  } catch { return null; } finally { clearTimeout(t); }
}

// ======================= Barabash AI =======================
async function askAI(system: string, user: string, maxTokens: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 110000);
  let res: Response;
  try {
    res = await fetch(`${AI_URL}/chat/completions`, {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${AI_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        stream: false, temperature: 0.35, max_tokens: maxTokens, think: false,
      }),
    });
  } finally { clearTimeout(t); }
  if (!res.ok) throw new Error(`Barabash AI: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
function closeBrackets(s: string): string {
  let inStr = false, esc = false;
  const st: string[] = [];
  for (const c of s) {
    if (esc) { esc = false; continue; }
    if (c === "\\") { if (inStr) esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") st.push(c);
    else if (c === "}" || c === "]") st.pop();
  }
  let out = s;
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "");
  while (st.length) out += st.pop() === "{" ? "}" : "]";
  return out;
}
function repairJson(s: string): Record<string, unknown> {
  let end = s.length;
  for (let iter = 0; iter < 400 && end > 1; iter++) {
    const cut = s.slice(0, end);
    try { return JSON.parse(closeBrackets(cut)); } catch { /* tnij dalej */ }
    const idx = Math.max(cut.lastIndexOf(","), cut.lastIndexOf("{"), cut.lastIndexOf("["), cut.lastIndexOf('"'));
    if (idx <= 0) break;
    end = idx;
  }
  throw new Error("Model nie zwrócił poprawnego JSON");
}
function parseJson(raw: string): Record<string, unknown> {
  let s = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const a = s.indexOf("{");
  if (a === -1) throw new Error("Model nie zwrócił JSON");
  const b = s.lastIndexOf("}");
  s = b > a ? s.slice(a, b + 1) : s.slice(a);
  try { return JSON.parse(s); } catch { /* spróbuj naprawić */ }
  return repairJson(s);
}
async function askJson(system: string, user: string, maxTokens: number): Promise<Record<string, unknown>> {
  try {
    return parseJson(await askAI(system, user, maxTokens));
  } catch (_) {
    const reminder = user + `\n\nUWAGA: poprzednia odpowiedź miała niepoprawny JSON. Zwróć TYLKO poprawny JSON. W tekstach nie używaj znaku cudzysłowu prostego (") — pisz bez cytatów.`;
    return parseJson(await askAI(system, reminder, maxTokens));
  }
}

const SYS = "Jesteś senior konsultantem SEO/GEO i wdrożeń AI (widoczność w Google i w odpowiedziach AI: ChatGPT, Gemini, Perplexity) w agencji Fastline InfinitiQ. Piszesz po polsku: rzeczowo, konkretnie, bez lania wody i bez przesady marketingowej — diagnoza i propozycja, nie reklama. Odwołujesz się do FAKTÓW ze strony klienta (nazwy usług, kanały, miasta, sygnały techniczne). Odpowiadasz WYŁĄCZNIE poprawnym JSON, bez markdown, bez komentarzy.";

function yn(v: unknown) { return v ? "JEST" : "BRAK"; }
function siteBrief(meta: SiteMeta, clientName: string, url: string, full = true): string {
  const s = meta.signals;
  const lines = [
    `Klient: ${clientName}`,
    `URL: ${url} (final: ${meta.finalUrl})${s.city ? ` · miasto/adres: ${s.city}` : ""}`,
    `Title: ${meta.title || "(brak)"}`,
    `Meta description: ${meta.desc || "(brak)"}`,
    `H1: ${meta.h1.join(" | ") || "(brak)"}`,
    `H2: ${meta.h2.slice(0, 14).join(" | ") || "(brak)"}`,
    `H3: ${meta.h3.slice(0, 10).join(" | ") || "(brak)"}`,
    `Menu: ${s.navLabels.join(" · ") || "(brak)"}`,
    `Sygnały techniczne: schema.org=${yn(s.hasSchema)}${s.schemaTypes.length ? ` (${s.schemaTypes.join(",")})` : ""}, FAQ schema=${yn(s.faqSchema)}, OpenGraph=${yn(s.hasOg)}, canonical=${yn(s.hasCanonical)}, hreflang=${yn(s.hasHreflang)} (${s.langs.join(",") || "-"}), lang=${s.lang || "-"}, CMS=${s.cms || "?"}, HTML=${s.htmlKb}KB, skryptów=${meta.perf.scripts}, obrazów=${meta.perf.imgs} (lazy ${meta.perf.lazyImgs}, WebP ${meta.perf.webp ? "tak" : "nie"})`,
    `Sygnały biznesowe: sklep online=${s.ecommerce ? "TAK" : "NIE"}, ceny na stronie=${s.pricesOnSite ? "TAK" : "NIE"}, chat/czat na stronie=${s.chatWidget ? "JEST (" + s.chatWidget + ")" : "BRAK"}, rezerwacja online=${s.booking ? "JEST" : "BRAK"}, WhatsApp=${s.whatsapp ? "JEST" : "BRAK"}, Messenger=${s.messenger ? "JEST" : "BRAK"}, blog/aktualności=${s.blog ? "JEST" : "BRAK"}, opinie (schema)=${s.reviews ? `${s.reviews.value}/5 (${s.reviews.count})` : "BRAK"}, widget opinii=${s.reviewsWidget ? "JEST" : "BRAK"}, formularze=${s.forms}, newsletter=${s.newsletter ? "JEST" : "BRAK"}, mapa Google=${s.maps ? "JEST" : "BRAK"}, wideo=${s.video ? "JEST" : "BRAK"}, analityka/piksel=${s.analytics ? "JEST" : "BRAK"}, social: ${s.socials.join(", ") || "brak linków"}, telefony: ${s.phones.length}, e-maile: ${s.emails.length}`,
    `--- Treść strony głównej (fragment) ---`,
    meta.text.slice(0, full ? 4200 : 2200),
  ];
  if (full && meta.subpages.length) {
    lines.push(`--- Podstrony ---`);
    for (const p of meta.subpages) {
      lines.push(`[${p.url.replace(/^https?:\/\/(www\.)?/, "")}] ${p.title}${p.h1.length ? " | H1: " + p.h1.join(" / ") : ""}${p.h2.length ? " | H2: " + p.h2.slice(0, 6).join(" / ") : ""}\n${p.text.slice(0, 900)}`);
    }
  }
  return lines.join("\n");
}

// ======================= pakiety z katalogu (liczone w kodzie) =======================
type PickedProduct = { id: number; tier: number; why: string; scope: string[]; effect: string; example: string; kpi: string[] };
// zdanie celu pakietu bez numerów produktów ("(#12, #16)", "(produkty #12 i #2)", "(dodatkowo #13 i #15)")
function cleanGoal(g: string): string {
  return g.replace(/\s*\((?:produkty |dodatkowo |dodaje |z |plus )?#\d+[^)]*\)/gi, "").replace(/\s*#\d+(?:\s*(?:,|i|oraz)\s*#\d+)*/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
}
function buildPackages(picked: PickedProduct[], goals: Record<string, string>) {
  const byTier = (max: number) => picked.filter(p => p.tier <= max);
  const defs = [
    { key: "start", name: "Start", tier: 1, sub: "Najpilniejszy problem — jeden ruch, szybki efekt" },
    { key: "growth", name: "Wzrost", tier: 2, sub: "Sprzedaż i widoczność pracują razem" },
    { key: "scale", name: "Skala", tier: 3, sub: "Cyfrowy organizm firmy — pełny ekosystem" },
  ];
  return defs.map((d, i) => {
    const items = byTier(d.tier);
    const impl = items.reduce((a, p) => a + (CATALOG.find(c => c.id === p.id)?.impl ?? 0), 0);
    const sub = items.reduce((a, p) => a + (CATALOG.find(c => c.id === p.id)?.sub ?? 0), 0);
    return {
      key: d.key, name: d.name, level: i + 1, subtitle: d.sub,
      goal: cleanGoal(String(goals?.[d.key] ?? "")),
      product_ids: items.map(p => p.id),
      impl_from: impl, sub_from: sub, year_from: impl + sub * 12,
      impl_label: `od ${fmtPln(impl)}`, sub_label: `od ${fmtPln(sub)} / mies.`, year_label: `≈ ${fmtPln(impl + sub * 12)} w 1. roku`,
    };
  });
}

// Głęboka sanityzacja stringów przed zapisem do jsonb: Postgres odrzuca \u0000,
// a ucięte slice()'m pary zastępcze (emoji przecięte w połowie) dają "unsupported Unicode
// escape sequence" — cały UPDATE pada. toWellFormed (ES2024) zamienia samotne surogaty na U+FFFD.
function deepClean<T>(v: T): T {
  if (typeof v === "string") {
    let s = v.replace(/\u0000/g, "");
    // deno-lint-ignore no-explicit-any
    if (typeof (s as any).toWellFormed === "function") s = (s as any).toWellFormed();
    else s = s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "\uFFFD").replace(/(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, "$1\uFFFD");
    return s as unknown as T;
  }
  if (Array.isArray(v)) return v.map(deepClean) as unknown as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = deepClean(x);
    return o as unknown as T;
  }
  return v;
}

// ======================= stan między etapami (site_meta._stage) =======================
// Izolat edge żyje max ~150 s, więc audyt jedzie w 3 etapach; każdy etap to osobne
// wywołanie funkcji (sama się woła z nagłówkiem x-audit-key = service role):
//  1: strona + logo + podstrony + PageSpeed/paleta + AI para 1 (diagnoza ‖ oferta)
//  2: wyszukiwanie konkurentów + pomiar ich stron + AI p4 (konkurencja/naprawy)
//  3: AI p3 (produkty z katalogu) + pakiety + zapis finalny
type RivalLite = Omit<Rival, "html">;
type StageState = {
  url: string; finalUrl: string; host: string; title: string; desc: string; h1n: number;
  brief: string; briefShort: string; perf: SiteMeta["perf"]; signals: SiteMeta["signals"]; scanInfo?: SiteMeta["scanInfo"];
  logo: string; light: boolean; small: boolean; favicon: string; subpages: string[];
  linked: string[]; brandText: string; phones: string[];
  psi: Awaited<ReturnType<typeof fetchPSI>>; theme: Awaited<ReturnType<typeof extractTheme>>;
  r1: Record<string, unknown>; r2: Record<string, unknown>; manualRivals: string[];
  // po etapie 2
  rivals?: RivalLite[]; compCards?: Array<Record<string, unknown>>; r4?: Record<string, unknown>;
  searchInfo?: { queries: string[]; engines: string[]; candidates: number } | null;
  startedAt: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* noop */ }

  // wywołania wewnętrzne (etapy 2/3, debug) — klucz service role w nagłówku
  const internal = !!INTERNAL_KEY && req.headers.get("x-audit-key") === INTERNAL_KEY;
  if (!internal) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Wymagane logowanie" }, 401);
  }

  // debug: surowy HTML z IP edge — {action:"fetch", url}
  if (internal && body.action === "fetch") {
    try {
      const { res, text } = await fetchText(String(body.url ?? ""), 15000, { Accept: "text/html" }, 400_000);
      return new Response(JSON.stringify({ status: res.status, url: res.url, len: text.length, html: text.slice(0, 160_000) }), { headers: { ...CORS, "content-type": "application/json" } });
    } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
  }
  // debug: test wyszukiwarek z IP edge — {action:"search", q:"..."}
  if (internal && body.action === "search") {
    const q = String(body.q ?? "");
    const out: Record<string, unknown> = {};
    for (const [name, fn] of ENGINES) {
      const t0 = Date.now();
      try { const hits = await fn(q); out[name] = { n: hits.length, ms: Date.now() - t0, top: hits.slice(0, 8).map(h => `${h.domain} | ${h.title.slice(0, 60)}`) }; }
      catch (e) { out[name] = { error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }; }
    }
    return json(out);
  }

  const db = createClient(supaUrl, service);
  const id = String(body.id ?? "");
  const stage = Math.max(1, Math.min(3, +(body.stage ?? 1) || 1));
  if (!id) return json({ error: "Brak id audytu" }, 400);

  const { data: audit, error: loadErr } = await db.from("audits").select("*").eq("id", id).maybeSingle();
  if (loadErr || !audit) return json({ error: "Nie znaleziono audytu" }, 404);
  if (!AI_KEY) {
    await db.from("audits").update({ status: "error", error: "Brak klucza BARABASH_AI_KEY" }).eq("id", id);
    return json({ error: "Brak klucza BARABASH_AI_KEY" }, 500);
  }
  if (stage === 1) await db.from("audits").update({ status: "running", error: null }).eq("id", id);

  const fail = async (msg: string) => {
    console.error("audyt", id, `etap ${stage} błąd:`, msg);
    await db.from("audits").update({ status: "error", error: msg }).eq("id", id);
  };
  const saveStage = async (st: StageState) => {
    const payload = { site_meta: deepClean({ ...(audit.site_meta ?? {}), _stage: st }) };
    const { error } = await db.from("audits").update(payload).eq("id", id);
    if (error) throw new Error(`Zapis stanu etapu nie powiódł się: ${error.message}`);
  };
  const next = async (n: number) => {
    const r = await fetch(`${supaUrl}/functions/v1/audit-run`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, Authorization: `Bearer ${anon}`, "x-audit-key": INTERNAL_KEY },
      body: JSON.stringify({ id, stage: n }),
    });
    console.log("audyt", id, `→ etap ${n}:`, r.status);
    if (!r.ok) await fail(`Nie udało się uruchomić etapu ${n}: ${r.status}`);
  };

  const work = (async () => {
  const t0 = Date.now();
  const lap = () => `${Math.round((Date.now() - t0) / 1000)}s`;
  try {
    // ======================= ETAP 1 =======================
    if (stage === 1) {
      let url = String(audit.site_url).trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      const psiPromise = fetchPSI(url).catch(() => null);
      const meta = await fetchSite(url);
      console.log("audyt", id, lap(), "strona pobrana:", meta.host, "podstron:", meta.subpages.length, "logo:", meta.logo || "(brak)");
      const themePromise = extractTheme(meta.html, meta.finalUrl).catch(() => null);
      const brief = siteBrief(meta, audit.client_name, url, true);
      const briefShort = siteBrief(meta, audit.client_name, url, false);
      const manualRivals = String(audit.competitors || "")
        .split(/[,;\n]+/).map(normDomain).filter(d => d && d.includes(".")).slice(0, 4);

      const p1 = `Przeanalizuj stronę klienta pod kątem SEO i widoczności w AI (GEO). Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "firma": "krótka nazwa firmy",
 "branza": "branża / czym się zajmuje (kilka słów)",
 "model": "b2b|b2c|b2b+b2c",
 "zasieg": "lokalny|regionalny|ogólnopolski|międzynarodowy",
 "lokalizacja": "miasto/region działania wg strony albo pusty string",
 "oferta": [ "główne usługi/produkty firmy wg strony" ],  // 3-6 pozycji, konkretne nazwy ze strony
 "klient_docelowy": "kto kupuje (1 zdanie)",
 "hero": { "headline": "1 zdanie-hasło audytu w stylu: gdy klient pyta AI o [usługę], niech pada [firma]", "sub": "2 zdania: obecna sytuacja i co daje ta oferta" },
 "diagnosis": [ { "title": "3-6 słów", "text": "2-3 zdania diagnozy z odwołaniem do konkretów ze strony" } ],   // dokładnie 3
 "metrics": [ { "value": "krótka wartość PO POLSKU: 'BRAK' / 'JEST' / 'TAK' / 'NIE' / '2 języki' (nigdy true/false)", "label": "czego dotyczy" } ],  // 5-6 metryk punktu wyjścia opartych o realne sygnały (schema, OG, canonical, hreflang, blog, chat, rezerwacja, opinie)
 "plus": [ "co już działa — konkret ze strony" ],   // dokładnie 4
 "minus": [ "co kosztuje widoczność lub sprzedaż — konkret" ],   // dokładnie 4
 "scores": { "google": 0, "ai": 0, "technika": 0, "tresc": 0 },  // 0-100, uczciwie
 "search_queries": [ "zapytanie do wyszukiwarki" ]  // dokładnie 4 KRÓTKIE zapytania PO POLSKU (2-5 słów), jakimi klient końcowy szuka TAKIEJ firmy jak ta w Google (usługa/produkt + ewentualnie miasto/region dla firm lokalnych; dla B2B: producent/hurtownia/dostawca + produkt). Bez nazwy klienta. Wyniki posłużą do znalezienia BEZPOŚREDNICH konkurentów${manualRivals.length ? "" : `,
 "competitor_domains": [ "domena.pl" ]  // do 5 domen realnych bezpośrednich konkurentów, tylko jeśli jesteś ich pewien (inaczej pusta lista); bez mediów, katalogów, marek klienta`}
}
Pisz zwięźle. Opieraj się TYLKO na danych ze strony. Nie wymyślaj liczb ruchu.

${brief}`;
      const p2 = `Dla tej samej strony przygotuj część ofertową audytu. Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "keywords": [ { "phrase": "fraza po polsku", "intent": "informacyjna|zakupowa|lokalna|porównawcza", "potential": "wysoki|średni|niski" } ],  // dokładnie 8 fraz, którymi realni klienci szukają takich usług (konkretnie pod ofertę i lokalizację klienta)
 "ai_prompts": [ { "category": "nazwa kategorii", "prompts": [ "pytanie 1", "pytanie 2" ] } ],  // dokładnie 4 kategorie po 2 pytania: jak klienci pytają ChatGPT/Gemini o takie usługi
 "why_now": [ { "title": "3-6 słów", "text": "2 zdania" } ],  // dokładnie 3: dlaczego warto działać teraz (odnieś do branży klienta)
 "plan": [ { "title": "nazwa etapu", "text": "co robimy, 2 zdania", "effect": "efekt etapu, 1 zdanie" } ],  // dokładnie 3 etapy: audyt+fundament techniczny → treści+GEO → skala i pomiar
 "faq": [ { "q": "pytanie", "a": "odpowiedź 2 zdania" } ]  // dokładnie 4 najczęstsze pytania klienta o taką współpracę
}
Pisz zwięźle. Frazy i prompty mają pasować do branży i oferty klienta (wg strony). Bez wymyślonych liczb.

${briefShort.slice(0, 3600)}`;

      const [r1, r2] = await Promise.all([askJson(SYS, p1, 1600), askJson(SYS, p2, 1700)]);
      console.log("audyt", id, lap(), "para 1 gotowa; branża:", r1.branza, "| zasięg:", r1.zasieg, "| lokalizacja:", r1.lokalizacja);
      const [psi, theme] = await Promise.all([psiPromise, themePromise]);
      const linked = [...new Set([...meta.html.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map(m => normDomain(m[1])).filter(d => d && !sameSite(d, meta.host)))].slice(0, 300);
      const st: StageState = {
        url, finalUrl: meta.finalUrl, host: meta.host, title: meta.title, desc: meta.desc, h1n: meta.h1.length,
        brief, briefShort, perf: meta.perf, signals: meta.signals, scanInfo: meta.scanInfo,
        logo: meta.logo, light: meta.light, small: meta.small, favicon: meta.favicon, subpages: meta.subpages.map(p => p.url),
        linked, brandText: stripTags(meta.body).toLowerCase().slice(0, 30_000), phones: meta.signals.phones,
        psi, theme, r1, r2, manualRivals, startedAt: new Date().toISOString(),
      };
      await saveStage(st);
      console.log("audyt", id, lap(), "etap 1 zapisany");
      await next(2);
      return;
    }

    const st = (audit.site_meta?._stage ?? null) as StageState | null;
    if (!st) throw new Error(`Brak zapisanego stanu etapu 1 (etap ${stage}) — kliknij „Ponów analizę"`);
    const r1 = st.r1;

    // ======================= ETAP 2: konkurenci =======================
    if (stage === 2) {
      const clientHost = st.host;
      const GENERIC_WORDS = new Set(["group", "grupa", "polska", "poland", "company", "agency", "agencja", "studio", "academy", "akademia", "racing", "sport", "sports", "team", "biuro", "office", "serwis", "service", "online", "sklep", "store", "centrum", "center", "klinika", "clinic", "salon", "hotel", "restauracja", "firma"]);
      const clientBrandTokens = [clientHost.split(".")[0], ...String(audit.client_name || "").toLowerCase().split(/[^a-z0-9ąćęłńóśźż]+/)]
        .filter(w => w.length >= 5 && !GENERIC_WORDS.has(w));
      const clientPhones = new Set(st.phones);
      const linkedSet = new Set(st.linked);
      const isOwnGroup = (r: Rival): boolean => {
        if (sameSite(r.domain, clientHost)) return true;
        if (linkedSet.has(r.domain) || [...linkedSet].some(d => sameSite(d, r.domain))) return true;
        const rivalBase = r.domain.split(".")[0].replace(/-/g, "");
        if (rivalBase.length >= 5 && st.brandText.replace(/-/g, "").includes(rivalBase)) return true;
        if (r.html) {
          const lc = r.html.toLowerCase();
          if (lc.includes(clientHost)) return true;
          for (const tok of clientBrandTokens) if (lc.includes(tok)) return true;
          const rp = phonesOf(r.html);
          for (const p of clientPhones) if (rp.has(p)) return true;
        }
        return false;
      };

      let rivals: Rival[] = [];
      let searchInfo: StageState["searchInfo"] = null;
      if (st.manualRivals.length) {
        rivals = (await Promise.all(st.manualRivals.filter(d => !sameSite(d, clientHost)).map(d => fetchRival(d, true)))).filter(Boolean) as Rival[];
      } else {
        const queries = [...new Set(
          (Array.isArray(r1.search_queries) ? r1.search_queries as string[] : []).map(q => String(q).trim()).filter(q => q.length > 3 && q.length < 80)
        )].slice(0, 4);
        const autoQ = [String(r1.branza ?? ""), String(r1.lokalizacja ?? "")].filter(Boolean).join(" ").trim();
        if (autoQ && autoQ.length < 80 && !queries.includes(autoQ)) queries.push(autoQ);
        const hitsPerQ = await webSearchAll(queries);
        const agg = new Map<string, { score: number; hits: number; title: string; snippet: string; url: string; engines: Set<string> }>();
        hitsPerQ.forEach((hits) => {
          const seenQ = new Set<string>();
          hits.forEach(h => {
            const d = h.domain;
            if (!d || seenQ.has(d)) return;
            seenQ.add(d);
            const e = agg.get(d) ?? { score: 0, hits: 0, title: h.title, snippet: h.snippet, url: h.url, engines: new Set<string>() };
            e.score += 1 / Math.sqrt(h.rank);
            e.hits += 1;
            e.engines.add(h.engine);
            if (!e.title && h.title) e.title = h.title;
            if (!e.snippet && h.snippet) e.snippet = h.snippet;
            agg.set(d, e);
          });
        });
        const engines = [...new Set([...agg.values()].flatMap(e => [...e.engines]))];
        const ranked = [...agg.entries()]
          .filter(([d, e]) => !isNoiseDomain(d) && !NOISE_HOST.test(d) && !NOISE_TITLE.test(e.title) && !/\.(place|info|biz)$/i.test(d) && !sameSite(d, clientHost) && !linkedSet.has(d))
          .sort((a, b) => b[1].score - a[1].score);
        const aiDomains = (Array.isArray(r1.competitor_domains) ? r1.competitor_domains as string[] : []).map(normDomain)
          .filter(d => d && d.includes(".") && !isNoiseDomain(d) && !sameSite(d, clientHost) && !ranked.some(([x]) => x === d));
        const candDomains = [...ranked.slice(0, 9).map(([d]) => d), ...(ranked.length < 6 ? aiDomains.slice(0, 3) : [])].slice(0, 10);
        searchInfo = { queries, engines, candidates: ranked.length };
        console.log("audyt", id, lap(), "search:", queries.join(" | "), "→ silniki:", engines.join(",") || "brak", "domen:", ranked.length, "kandydaci:", candDomains.join(", ") || "(brak)");
        const fetched = (await Promise.all(candDomains.map(d => fetchRival(d, false)))).filter(Boolean) as Rival[];
        rivals = fetched.filter(r => r.measured && !isOwnGroup(r)).map(r => {
          const e = agg.get(r.domain);
          return { ...r, searchScore: e ? Math.round(e.score * 100) / 100 : 0, hits: e?.hits ?? 0, snippet: (r.snippet || e?.snippet || "").slice(0, 500) };
        }).slice(0, 7);
        console.log("audyt", id, lap(), "po filtrach:", rivals.map(r => r.domain).join(", ") || "(brak)");
      }

      const rivalFacts = rivals.length
        ? (st.manualRivals.length
            ? "KONKURENCI DO ANALIZY (używaj DOKŁADNIE tych domen jako nazw; nie dodawaj innych firm):\n"
            : `KANDYDACI NA KONKURENTÓW (znalezieni w wyszukiwarce po zapytaniach: ${searchInfo?.queries.map(q => `"${q}"`).join(", ")}; dane zmierzone na ich stronach):\n`) +
          rivals.filter(r => r.measured).map(r =>
            `- ${r.domain}: tytuł="${(r.title || "").slice(0, 90)}"; opis="${(r.desc || r.snippet || "").slice(0, 160)}"; meta description ${yn(r.hasDesc)}, Schema.org ${yn(r.hasSchema)}, OpenGraph ${yn(r.hasOg)}, hreflang ${yn(r.hasHreflang)}, blog ${yn(r.hasBlog)}, chat ${yn(r.hasChat)}, rezerwacja online ${yn(r.hasBooking)}, TTFB ~${r.ttfbMs} ms, HTML ${r.htmlKb} KB`).join("\n") +
          (rivals.some(r => !r.measured)
            ? "\n" + rivals.filter(r => !r.measured).map(r =>
                `- ${r.domain}: ${r.alive ? "strona działa, ale blokuje automatyczny pomiar (ochrona przed botami) — opisz jakościowo" : "strona nie odpowiada — opisz jakościowo"}`).join("\n")
            : "")
        : "Brak zmierzonych danych konkurentów — opisz 3 TYPY konkurentów w tej branży.";

      const psi = st.psi;
      const speedBrief = psi
        ? `PageSpeed (mobile): wynik ${psi.score}/100, FCP ${psi.fcp?.text}, LCP ${psi.lcp?.text}, CLS ${psi.cls?.text}, TBT ${psi.tbt?.text}. Do tego: HTML ${st.perf.htmlKb} KB, tagów <script> ${st.perf.scripts}, obrazów ${st.perf.imgs} (lazy: ${st.perf.lazyImgs}), WebP: ${st.perf.webp ? "tak" : "nie"}.`
        : `PageSpeed niedostępny. Pomiary własne: TTFB ~${st.perf.ttfbMs} ms, HTML ${st.perf.htmlKb} KB, tagów <script> ${st.perf.scripts}, obrazów ${st.perf.imgs} (lazy: ${st.perf.lazyImgs}), WebP: ${st.perf.webp ? "tak" : "nie"}.`;

      const p4 = `Przygotuj część konkurencyjno-naprawczą audytu dla "${audit.client_name}" (branża: ${r1.branza ?? "wg strony"}; oferta: ${(Array.isArray(r1.oferta) ? r1.oferta as string[] : []).join(", ")}; zasięg: ${r1.zasieg ?? "?"}${r1.lokalizacja ? `; lokalizacja: ${r1.lokalizacja}` : ""}). Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "competitors": [ { "name": "domena konkurenta z listy niżej (jeśli jest) lub typ konkurenta", "profile": "kim jest ta firma i dla kogo — 1 zdanie na podstawie jej tytułu/opisu", "strengths": "czym dziś wygrywa widoczność w Google i AI lub sprzedaż — oprzyj się na zmierzonych danych, 1-2 zdania", "gap": "czego jej brakuje albo w czym klient może ją wyprzedzić — konkretna szansa, 1 zdanie" } ],  // ${st.manualRivals.length && rivals.length ? `dokładnie ${rivals.length}: po jednym dla KAŻDEJ domeny z listy niżej, w tej samej kolejności, name = domena` : rivals.length ? `wybierz z listy niżej maksymalnie 3 domeny będące BEZPOŚREDNIMI konkurentami klienta (ta sama usługa/produkt, ten sam typ klienta, podobny zasięg — dla firmy lokalnej ten sam region); POMIŃ portale, media, katalogi, sklepy z innej branży, dostawców i firmy z innego segmentu; name = domena dokładnie jak na liście; jeśli żadna nie pasuje — opisz 3 TYPY konkurentów (name = typ)` : "dokładnie 3 TYPY konkurentów (name = typ)"}
 "lost_queries": [ { "query": "zapytanie klienta po polsku", "why": "dlaczego na tym zapytaniu klient trafia gdzie indziej (czego brakuje na stronie), 1 zdanie", "fix": "co wdrożyć, żeby przechwycić to zapytanie, 1 zdanie" } ],  // dokładnie 5 zapytań, na których firma DZIŚ traci klientów (konkretne pod ofertę i region)
 "speed_tips": [ "konkretna poprawa szybkości strony wynikająca z danych poniżej" ],  // dokładnie 4
 "recommendations": [ { "title": "3-6 słów", "text": "co dokładnie zmienić i jak, 1-2 zdania", "priority": "wysoki|średni|niski" } ]  // dokładnie 6 najważniejszych zmian (technika, treść, GEO, szybkość, kanały kontaktu/sprzedaży)
}
Pisz zwięźle. Nie wymyślaj liczb ruchu ani nazw firm, których nie ma na liście — wtedy opisuj TYP konkurenta.
WAŻNE: firmy i marki wymienione NA STRONIE klienta (marki jego grupy, partnerzy, submarki) NIE są konkurencją — NIGDY nie używaj ich nazw jako konkurentów.

Dane o szybkości strony: ${speedBrief}

${rivalFacts}

${st.briefShort.slice(0, 2600)}`;

      const r4 = await askJson(SYS, p4, 1900);
      console.log("audyt", id, lap(), "p4 gotowe");

      let compCards = (Array.isArray(r4.competitors) ? r4.competitors as Array<Record<string, unknown>> : []).filter(k => k && String(k.name ?? "").trim());
      if (!st.manualRivals.length && rivals.length) {
        const chosen = compCards.map(k => normDomain(String(k.name ?? "")));
        const picked = rivals.filter(r => chosen.includes(r.domain));
        if (picked.length) {
          rivals = picked.slice(0, 3);
          compCards = compCards.filter(k => rivals.some(r => r.domain === normDomain(String(k.name ?? ""))));
        } else {
          rivals = [];
        }
        console.log("audyt", id, lap(), "finał konkurentów:", rivals.map(r => r.domain).join(", ") || "(typy)");
      }
      st.rivals = rivals.map(({ html: _h, snippet: _s, h1s: _hs, desc: _d, ...r }) => ({ ...r, title: (r.title || "").slice(0, 90) }));
      st.compCards = compCards;
      st.r4 = r4;
      st.searchInfo = searchInfo;
      await saveStage(st);
      console.log("audyt", id, lap(), "etap 2 zapisany");
      await next(3);
      return;
    }

    // ======================= ETAP 3: produkty z katalogu + pakiety + zapis =======================
    // Dwa krótkie wywołania zamiast jednego długiego (qwen ucinał JSON przy 6 rozbudowanych produktach):
    //  A — wybór 6 produktów + tier + why/effect + cele pakietów; B — scope/example/kpi dla wybranych.
    const diagText = (Array.isArray(r1.diagnosis) ? r1.diagnosis as Array<Record<string, string>> : []).map(d => `${d.title}: ${d.text}`).join("\n");
    const minusText = (Array.isArray(r1.minus) ? r1.minus as string[] : []).join("; ");
    const clientCtx = `Klient "${audit.client_name}" (branża: ${r1.branza ?? "wg strony"}; model: ${r1.model ?? "?"}; zasięg: ${r1.zasieg ?? "?"}; klient docelowy: ${r1.klient_docelowy ?? "?"}; oferta: ${(Array.isArray(r1.oferta) ? r1.oferta as string[] : []).join(", ")})`;
    const p3a = `Fastline InfinitiQ sprzedaje 18 gotowych produktów AI (katalog niżej). Dla klienta wybierz DOKŁADNIE 6 produktów, które rozwiążą jego realne problemy, i uzasadnij każdy KONKRETNIE faktami z jego strony/branży. Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "products": [
  { "id": 12, "tier": 1, "why": "2 zdania: jaki KONKRETNY fakt ze strony/branży klienta (brak chatu, brak rezerwacji online, sezonowość, telefon jako główny kanał, sklep online, B2B z ofertowaniem, wiele marek, rekrutacja…) wskazuje na ten produkt i co dziś klient przez to traci", "effect": "1-2 zdania: co się zmieni w firmie klienta (bez wymyślonych liczb)" }
 ],
 "packages": {
  "start": "1 zdanie: jaki problem klienta zamyka pakiet Start (2 produkty tier 1) — bez numerów produktów",
  "growth": "1 zdanie: co dokłada pakiet Wzrost (produkty tier 1+2) — bez numerów produktów",
  "scale": "1 zdanie: co daje pakiet Skala (wszystkie 6) — bez numerów produktów"
 }
}
Zasady: id = numer z katalogu (liczba); tier: 1 = Start (2 najpilniejsze), 2 = Wzrost (kolejne 2), 3 = Skala (ostatnie 2) — dokładnie 2 produkty na tier. SEO & GEO Autopilot (#12) MUSI być wśród 6 (to audyt widoczności), zwykle tier 1. Jeśli wybierasz produkt treściowy (#11, #13, #14, #15), Brand Voice Core (#16) też ma być w tym samym lub niższym tierze. Nie wybieraj produktów bez uzasadnienia w faktach (Warehouse Autopilot tylko dla firm z towarem/magazynem; AI Reception tylko gdy telefon/wizyty są kanałem sprzedaży; Loyalty OS gdy klienci wracają: gastro/beauty/retail/usługi cykliczne; Dynamic Pricing gdy są ceny na stronie/sklep/konkurencja cenowa; AI Recruiter/Academy gdy firma rekrutuje lub ma rotację; QRI/Instant Offer gdy jest sprzedaż B2B z ofertowaniem). Pisz po polsku, zwięźle.

${clientCtx}
DIAGNOZA: ${diagText}
Słabe punkty: ${minusText}

KATALOG PRODUKTÓW:
${catalogBrief()}

Kontekst o kliencie:
${st.brief.slice(0, 4200)}`;
    const r3 = await askJson(SYS, p3a, 1500);
    console.log("audyt", id, lap(), "p3a gotowe");
    const chosenIds = (Array.isArray(r3.products) ? r3.products as Array<Record<string, unknown>> : [])
      .map(p => +String(p.id ?? 0).replace(/\D/g, "") || 0).filter(n => CATALOG.some(c => c.id === n));
    const detailCatalog = CATALOG.filter(c => chosenIds.includes(c.id) || c.id === 12).map(c => `#${c.id} ${c.name} — ${c.tagline} Co robi: ${c.does.join("; ")}.`).join("\n");
    const p3b = `Dla klienta rozpisz szczegółowo wdrożenie wybranych produktów AI Fastline InfinitiQ. Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "details": [
  {
   "id": 12,
   "scope": [ "co dokładnie wdrażamy u TEGO klienta — 4 krótkie punkty (do 12 słów), każdy z nazwą kanału/procesu/działu/usługi klienta" ],
   "example": "1-2 zdania: konkretna scenka z życia tego klienta — klient końcowy robi X (pora, kanał), system robi Z",
   "kpi": [ "3 krótkie wskaźniki, które będziemy mierzyć" ]
  }
 ]
}
Po jednym wpisie dla KAŻDEGO produktu z listy (id jak w liście). Pisz po polsku, konkretnie, nazwami usług/kanałów/miejsc ze strony klienta, bez ogólników i bez wymyślonych liczb.

${clientCtx}
PRODUKTY DO ROZPISANIA:
${detailCatalog}

Kontekst o kliencie:
${st.brief.slice(0, 3600)}`;
    let r3b: Record<string, unknown> = {};
    try { r3b = await askJson(SYS, p3b, 2200); } catch (e) { console.log("audyt", id, lap(), "p3b błąd:", e instanceof Error ? e.message : String(e)); }
    console.log("audyt", id, lap(), "p3b gotowe");
    const details = new Map<number, Record<string, unknown>>();
    for (const d of (Array.isArray(r3b.details) ? r3b.details as Array<Record<string, unknown>> : [])) {
      const n = +String(d?.id ?? 0).replace(/\D/g, "") || 0;
      if (n) details.set(n, d);
    }

    const rawProducts = (Array.isArray(r3.products) ? r3.products as Array<Record<string, unknown>> : []);
    let picked: PickedProduct[] = rawProducts.map(p => {
      const pid = +String(p.id ?? 0).replace(/\D/g, "") || 0;
      const d = details.get(pid) ?? {};
      return {
        id: pid,
        tier: Math.min(3, Math.max(1, +(p.tier ?? 2) || 2)),
        why: String(p.why ?? "").trim(),
        scope: (Array.isArray(d.scope) ? d.scope : []).map(s => String(s).trim()).filter(Boolean).slice(0, 5),
        effect: String(p.effect ?? "").trim(),
        example: String(d.example ?? "").trim(),
        kpi: (Array.isArray(d.kpi) ? d.kpi : []).map(s => String(s).trim()).filter(Boolean).slice(0, 4),
      };
    }).filter((p, i, a) => CATALOG.some(c => c.id === p.id) && a.findIndex(x => x.id === p.id) === i);
    if (!picked.some(p => p.id === 12)) {
      const c = CATALOG.find(x => x.id === 12)!;
      picked.unshift({ id: 12, tier: 1, why: "Audyt dotyczy widoczności w Google i w odpowiedziach AI — to produkt, który tę widoczność buduje na autopilocie.", scope: c.does, effect: c.effect, example: "", kpi: ["pozycje na frazach z audytu", "liczba cytowań w odpowiedziach AI", "ruch organiczny"] });
    }
    const contentTier = Math.min(...picked.filter(p => CONTENT_IDS.has(p.id)).map(p => p.tier), 9);
    if (contentTier < 9 && !picked.some(p => p.id === 16)) {
      const c = CATALOG.find(x => x.id === 16)!;
      picked.push({ id: 16, tier: contentTier, why: "Wybrane produkty treściowe (blog, posty, odpowiedzi) muszą mówić jednym głosem marki — Brand Voice Core jest ich fundamentem.", scope: c.does, effect: c.effect, example: "", kpi: ["spójność tonu w kanałach", "liczba wpadek językowych", "czas akceptacji treści"] });
    } else if (contentTier < 9) {
      const bvc = picked.find(p => p.id === 16)!;
      if (bvc.tier > contentTier) bvc.tier = contentTier;
    }
    picked = picked.slice(0, 7);
    if (!picked.some(p => p.tier === 1)) picked[0].tier = 1;
    picked.sort((a, b) => a.tier - b.tier || a.id - b.id);
    // pakiety muszą rosnąć: gdy któryś tier pusty, rozkładamy produkty równo (2/2/2) zachowując kolejność
    if (picked.length >= 3 && (!picked.some(p => p.tier === 2) || !picked.some(p => p.tier === 3))) {
      const per = Math.ceil(picked.length / 3);
      picked.forEach((p, i) => { p.tier = Math.min(3, Math.floor(i / per) + 1); });
    }
    const products = picked.map(p => {
      const c = CATALOG.find(x => x.id === p.id)!;
      return { ...p, name: c.name, group: c.group, sense: c.sense, tagline: c.tagline, does: c.does, impl: c.impl, sub: c.sub, impl_label: `od ${fmtPln(c.impl)}`, sub_label: `od ${fmtPln(c.sub)} / mies.` };
    });
    const packages = buildPackages(picked, (r3.packages && typeof r3.packages === "object" ? r3.packages : {}) as Record<string, string>);

    // fallback ocen: p1 bywa ucięty (repairJson gubi "scores") — liczymy z realnych sygnałów, żeby hero zawsze miał wskaźniki
    const sg = st.signals;
    const clamp = (n: number) => Math.max(5, Math.min(95, Math.round(n)));
    const heur = {
      technika: clamp(25 + (sg.hasSchema ? 14 : 0) + (sg.hasOg ? 10 : 0) + (sg.hasCanonical ? 10 : 0) + (sg.hasHreflang ? 5 : 0) + (sg.viewport ? 6 : 0) + (st.psi ? st.psi.score * 0.22 : 8)),
      google: clamp(20 + (st.desc ? 10 : 0) + (st.h1n ? 8 : 0) + (sg.hasSchema ? 10 : 0) + (sg.blog ? 12 : 0) + (sg.hasCanonical ? 6 : 0) + (st.psi ? st.psi.score * 0.18 : 6)),
      ai: clamp(12 + (sg.hasSchema ? 14 : 0) + (sg.faqSchema ? 12 : 0) + (sg.blog ? 10 : 0) + (st.desc ? 8 : 0) + (sg.hasOg ? 6 : 0)),
      tresc: clamp(25 + (sg.blog ? 15 : 0) + (st.h1n ? 8 : 0) + (sg.faqSchema ? 8 : 0) + Math.min(20, st.subpages.length * 4)),
    };
    const aiScores = (r1.scores && typeof r1.scores === "object" ? r1.scores : {}) as Record<string, unknown>;
    const scores: Record<string, number> = {};
    for (const k of ["google", "ai", "technika", "tresc"] as const) {
      const v = +String(aiScores[k] ?? "");
      scores[k] = Number.isFinite(v) && v > 0 ? Math.min(100, v) : heur[k];
    }

    const rivals = st.rivals ?? [];
    const measuredRivals = rivals.filter(r => r.measured);
    const unmeasuredRivals = rivals.filter(r => !r.measured);
    const content = {
      ...r1, ...st.r2, ...(st.r4 ?? {}),
      scores,
      products, packages,
      speed: { psi: st.psi, local: st.perf },
      competitors: st.compCards ?? [],
      competitor_matrix: rivals.length ? {
        client: {
          domain: st.host, ttfbMs: st.perf.ttfbMs, htmlKb: st.perf.htmlKb,
          hasDesc: !!st.desc, hasSchema: st.signals.hasSchema, hasOg: st.signals.hasOg,
          hasCanonical: st.signals.hasCanonical, hasHreflang: st.signals.hasHreflang, h1: st.h1n,
          hasChat: !!st.signals.chatWidget, hasBlog: st.signals.blog, hasBooking: st.signals.booking,
        },
        rivals: measuredRivals,
        unmeasured: unmeasuredRivals.map(r => ({ domain: r.domain, alive: r.alive })),
        search: st.manualRivals.length ? null : st.searchInfo,
      } : null,
    };
    delete (content as Record<string, unknown>).competitor_domains;
    delete (content as Record<string, unknown>).search_queries;
    const { error: finErr } = await db.from("audits").update({
      status: "ready",
      content: deepClean(content),
      logo_url: st.logo || null,
      site_meta: deepClean({
        title: st.title, desc: st.desc, finalUrl: st.finalUrl, theme: st.theme,
        favicon: st.favicon || null, logo_light: st.light, logo_small: st.small,
        signals: { ...st.signals, navLabels: undefined },
        subpages: st.subpages,
        // gdzie znaleziono każdy sygnał + czy strona buduje treść skryptem —
        // strona audytu pokazuje na tej podstawie „jest · /cennik" i tłumaczy braki
        scan: st.scanInfo ?? null,
        version: 25,
      }),
      generated_at: new Date().toISOString(),
      error: null,
    }).eq("id", id);
    if (finErr) throw new Error(`Zapis wyniku nie powiódł się: ${finErr.message}`);
    console.log("audyt", id, lap(), "gotowy (start etapu 1:", st.startedAt, ")");
  } catch (e) {
    await fail(e instanceof Error ? e.message : String(e));
  }
  })();

  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(work);
  else await work;
  return json({ ok: true, id, stage, status: "running" });
});
