// Sprzedaż online i płatności cykliczne (2026-10-28).
//
// Ścieżka (tablica Miro, schemat 2, strefy 3A / 4A / 5):
//   koszyk (NIP → dane z rejestru MF) → płatność → automat zakłada konto
//   (workspace, projekt, produkt, użytkownik z hasłem jednorazowym) →
//   strona „Dziękujemy" + mail powitalny z loginem, hasłem i fakturą →
//   co miesiąc odnowienie z faktury; nieudane: mail dzień 0 / 3 / 5,
//   dzień 7 doradca wstrzymany, dzień 14 anulowanie.
//
// Bramka płatności jest wymienna (`provider()`); dopóki właściciel nie poda danych
// swojej bramki, działa `test` — strona /platnosc-testowa udaje bramkę.
// ⚠️ Kwoty liczy WYŁĄCZNIE ten plik z `billing_plans` — front tylko pokazuje.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
// @ts-ignore: typy esm.sh nie mają eksportu domyślnego, runtime ma (jak w brain-admin)
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_KEY") ?? "";
const MAIL_FROM = Deno.env.get("BILLING_MAIL_FROM") ?? "Fastline InfinitiQ <audyt@fastlineinfinitiq.pl>";
const NOTIFY_TO = Deno.env.get("BILLING_NOTIFY_TO") ?? Deno.env.get("AUDIT_LEAD_NOTIFY_TO") ?? "";
const CRON_KEY = Deno.env.get("BILLING_CRON_KEY") ?? "";
const PROVIDER = Deno.env.get("BILLING_PROVIDER") ?? "test";
const SITE = "https://fastlineinfinitiq.pl";
const BRAIN = "https://brain.fastlineinfinitiq.pl";
const LOGO = `${SITE}/assets/logo/LOGO.png`;
const ORIGINS = [SITE, "https://www.fastlineinfinitiq.pl", BRAIN, "https://hand.fastlineinfinitiq.pl",
  "http://localhost:5173", "http://localhost:4173", "http://localhost:4900", "http://localhost:4901"];

// Sprzedawca na fakturze — dane z wykazu podatników VAT (MF) dla NIP 5214163067, 2026-10-28.
const SELLER = {
  name: "FASTLINE INFINITIQ SP. Z O.O.",
  street: "ul. Wita Stwosza 48/103",
  postal_code: "02-661",
  city: "Warszawa",
  nip: "5214163067",
  regon: "544613419",
  krs: "0001237811",
  bank: "ING Bank Śląski",
  account: "PL35 1050 1142 1000 0090 8680 4086",
  email: "infinitiq@fastline.pl",
};

// ───────────────────────────────────────────────────────────────── pomocnicze

function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : SITE,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-billing-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
  };
}
let CORS: Record<string, string> = {};
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r2 = (n: number) => Math.round(n * 100) / 100;
const zl = (n: number) => r2(n).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
function addMonth(d: string) {
  const x = new Date(d + "T12:00:00Z");
  const day = x.getUTCDate();
  x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + 1);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return x.toISOString().slice(0, 10);
}
const plDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export function nipValid(nip: string) {
  const d = nip.replace(/\D/g, "");
  if (d.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((s, k, i) => s + k * +d[i], 0);
  return sum % 11 === +d[9];
}

// „WITA STWOSZA 48/103, 02-661 WARSZAWA" → ulica / kod / miasto (rejestr MF pisze wersalikami)
const title = (s: string) => s.toLowerCase().replace(/(^|[\s\-/.(])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
function splitAddress(a: string) {
  const m = a.match(/^(.*?),\s*(\d{2}-\d{3})\s+(.+)$/);
  if (!m) return { street: title(a), postal_code: "", city: "" };
  let street = title(m[1]);
  if (!/^(ul\.|al\.|pl\.|os\.)/i.test(street) && !/^\d/.test(street)) street = "ul. " + street;
  return { street, postal_code: m[2], city: title(m[3]) };
}
function companyTitle(n: string) {
  return n.replace(/SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ/i, "Sp. z o.o.")
    .replace(/SPÓŁKA AKCYJNA/i, "S.A.").replace(/SPÓŁKA KOMANDYTOWA/i, "sp.k.").replace(/SPÓŁKA JAWNA/i, "sp.j.");
}

async function nipLookup(nipRaw: string) {
  const nip = nipRaw.replace(/\D/g, "");
  if (!nipValid(nip)) return { ok: false, error: "nip" };
  try {
    const r = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today()}`, { signal: AbortSignal.timeout(8000) });
    const d = await r.json().catch(() => ({}));
    const s = d?.result?.subject;
    if (!s) return { ok: true, found: false, nip };
    const addr = splitAddress(String(s.workingAddress || s.residenceAddress || ""));
    return {
      ok: true, found: true, nip,
      company_name: companyTitle(String(s.name || "")),
      ...addr,
      regon: s.regon || "",
      vat_status: s.statusVat || "",
    };
  } catch {
    return { ok: true, found: false, nip, unavailable: true };
  }
}

async function sendMail(to: string, subject: string, html: string, attachments?: { filename: string; content: string }[]) {
  if (!RESEND_KEY || !to) return { ok: false, error: "brak RESEND_KEY lub adresu" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, ...(attachments?.length ? { attachments } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return { ok: false, error: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e).slice(0, 200) }; }
}

async function alertUs(subject: string, text: string) {
  console.error("ALERT", subject, text);
  // testy (adresy @resend.dev) nie zaśmiecają skrzynki właściciela
  if (/@resend\.dev\b/.test(text)) return;
  if (NOTIFY_TO) await sendMail(NOTIFY_TO, `[FIQ billing] ${subject}`, `<pre style="font:13px monospace">${esc(text)}</pre>`);
}

// ───────────────────────────────────────────────────────────────── ING Księgowość
// Fakturę wystawia ING Księgowość (numeracja, KSeF po ich stronie) — API publiczne:
// POST https://ksiegowosc.ing.pl/v2/api/public/create-invoice, GET …/download-invoice/{id}/pdf,
// nagłówek `ApiUserCompanyRoleKey` (klucz: ING Księgowość → Dane i Ustawienia → Integracje).
// Wystawiamy dopiero po zaksięgowaniu płatności (faktura = zapłacona, bez korekt).
// Bez klucza (`INGK_API_KEY`) działa nasza faktura HTML (/faktura) — tak jak dotąd.
// ⚠️ Nie włączać jednocześnie automatycznych faktur w panelu ING Pay (obiekt `invoice`
// w płatności) — klient dostałby dwie faktury za to samo.
const INGK_KEY = Deno.env.get("INGK_API_KEY") ?? "";
const INGK = "https://ksiegowosc.ing.pl/v2/api/public";
const ingkNo = (inv: Record<string, any>) => inv.ing_number || inv.number;

function b64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Wystawia fakturę w ING Księgowość (idempotentnie) i zapisuje PDF w magazynie `invoices`.
 *  Zwraca numer do pokazania i PDF (base64) do załącznika maila — albo nic, gdy się nie da. */
async function issueIngInvoice(invoiceId: string): Promise<{ number: string; pdf?: string } | null> {
  const { data: inv } = await db.from("billing_invoices").select("*").eq("id", invoiceId).single();
  if (!inv) return null;
  // już wystawiona — oddajemy zapisany PDF
  if (inv.ing_doc_id && inv.ing_pdf_path) {
    const { data: f } = await db.storage.from("invoices").download(inv.ing_pdf_path);
    return { number: ingkNo(inv), pdf: f ? b64(new Uint8Array(await f.arrayBuffer())) : undefined };
  }
  if (!INGK_KEY || inv.status !== "paid") return { number: inv.number };
  const b = inv.buyer as Record<string, string>;
  const s = inv.seller as Record<string, string>;
  try {
    let docId: string = inv.ing_doc_id ?? "";
    let raw: unknown = inv.ing_raw;
    if (!docId) {
      const body = {
        issuedGross: false,
        issueDate: inv.issue_date, serviceDate: inv.sale_date,
        currency: { code: "PLN" },
        payment: {
          method: "CARD", deadlineDate: inv.due_date, paidAmount: +inv.gross,
          bankAccounts: [{ accountNumber: String(s.account).replace(/\s/g, ""), name: s.bank, countryCode: "PL" }],
        },
        buyer: {
          email: b.email, fullName: b.name, addressStreet: b.street || "-", city: b.city || "-", postCode: b.postal_code || "-",
          countryCode: "PL", taxNumber: b.nip, taxCountryCode: "PL",
        },
        positions: (inv.items as any[]).map((l, i) => ({
          name: l.name, code: `fiq-${i + 1}`, quantity: l.qty, unit: l.unit || "usł.",
          net: l.net, tax: l.vat, gross: l.gross, taxStake: "TAX_23",
        })),
      };
      const r = await fetch(`${INGK}/create-invoice`, {
        method: "POST",
        headers: { ApiUserCompanyRoleKey: INGK_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
      });
      raw = await r.json().catch(async () => ({ text: (await r.text().catch(() => "")).slice(0, 500) }));
      if (!r.ok) throw new Error(`create-invoice ${r.status}: ${JSON.stringify(raw).slice(0, 300)}`);
      const d = raw as Record<string, any>;
      // dokumentacja mówi tylko o `id` i linku — numer bierzemy, jeśli przyjdzie
      docId = String(d.id ?? d.documentId ?? d.document?.id ?? d.data?.id ?? "");
      if (!docId) throw new Error("brak id dokumentu w odpowiedzi: " + JSON.stringify(d).slice(0, 300));
      const number = d.number ?? d.fullNumber ?? d.documentNumber ?? d.document?.number ?? d.data?.number ?? null;
      await db.from("billing_invoices").update({ ing_doc_id: docId, ing_number: number, ing_raw: d, ing_issued_at: new Date().toISOString(), ing_error: null }).eq("id", inv.id);
      inv.ing_number = number;
    }
    // PDF
    const pr = await fetch(`${INGK}/download-invoice/${encodeURIComponent(docId)}/pdf`, {
      headers: { ApiUserCompanyRoleKey: INGK_KEY }, signal: AbortSignal.timeout(30_000),
    });
    if (!pr.ok) throw new Error(`download-invoice ${pr.status}`);
    const bytes = new Uint8Array(await pr.arrayBuffer());
    const path = `${inv.workspace_id ?? "brak"}/${inv.id}.pdf`;
    const up = await db.storage.from("invoices").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;
    await db.from("billing_invoices").update({ ing_pdf_path: path, ing_error: null }).eq("id", inv.id);
    return { number: ingkNo(inv), pdf: b64(bytes) };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 500);
    await db.from("billing_invoices").update({ ing_error: msg, ing_attempts: (inv.ing_attempts ?? 0) + 1 }).eq("id", inv.id);
    if ((inv.ing_attempts ?? 0) === 0) await alertUs("Faktura ING Księgowość nie wyszła", `${inv.number}\n${msg}`);
    return { number: inv.number };
  }
}
const pdfAttach = (num: string, pdf?: string) => (pdf ? [{ filename: `Faktura ${num.replace(/\//g, "-")}.pdf`, content: pdf }] : undefined);

// ───────────────────────────────────────────────────────────────── maile

function shell(inner: string, pre: string) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#0D0D0D;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111211;border:1px solid rgba(184,255,0,0.18);">
<tr><td style="padding:26px 30px 0;"><img src="${LOGO}" alt="Fastline InfinitiQ" width="168" style="display:block;width:168px;height:auto;border:0;"></td></tr>
${inner}
<tr><td style="padding:22px 30px 26px;border-top:1px solid rgba(245,245,240,0.10);">
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:rgba(245,245,240,0.5);">${esc(SELLER.name)} · NIP ${SELLER.nip}<br>${esc(SELLER.street)}, ${SELLER.postal_code} ${SELLER.city} · <a href="${SITE}" style="color:#B8FF00;text-decoration:none;">fastlineinfinitiq.pl</a></p>
</td></tr></table></td></tr></table></body></html>`;
}
const block = (label: string, h1: string, body: string) => `<tr><td style="padding:26px 30px 8px;">
<p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#B8FF00;">${esc(label)}</p>
<h1 style="margin:0 0 16px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:26px;line-height:1.15;text-transform:uppercase;color:#F5F5F0;">${esc(h1)}</h1>${body}</td></tr>`;
const para = (h: string) => `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(245,245,240,0.86);">${h}</p>`;
const btn = (href: string, label: string) => `<p style="margin:8px 0 22px;"><a href="${href}" style="display:inline-block;background:#B8FF00;color:#0D0D0D;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:15px;text-transform:uppercase;text-decoration:none;padding:16px 28px;">${esc(label)}</a></p>`;
const kv = (rows: [string, string][]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#191A17;">${rows.map(([k, v]) =>
  `<tr><td style="padding:12px 16px;font-family:'Courier New',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgba(245,245,240,0.6);">${esc(k)}</td><td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#F5F5F0;text-align:right;">${v}</td></tr>`).join("")}</table>`;

const invoiceUrl = (inv: Record<string, any>) => `${SITE}/faktura/?t=${inv.pay_token}`;
const payUrl = (inv: Record<string, any>) => `${SITE}/zaplac/?f=${inv.pay_token}`;
const loginUrl = (email: string) => `${BRAIN}/login?login=${encodeURIComponent(email)}`;

function mailWelcome(email: string, password: string | null, plan: Plan, inv: Invoice) {
  const creds = password
    ? kv([["Login", esc(email)], ["Hasło", `<span style="font-family:'Courier New',monospace;letter-spacing:.06em;">${esc(password)}</span>`]])
      + para("Hasło jest jednorazowe: po pierwszym logowaniu ustawisz własne.")
    : para(`Twoje konto już istnieje — zaloguj się jak zwykle adresem <strong style="color:#F5F5F0;">${esc(email)}</strong>.`);
  return {
    subject: "Witaj w Fastline InfinitiQ — Twój AI Doradca czeka",
    html: shell(block("Płatność przyjęta", "Witaj na pokładzie", `
      ${para(`Dziękujemy za zakup <strong style="color:#F5F5F0;">${esc(plan.name)}</strong>. Konto w panelu Brain jest gotowe — poprowadzimy Cię krok po kroku: podłączenie kanału, wiedza o firmie, test rozmowy i start.`)}
      ${creds}
      ${btn(loginUrl(email), "Zaloguj się do panelu")}
      ${para(`Faktura <strong style="color:#F5F5F0;">${esc(inv.number)}</strong> (${zl(inv.gross)} brutto, opłacona): <a href="${invoiceUrl(inv)}" style="color:#B8FF00;">pobierz fakturę</a>.`)}
    `), "Login, hasło i pierwszy krok w panelu"),
  };
}

function mailRenewalOk(email: string, inv: Invoice, next: string) {
  return {
    subject: `Faktura ${inv.number} — opłacona`,
    html: shell(block("Odnowienie", "Dziękujemy, płatność przyszła", `
      ${kv([["Faktura", esc(inv.number)], ["Kwota brutto", zl(inv.gross)], ["Następna płatność", esc(plDate(next))]])}
      ${btn(invoiceUrl(inv), "Pobierz fakturę")}
    `), `Faktura ${inv.number}`),
  };
}

function mailDunning(email: string, inv: Invoice, day: number) {
  const msg = day >= 7
    ? "AI Doradca jest wstrzymany, dopóki płatność nie przejdzie. Dane i ustawienia są bezpieczne — po opłaceniu wraca od razu."
    : day >= 5
      ? `Jeśli płatność nie przejdzie do ${esc(plDate(addDays(inv.due_date, 7)))}, AI Doradca zostanie wstrzymany.`
      : "Karta została odrzucona. Zaktualizuj płatność jednym kliknięciem — doradca pracuje dalej.";
  return {
    subject: day >= 7 ? "AI Doradca wstrzymany — zaległa płatność" : `Płatność nie przeszła — faktura ${inv.number}`,
    html: shell(block("Płatność", day >= 7 ? "Doradca wstrzymany" : "Płatność nie przeszła", `
      ${para(msg)}
      ${kv([["Faktura", esc(inv.number)], ["Do zapłaty", zl(inv.gross)]])}
      ${btn(payUrl(inv), "Zapłać teraz")}
    `), "Zaktualizuj płatność"),
  };
}

function mailCart(order: Order, hours: number) {
  const url = `${SITE}/ai-doradca/?kup=${order.plan_key}&z=${order.public_token}`;
  return {
    subject: hours <= 1 ? "Dokończ zakup AI Doradcy" : "AI Doradca czeka — masz pytania?",
    html: shell(block("Koszyk", hours <= 1 ? "Zostało jedno kliknięcie" : "Pomożemy wybrać", `
      ${para(hours <= 1
        ? "Twoje zamówienie czeka — dane firmy są już wpisane. Wróć i dokończ płatność."
        : "Nie wszystko jasne? Umów 30 minut — pokażemy doradcę na Twojej ofercie i powiemy wprost, czy to się u Ciebie spina.")}
      ${btn(url, "Dokończ zakup")}
      ${hours > 1 ? para(`<a href="${SITE}/kontakt" style="color:#B8FF00;">Wolę porozmawiać — umów rozmowę</a>`) : ""}
    `), "Twoje zamówienie czeka"),
  };
}

// ───────────────────────────────────────────────────────────────── bramka

type Plan = { key: string; product_key: string; name: string; monthly_net: number; setup_net: number; vat_rate: number };
type Order = Record<string, any>;
type Invoice = Record<string, any>;

interface Provider {
  name: string;
  /** adres, na który przekierowujemy klienta (bramka) */
  start(order: Order): Promise<{ url: string; ref: string }>;
  /** start płatności za konkretną fakturę (zaległość, „Zapłać teraz") */
  startInvoice(inv: Invoice): Promise<{ url: string; ref: string }>;
  /** obciążenie zapisanej karty przy odnowieniu */
  charge(sub: Record<string, any>, inv: Invoice): Promise<{ ok: boolean; pending?: boolean; ref?: string; error?: string }>;
}

// Bramka testowa: strona /platnosc-testowa/ na lądowaniu pokazuje „Zapłać / Odrzuć"
// i woła akcję `test.result`. Karta z tokenem „fail" odrzuca odnowienia.
const testProvider: Provider = {
  name: "test",
  async start(o) { return { url: `${SITE}/platnosc-testowa/?o=${o.public_token}`, ref: "test_" + o.id }; },
  async startInvoice(inv) { return { url: `${SITE}/platnosc-testowa/?f=${inv.pay_token}`, ref: "test_inv_" + inv.id }; },
  async charge(sub) {
    if (sub.provider_token === "fail") return { ok: false, error: "Karta odrzucona (test)" };
    return { ok: true, ref: "test_ch_" + crypto.randomUUID().slice(0, 8) };
  },
};

// ── ING Pay (dawniej imoje) — dokumentacja: bump.sh/pgw/doc/ing-pay-api-en i ing-pay-paywall-en ──
// Pierwsza płatność: widżet kartowy `recurring` na naszej stronie /platnosc (bez PCI DSS
// tylko widżet może założyć profil karty). Odnowienia: REST `transaction/profile`.
// Wynik zawsze przychodzi powiadomieniem (?hook=ingpay) z podpisem X-Imoje-Signature.
const ING = {
  merchant: Deno.env.get("INGPAY_MERCHANT_ID") ?? "",
  service: Deno.env.get("INGPAY_SERVICE_ID") ?? "",
  key: Deno.env.get("INGPAY_SERVICE_KEY") ?? "",
  token: Deno.env.get("INGPAY_API_TOKEN") ?? "",
  sandbox: (Deno.env.get("INGPAY_ENV") ?? "prod") === "sandbox",
};
const ING_API = () => `https://api.${ING.sandbox ? "sandbox." : ""}pay.ing.pl/v1/merchant/${ING.merchant}`;
const ING_WIDGET = () => `https://paywall.${ING.sandbox ? "sandbox." : ""}pay.ing.pl/js/widget.min.js`;
const HOOK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/billing?hook=ingpay`;

async function hashHex(alg: string, text: string) {
  const map: Record<string, string> = { sha224: "SHA-224", sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };
  const name = map[alg.toLowerCase()];
  if (!name) throw new Error("alg " + alg);
  if (name === "SHA-224") {
    // WebCrypto nie ma SHA-224 — bramka domyślnie używa sha256, tu wystarczy odmowa
    throw new Error("sha224 nieobsługiwane");
  }
  const buf = await crypto.subtle.digest(name, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
// podpis jak w dokumentacji: parametry posortowane, `k=v&k=v` + klucz sklepu, sha256, „;sha256"
async function ingSign(fields: Record<string, string>) {
  const body = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("&");
  return (await hashHex("sha256", body + ING.key)) + ";sha256";
}
// znaki dozwolone w imieniu/nazwisku i tytule (paywall odrzuca resztę)
const ingName = (s: string) => String(s || "").replace(/[^A-Za-z0-9\-,. \u00C0-\u02C0\u0400-\u04FF]/g, "").trim().slice(0, 100) || "Klient";
const ingTitle = (s: string) => String(s || "").replace(/[^A-Za-z0-9#&_\-,./ \u00C0-\u02C0]/g, " ").replace(/\s+/g, " ").trim().slice(0, 255);
async function cidOf(email: string) { return "fiq-" + (await hashHex("sha256", email.toLowerCase())).slice(0, 32); }

/** Atrybuty widżetu kartowego (podpisane) — strona /platnosc wstawia z nich <script>. */
async function ingWidget(o: { orderId: string; amount: number; email: string; name: string; title: string; back: string }) {
  const [first, ...rest] = String(o.name || "").trim().split(/\s+/);
  const f: Record<string, string> = {
    merchantId: ING.merchant, serviceId: ING.service,
    amount: String(Math.round(o.amount * 100)), currency: "PLN",
    orderId: o.orderId, customerId: await cidOf(o.email),
    customerFirstName: ingName(first), customerLastName: ingName(rest.join(" ") || first),
    customerEmail: o.email, orderDescription: ingTitle(o.title),
    urlSuccess: o.back, urlFailure: o.back, urlReturn: o.back,
    widgetType: "recurring",
  };
  const signature = await ingSign(f);
  const attr: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...f, signature })) attr["data-" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())] = v;
  return { src: ING_WIDGET(), attrs: { ...attr, "data-locale": "pl", "data-inline": "true" } };
}

const ingProvider: Provider = {
  name: "ingpay",
  async start(o) { return { url: `${SITE}/platnosc/?o=${o.public_token}`, ref: "o-" + o.id }; },
  async startInvoice(inv) { return { url: `${SITE}/platnosc/?f=${inv.pay_token}`, ref: "f-" + inv.id }; },
  async charge(sub, inv) {
    if (!sub.provider_token) return { ok: false, error: "brak profilu karty" };
    try {
      const r = await fetch(`${ING_API()}/transaction/profile`, {
        method: "POST",
        headers: { authorization: `Bearer ${ING.token}`, "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: ING.service, paymentProfileId: sub.provider_token,
          amount: Math.round(+inv.gross * 100), currency: "PLN",
          orderId: "f-" + inv.id, title: ingTitle(`Faktura ${inv.number}`), notificationUrl: HOOK_URL,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: `ING ${r.status}: ${JSON.stringify(d).slice(0, 200)}` };
      const st = d?.transaction?.status;
      if (st === "settled") return { ok: true, ref: d.transaction.id };
      if (st === "rejected" || st === "cancelled" || st === "error") return { ok: false, ref: d.transaction?.id, error: d.transaction?.statusCodeDescription || st };
      return { ok: false, pending: true, ref: d?.transaction?.id };   // wynik przyjdzie powiadomieniem
    } catch (e) { return { ok: false, error: String(e).slice(0, 200) }; }
  },
};

function provider(): Provider {
  return PROVIDER === "ingpay" ? ingProvider : testProvider;
}

/** Powiadomienie ING Pay: weryfikacja podpisu, potem zamówienie (o-…) albo faktura (f-…). */
async function ingHook(req: Request) {
  const raw = await req.text();
  const h = req.headers.get("x-imoje-signature") ?? "";
  const parts = Object.fromEntries(h.split(";").map((x) => x.split("=").map((y) => y.trim())).filter((x) => x.length === 2));
  const ok = parts.signature && parts.alg && (await hashHex(parts.alg, raw + ING.key).catch(() => "")) === parts.signature;
  if (!ok) { console.error("ingpay: zły podpis", h.slice(0, 120)); return new Response(JSON.stringify({ status: "error" }), { status: 400 }); }
  const n = JSON.parse(raw);
  const tx = n.transaction ?? {};
  const prof = n.paymentProfile ?? null;
  const orderId = String(tx.orderId ?? n.payment?.orderId ?? "");
  const st = String(tx.status ?? n.payment?.status ?? "");
  const card = prof?.maskedNumber ? `${prof.organization ?? "Karta"} •••• ${String(prof.maskedNumber).slice(-4)}` : undefined;
  console.log("ingpay", orderId, st, prof?.id ?? "");

  if (orderId.startsWith("o-")) {
    const { data: o } = await db.from("billing_orders").select("*").eq("id", orderId.slice(2)).maybeSingle();
    if (o) {
      if (st === "settled") await markOrderPaid(o, tx.id, prof?.id, card);
      else if (["rejected", "cancelled", "error"].includes(st) && o.status !== "paid") {
        await db.from("billing_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", o.id);
        await db.from("billing_payments").insert({ order_id: o.id, kind: "checkout", amount: o.gross, status: "failed", provider: "ingpay", provider_ref: tx.id ?? null, error: tx.statusCodeDescription ?? st });
      }
    }
  } else if (orderId.startsWith("f-")) {
    const { data: inv } = await db.from("billing_invoices").select("*").eq("id", orderId.slice(2)).maybeSingle();
    if (inv) {
      if (st === "settled") {
        if (prof?.id && inv.subscription_id) await db.from("billing_subscriptions").update({ provider_token: prof.id, card_label: card ?? null }).eq("id", inv.subscription_id);
        const wasUnpaid = inv.status === "unpaid";
        await markInvoicePaid(inv, tx.id ?? "ingpay");
        if (wasUnpaid && inv.subscription_id) {
          const { data: cust } = await db.from("billing_customers").select("email, invoice_email").eq("workspace_id", inv.workspace_id).maybeSingle();
          const { data: sub } = await db.from("billing_subscriptions").select("period_end").eq("id", inv.subscription_id).single();
          if (cust) {
            const ing = await issueIngInvoice(inv.id).catch(() => null);
            const m = mailRenewalOk(cust.email, { ...inv, gross: +inv.gross, number: ing?.number ?? inv.number }, sub!.period_end);
            await sendMail(cust.invoice_email || cust.email, m.subject, m.html, pdfAttach(ing?.number ?? inv.number, ing?.pdf));
          }
        }
      } else if (["rejected", "cancelled", "error"].includes(st) && inv.status === "unpaid" && inv.subscription_id) {
        const { data: sub } = await db.from("billing_subscriptions").select("*").eq("id", inv.subscription_id).single();
        await db.from("billing_payments").insert({ invoice_id: inv.id, subscription_id: inv.subscription_id, kind: "renewal", amount: inv.gross, status: "failed", provider: "ingpay", provider_ref: tx.id ?? null, error: tx.statusCodeDescription ?? st });
        if (sub && sub.status === "active") {
          await db.from("billing_subscriptions").update({ status: "past_due", past_due_since: new Date().toISOString(), dunning: { d0: new Date().toISOString() } }).eq("id", sub.id);
          const { data: cust } = await db.from("billing_customers").select("email").eq("id", sub.customer_id).single();
          if (cust) { const m = mailDunning(cust.email, { ...inv, gross: +inv.gross }, 0); await sendMail(cust.email, m.subject, m.html); }
        }
      }
    }
  }
  return new Response(JSON.stringify({ status: "ok" }), { headers: { "content-type": "application/json" } });
}

// ───────────────────────────────────────────────────────────────── logika

async function getPlan(key: string): Promise<Plan | null> {
  const { data } = await db.from("billing_plans").select("*").eq("key", key).eq("active", true).maybeSingle();
  return data ? { ...data, monthly_net: +data.monthly_net, setup_net: +data.setup_net, vat_rate: +data.vat_rate } as Plan : null;
}

function lines(plan: Plan, withSetup: boolean, periodLabel: string) {
  const out = [{ name: `${plan.name.replace(/ — abonament.*$/, "")} — abonament (${periodLabel})`, qty: 1, unit: "usł.", net: plan.monthly_net, vat_rate: plan.vat_rate }];
  if (withSetup && plan.setup_net > 0) out.push({ name: `${plan.name.replace(/ — abonament.*$/, "")} — wdrożenie (jednorazowo)`, qty: 1, unit: "usł.", net: plan.setup_net, vat_rate: plan.vat_rate });
  return out.map((l) => ({ ...l, vat: r2(l.net * l.vat_rate / 100), gross: r2(l.net * (1 + l.vat_rate / 100)) }));
}
const sum = (ls: { net: number; vat: number; gross: number }[]) =>
  ({ net: r2(ls.reduce((s, l) => s + l.net, 0)), vat: r2(ls.reduce((s, l) => s + l.vat, 0)), gross: r2(ls.reduce((s, l) => s + l.gross, 0)) });
const periodLabel = (from: string, to: string) => `${new Date(from + "T12:00:00Z").toLocaleDateString("pl-PL")} – ${new Date(addDays(to, -1) + "T12:00:00Z").toLocaleDateString("pl-PL")}`;

async function makeInvoice(o: { workspace_id: string | null; subscription_id?: string | null; order_id?: string | null; buyer: Record<string, unknown>; items: any[]; status: "paid" | "unpaid"; due?: string }) {
  const { data: number } = await db.rpc("billing_next_invoice_number");
  const t = sum(o.items);
  const { data, error } = await db.from("billing_invoices").insert({
    number, workspace_id: o.workspace_id, subscription_id: o.subscription_id ?? null, order_id: o.order_id ?? null,
    seller: SELLER, buyer: o.buyer, items: o.items, ...t,
    due_date: o.due ?? today(), status: o.status, paid_at: o.status === "paid" ? new Date().toISOString() : null,
  }).select().single();
  if (error) throw error;
  return { ...data, net: +data.net, vat: +data.vat, gross: +data.gross } as Invoice;
}

function genPassword() {
  const A = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => A[x % A.length]).join("").replace(/(.{4})(?=.)/g, "$1-");
}

/** Automat po udanej płatności: konto + subskrypcja + faktura + mail. Idempotentny. */
async function fulfill(orderId: string, providerToken?: string, cardLabel?: string) {
  const { data: order } = await db.from("billing_orders").select("*").eq("id", orderId).single();
  if (!order || order.fulfilled_at) return order;
  const plan = (await getPlan(order.plan_key))!;
  const c = order.customer as Record<string, string>;
  try {
    // 1. użytkownik: e-mail = login. Istniejące konto dostaje produkt, bez nowego hasła.
    const email = String(order.email).toLowerCase();
    const { data: existing } = await db.from("brain_users").select("id, workspace_id").eq("login", email).maybeSingle();
    let wsId: string = existing?.workspace_id ?? "";
    let userId: string = existing?.id ?? "";
    let password: string | null = null;

    if (!wsId) {
      const { data: ws, error } = await db.from("brain_workspaces").insert({ name: c.company_name }).select().single();
      if (error) throw error;
      wsId = ws.id;
    }
    await db.from("fiq_workspace_products").upsert({ workspace_id: wsId, product_key: plan.product_key }, { onConflict: "workspace_id,product_key" });

    // projekt: pierwszy w workspace albo nowy
    let { data: proj } = await db.from("brain_projects").select("id").eq("workspace_id", wsId).order("created_at").limit(1).maybeSingle();
    if (!proj) {
      const r = await db.from("brain_projects").insert({ workspace_id: wsId, name: c.company_name }).select("id").single();
      if (r.error) throw r.error;
      proj = r.data;
    }

    if (!userId) {
      password = genPassword();
      const r = await db.from("brain_users").insert({
        login: email, pass_hash: bcrypt.hashSync(password, 10), display_name: c.contact_name || null,
        role: "client", workspace_id: wsId, must_change_password: true,
        onboarding: { started_at: new Date().toISOString(), product: plan.product_key, plan: plan.key, project_id: proj!.id },
      }).select("id").single();
      if (r.error) throw r.error;
      userId = r.data.id;
    } else if (!existing!.workspace_id) {
      await db.from("brain_users").update({ workspace_id: wsId }).eq("id", userId);
    }
    await db.from("brain_user_projects").upsert({ user_id: userId, project_id: proj!.id }, { onConflict: "user_id,project_id" }).then(() => {}, () => {});

    // 2. klient (dane do faktur) — jeden na workspace
    const custRow = {
      workspace_id: wsId, email, contact_name: c.contact_name || null, phone: c.phone || null,
      nip: c.nip, company_name: c.company_name, street: c.street || null, postal_code: c.postal_code || null,
      city: c.city || null, regon: c.regon || null, updated_at: new Date().toISOString(),
    };
    const { data: cust, error: ce } = await db.from("billing_customers").upsert(custRow, { onConflict: "workspace_id" }).select().single();
    if (ce) throw ce;

    // 3. subskrypcja: okres od dziś na miesiąc
    const start = today(), end = addMonth(start);
    const { data: sub, error: se } = await db.from("billing_subscriptions").insert({
      workspace_id: wsId, customer_id: cust.id, plan_key: plan.key, status: "active",
      period_start: start, period_end: end, provider: provider().name,
      provider_token: providerToken ?? null, card_label: cardLabel ?? null,
    }).select().single();
    if (se) throw se;

    // 4. faktura (opłacona)
    const inv = await makeInvoice({
      workspace_id: wsId, subscription_id: sub.id, order_id: order.id, buyer: buyerOf(cust),
      items: lines(plan, plan.setup_net > 0, periodLabel(start, end)), status: "paid",
    });
    await db.from("billing_payments").update({ invoice_id: inv.id, subscription_id: sub.id }).eq("order_id", order.id);

    await db.from("billing_orders").update({
      fulfilled_at: new Date().toISOString(), fulfill_error: null, workspace_id: wsId, user_id: userId, updated_at: new Date().toISOString(),
    }).eq("id", order.id);

    // 5. faktura w ING Księgowość (jeśli podłączona) + mail powitalny z PDF w załączniku
    const ing = await issueIngInvoice(inv.id).catch(() => null);
    const m = mailWelcome(email, password, plan, { ...inv, number: ing?.number ?? inv.number });
    const sent = await sendMail(email, m.subject, m.html, pdfAttach(ing?.number ?? inv.number, ing?.pdf));
    if (!sent.ok) await alertUs("Mail powitalny nie wyszedł", `${email}\n${sent.error}`);
    await alertUs("Nowy klient", `${c.company_name} (${c.nip}) · ${email} · ${plan.name} · ${zl(inv.gross)}`).catch(() => {});
    return { ...order, fulfilled_at: new Date().toISOString() };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 500);
    await db.from("billing_orders").update({ fulfill_error: msg, updated_at: new Date().toISOString() }).eq("id", order.id);
    // Miro: „FAKAP: zapłacił, konta nie ma" → alert do nas, konto ręcznie w 1 h
    await alertUs("ZAPŁACIŁ, KONTA NIE MA", `order ${order.id}\n${order.email}\n${msg}`);
    throw e;
  }
}

function buyerOf(c: Record<string, any>) {
  return { name: c.company_name, nip: c.nip, street: c.street, postal_code: c.postal_code, city: c.city, email: c.invoice_email || c.email };
}

async function markOrderPaid(order: Order, ref: string, token?: string, card?: string) {
  if (order.status !== "paid") {
    await db.from("billing_orders").update({ status: "paid", paid_at: new Date().toISOString(), provider_ref: ref, updated_at: new Date().toISOString() }).eq("id", order.id);
    await db.from("billing_payments").insert({ order_id: order.id, kind: "checkout", amount: order.gross, status: "paid", provider: provider().name, provider_ref: ref });
  }
  return await fulfill(order.id, token, card);
}

/** Faktura opłacona (odnowienie lub zaległość) → subskrypcja wraca do życia. */
async function markInvoicePaid(inv: Invoice, ref: string) {
  if (inv.status === "paid") return;
  await db.from("billing_invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", inv.id);
  await issueIngInvoice(inv.id).catch(() => null);
  await db.from("billing_payments").insert({ invoice_id: inv.id, subscription_id: inv.subscription_id, kind: "manual", amount: inv.gross, status: "paid", provider: provider().name, provider_ref: ref });
  if (inv.subscription_id) {
    const { data: sub } = await db.from("billing_subscriptions").select("*").eq("id", inv.subscription_id).single();
    const { count } = await db.from("billing_invoices").select("id", { count: "exact", head: true }).eq("subscription_id", inv.subscription_id).eq("status", "unpaid");
    if (sub && !count && sub.status !== "canceled") {
      await db.from("billing_subscriptions").update({ status: "active", past_due_since: null, dunning: {}, updated_at: new Date().toISOString() }).eq("id", sub.id);
      await db.from("brain_workspaces").update({ billing_blocked_at: null }).eq("id", sub.workspace_id);
    }
  }
}

/** Cron: odnowienia, windykacja, porzucone koszyki. */
async function tick() {
  const out = { renewed: 0, failed: 0, dunning: 0, paused: 0, canceled: 0, carts: 0, ended: 0 };
  const now = today();

  // 1. odnowienia — okres się skończył
  const { data: due } = await db.from("billing_subscriptions").select("*").in("status", ["active"]).lte("period_end", now).limit(50);
  for (const sub of due ?? []) {
    if (sub.cancel_at_period_end) {
      await db.from("billing_subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", sub.id);
      await db.from("brain_workspaces").update({ billing_blocked_at: new Date().toISOString() }).eq("id", sub.workspace_id);
      out.ended++; continue;
    }
    const plan = (await getPlan(sub.plan_key))!;
    const { data: cust } = await db.from("billing_customers").select("*").eq("id", sub.customer_id).single();
    const start = sub.period_end, end = addMonth(start);
    const inv = await makeInvoice({
      workspace_id: sub.workspace_id, subscription_id: sub.id, buyer: buyerOf(cust),
      items: lines(plan, false, periodLabel(start, end)), status: "unpaid", due: start,
    });
    // okres przesuwamy od razu — faktura „wisi", dopóki płatność nie przejdzie
    await db.from("billing_subscriptions").update({ period_start: start, period_end: end, updated_at: new Date().toISOString() }).eq("id", sub.id);
    const ch = await provider().charge(sub, inv);
    await db.from("billing_payments").insert({ invoice_id: inv.id, subscription_id: sub.id, kind: "renewal", amount: inv.gross, status: ch.ok ? "paid" : ch.pending ? "pending" : "failed", provider: provider().name, provider_ref: ch.ref ?? null, error: ch.error ?? null });
    if (ch.pending) {
      out.renewed++;   // bramka przyjęła obciążenie — wynik (opłacona / odrzucona) przyjdzie powiadomieniem
    } else if (ch.ok) {
      await db.from("billing_invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", inv.id);
      const ing = await issueIngInvoice(inv.id).catch(() => null);
      const m = mailRenewalOk(cust.email, { ...inv, number: ing?.number ?? inv.number }, end);
      await sendMail(cust.invoice_email || cust.email, m.subject, m.html, pdfAttach(ing?.number ?? inv.number, ing?.pdf));
      out.renewed++;
    } else {
      await db.from("billing_subscriptions").update({ status: "past_due", past_due_since: new Date().toISOString(), dunning: { d0: new Date().toISOString() } }).eq("id", sub.id);
      const m = mailDunning(cust.email, inv, 0);
      await sendMail(cust.email, m.subject, m.html);
      out.failed++;
    }
  }

  // 2. windykacja: dzień 3 i 5 (mail), 7 (wstrzymanie), 14 (anulowanie)
  const { data: late } = await db.from("billing_subscriptions").select("*").in("status", ["past_due", "paused"]).limit(100);
  for (const sub of late ?? []) {
    const days = Math.floor((Date.now() - new Date(sub.past_due_since).getTime()) / 864e5);
    const dun = (sub.dunning ?? {}) as Record<string, string>;
    const { data: inv } = await db.from("billing_invoices").select("*").eq("subscription_id", sub.id).eq("status", "unpaid").order("issue_date").limit(1).maybeSingle();
    const { data: cust } = await db.from("billing_customers").select("email").eq("id", sub.customer_id).single();
    if (!inv) continue;
    const stage = days >= 14 ? "d14" : days >= 7 ? "d7" : days >= 5 ? "d5" : days >= 3 ? "d3" : null;
    if (!stage || dun[stage]) continue;
    dun[stage] = new Date().toISOString();
    if (stage === "d14") {
      await db.from("billing_subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString(), dunning: dun }).eq("id", sub.id);
      await alertUs("Subskrypcja anulowana (14 dni zaległości)", `${sub.workspace_id} · ${cust?.email}`);
      out.canceled++;
    } else if (stage === "d7") {
      await db.from("billing_subscriptions").update({ status: "paused", dunning: dun }).eq("id", sub.id);
      await db.from("brain_workspaces").update({ billing_blocked_at: new Date().toISOString() }).eq("id", sub.workspace_id);
      const m = mailDunning(cust!.email, { ...inv, gross: +inv.gross }, 7);
      await sendMail(cust!.email, m.subject, m.html);
      await alertUs("Doradca wstrzymany — telefon opiekuna", `${sub.workspace_id} · ${cust?.email}`);
      out.paused++;
    } else {
      await db.from("billing_subscriptions").update({ dunning: dun }).eq("id", sub.id);
      const m = mailDunning(cust!.email, { ...inv, gross: +inv.gross }, stage === "d5" ? 5 : 3);
      await sendMail(cust!.email, m.subject, m.html);
      out.dunning++;
    }
  }

  // 3. faktury ING Księgowość, które nie wyszły (sieć, chwilowy błąd) — do 6 prób
  if (INGK_KEY) {
    const { data: todo } = await db.from("billing_invoices").select("id").eq("status", "paid").is("ing_pdf_path", null).lt("ing_attempts", 6).limit(10);
    for (const t of todo ?? []) { await issueIngInvoice(t.id).catch(() => null); (out as Record<string, number>).ing = ((out as Record<string, number>).ing ?? 0) + 1; }
  }

  // 4. porzucone koszyki: mail po 1 h i po 24 h (Miro 3A); po 7 dniach zamówienie wygasa
  const { data: carts } = await db.from("billing_orders").select("*").in("status", ["new", "pending", "failed"])
    .gte("created_at", new Date(Date.now() - 8 * 864e5).toISOString()).limit(100);
  for (const o of carts ?? []) {
    const age = (Date.now() - new Date(o.created_at).getTime()) / 36e5;
    const rem = (o.reminders ?? {}) as Record<string, string>;
    // ten sam e-mail już kupił → nie męczymy
    const { count } = await db.from("billing_orders").select("id", { count: "exact", head: true }).eq("email", o.email).eq("status", "paid");
    if (count) { await db.from("billing_orders").update({ status: "expired" }).eq("id", o.id); continue; }
    let h = 0;
    if (age >= 24 && !rem.h24) h = 24; else if (age >= 1 && !rem.h1) h = 1;
    if (age >= 168) { await db.from("billing_orders").update({ status: "expired" }).eq("id", o.id); continue; }
    if (!h || o.consents?.no_reminders) continue;
    const m = mailCart(o, h);
    const s = await sendMail(o.email, m.subject, m.html);
    if (s.ok) { rem[h === 1 ? "h1" : "h24"] = new Date().toISOString(); await db.from("billing_orders").update({ reminders: rem }).eq("id", o.id); out.carts++; }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────── sesja panelu

async function panelUser(token: string) {
  if (!token) return null;
  const { data } = await db.from("brain_sessions").select("expires_at, brain_users(id, login, role, workspace_id, disabled)").eq("token", token).maybeSingle();
  const u = data?.brain_users as any;
  if (!data || !u || u.disabled || new Date(data.expires_at) < new Date()) return null;
  return u as { id: string; login: string; role: string; workspace_id: string | null };
}

async function accountView(wsId: string) {
  const [{ data: sub }, { data: cust }, { data: invoices }, { data: ws }] = await Promise.all([
    db.from("billing_subscriptions").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("billing_customers").select("*").eq("workspace_id", wsId).maybeSingle(),
    db.from("billing_invoices").select("id, number, ing_number, ing_pdf_path, issue_date, due_date, gross, net, status, pay_token").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(60),
    db.from("brain_workspaces").select("billing_blocked_at").eq("id", wsId).maybeSingle(),
  ]);
  const plan = sub ? await getPlan(sub.plan_key) : null;
  const unpaid = (invoices ?? []).filter((i) => i.status === "unpaid");
  return {
    subscription: sub ? {
      id: sub.id, status: sub.status, plan_key: sub.plan_key, plan_name: plan?.name ?? sub.plan_key,
      monthly_net: plan?.monthly_net ?? 0, monthly_gross: plan ? r2(plan.monthly_net * (1 + plan.vat_rate / 100)) : 0,
      period_start: sub.period_start, period_end: sub.period_end, next_charge: sub.cancel_at_period_end ? null : sub.period_end,
      cancel_at_period_end: sub.cancel_at_period_end, card_label: sub.card_label, past_due_since: sub.past_due_since,
    } : null,
    customer: cust ? { company_name: cust.company_name, nip: cust.nip, street: cust.street, postal_code: cust.postal_code, city: cust.city, email: cust.email, invoice_email: cust.invoice_email, phone: cust.phone, contact_name: cust.contact_name } : null,
    invoices: (invoices ?? []).map((i) => ({
      id: i.id, number: ingkNo(i), issue_date: i.issue_date, due_date: i.due_date, gross: +i.gross, net: +i.net, status: i.status,
      ing: !!i.ing_pdf_path, url: invoiceUrl(i), pay_url: i.status === "unpaid" ? payUrl(i) : null,
    })),
    debt: r2(unpaid.reduce((s, i) => s + +i.gross, 0)),
    blocked: !!ws?.billing_blocked_at,
  };
}

// ───────────────────────────────────────────────────────────────── handler

Deno.serve(async (req) => {
  CORS = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);

  if (req.method === "POST" && url.searchParams.get("hook") === "ingpay") return await ingHook(req);
  if (req.method !== "POST") return J({ error: "POST only" }, 405);
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* puste */ }
  const action = String(body.action ?? "");

  try {
    switch (action) {
      // ── publiczne: koszyk ──────────────────────────────────────────────
      case "plans": {
        const { data } = await db.from("billing_plans").select("key, product_key, name, monthly_net, setup_net, vat_rate").eq("active", true);
        return J({ plans: data ?? [] });
      }
      case "nip.lookup":
        return J(await nipLookup(String(body.nip ?? "")));

      case "checkout.create": {
        const plan = await getPlan(String(body.plan ?? ""));
        if (!plan) return J({ error: "plan" }, 400);
        const email = String(body.email ?? "").trim().toLowerCase();
        const c = (body.customer ?? {}) as Record<string, string>;
        const nip = String(c.nip ?? "").replace(/\D/g, "");
        const errs: string[] = [];
        if (!emailOk(email)) errs.push("email");
        if (!nipValid(nip)) errs.push("nip");
        if (!String(c.company_name ?? "").trim()) errs.push("company_name");
        if (!String(c.street ?? "").trim()) errs.push("street");
        if (!/^\d{2}-\d{3}$/.test(String(c.postal_code ?? "").trim())) errs.push("postal_code");
        if (!String(c.city ?? "").trim()) errs.push("city");
        if (!String(c.contact_name ?? "").trim()) errs.push("contact_name");
        if (!body.consents?.terms) errs.push("terms");
        if (errs.length) return J({ error: "validation", fields: errs }, 400);

        const ls = lines(plan, plan.setup_net > 0, "pierwszy miesiąc");
        const t = sum(ls);
        const customer = {
          nip, company_name: c.company_name.trim().slice(0, 200), street: c.street.trim().slice(0, 200),
          postal_code: c.postal_code.trim(), city: c.city.trim().slice(0, 100), regon: String(c.regon ?? "").slice(0, 20),
          contact_name: c.contact_name.trim().slice(0, 120), phone: String(c.phone ?? "").trim().slice(0, 30),
        };
        // wracający koszyk (link z maila) — aktualizujemy to samo zamówienie
        let order: Order | null = null;
        if (body.resume) {
          const { data } = await db.from("billing_orders").select("*").eq("public_token", String(body.resume)).in("status", ["new", "pending", "failed"]).maybeSingle();
          if (data) {
            const r = await db.from("billing_orders").update({ plan_key: plan.key, email, customer, consents: body.consents, ...t, status: "new", updated_at: new Date().toISOString() }).eq("id", data.id).select().single();
            order = r.data;
          }
        }
        if (!order) {
          const r = await db.from("billing_orders").insert({ plan_key: plan.key, email, customer, consents: body.consents ?? {}, ...t, source: String(body.source ?? "").slice(0, 60) || null }).select().single();
          if (r.error) throw r.error;
          order = r.data;
        }
        const p = provider();
        const start = await p.start(order!);
        await db.from("billing_orders").update({ status: "pending", provider: p.name, provider_ref: start.ref }).eq("id", order!.id);
        return J({ ok: true, order: order!.public_token, redirect: start.url });
      }

      case "checkout.status": {
        const { data: o } = await db.from("billing_orders").select("id, status, email, plan_key, gross, fulfilled_at, fulfill_error, customer, created_at").eq("public_token", String(body.order ?? "")).maybeSingle();
        if (!o) return J({ error: "not_found" }, 404);
        const plan = await getPlan(o.plan_key);
        return J({
          status: o.status, email: o.email, plan: plan?.name, gross: +o.gross,
          account: o.fulfilled_at ? "ready" : (o.fulfill_error ? "delayed" : (o.status === "paid" ? "creating" : null)),
          login_url: loginUrl(o.email), company: (o.customer as any)?.company_name,
        });
      }

      case "checkout.resume": {
        // link „Dokończ zakup" z maila → dane do formularza
        const { data: o } = await db.from("billing_orders").select("plan_key, email, customer, status").eq("public_token", String(body.order ?? "")).maybeSingle();
        if (!o || !["new", "pending", "failed"].includes(o.status)) return J({ ok: false });
        return J({ ok: true, plan: o.plan_key, email: o.email, customer: o.customer });
      }

      case "checkout.resend": {
        // Miro: „mail powitalny nie doszedł" → ponowna wysyłka ze strony „Dziękujemy" (nowe hasło jednorazowe)
        const { data: o } = await db.from("billing_orders").select("*").eq("public_token", String(body.order ?? "")).maybeSingle();
        if (!o?.fulfilled_at || !o.user_id) return J({ ok: false });
        const last = (o.reminders ?? {}).resend;
        if (last && Date.now() - new Date(last).getTime() < 120_000) return J({ ok: false, error: "wait" });
        const { data: u } = await db.from("brain_users").select("must_change_password").eq("id", o.user_id).single();
        let pass: string | null = null;
        if (u?.must_change_password) {
          pass = genPassword();
          await db.from("brain_users").update({ pass_hash: bcrypt.hashSync(pass, 10) }).eq("id", o.user_id);
        }
        const plan = (await getPlan(o.plan_key))!;
        const { data: inv } = await db.from("billing_invoices").select("*").eq("order_id", o.id).maybeSingle();
        const m = mailWelcome(o.email, pass, plan, { ...inv, gross: +inv!.gross });
        const s = await sendMail(o.email, m.subject, m.html);
        await db.from("billing_orders").update({ reminders: { ...(o.reminders ?? {}), resend: new Date().toISOString() } }).eq("id", o.id);
        return J({ ok: s.ok });
      }

      // ── strona /platnosc: podpisany widżet kartowy ING Pay ───────────────
      case "pay.widget": {
        if (PROVIDER !== "ingpay") return J({ error: "off" }, 403);
        if (body.order) {
          const { data: o } = await db.from("billing_orders").select("*").eq("public_token", String(body.order)).maybeSingle();
          if (!o) return J({ error: "not_found" }, 404);
          if (o.status === "paid") return J({ paid: true, back: `${SITE}/zamowienie/?o=${o.public_token}` });
          const plan = await getPlan(o.plan_key);
          const w = await ingWidget({ orderId: "o-" + o.id, amount: +o.gross, email: o.email, name: (o.customer as any)?.contact_name, title: plan?.name ?? "AI Doradca", back: `${SITE}/zamowienie/?o=${o.public_token}` });
          return J({ kind: "order", amount: +o.gross, email: o.email, plan: plan?.name, ...w });
        }
        const { data: inv } = await db.from("billing_invoices").select("*").eq("pay_token", String(body.invoice ?? "")).maybeSingle();
        if (!inv) return J({ error: "not_found" }, 404);
        if (inv.status === "paid") return J({ paid: true, back: `${BRAIN}/platnosci?paid=1` });
        const { data: cust } = await db.from("billing_customers").select("email, contact_name").eq("workspace_id", inv.workspace_id).maybeSingle();
        const w = await ingWidget({ orderId: "f-" + inv.id, amount: +inv.gross, email: cust?.email ?? "", name: cust?.contact_name ?? "", title: `Faktura ${inv.number}`, back: `${BRAIN}/platnosci?paid=1` });
        return J({ kind: "invoice", amount: +inv.gross, number: inv.number, ...w });
      }

      // ── bramka testowa ─────────────────────────────────────────────────
      case "test.info": {
        if (PROVIDER !== "test") return J({ error: "off" }, 403);
        if (body.order) {
          const { data: o } = await db.from("billing_orders").select("gross, email, plan_key, status").eq("public_token", String(body.order)).maybeSingle();
          return J(o ? { kind: "order", amount: +o.gross, email: o.email, status: o.status } : { error: "not_found" });
        }
        const { data: inv } = await db.from("billing_invoices").select("gross, number, status").eq("pay_token", String(body.invoice ?? "")).maybeSingle();
        return J(inv ? { kind: "invoice", amount: +inv.gross, number: inv.number, status: inv.status } : { error: "not_found" });
      }
      case "test.result": {
        if (PROVIDER !== "test") return J({ error: "off" }, 403);
        const ok = !!body.ok;
        if (body.order) {
          const { data: o } = await db.from("billing_orders").select("*").eq("public_token", String(body.order)).maybeSingle();
          if (!o) return J({ error: "not_found" }, 404);
          if (!ok) {
            await db.from("billing_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", o.id);
            await db.from("billing_payments").insert({ order_id: o.id, kind: "checkout", amount: o.gross, status: "failed", provider: "test", error: "odrzucona w bramce testowej" });
            return J({ ok: true, back: `${SITE}/zamowienie/?o=${o.public_token}` });
          }
          await markOrderPaid(o, "test_" + Date.now(), body.card_token ? String(body.card_token) : "tok_test", "Visa •••• 4242");
          return J({ ok: true, back: `${SITE}/zamowienie/?o=${o.public_token}` });
        }
        const { data: inv } = await db.from("billing_invoices").select("*").eq("pay_token", String(body.invoice ?? "")).maybeSingle();
        if (!inv) return J({ error: "not_found" }, 404);
        if (ok) {
          await markInvoicePaid(inv, "test_" + Date.now());
          if (inv.subscription_id) await db.from("billing_subscriptions").update({ provider_token: "tok_test", card_label: "Visa •••• 4242" }).eq("id", inv.subscription_id);
        }
        return J({ ok: true, back: `${BRAIN}/platnosci?${ok ? "paid" : "failed"}=1` });
      }

      // ── faktura do podglądu/druku (strona /faktura; Supabase nie serwuje HTML z edge) ──
      case "invoice.get": {
        const { data: inv } = await db.from("billing_invoices").select("number, ing_number, ing_pdf_path, seller, buyer, items, net, vat, gross, issue_date, sale_date, due_date, status, paid_at, pay_token").eq("pay_token", String(body.invoice ?? "")).maybeSingle();
        if (!inv) return J({ error: "not_found" }, 404);
        // PDF z ING Księgowość — krótki podpisany link do prywatnego magazynu
        let pdf_url: string | null = null;
        if (inv.ing_pdf_path) {
          const { data: su } = await db.storage.from("invoices").createSignedUrl(inv.ing_pdf_path, 600, { download: `Faktura ${String(ingkNo(inv)).replace(/\//g, "-")}.pdf` });
          pdf_url = su?.signedUrl ?? null;
        }
        return J({ invoice: {
          ...inv, number: ingkNo(inv), ing_number: undefined, ing_pdf_path: undefined,
          net: +inv.net, vat: +inv.vat, gross: +inv.gross, pay_url: inv.status === "unpaid" ? payUrl(inv) : null, pdf_url,
        } });
      }

      // ── strona „Zapłać" (link z maila windykacyjnego) ───────────────────
      case "invoice.pay": {
        const { data: inv } = await db.from("billing_invoices").select("*").eq("pay_token", String(body.invoice ?? "")).maybeSingle();
        if (!inv) return J({ error: "not_found" }, 404);
        if (inv.status === "paid") return J({ ok: true, paid: true });
        const s = await provider().startInvoice(inv);
        return J({ ok: true, redirect: s.url, number: inv.number, amount: +inv.gross });
      }

      // ── cron ───────────────────────────────────────────────────────────
      case "tick": {
        if (!CRON_KEY || req.headers.get("x-billing-key") !== CRON_KEY) return J({ error: "auth" }, 401);
        return J({ ok: true, ...(await tick()) });
      }

      // ── admin: wszystkie faktury platformy (Ustawienia w każdym produkcie) ──
      case "admin.invoices":
      case "admin.invoice.retry": {
        const u = await panelUser(String(body.token ?? ""));
        if (!u) return J({ error: "auth" }, 401);
        if (u.role !== "admin") return J({ error: "forbidden" }, 403);
        if (action === "admin.invoice.retry") {
          await db.from("billing_invoices").update({ ing_attempts: 0, ing_error: null }).eq("id", String(body.id ?? ""));
          const r = await issueIngInvoice(String(body.id ?? ""));
          return J({ ok: true, number: r?.number, pdf: !!r?.pdf, off: !INGK_KEY });
        }
        const { data: rows } = await db.from("billing_invoices")
          .select("id, number, ing_number, ing_pdf_path, ing_error, ing_doc_id, workspace_id, buyer, issue_date, gross, net, status, pay_token")
          .order("created_at", { ascending: false }).limit(Math.min(+(body.limit ?? 300), 1000));
        const wsIds = [...new Set((rows ?? []).map((r) => r.workspace_id).filter(Boolean))];
        const { data: wss } = wsIds.length ? await db.from("brain_workspaces").select("id, name").in("id", wsIds) : { data: [] };
        const wsName = new Map((wss ?? []).map((w) => [w.id, w.name]));
        const invoices = (rows ?? []).map((r) => ({
          id: r.id, number: ingkNo(r), internal: r.number, company: (r.buyer as any)?.name, nip: (r.buyer as any)?.nip,
          workspace: wsName.get(r.workspace_id) ?? null, issue_date: r.issue_date, gross: +r.gross, net: +r.net, status: r.status,
          ing: r.ing_pdf_path ? "ok" : r.ing_error ? "error" : !INGK_KEY ? "off" : r.status === "paid" ? "pending" : "unpaid",
          ing_error: r.ing_error, url: invoiceUrl(r),
        }));
        const sumPaid = r2(invoices.filter((i) => i.status === "paid").reduce((a, i) => a + i.gross, 0));
        const sumDue = r2(invoices.filter((i) => i.status === "unpaid").reduce((a, i) => a + i.gross, 0));
        return J({ invoices, sum_paid: sumPaid, sum_due: sumDue, ing_connected: !!INGK_KEY });
      }

      // ── panel klienta (sesja Brain/Hand) ───────────────────────────────
      case "account.get":
      case "account.update":
      case "account.cancel":
      case "account.resume":
      case "account.pay": {
        const u = await panelUser(String(body.token ?? ""));
        if (!u) return J({ error: "auth" }, 401);
        const ws = u.role === "admin" && body.workspace_id ? String(body.workspace_id) : u.workspace_id;
        if (!ws) return J({ subscription: null, customer: null, invoices: [], debt: 0, blocked: false });
        if (action === "account.update") {
          const c = (body.customer ?? {}) as Record<string, string>;
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          for (const k of ["company_name", "street", "postal_code", "city", "invoice_email", "phone", "contact_name"]) if (c[k] !== undefined) patch[k] = String(c[k]).trim().slice(0, 200) || null;
          if (patch.invoice_email && !emailOk(String(patch.invoice_email))) return J({ error: "email" }, 400);
          await db.from("billing_customers").update(patch).eq("workspace_id", ws);
        }
        if (action === "account.cancel" || action === "account.resume") {
          await db.from("billing_subscriptions").update({ cancel_at_period_end: action === "account.cancel", updated_at: new Date().toISOString() })
            .eq("workspace_id", ws).in("status", ["active", "past_due"]);
          if (action === "account.cancel") await alertUs("Klient anuluje subskrypcję", `${u.login} — oferta ratunkowa (Miro 5)`);
        }
        if (action === "account.pay") {
          const { data: inv } = await db.from("billing_invoices").select("*").eq("workspace_id", ws).eq("status", "unpaid").order("issue_date").limit(1).maybeSingle();
          if (!inv) return J({ ok: true, nothing: true });
          const s = await provider().startInvoice(inv);
          return J({ ok: true, redirect: s.url });
        }
        return J(await accountView(ws));
      }
    }
    return J({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(action, e);
    return J({ error: "server", detail: String((e as Error)?.message ?? e).slice(0, 300) }, 500);
  }
});
