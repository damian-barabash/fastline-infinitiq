# FASTLINE INFINITIQ — правила проекта

## Запреты

- **Папку `fastline-infinitiq/` НЕ ТРОГАТЬ** — пользовательская папка (добавлена юзером 2026-06-12). Не читать, не изменять, не удалять её содержимое без явной просьбы.
- **Папку `Prod/` НЕ ТРОГАТЬ** — пользовательская (та же договорённость).

## Стек и структура

- **С 2026-07-28: React 18 + Vite + react-router** (переписано с vanilla; старые файлы в `legacy/` — только справка, не редактировать). SEO через SSG-пререндер (`npm run build` → `dist/`), деплой GH Pages (`.github/workflows/deploy.yml`, **домен `fastlineinfinitiq.pl` с 2026-08-05**).
- **Прелоадер (2026-08-05):** инлайн в `index.html` (стиль+разметка+скрипт до бандла) — 3D-сетка на canvas, морф в спираль нейро-столпа на выходе; показывается только на `/`, API `window.__fiq.set/done` (сигналы из `Home.jsx`), страховка 4.2 с. Прячет подстановку CMS-контента. Лендинг ходит в Supabase чистым `fetch` (`src/lib/supabase-config.js`) — supabase-js только в lazy-чанках editor/login/audyt.
- CSS страниц извлечён **байт-в-байт** из legacy в `src/styles/*.css` и инжектится per-page `<style>` — не «улучшать» и не объединять.
- Движки (барабан/нейро-столп/курсор/редактор) — императивные модули в `src/engine/*`, вызываются из useEffect с cleanup. FIQ-модуль CMS: `src/engine/fiq.js`.
- **Секция «Mapa procesu» (v2, 2026-08-14):** демо-панель и все demo-симуляции из `landingEngine.js` УДАЛЕНЫ (`window.fiqInitServices` — no-op, Home.jsx его по-прежнему зовёт). Строка `_lists.svc` = карточка фазы: `{name, desc, foot, chips, demo, hidden}`; `name` рендерится как «первое слово = крупный титул + остальное = mono-подпись»; `chips` — сырой текст «Nazwa | opis; Nazwa | opis» (парсится в `FIQ.parseChips`); при пустых chips/foot берутся дефолты `FIQ.SVC_DEFAULTS` по ключу `demo` (strategy/gen/voice/llm/auto). Зелёный луч — чистый CSS `.svc-beam` (18s, стаггер по `--i`). **Секция `#dla-kogo` = «Co robimy» (WHO v2)**: первый элемент `_lists.who` — hero-карточка ({tag,h,p,cta,s1l,s1v,s2l,s2v}), остальные — категории ({tag,h,p}); спарклайн pipeline в hero рисует движок (`sparkTick`), ховер карточек даёт импульс. Матовые карточки (what/svc/who): внутри 3D-барабана `backdrop-filter` НЕ сэмплит канвас за гранью (Chromium) — **настоящий фрост рисует движок**: `.frost-c`-канвас в каждой карточке + downscale-каскад региона `#neural` (frostRects ДО записей барабана, frostDraw ПОСЛЕ drawNeural); база почти непрозрачная `rgba(16,17,13,0.9)`, иначе резкие точки двоятся с блюром. CSS-blur оставлен — работает в mode-flat.
- Роуты: `/`, `/kontakt`, `/login`, `/editor` (+вкладка Audyt), `/audyt/:slug` (клиентский аудит, noindex). Edge-функция `audit-run` (Barabash AI, ключ `fiq-audit`, 3 последовательных вызова qwen3.5:9b — не распараллеливать, общий gateway с Теосом/CatMon).
- Палитра: `#0D0D0D` / acid `#B8FF00` / `#F5F5F0`. Шрифты DM Sans / DM Mono / Bebas Neue (Google Fonts).
- Лого: `assets/logo/LOGO.png` (**с 2026-08-05 полностью кислотное**, 1734×400, из `LOGO_2.png` юзера; старое было красно-зелёное), Greywolf: `assets/Greywolf/logo_greywolf.png`, фавиконы в `assets/favicon/` (сгенерированы из знака ∞Q). OG-картинка: `public/assets/og/og.jpg` (1200×630, генерится PIL из лого + сетка).

## Правила кода (уроки HORIN)

- `prefers-reduced-motion` игнорируется сознательно (Windows-кейс) — не возвращать.
- DOM-стили писать только при реальном изменении значения (не каждый кадр).
- JS не пишет transform элементам, чей transform управляется media query.
- Классы шторки перехода — `w-in`/`w-out` (не `in`/`out` — конфликт с entrance-анимацией контента на kontakt).
- После правок прогонять puppeteer-проверку: 1440×900 + 390×844, 0 console errors, 0 переполнений. Скрипты в `/tmp/pptr-fiq/` (puppeteer-core + Chrome из `~/.cache/puppeteer`). **Не использовать `clip` + `deviceScaleFactor: 2`** — отдаёт чёрные клипы; делать полные скриншоты.

## Вики

Документация проекта: `/Users/dmytrii/Desktop/Claude memory/wiki/projects/fastline-infinitiq/`.

## Типографика (обновлена 2026-08-13)

- **Space Grotesk Bold** (700, UPPERCASE) — заголовки/display (с 2026-08-13, запрос юзера «более читаемый»; заменил Archivo Expanded — веса >700 не грузятся, `font-weight` клампить в 700, `font-stretch` не использовать); **Schibsted Grotesk** (400-700) — текст; **IBM Plex Mono** (400/500) — лейблы/кнопки/демо. Google Fonts, latin-ext (`family=Space+Grotesk:wght@400..700`). То же в Brain-панели (`Prod/brain.fastlineinfinitiq`).
- НЕ возвращать DM Sans / DM Mono / Bebas Neue («ИИшные») и Unbounded (слишком округлый) — юзер отверг. Archivo Expanded заменён на Space Grotesk 2026-08-13 ради читаемости.
