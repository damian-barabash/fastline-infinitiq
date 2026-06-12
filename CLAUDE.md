# FASTLINE INFINITIQ — правила проекта

## Запреты

- **Папку `fastline-infinitiq/` НЕ ТРОГАТЬ** — пользовательская папка (добавлена юзером 2026-06-12). Не читать, не изменять, не удалять её содержимое без явной просьбы.
- **Папку `Prod/` НЕ ТРОГАТЬ** — пользовательская (та же договорённость).

## Стек и структура

- Vanilla HTML/CSS/JS, без фреймворков и сборки. Всё inline в `index.html` и `kontakt.html`.
- Палитра: `#0D0D0D` / acid `#B8FF00` / `#F5F5F0`. Шрифты DM Sans / DM Mono / Bebas Neue (Google Fonts).
- Лого: `assets/logo/LOGO.png`, Greywolf: `assets/Greywolf/logo_greywolf.png`, фавиконы в `assets/favicon/` (сгенерированы из знака ∞Q).

## Правила кода (уроки HORIN)

- `prefers-reduced-motion` игнорируется сознательно (Windows-кейс) — не возвращать.
- DOM-стили писать только при реальном изменении значения (не каждый кадр).
- JS не пишет transform элементам, чей transform управляется media query.
- Классы шторки перехода — `w-in`/`w-out` (не `in`/`out` — конфликт с entrance-анимацией контента на kontakt).
- После правок прогонять puppeteer-проверку: 1440×900 + 390×844, 0 console errors, 0 переполнений. Скрипты в `/tmp/pptr-fiq/` (puppeteer-core + Chrome из `~/.cache/puppeteer`). **Не использовать `clip` + `deviceScaleFactor: 2`** — отдаёт чёрные клипы; делать полные скриншоты.

## Вики

Документация проекта: `/Users/dmytrii/Desktop/Claude memory/wiki/projects/fastline-infinitiq/`.

## Типографика (зафиксирована 2026-06-12)

- **Archivo Expanded** (`font-stretch: 125%`, 800/900, UPPERCASE) — заголовки; **Schibsted Grotesk** (400-700) — текст; **IBM Plex Mono** (400/500) — лейблы/кнопки/демо. Google Fonts, latin-ext (`family=Archivo:wdth,wght@125,600..900`).
- НЕ возвращать DM Sans / DM Mono / Bebas Neue («ИИшные») и Unbounded (слишком округлый) — юзер отверг. Просил «серьёзный прямоугольный».
