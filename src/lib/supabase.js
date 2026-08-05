import { createClient } from '@supabase/supabase-js';
import { SB_URL, SB_KEY } from './supabase-config.js';

export { SB_URL, SB_KEY };

let pub = null;
let auth = null;

// публичный клиент (страница аудита) — без сессии; лендинг ходит в REST
// напрямую через supabase-config.js и supabase-js не тянет
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
