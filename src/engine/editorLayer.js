// Слой визуального редактора: contenteditable, тулбары, палитра блоков,
// сбор контента и сохранение (published/draft). Перенос 1:1 из editor.html.
// Адаптация: sb-клиент и редиректы приходят из React, cleanup для SPA.
import { renderHeroProducts } from './heroProducts.js';
import { fitNavClaim } from './navClaim.js';

export function initEditorLayer({ sb, onRequireLogin, pageId = 'index' }) {

  // Redaktor obsługuje kilka stron: lądowanie leży w wierszu `index`,
  // strona produktu /agenci-ai w `agenci-ai`. Cała reszta warstwy jest wspólna.

  const ac = new AbortController();
  const signal = ac.signal;
  const FIQ = window.FIQ;

  const $ = id => document.getElementById(id);
  const gate = $('fiqGate'), bar = $('fiqBar'), fileInput = $('fiqFile');
  const statusEl = $('fiqStatus'), statusText = $('fiqStatusText');
  const userEl = $('fiqUser'), toast = $('fiqToast');

  const B = FIQ.BLOCKS;
  const pad = n => ('0' + n).slice(-2);
  let session = null, baseline = '', loadedFrom = 'published', imgTarget = null, palZone = null;
  let destroyed = false;

  function showToast(msg, err) {
    toast.textContent = msg; toast.classList.toggle('err', !!err);
    toast.classList.add('show'); clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // src плейсхолдера → пустая строка (чтобы не сохранять data-uri как картинку)
  const imgSrc = el => { const s = el.getAttribute('src') || ''; return s.indexOf('data:image/svg') === 0 ? '' : s; };
  const fromHTML = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const txt = (root, sel) => { const e = root.querySelector(sel); return e ? e.textContent.trim() : ''; };
  // Pole html bywa jednocześnie blokiem `data-hideable` — wtedy siedzi w nim nasz
  // tulbar (◉ ↑ ↓ ✕). Do CMS idzie treść BEZ niego, inaczej ikony lądują na stronie.
  const cleanHtml = el => {
    const c = el.cloneNode(true);
    c.querySelectorAll('.fiq-tb, .fiq-add').forEach(n => n.remove());
    // insertHTML zostawia &nbsp; przy wstawionym znaczniku — pojedynczy między
    // słowami wraca do zwykłej spacji, inaczej tekst nie łamałby się w tym miejscu
    return c.innerHTML.trim().replace(/(\S)&nbsp;(?=\S)/g, '$1 ');
  };

  /* ===== Сбор контента: flat + _lists + _hidden + _blocks ===== */
  function readBlock(block) {
    const type = block.getAttribute('data-block-type');
    const data = {};
    block.querySelectorAll('[data-f]').forEach(e => { if (!e.closest('.fb-item')) data[e.getAttribute('data-f')] = e.textContent.trim(); });
    block.querySelectorAll('[data-fimg]').forEach(e => { if (!e.closest('.fb-item')) data[e.getAttribute('data-fimg')] = imgSrc(e); });
    block.querySelectorAll('[data-items]').forEach(listEl => {
      data[listEl.getAttribute('data-items')] = Array.from(listEl.querySelectorAll(':scope > .fb-item')).map(it => {
        const o = {};
        it.querySelectorAll('[data-f]').forEach(e => o[e.getAttribute('data-f')] = e.textContent.trim());
        it.querySelectorAll('[data-fimg]').forEach(e => o[e.getAttribute('data-fimg')] = imgSrc(e));
        return o;
      });
    });
    if (block.hasAttribute('data-flip')) data.flip = block.getAttribute('data-flip') === '1';
    return { type, hidden: block.classList.contains('fiq-hidden'), data };
  }
  function collect() {
    const o = {};
    const rich = [];
    document.querySelectorAll('[data-edit]').forEach(el => {
      if (el.closest('[data-list]') || el.closest('[data-zone]')) return; // динамику собираем отдельно
      const k = el.getAttribute('data-edit'), t = el.getAttribute('data-edit-type');
      if (t === 'image') o[k] = el.tagName === 'IMG' ? (el.getAttribute('src') || '') : '';
      else if (t === 'html') o[k] = cleanHtml(el);
      else if (el.hasAttribute('data-rich')) {
        // pole jednoliniowe z formatowaniem: html + wpis w `_rich`; bez znaczników wraca do tekstu
        const h = cleanHtml(el);
        if (/<[a-z]/i.test(h)) { o[k] = h; rich.push(k); }
        else { o[k] = el.textContent.trim(); el.removeAttribute('data-rich'); }
      }
      else o[k] = el.textContent.trim();
    });
    o._rich = rich;
    const lists = {};
    document.querySelectorAll('[data-list]').forEach(cont => {
      const name = cont.getAttribute('data-list');
      lists[name] = Array.from(cont.querySelectorAll(':scope > [data-litem]')).map(item => {
        const o2 = { hidden: item.classList.contains('fiq-hidden') };
        item.querySelectorAll('[data-f]').forEach(e => o2[e.getAttribute('data-f')] = e.textContent.trim());
        if (name === 'svc') o2.demo = item.getAttribute('data-demo') || '';
        return o2;
      });
    });
    o._lists = lists;
    const hid = [];
    document.querySelectorAll('[data-hideable]').forEach(el => { if (el.classList.contains('fiq-hidden')) hid.push(el.getAttribute('data-hideable')); });
    o._hidden = hid;
    // usunięte bloki nie istnieją już w DOM — lista pamięta je za nas
    o._removed = Array.from(removedKeys);
    o._order = FIQ.readOrder();
    const blocks = {};
    document.querySelectorAll('[data-zone]').forEach(zone => {
      blocks[zone.getAttribute('data-zone')] = Array.from(zone.querySelectorAll(':scope > .fb')).map(readBlock);
    });
    o._blocks = blocks;
    return o;
  }
  const serialize = o => JSON.stringify(o);

  function setStatus(state) {
    statusEl.className = state;
    statusText.textContent =
      state === 'saved' ? 'Zapisano' :
      state === 'draft' ? 'Wersja robocza' :
      state === 'saving' ? 'Zapisywanie…' : 'Niezapisane';
  }
  function checkDirty() {
    if (serialize(collect()) === baseline) setStatus(loadedFrom === 'draft' ? 'draft' : 'saved');
    else setStatus('dirty');
  }

  /* ===== Превращение полей в редактируемые ===== */
  function enhanceText(el) {
    if (el._fEnh) return; el._fEnh = true;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.addEventListener('input', checkDirty);
    if (el.tagName === 'A') el.addEventListener('click', e => e.preventDefault());
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      // pola jednoliniowe: Enter kończy edycję; Shift+Enter wstawia znak nowej linii
      // (widać go tam, gdzie CSS ma `white-space: pre-line`, np. krótki CTA w nagłówku)
      if (el.getAttribute('data-edit-type') !== 'html') {
        e.preventDefault();
        if (e.shiftKey) document.execCommand('insertText', false, '\n'); else el.blur();
        return;
      }
      // pola wieloliniowe: łamiemy wiersz przez <br>. Domyślnie przeglądarka
      // wstawia tu <div>, co rozjeżdża odstępy i trafia do CMS jako śmieć.
      e.preventDefault();
      if (!document.execCommand('insertLineBreak')) document.execCommand('insertHTML', false, '<br>');
    });
    el.addEventListener('paste', e => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
  }
  function enhanceImg(el) {
    if (el._fEnh) return; el._fEnh = true;
    el.addEventListener('click', e => { e.preventDefault(); imgTarget = el; fileInput.click(); });
  }

  /* ===== Тулбары / нумерация ===== */
  function tbi(icon, title, fn, cls) {
    const s = document.createElement('span');
    s.className = 'tbi' + (cls ? ' ' + cls : '');
    s.textContent = icon; s.title = title;
    s.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(s); });
    return s;
  }
  function renumber(parent) {
    let i = 0;
    Array.from(parent.children).forEach(c => {
      if (!c.matches || !c.matches('[data-litem], .fb-item')) return;
      i++; const n = pad(i);
      const sn = c.querySelector(':scope > .svc-num'); if (sn) sn.textContent = n;
      if (c.classList.contains('who-item')) c.setAttribute('data-n', n);
      const cn = c.querySelector(':scope > .fb-card-num'); if (cn) cn.textContent = n;
      const stn = c.querySelector(':scope > .fb-step-num'); if (stn) stn.textContent = n;
    });
  }
  function addItemTb(item, sub) {
    if (item.querySelector(':scope > .fiq-tb')) return;
    const tb = document.createElement('span'); tb.className = 'fiq-tb';
    tb.appendChild(tbi('↑', 'W górę', () => { const p = item.previousElementSibling; if (p && p.matches('[data-litem], .fb-item')) { item.parentNode.insertBefore(item, p); renumber(item.parentNode); checkDirty(); } }));
    tb.appendChild(tbi('↓', 'W dół', () => { const n = item.nextElementSibling; if (n && n.matches('[data-litem], .fb-item')) { item.parentNode.insertBefore(n, item); renumber(item.parentNode); checkDirty(); } }));
    if (!sub) tb.appendChild(tbi('◉', 'Ukryj / pokaż', s => { item.classList.toggle('fiq-hidden'); s.classList.toggle('on', item.classList.contains('fiq-hidden')); checkDirty(); }));
    tb.appendChild(delBtn(item, (p) => renumber(p)));
    item.appendChild(tb);
  }
  /* Blok `data-hideable` można przesuwać wśród RODZEŃSTWA tego samego rodzaju
     (grań wśród grani, karta agenta wśród kart, pytanie FAQ wśród pytań).
     Kolejność trafia do CMS jako `_order` (FIQ.readOrder) i wraca w applyContent —
     markup jest statycznym snapshotem, więc bez tego strona wróciłaby do
     kolejności z kodu po odświeżeniu. Strzałki pojawiają się tylko tam, gdzie
     jest z czym się zamienić. */
  function sibHideable(el, dir) {
    let n = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    while (n && !n.hasAttribute('data-hideable')) {
      // pomijamy tylko nasze przyciski/strefy; obce elementy zatrzymują ruch
      if (n.matches('.fiq-add, .fiq-blocks')) { n = dir < 0 ? n.previousElementSibling : n.nextElementSibling; continue; }
      return null;
    }
    return n;
  }
  function moveHideable(el, dir) {
    const other = sibHideable(el, dir);
    if (!other) return;
    if (dir < 0) el.parentNode.insertBefore(el, other);
    else el.parentNode.insertBefore(other, el);
    FIQ.syncRail && FIQ.syncRail();
    checkDirty();
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function addHideTb(el) {
    if (el.querySelector(':scope > .fiq-tb')) return;
    const tb = document.createElement('span'); tb.className = 'fiq-tb';
    if (sibHideable(el, -1) || sibHideable(el, 1)) {
      tb.appendChild(tbi('↑', 'W górę', () => moveHideable(el, -1)));
      tb.appendChild(tbi('↓', 'W dół', () => moveHideable(el, 1)));
    }
    tb.appendChild(tbi('◉', 'Ukryj / pokaż', s2 => { el.classList.toggle('fiq-hidden'); s2.classList.toggle('on', el.classList.contains('fiq-hidden')); checkDirty(); }));
    tb.appendChild(delBtn(el));
    el.appendChild(tb);
  }
  function addBlockTb(block) {
    if (block.querySelector(':scope > .fiq-tb')) return;
    const tb = document.createElement('span'); tb.className = 'fiq-tb';
    tb.appendChild(tbi('↑', 'W górę', () => { const p = block.previousElementSibling; if (p && p.matches('.fb')) { block.parentNode.insertBefore(block, p); checkDirty(); } }));
    tb.appendChild(tbi('↓', 'W dół', () => { const n = block.nextElementSibling; if (n && n.matches('.fb')) { block.parentNode.insertBefore(n, block); checkDirty(); } }));
    if (block.hasAttribute('data-flip')) tb.appendChild(tbi('⇄', 'Odbij', s => { const f = block.getAttribute('data-flip') === '1'; block.setAttribute('data-flip', f ? '0' : '1'); const sp = block.querySelector('.fb-split'); if (sp) sp.classList.toggle('fb-flip', !f); s.classList.toggle('on', !f); checkDirty(); }));
    tb.appendChild(tbi('◉', 'Ukryj / pokaż', s => { block.classList.toggle('fiq-hidden'); s.classList.toggle('on', block.classList.contains('fiq-hidden')); checkDirty(); }));
    tb.appendChild(delBtn(block));
    block.appendChild(tb);
  }

  /* ===== Кнопки добавления ===== */
  function ensureListAdd(cont) {
    if (cont.querySelector(':scope > .fiq-add')) return;
    const name = cont.getAttribute('data-list');
    const btn = document.createElement('button');
    btn.className = 'fiq-add';
    btn.textContent = name === 'svc' ? '＋ Faza' : '＋ Karta';
    btn.addEventListener('click', e => {
      e.preventDefault();
      const idx = cont.querySelectorAll(':scope > [data-litem]').length;
      const html = name === 'svc'
        ? FIQ.buildSvcRow({ name: 'Nowa faza', desc: 'Opis fazy.', foot: 'Podpis fazy.', chips: 'Produkt | opis', demo: '' }, idx)
        : FIQ.buildWhoCard({ tag: 'Kategoria', h: 'Nowa pozycja', p: 'Opis.' }, idx);
      const node = fromHTML(html);
      cont.insertBefore(node, btn);
      addItemTb(node);
      node.querySelectorAll('[data-f]').forEach(enhanceText);
      renumber(cont); checkDirty();
    });
    cont.appendChild(btn);
  }
  function ensureSubAdd(itemsEl, block) {
    if (itemsEl.querySelector(':scope > .fiq-add')) return;
    const type = block.getAttribute('data-block-type');
    const btn = document.createElement('button');
    btn.className = 'fiq-add'; btn.textContent = '＋';
    btn.addEventListener('click', e => {
      e.preventDefault();
      const def = (B[type].make().items || [{}])[0];
      const idx = itemsEl.querySelectorAll(':scope > .fb-item').length;
      const node = fromHTML(B[type].item(def, idx));
      itemsEl.insertBefore(node, btn);
      addItemTb(node, true);
      node.querySelectorAll('[data-f]').forEach(enhanceText);
      node.querySelectorAll('[data-fimg]').forEach(enhanceImg);
      renumber(itemsEl); checkDirty();
    });
    itemsEl.appendChild(btn);
  }
  function enhanceBlock(block) {
    if (block._bEnh) return; block._bEnh = true;
    block.querySelectorAll('[data-f]').forEach(enhanceText);
    block.querySelectorAll('[data-fimg]').forEach(enhanceImg);
    block.querySelectorAll('[data-items]').forEach(itemsEl => {
      itemsEl.querySelectorAll(':scope > .fb-item').forEach(it => addItemTb(it, true));
      ensureSubAdd(itemsEl, block);
    });
    addBlockTb(block);
  }
  function ensureZoneAdd(zone) {
    if (zone.querySelector(':scope > .fiq-add')) return;
    const btn = document.createElement('button');
    btn.className = 'fiq-add fiq-zone-add'; btn.textContent = '＋ Dodaj blok';
    btn.addEventListener('click', e => { e.preventDefault(); palZone = zone; pal.classList.add('show'); });
    zone.appendChild(btn);
  }

  /* ===== Usuwanie bloków =====
     Ukrycie jest odwracalne jednym kliknięciem, usunięcie — nie, więc idzie
     przez okno z losowym 10-cyfrowym kodem do przepisania. Klucze usuniętych
     elementów `data-hideable` trzymamy w `_removed`: markup strony jest
     statyczny (snapshot dla SSG), więc bez tej listy blok wróciłby po odświeżeniu. */
  const removedKeys = new Set();
  const cf = $('fiqConfirm'), cfWhat = $('fiqConfirmWhat'), cfCode = $('fiqConfirmCode');
  const cfInput = $('fiqConfirmInput'), cfOk = $('fiqConfirmOk'), cfCancel = $('fiqConfirmCancel');
  let cfResolve = null;

  function blockLabel(el) {
    const own = el.getAttribute('data-hide-label');
    if (own) return own;
    const h = el.querySelector('h1, h2, h3, .section-label, .dm-cap, .cost-tag, .svc-name, .who-tag');
    const t = (h ? h.textContent : el.textContent || '').trim().replace(/\s+/g, ' ');
    return t ? t.slice(0, 60) : 'blok';
  }
  function askDelete(el) {
    if (!cf) return Promise.resolve(true);
    const code = String(Math.floor(Math.random() * 9e9) + 1e9);
    cfWhat.textContent = '// ' + blockLabel(el);
    cfCode.textContent = code;
    cfInput.value = '';
    cfOk.disabled = true;
    cf.classList.add('show');
    setTimeout(() => cfInput.focus(), 30);
    const check = () => { cfOk.disabled = cfInput.value.trim() !== code; };
    cfInput.oninput = check;
    return new Promise(resolve => { cfResolve = resolve; });
  }
  function closeConfirm(v) {
    if (!cf) return;
    cf.classList.remove('show');
    cfInput.oninput = null;
    const r = cfResolve; cfResolve = null;
    if (r) r(v);
  }
  if (cf) {
    cfOk.addEventListener('click', () => { if (!cfOk.disabled) closeConfirm(true); }, { signal });
    cfCancel.addEventListener('click', () => closeConfirm(false), { signal });
    cf.addEventListener('click', e => { if (e.target === cf) closeConfirm(false); }, { signal });
    cfInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !cfOk.disabled) closeConfirm(true); }, { signal });
    addEventListener('keydown', e => { if (e.key === 'Escape' && cf.classList.contains('show')) closeConfirm(false); }, { signal });
  }

  /** Kasownik z potwierdzeniem — wspólny dla sekcji, kart list i bloków. */
  function delBtn(el, after) {
    return tbi('✕', 'Usuń', async () => {
      if (!await askDelete(el)) return;
      const key = el.getAttribute('data-hideable');
      if (key) removedKeys.add(key);
      const parent = el.parentNode;
      el.remove();
      if (after) after(parent);
      checkDirty();
    }, 'del');
  }

  /* ===== Pasek formatowania zaznaczonego tekstu =====
     Działa w polach [data-edit] (płaskie klucze CMS). Pola list/bloków ([data-f])
     są celowo pominięte — ich szablony escapują html i znaczniki wyszłyby tekstem.
     B/I/U/S → execCommand (toggle działa w obie strony); wszystko inne →
     <span data-fq style="…"> wokół zaznaczenia (własny CSS dla kawałka tekstu). */
  const fmt = $('fiqFmt');
  const fmtPanel = $('fiqFmtPanel'), fmtLab = $('fiqFmtLab'), fmtPresets = $('fiqFmtPresets');
  const fmtInput = $('fiqFmtInput'), fmtApply = $('fiqFmtApply'), fmtHint = $('fiqFmtHint');
  let fmtRange = null;      // zaznaczenie zapamiętane, bo klik w input je zabiera
  let fmtHost = null;       // pole [data-edit], w którym trwa formatowanie
  let fmtPanelKind = null;

  const PANELS = {
    color: {
      lab: 'Kolor tekstu', ph: '#B8FF00 albo rgba(245,245,240,.6)',
      presets: [['kwas', '#B8FF00'], ['biały', '#F5F5F0'], ['przygaszony', 'rgba(245,245,240,0.6)'], ['pomarańcz', '#FF7A18'], ['czerwony', '#FF5470']],
      apply: v => ({ color: v }),
    },
    size: {
      lab: 'Rozmiar tekstu', ph: '18px, 1.2em, 120%',
      presets: [['mały', '0.8em'], ['normalny', '1em'], ['duży', '1.25em'], ['bardzo duży', '1.6em'], ['16px', '16px'], ['24px', '24px'], ['32px', '32px']],
      apply: v => ({ 'font-size': /^\d+(\.\d+)?$/.test(v) ? v + 'px' : v }),
    },
    link: {
      lab: 'Adres linku', ph: 'https://… albo /kontakt', hint: 'Pusty adres = usuń link.',
      presets: [['/kontakt', '/kontakt'], ['/agenci-ai', '/agenci-ai'], ['/#audyt', '/#audyt']],
    },
    css: {
      lab: 'Własny CSS tego fragmentu', ph: 'letter-spacing: .12em; text-transform: uppercase; color: #B8FF00',
      hint: 'Deklaracje CSS rozdzielone średnikiem — trafiają do atrybutu style tego kawałka tekstu.',
      presets: [['odstępy liter', 'letter-spacing: .12em'], ['mono', "font-family: 'IBM Plex Mono', monospace"], ['display', "font-family: 'Space Grotesk', sans-serif; font-weight: 700; text-transform: uppercase"], ['poświata', 'text-shadow: 0 0 14px rgba(184,255,0,.6)'], ['obramowanie', 'border: 1px solid #B8FF00; padding: 0 .3em']],
    },
  };

  const editHost = node => {
    const el = node && (node.nodeType === 3 ? node.parentNode : node);
    return el && el.closest ? el.closest('[data-edit][contenteditable="true"]') : null;
  };
  function currentRange() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    const host = editHost(r.commonAncestorContainer);
    if (!host || editHost(r.startContainer) !== host || editHost(r.endContainer) !== host) return null;
    return r;
  }
  function placeFmt(r) {
    const rect = r.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    fmt.classList.add('show');
    const w = fmt.offsetWidth, h = fmt.offsetHeight;
    let top = rect.top - h - 12, below = false;
    if (top < 8) { top = rect.bottom + 12; below = true; }
    const cx = rect.left + rect.width / 2;
    const left = Math.max(8, Math.min(cx - w / 2, innerWidth - w - 8));
    fmt.style.left = left + 'px'; fmt.style.top = top + 'px';
    fmt.style.setProperty('--ax', Math.max(14, Math.min(cx - left, w - 14)) + 'px');
    fmt.classList.toggle('below', below);
  }
  function syncFmtState() {
    const q = c => { try { return document.queryCommandState(c); } catch (_) { return false; } };
    fmt.querySelector('[data-fmt="bold"]').classList.toggle('on', q('bold'));
    fmt.querySelector('[data-fmt="italic"]').classList.toggle('on', q('italic'));
    fmt.querySelector('[data-fmt="underline"]').classList.toggle('on', q('underline'));
    fmt.querySelector('[data-fmt="strike"]').classList.toggle('on', q('strikeThrough'));
  }
  function hideFmt() { fmt.classList.remove('show'); closeFmtPanel(); fmtRange = null; fmtHost = null; }
  function onSelection() {
    if (fmtPanelKind) return;                 // otwarty panel: input zabiera zaznaczenie, nie chowamy
    const r = currentRange();
    if (!r) { if (fmt.classList.contains('show')) hideFmt(); return; }
    fmtRange = r.cloneRange(); fmtHost = editHost(r.commonAncestorContainer);
    placeFmt(r); syncFmtState();
  }
  document.addEventListener('selectionchange', onSelection, { signal });
  addEventListener('scroll', () => { if (fmt.classList.contains('show') && fmtRange) placeFmt(fmtRange); }, { signal, passive: true });
  addEventListener('resize', () => { if (fmt.classList.contains('show') && fmtRange) placeFmt(fmtRange); }, { signal });
  document.addEventListener('mousedown', e => { if (fmt.classList.contains('show') && !fmt.contains(e.target) && !editHost(e.target)) hideFmt(); }, { signal });

  function restoreRange() {
    if (!fmtRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(fmtRange);
    return true;
  }
  function markRich() {
    if (fmtHost && fmtHost.getAttribute('data-edit-type') !== 'html') fmtHost.setAttribute('data-rich', '');
  }
  const escAttr = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cleanCss = v => String(v || '').replace(/[<>"{}]/g, '').replace(/\s+/g, ' ').trim().replace(/;\s*$/, '');
  const fragHtml = r => { const d = document.createElement('div'); d.appendChild(r.cloneContents()); d.querySelectorAll('.fiq-tb').forEach(n => n.remove()); return d.innerHTML; };
  /** Zaznaczenie w całości = istniejący <span data-fq>? Wtedy zmieniamy jego styl zamiast zagnieżdżać. */
  function wholeSpan(r) {
    const el = editHost(r.commonAncestorContainer) ? (r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer) : null;
    const sp = el && el.closest('span[data-fq]');
    return sp && fmtHost && fmtHost.contains(sp) && sp.textContent === r.toString() ? sp : null;
  }
  function selectNode(n) {
    const sel = window.getSelection(); const r = document.createRange();
    r.selectNodeContents(n); sel.removeAllRanges(); sel.addRange(r);
    fmtRange = r.cloneRange();
  }
  /** Owija zaznaczenie w <span data-fq style="…"> (albo dopisuje styl do istniejącego). */
  function styleSelection(decl) {
    if (!restoreRange()) return;
    const r = window.getSelection().getRangeAt(0);
    const sp = wholeSpan(r);
    if (sp) { Object.keys(decl).forEach(k => sp.style.setProperty(k, decl[k])); selectNode(sp); }
    else {
      const css = Object.keys(decl).map(k => k + ': ' + decl[k]).join('; ');
      const id = 'fq' + Date.now();
      document.execCommand('insertHTML', false, `<span data-fq data-fqid="${id}" style="${escAttr(css)}">${fragHtml(r)}</span>`);
      const node = fmtHost.querySelector(`[data-fqid="${id}"]`);
      if (node) { node.removeAttribute('data-fqid'); selectNode(node); }
    }
    markRich(); checkDirty();
    if (fmtRange) { placeFmt(fmtRange); syncFmtState(); }
  }
  function rawStyleSelection(cssText) {
    if (!restoreRange()) return;
    const r = window.getSelection().getRangeAt(0);
    const sp = wholeSpan(r);
    if (sp) { sp.setAttribute('style', (sp.getAttribute('style') ? sp.getAttribute('style').replace(/;\s*$/, '') + '; ' : '') + cssText); selectNode(sp); }
    else {
      const id = 'fq' + Date.now();
      document.execCommand('insertHTML', false, `<span data-fq data-fqid="${id}" style="${escAttr(cssText)}">${fragHtml(r)}</span>`);
      const node = fmtHost.querySelector(`[data-fqid="${id}"]`);
      if (node) { node.removeAttribute('data-fqid'); selectNode(node); }
    }
    markRich(); checkDirty();
    if (fmtRange) { placeFmt(fmtRange); syncFmtState(); }
  }
  function linkSelection(href) {
    if (!restoreRange()) return;
    const r = window.getSelection().getRangeAt(0);
    const el = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    const a = el.closest && el.closest('a');
    if (a && fmtHost.contains(a) && a !== fmtHost) {
      if (!href) { const f = document.createDocumentFragment(); while (a.firstChild) f.appendChild(a.firstChild); a.replaceWith(f); }
      else { a.setAttribute('href', href); selectNode(a); }
    } else if (href) {
      const id = 'fq' + Date.now();
      document.execCommand('insertHTML', false, `<a href="${escAttr(href)}" data-fqid="${id}">${fragHtml(r)}</a>`);
      const node = fmtHost.querySelector(`[data-fqid="${id}"]`);
      if (node) { node.removeAttribute('data-fqid'); node.addEventListener('click', ev => ev.preventDefault()); selectNode(node); }
    }
    markRich(); checkDirty();
    if (fmtRange) { placeFmt(fmtRange); syncFmtState(); }
  }
  /** Czyści formatowanie: zostaje tekst i <br>. */
  function clearSelection() {
    if (!restoreRange()) return;
    const r = window.getSelection().getRangeAt(0);
    const sp = wholeSpan(r);
    const plain = n => {
      if (n.nodeType === 3) return n.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      if (n.nodeType !== 1) return '';
      if (n.tagName === 'BR') return '<br>';
      if (n.classList && n.classList.contains('fiq-tb')) return '';
      return Array.from(n.childNodes).map(plain).join('');
    };
    const target = sp || r;
    const html = sp ? Array.from(sp.childNodes).map(plain).join('') : Array.from(r.cloneContents().childNodes).map(plain).join('');
    if (sp) selectNode(sp);
    document.execCommand('insertHTML', false, html || ' ');
    checkDirty();
    hideFmt();
  }
  function execToggle(cmd) {
    if (!restoreRange()) return;
    try { document.execCommand('styleWithCSS', false, false); } catch (_) {}
    document.execCommand(cmd, false, null);
    const sel = window.getSelection();
    if (sel.rangeCount) fmtRange = sel.getRangeAt(0).cloneRange();
    markRich(); checkDirty();
    if (fmtRange) { placeFmt(fmtRange); syncFmtState(); }
  }

  const QUICK = {
    bold: () => execToggle('bold'), italic: () => execToggle('italic'),
    underline: () => execToggle('underline'), strike: () => execToggle('strikeThrough'),
    acid: () => styleSelection({ color: '#B8FF00' }),
    mark: () => styleSelection({ background: '#B8FF00', color: '#0D0D0D', padding: '0 0.25em' }),
    upper: () => styleSelection({ 'text-transform': 'uppercase', 'letter-spacing': '0.08em' }),
    small: () => styleSelection({ 'font-size': '0.8em' }),
    big: () => styleSelection({ 'font-size': '1.3em' }),
    clear: () => clearSelection(),
  };
  function openFmtPanel(kind) {
    const P = PANELS[kind]; if (!P) return;
    fmtPanelKind = kind;
    fmtLab.textContent = P.lab; fmtInput.placeholder = P.ph || ''; fmtInput.value = '';
    fmtHint.textContent = P.hint || '';
    fmtPresets.innerHTML = '';
    (P.presets || []).forEach(([name, val]) => {
      const c = document.createElement('span'); c.className = 'fiq-fmt-chip';
      if (kind === 'color') { const i = document.createElement('i'); i.style.background = val; c.appendChild(i); }
      c.appendChild(document.createTextNode(name)); c.title = val;
      c.addEventListener('mousedown', e => e.preventDefault());
      c.addEventListener('click', () => { fmtInput.value = val; applyFmtPanel(); });
      fmtPresets.appendChild(c);
    });
    // wartość z istniejącego spana — żeby dało się poprawić, nie tylko dopisać
    if (fmtRange) {
      const sp = wholeSpan(fmtRange);
      if (sp) {
        if (kind === 'css') fmtInput.value = sp.getAttribute('style') || '';
        if (kind === 'color') fmtInput.value = sp.style.color || '';
        if (kind === 'size') fmtInput.value = sp.style.fontSize || '';
      }
      if (kind === 'link') {
        const el = fmtRange.commonAncestorContainer.nodeType === 3 ? fmtRange.commonAncestorContainer.parentNode : fmtRange.commonAncestorContainer;
        const a = el.closest && el.closest('a'); if (a && a !== fmtHost) fmtInput.value = a.getAttribute('href') || '';
      }
    }
    fmt.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === kind));
    fmtPanel.hidden = false;
    if (fmtRange) placeFmt(fmtRange);
    setTimeout(() => fmtInput.focus(), 20);
  }
  function closeFmtPanel() {
    fmtPanelKind = null; fmtPanel.hidden = true;
    fmt.querySelectorAll('[data-panel]').forEach(b => b.classList.remove('on'));
  }
  function applyFmtPanel() {
    const kind = fmtPanelKind; const v = fmtInput.value.trim();
    if (!kind) return;
    if (kind === 'link') linkSelection(v.replace(/["<>]/g, ''));
    else if (kind === 'css') { const c = cleanCss(v); if (c) rawStyleSelection(c); }
    else if (v) { const d = PANELS[kind].apply(v.replace(/["<>;]/g, '')); styleSelection(d); }
    closeFmtPanel();
    if (fmtRange) placeFmt(fmtRange);
  }
  fmt.addEventListener('mousedown', e => { if (e.target.closest('button, .fiq-fmt-chip')) e.preventDefault(); }, { signal }); // nie zabieraj zaznaczenia
  fmt.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    e.preventDefault();
    if (b.dataset.fmt) { closeFmtPanel(); QUICK[b.dataset.fmt] && QUICK[b.dataset.fmt](); }
    else if (b.dataset.panel) { if (fmtPanelKind === b.dataset.panel) closeFmtPanel(); else openFmtPanel(b.dataset.panel); }
  }, { signal });
  fmtApply.addEventListener('click', applyFmtPanel, { signal });
  fmtInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applyFmtPanel(); }
    if (e.key === 'Escape') { e.preventDefault(); closeFmtPanel(); restoreRange(); }
  }, { signal });
  // skróty w polu: Ctrl/Cmd+B/I/U — przeglądarka zrobiłaby to sama, ale bez `data-rich`
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || !fmtHost) return;
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); onSelection(); QUICK[k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline'](); }
  }, { signal });

  /* ===== Палитра блоков ===== */
  const pal = $('fiqPal'), palGrid = $('fiqPalGrid');
  const PAL_IC = { partners: '▦', gallery: '▣', textimg: '◧', stats: '＃', cards: '▤', quote: '❝', cta: '➔', logotext: '◉', steps: '☰' };
  palGrid.innerHTML = '';
  Object.keys(B).forEach(type => {
    const b = document.createElement('button');
    b.className = 'fiq-pal-item';
    b.innerHTML = `<span class="fiq-pal-ic">${PAL_IC[type] || '＋'}</span><span class="fiq-pal-name">${B[type].label}</span>`;
    b.addEventListener('click', () => {
      if (!palZone) return;
      const node = fromHTML(FIQ.renderBlock(type, B[type].make()));
      palZone.insertBefore(node, palZone.querySelector(':scope > .fiq-add'));
      enhanceBlock(node);
      pal.classList.remove('show'); palZone = null;
      checkDirty();
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    palGrid.appendChild(b);
  });
  $('fiqPalClose').addEventListener('click', () => { pal.classList.remove('show'); palZone = null; }, { signal });
  pal.addEventListener('click', e => { if (e.target === pal) { pal.classList.remove('show'); palZone = null; } }, { signal });

  /* ===== Полное включение редактирования над текущим DOM ===== */
  function enableEditing() {
    document.body.classList.add('fiq-edit');
    document.querySelectorAll('[data-edit]:not([data-edit-type="image"])').forEach(enhanceText);
    document.querySelectorAll('[data-edit-type="image"]').forEach(enhanceImg);
    document.querySelectorAll('[data-list] > [data-litem]').forEach(it => { addItemTb(it); it.querySelectorAll('[data-f]').forEach(enhanceText); });
    document.querySelectorAll('.fb').forEach(enhanceBlock);
    document.querySelectorAll('[data-hideable]').forEach(addHideTb);
    document.querySelectorAll('[data-list]').forEach(ensureListAdd);
    document.querySelectorAll('[data-zone]').forEach(ensureZoneAdd);
  }

  /* ===== Загрузка картинки (обе ветки: data-edit и data-fimg) ===== */
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0]; fileInput.value = '';
    if (!f || !imgTarget) return;
    const tgt = imgTarget; imgTarget = null;
    showToast('Wgrywanie obrazu…');
    const ext = (f.name.split('.').pop() || 'png').toLowerCase();
    const isFlat = tgt.hasAttribute('data-edit');
    const key = tgt.getAttribute('data-edit') || tgt.getAttribute('data-fimg') || 'img';
    const path = (isFlat ? 'logos/' : 'blocks/') + key + '-' + Date.now() + '.' + ext;
    const up = await sb.storage.from('site-assets').upload(path, f, { upsert: true, contentType: f.type || 'image/png' });
    if (up.error) { showToast('Błąd wgrywania: ' + up.error.message, true); return; }
    const pub = sb.storage.from('site-assets').getPublicUrl(path);
    tgt.src = pub.data.publicUrl;
    checkDirty();
    showToast('Obraz zaktualizowany ✓');
  }, { signal });

  async function save(asDraft) {
    if (!session) return;
    setStatus('saving');
    const content = collect();
    const patch = asDraft
      ? { draft: content, updated_at: new Date().toISOString(), updated_by: session.user.id }
      : { published: content, draft: null, updated_at: new Date().toISOString(), updated_by: session.user.id };
    const { error } = await sb.from('site_content').update(patch).eq('id', pageId);
    if (error) { showToast('Błąd zapisu: ' + error.message, true); checkDirty(); return; }
    baseline = serialize(content);
    loadedFrom = asDraft ? 'draft' : 'published';
    setStatus(asDraft ? 'draft' : 'saved');
    showToast(asDraft ? 'Zapisano wersję roboczą ✓' : 'Opublikowano na stronie ✓');
  }
  $('fiqSave').addEventListener('click', () => save(false), { signal });
  $('fiqSaveDraft').addEventListener('click', () => save(true), { signal });
  $('fiqLogout').addEventListener('click', async () => { await sb.auth.signOut(); onRequireLogin(false); }, { signal });

  const beforeUnload = e => {
    if (statusEl.classList.contains('dirty')) { e.preventDefault(); e.returnValue = ''; }
  };
  addEventListener('beforeunload', beforeUnload, { signal });

  // если в загруженном контенте нет _lists — выводим их из статичного DOM
  // (после применения flat-ключей), чтобы старый плоский контент перешёл в структуру
  function deriveLists() {
    const out = {};
    document.querySelectorAll('[data-list]').forEach(cont => {
      const name = cont.getAttribute('data-list');
      out[name] = Array.from(cont.children).filter(c => c.matches && c.matches('.svc-row, .who-item')).map(c => {
        if (name === 'svc') return { name: txt(c, '.svc-name'), desc: txt(c, '.svc-desc'), foot: txt(c, '.svc-foot'), chips: txt(c, '.svc-chips-src'), demo: c.getAttribute('data-demo') || '', hidden: false };
        const o = { tag: txt(c, '.who-tag'), h: txt(c, 'h3'), p: txt(c, 'p'), hidden: false };
        if (c.classList.contains('who-hero')) {
          o.cta = txt(c, '.wh-cta');
          o.s1l = txt(c, '.wh-stat:nth-child(1) .wh-stat-l'); o.s1v = txt(c, '.wh-stat:nth-child(1) .wh-stat-v span');
          o.s2l = txt(c, '.wh-stat:nth-child(2) .wh-stat-l'); o.s2v = txt(c, '.wh-stat:nth-child(2) .wh-stat-v span');
        }
        return o;
      });
    });
    return out;
  }

  /* ===== Hero: produkty pochodzą z katalogu, nie z CMS =====
     Karty w kuli to ta sama lista, z której liczy się audyt (`audit_catalog`),
     więc edytuje się je w /katalog, a nie tutaj — inaczej byłyby dwa źródła nazw
     i cen. Podgląd pokazujemy aktualny, żeby redaktor widział prawdę. */
  async function showHeroProducts() {
    const stage = document.getElementById('plStage');
    if (!stage) return;
    if (!stage.querySelector('.pl-cmshint')) {
      const hint = document.createElement('div');
      hint.className = 'pl-cmshint';
      hint.innerHTML = 'Produkty w kuli edytujesz w <a href="/katalog" target="_blank" rel="noreferrer">Katalogu produktów</a>'
        + ' — nazwy, opisy, kolejność i ukrywanie. Ta sama lista zasila audyty.';
      stage.appendChild(hint);
    }
    try {
      const { data } = await sb.from('landing_products').select('id,name,descr,grp,group_name,ord').order('ord');
      if (!destroyed) renderHeroProducts(data);
    } catch (_) { /* brak sieci — zostaje snapshot z markupu */ }
  }

  (async () => {
    const { data: { session: s } } = await sb.auth.getSession();
    if (destroyed) return;
    if (!s) { onRequireLogin(true); return; }
    session = s;
    userEl.textContent = s.user.email;
    let content = {};
    try {
      const { data } = await sb.from('site_content').select('published,draft').eq('id', pageId).maybeSingle();
      if (data) {
        if (data.draft) { content = data.draft; loadedFrom = 'draft'; }
        else if (data.published) { content = data.published; loadedFrom = 'published'; }
      }
    } catch (_) {}
    if (destroyed) return;
    if (!content || typeof content !== 'object') content = {};
    // 1-й проход: применяем flat-ключи к статичным строкам (для деривации _lists)
    FIQ.applyContent(content, { editor: true });
    (content._removed || []).forEach(k => removedKeys.add(k));
    if (!content._lists) content._lists = deriveLists();
    if (!content._blocks) content._blocks = {};
    // 2-й проход: перестраиваем списки/блоки уже в структурную форму
    FIQ.applyContent(content, { editor: true });
    enableEditing();
    // claim pod logo ma szerokość logo — w edytorze też, żeby podgląd nie kłamał
    fitNavClaim();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitNavClaim()).catch(() => {});
    await showHeroProducts();
    baseline = serialize(collect());
    setStatus(loadedFrom === 'draft' ? 'draft' : 'saved');
    gate.classList.add('hidden');
    bar.style.display = 'flex';
  })();

  return function destroy() {
    destroyed = true;
    ac.abort();
    if (fmt) fmt.classList.remove('show');
    clearTimeout(showToast._t);
    document.body.classList.remove('fiq-edit');
  };
}
