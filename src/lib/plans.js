/* Plany sprzedaży online (2026-10-28). Dziś tylko AI Doradca.
   ⚠️ Kwoty do zapłaty liczy SERWER z tabeli `billing_plans` (edge `billing`) —
   tutaj są tylko do pokazania na stronie. Zmiana ceny = tabela + ten plik. */
export const VAT = 0.23;

export const PLANS = {
  start: {
    key: 'start',
    product: 'AI Doradca',
    product_key: 'advisor',
    name: 'AI Doradca — abonament',
    short: 'Kup teraz',
    monthly_net: 490,
    setup_net: 0,
    lines: ['500 rozmów miesięcznie', 'Kanał: Twoja strona WWW', 'Katalog do 200 pozycji', 'Raport miesięczny', 'Umowa na miesiąc, bez okresu wypowiedzenia'],
  },
  wdrozenie: {
    key: 'wdrozenie',
    product: 'AI Doradca',
    product_key: 'advisor',
    name: 'AI Doradca — abonament z wdrożeniem',
    short: 'Kup z wdrożeniem',
    monthly_net: 490,
    setup_net: 1490,
    lines: ['Wszystko z abonamentu', 'Konfigurację, katalog i ton marki robimy my', 'Osadzenie na stronie', 'Start do 5 dni roboczych'],
  },
};

export const gross = (net) => Math.round(net * (1 + VAT) * 100) / 100;
export const money = (n) => Number(n).toLocaleString('pl-PL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' zł';
