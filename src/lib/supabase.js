import { createClient } from '@supabase/supabase-js';

export const SB_URL = 'https://ogxajgbrbkfwsactlsyj.supabase.co';
export const SB_KEY = 'sb_publishable_LIxIzg1U34aKQ-wXBSaDHg_xzv8SyMM';

let pub = null;
let auth = null;

// публичный клиент (лендинг, страница аудита) — без сессии
export function sbPublic() {
  if (!pub) pub = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  return pub;
}

// клиент редактора — долгая сессия (как в старом editor.html)
export function sbAuth() {
  if (!auth) auth = createClient(SB_URL, SB_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fiq-editor-auth' },
  });
  return auth;
}
