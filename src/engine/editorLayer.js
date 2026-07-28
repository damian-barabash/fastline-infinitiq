// Слой визуального редактора: contenteditable, тулбары, палитра блоков,
// сбор контента и сохранение (published/draft). Перенос 1:1 из editor.html.
// Адаптация: sb-клиент и редиректы приходят из React, cleanup для SPA.
export function initEditorLayer({ sb, onRequireLogin }) {

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
    document.querySelectorAll('[data-edit]').forEach(el => {
      if (el.closest('[data-list]') || el.closest('[data-zone]')) return; // динамику собираем отдельно
      const k = el.getAttribute('data-edit'), t = el.getAttribute('data-edit-type');
      if (t === 'image') o[k] = el.tagName === 'IMG' ? (el.getAttribute('src') || '') : '';
      else if (t === 'html') o[k] = el.innerHTML.trim();
      else o[k] = el.textContent.trim();
    });
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
      if (e.key === 'Enter' && el.getAttribute('data-edit-type') !== 'html') { e.preventDefault(); el.blur(); }
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
    tb.appendChild(tbi('✕', 'Usuń', () => { const p = item.parentNode; item.remove(); renumber(p); checkDirty(); }, 'del'));
    item.appendChild(tb);
  }
  function addHideTb(el) {
    if (el.querySelector(':scope > .fiq-tb')) return;
    const tb = document.createElement('span'); tb.className = 'fiq-tb';
    tb.appendChild(tbi('◉', 'Ukryj / pokaż', s => { el.classList.toggle('fiq-hidden'); s.classList.toggle('on', el.classList.contains('fiq-hidden')); checkDirty(); }));
    el.appendChild(tb);
  }
  function addBlockTb(block) {
    if (block.querySelector(':scope > .fiq-tb')) return;
    const tb = document.createElement('span'); tb.className = 'fiq-tb';
    tb.appendChild(tbi('↑', 'W górę', () => { const p = block.previousElementSibling; if (p && p.matches('.fb')) { block.parentNode.insertBefore(block, p); checkDirty(); } }));
    tb.appendChild(tbi('↓', 'W dół', () => { const n = block.nextElementSibling; if (n && n.matches('.fb')) { block.parentNode.insertBefore(n, block); checkDirty(); } }));
    if (block.hasAttribute('data-flip')) tb.appendChild(tbi('⇄', 'Odbij', s => { const f = block.getAttribute('data-flip') === '1'; block.setAttribute('data-flip', f ? '0' : '1'); const sp = block.querySelector('.fb-split'); if (sp) sp.classList.toggle('fb-flip', !f); s.classList.toggle('on', !f); checkDirty(); }));
    tb.appendChild(tbi('◉', 'Ukryj / pokaż', s => { block.classList.toggle('fiq-hidden'); s.classList.toggle('on', block.classList.contains('fiq-hidden')); checkDirty(); }));
    tb.appendChild(tbi('✕', 'Usuń blok', () => { block.remove(); checkDirty(); }, 'del'));
    block.appendChild(tb);
  }

  /* ===== Кнопки добавления ===== */
  function ensureListAdd(cont) {
    if (cont.querySelector(':scope > .fiq-add')) return;
    const name = cont.getAttribute('data-list');
    const btn = document.createElement('button');
    btn.className = 'fiq-add';
    btn.textContent = name === 'svc' ? '＋ Krok' : '＋ Karta';
    btn.addEventListener('click', e => {
      e.preventDefault();
      const idx = cont.querySelectorAll(':scope > [data-litem]').length;
      const html = name === 'svc'
        ? FIQ.buildSvcRow({ name: 'Nowy krok', desc: 'Opis kroku.', demo: '' }, idx)
        : FIQ.buildWhoCard({ h: 'Nowa pozycja', p: 'Opis.' }, idx);
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
    // подсказка в пустой демо-панели (демо-движок в редакторе не работает)
    const db = $('svcDemoBody');
    if (db && !db.children.length) db.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#666;line-height:1.7">// podgląd demo działa na żywej stronie<br>// kliknij ikonę oka, aby ukryć cały panel</div>';
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
    const { error } = await sb.from('site_content').update(patch).eq('id', 'index');
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
        if (name === 'svc') return { name: txt(c, '.svc-name'), desc: txt(c, '.svc-desc'), demo: c.getAttribute('data-demo') || '', hidden: false };
        return { h: txt(c, 'h3'), p: txt(c, 'p'), hidden: false };
      });
    });
    return out;
  }

  (async () => {
    const { data: { session: s } } = await sb.auth.getSession();
    if (destroyed) return;
    if (!s) { onRequireLogin(true); return; }
    session = s;
    userEl.textContent = s.user.email;
    let content = {};
    try {
      const { data } = await sb.from('site_content').select('published,draft').eq('id', 'index').maybeSingle();
      if (data) {
        if (data.draft) { content = data.draft; loadedFrom = 'draft'; }
        else if (data.published) { content = data.published; loadedFrom = 'published'; }
      }
    } catch (_) {}
    if (destroyed) return;
    if (!content || typeof content !== 'object') content = {};
    // 1-й проход: применяем flat-ключи к статичным строкам (для деривации _lists)
    FIQ.applyContent(content, { editor: true });
    if (!content._lists) content._lists = deriveLists();
    if (!content._blocks) content._blocks = {};
    // 2-й проход: перестраиваем списки/блоки уже в структурную форму
    FIQ.applyContent(content, { editor: true });
    enableEditing();
    baseline = serialize(collect());
    setStatus(loadedFrom === 'draft' ? 'draft' : 'saved');
    gate.classList.add('hidden');
    bar.style.display = 'flex';
  })();

  return function destroy() {
    destroyed = true;
    ac.abort();
    clearTimeout(showToast._t);
    document.body.classList.remove('fiq-edit');
  };
}
