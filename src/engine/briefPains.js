/* Problemy, a nie nazwy produktów (2026-09-11, prośba właściciela).

   Na formularzu kontaktu klient wybiera to, co go BOLI — „zapytania czekają do
   rana", a nie „AI Sprzedawca". Nazwy naszych produktów nic mu nie mówią, dopóki
   nie wie, co one rozwiązują; dobranie produktu to nasza robota, nie jego.

   Każdy problem wskazuje produkty z katalogu (`audit_catalog.name`), które go
   zamykają — tę mapę czyta też edge `brief-lead`, żeby powiedzieć modelowi,
   o czym ma pisać. ⚠️ Kopia tej listy siedzi w funkcji (osobny runtime):
   zmieniasz tu — zmień i tam.

   Teksty problemów są skrótem z pola `problem` w katalogu, więc gdy dojdzie
   nowy produkt, jego ból dopisujemy tutaj. */

export const PAINS = [
  { id: 'noc', label: 'Zapytania czekają do rana', products: ['AI Sprzedawca', 'AI Recepcja 24/7'] },
  { id: 'tel', label: 'Telefon dzwoni, gdy nie ma kto odebrać', products: ['AI Recepcja 24/7'] },
  { id: 'wybor', label: 'Klient nie wie, który wariant wybrać', products: ['AI Doradca'] },
  { id: 'oferta', label: 'Oferta powstaje zbyt wolno', products: ['AI Generator Ofert'] },
  { id: 'leady', label: 'Brakuje nowych leadów', products: ['AI Łowca Leadów'] },
  { id: 'crm', label: 'Nie wiadomo, kogo ruszyć pierwszego', products: ['AI CRM'] },
  { id: 'ads', label: 'Reklamy palą budżet bez wyniku', products: ['AI Kampanie Reklamowe'] },
  { id: 'tresci', label: 'Nie ma kto prowadzić treści', products: ['AI Fabryka Kontentu'] },
  { id: 'seo', label: 'Nie widać nas w Google i w AI', products: ['AI Pilot Widoczności'] },
  { id: 'opinie', label: 'Opinie zostają bez odpowiedzi', products: ['AI Strażnik Reputacji'] },
  { id: 'powrot', label: 'Klient kupuje raz i znika', products: ['AI Fabryka Lojalności'] },
  { id: 'pytania', label: 'Te same pytania wracają w kółko', products: ['AI Asystent', 'AI Academy'] },
  { id: 'dane', label: 'Dane rozrzucone po arkuszach', products: ['AI  Centrum Danych'] },
  { id: 'terminy', label: 'Terminy i zadania się gubią', products: ['AI Project Manager'] },
  { id: 'magazyn', label: 'Braki albo zator w magazynie', products: ['Inteligentny Magazyn'] },
  { id: 'rekrutacja', label: 'Rekrutacja zjada tygodnie', products: ['Rekruter AI'] },
  { id: 'rynek', label: 'Nie wiemy, co robi konkurencja', products: ['AI Market Radar'] },
];

export const UNSURE = { id: 'nie-wiem', label: 'Jeszcze nie wiem' };

/** Etykiety wybranych problemów → nazwy produktów z katalogu (bez powtórek). */
export function productsForPains(labels) {
  const out = [];
  (labels || []).forEach((l) => {
    const p = PAINS.find((x) => x.label === l || x.id === l);
    (p ? p.products : []).forEach((n) => { if (!out.includes(n)) out.push(n); });
  });
  return out;
}
