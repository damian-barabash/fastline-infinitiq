/* Wywołania edge `billing` (koszyk, status zamówienia, bramka testowa). */
import { SB_URL, SB_KEY } from './supabase-config.js';

export async function billing(action, body = {}) {
  const r = await fetch(`${SB_URL}/functions/v1/billing`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok && r.status >= 500) throw new Error(data.detail || data.error || String(r.status));
  return data;
}
