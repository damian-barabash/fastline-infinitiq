// audit-run — generuje audyt SEO/GEO strony klienta przez Barabash AI.
// Wywoływane z edytora (wymagany zalogowany user). Zapisuje wynik do public.audits.
// Ograniczenia: 2 sekwencyjne wywołania AI (nigdy równolegle — wspólny gateway
// z innymi produktami), model z env AUDIT_MODEL, cel: < 60 s.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = Deno.env.get("BARABASH_AI_URL") ?? "https://barabash-ai.tailcd3444.ts.net/v1";
const AI_KEY = Deno.env.get("BARABASH_AI_KEY") ?? "";
const AI_MODEL = Deno.env.get("AUDIT_MODEL") ?? "qwen3.5:9b";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

// ---------- pobranie i parsowanie strony klienta ----------
function absUrl(src: string, base: string): string {
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
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ").trim();
}

async function fetchSite(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "Accept-Language": "pl,en;q=0.8",
      },
    });
  } finally { clearTimeout(t); }
  if (!res.ok) throw new Error(`Strona klienta odpowiedziała ${res.status}`);
  const html = (await res.text()).slice(0, 600_000);
  const base = res.url || url;

  const title = extract(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const desc = extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html) ||
    extract(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i, html);
  const ogImage = extract(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i, html) ||
    extract(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i, html);

  // logo: <img> z "logo" w src/class/alt → apple-touch-icon → og:image → favicon
  let logo = "";
  const imgTags = extractAll(/(<img[^>]+>)/gi, html, 200);
  for (const tag of imgTags) {
    if (/logo/i.test(tag)) {
      const src = extract(/src=["']([^"']+)["']/i, tag);
      if (src && !/\.svg\?|pixel|tracking/i.test(src)) { logo = absUrl(src, base); if (logo) break; }
    }
  }
  if (!logo) logo = absUrl(extract(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i, html), base);
  if (!logo && ogImage) logo = absUrl(ogImage, base);
  if (!logo) logo = absUrl(extract(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i, html), base);

  const h1 = extractAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, html, 6).map(stripTags);
  const h2 = extractAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, html, 20).map(stripTags);
  const h3 = extractAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, html, 20).map(stripTags);
  const hasSchema = /application\/ld\+json/i.test(html);
  const hasOg = /property=["']og:/i.test(html);
  const hasCanonical = /rel=["']canonical["']/i.test(html);
  const hasHreflang = /hreflang=/i.test(html);
  const langs = extractAll(/hreflang=["']([a-zA-Z-]+)["']/gi, html, 10);
  const text = stripTags(html).slice(0, 4000);

  return {
    finalUrl: base, title, desc, logo, h1, h2, h3, text,
    signals: { hasSchema, hasOg, hasCanonical, hasHreflang, langs, htmlKb: Math.round(html.length / 1024) },
  };
}

// ---------- Barabash AI ----------
async function askAI(system: string, user: string, maxTokens: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 70000);
  let res: Response;
  try {
    res = await fetch(`${AI_URL}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${AI_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        stream: false,
        temperature: 0.4,
        max_tokens: maxTokens,
        think: false,
      }),
    });
  } finally { clearTimeout(t); }
  if (!res.ok) throw new Error(`Barabash AI: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// Domyka otwarte nawiasy/cudzysłowy w przyciętym fragmencie JSON.
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

// Naprawa zepsutego/uciętego JSON: tniemy od końca do kolejnych granic
// strukturalnych i próbujemy domknąć — pierwsza parsowalna wersja wygrywa.
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

// Wywołanie AI + parse z jedną powtórką przy niepoprawnym JSON.
async function askJson(system: string, user: string, maxTokens: number): Promise<Record<string, unknown>> {
  try {
    return parseJson(await askAI(system, user, maxTokens));
  } catch (_) {
    const reminder = user + `\n\nUWAGA: poprzednia odpowiedź miała niepoprawny JSON. Zwróć TYLKO poprawny JSON. W tekstach nie używaj znaku cudzysłowu prostego (") — pisz bez cytatów.`;
    return parseJson(await askAI(system, reminder, maxTokens));
  }
}

const SYS = "Jesteś senior konsultantem SEO/GEO (widoczność w Google i w odpowiedziach AI: ChatGPT, Gemini, Perplexity) w agencji Fastline InfinitiQ. Piszesz po polsku: rzeczowo, bez lania wody, bez przesady marketingowej — diagnoza, nie reklama. Odpowiadasz WYŁĄCZNIE poprawnym JSON, bez markdown, bez komentarzy.";

function siteBrief(meta: Awaited<ReturnType<typeof fetchSite>>, clientName: string, url: string): string {
  return [
    `Klient: ${clientName}`,
    `URL: ${url} (final: ${meta.finalUrl})`,
    `Title: ${meta.title || "(brak)"}`,
    `Meta description: ${meta.desc || "(brak)"}`,
    `H1: ${meta.h1.join(" | ") || "(brak)"}`,
    `H2: ${meta.h2.slice(0, 12).join(" | ") || "(brak)"}`,
    `H3: ${meta.h3.slice(0, 10).join(" | ") || "(brak)"}`,
    `Sygnały techniczne: schema.org=${meta.signals.hasSchema}, OpenGraph=${meta.signals.hasOg}, canonical=${meta.signals.hasCanonical}, hreflang=${meta.signals.hasHreflang} (${meta.signals.langs.join(",") || "-"}), rozmiar HTML=${meta.signals.htmlKb}KB`,
    `--- Treść strony (fragment) ---`,
    meta.text,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // auth: tylko zalogowany user edytora
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Wymagane logowanie" }, 401);

  const db = createClient(supaUrl, service);
  let id = "";
  try {
    const body = await req.json();
    id = String(body?.id ?? "");
  } catch { /* noop */ }
  if (!id) return json({ error: "Brak id audytu" }, 400);

  const { data: audit, error: loadErr } = await db.from("audits").select("*").eq("id", id).maybeSingle();
  if (loadErr || !audit) return json({ error: "Nie znaleziono audytu" }, 404);
  if (!AI_KEY) {
    await db.from("audits").update({ status: "error", error: "Brak klucza BARABASH_AI_KEY" }).eq("id", id);
    return json({ error: "Brak klucza BARABASH_AI_KEY" }, 500);
  }

  await db.from("audits").update({ status: "running", error: null }).eq("id", id);

  try {
    let url = String(audit.site_url).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const meta = await fetchSite(url);
    const brief = siteBrief(meta, audit.client_name, url);

    // Wywołanie 1: diagnoza strony
    const p1 = `Przeanalizuj stronę klienta pod kątem SEO i widoczności w AI (GEO). Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "firma": "krótka nazwa firmy",
 "branza": "branża / czym się zajmuje (kilka słów)",
 "hero": { "headline": "1 zdanie-hasło audytu w stylu: gdy klient pyta AI o [usługę], niech pada [firma]", "sub": "2 zdania: obecna sytuacja i co daje ta oferta" },
 "diagnosis": [ { "title": "3-6 słów", "text": "2-3 zdania diagnozy" } ],   // dokładnie 3 pozycje: jak rozumiemy sytuację klienta
 "metrics": [ { "value": "krótka wartość PO POLSKU: 'BRAK' / 'JEST' / 'TAK' / 'NIE' / '2 języki' (nigdy true/false)", "label": "czego dotyczy" } ],  // 4-6 metryk punktu wyjścia opartych o realne sygnały ze strony (schema, OG, canonical, hreflang, treść, blog)
 "plus": [ "co już działa — konkret ze strony" ],   // dokładnie 4
 "minus": [ "co kosztuje widoczność — konkret" ]    // dokładnie 4
}
Pisz zwięźle. Opieraj się TYLKO na danych ze strony. Nie wymyślaj liczb ruchu.

${brief}`;
    const r1 = await askJson(SYS, p1, 1200);

    // Wywołanie 2: fразы, prompty AI, plan
    const p2 = `Dla tej samej strony przygotuj część ofertową audytu. Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "keywords": [ { "phrase": "fraza po polsku", "intent": "informacyjna|zakupowa|lokalna|porównawcza", "potential": "wysoki|średni|niski" } ],  // dokładnie 8 fraz, którymi realni klienci szukają takich usług
 "ai_prompts": [ { "category": "nazwa kategorii", "prompts": [ "pytanie 1", "pytanie 2" ] } ],  // dokładnie 4 kategorie po 2 pytania: jak klienci pytają ChatGPT/Gemini o takie usługi
 "why_now": [ { "title": "3-6 słów", "text": "2 zdania" } ],  // dokładnie 3: dlaczego warto działać teraz
 "plan": [ { "title": "nazwa etapu", "text": "co robimy, 2 zdania", "effect": "efekt etapu, 1 zdanie" } ],  // dokładnie 3 etapy: audyt+fundament techniczny → treści+GEO → skala i pomiar
 "faq": [ { "q": "pytanie", "a": "odpowiedź 2 zdania" } ]  // dokładnie 4 najczęstsze pytania klienta o taką współpracę
}
Pisz zwięźle. Frazy i prompty mają pasować do branży klienta (${r1.branza ?? "wg strony"}). Bez wymyślonych liczb.

${brief.slice(0, 3200)}`;
    const r2 = await askJson(SYS, p2, 1600);

    // Wywołanie 3: propozycje usług AI dopasowane do biznesu klienta
    const p3 = `Fastline InfinitiQ (AI-Native Agency) oferuje wdrożenia AI: agenci AI (obsługa klienta, sprzedaż),
inteligentny copywriter / generative content, automatyzacja marketingu, AI w CRM i sprzedaży (scoring, follow-upy),
integracje LLM z procesami firmy, inteligentny magazyn / prognozowanie, AI wideo i wizualizacje, brand voice AI.
Dla klienta "${audit.client_name}" (branża: ${r1.branza ?? "wg strony"}) wybierz 5 NAJLEPIEJ pasujących wdrożeń AI
i opisz je KONKRETNIE pod ten biznes. Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "ai_services": [ { "name": "nazwa usługi (np. Agent AI obsługi klienta)", "desc": "co wdrażamy u tego klienta, 2 zdania", "effect": "co to daje biznesowo, 1 zdanie", "example": "konkretny przykład działania u tego klienta, 1 zdanie" } ]
}
Pisz zwięźle, po polsku, bez ogólników — odnoś się do realiów tej branży.

Kontekst o kliencie:
${brief.slice(0, 1500)}`;
    const r3 = await askJson(SYS, p3, 900);

    const content = { ...r1, ...r2, ...r3 };
    await db.from("audits").update({
      status: "ready",
      content,
      logo_url: meta.logo || null,
      site_meta: { title: meta.title, desc: meta.desc, finalUrl: meta.finalUrl, signals: meta.signals },
      generated_at: new Date().toISOString(),
      error: null,
    }).eq("id", id);

    return json({ ok: true, id, status: "ready" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("audits").update({ status: "error", error: msg }).eq("id", id);
    return json({ error: msg }, 500);
  }
});
