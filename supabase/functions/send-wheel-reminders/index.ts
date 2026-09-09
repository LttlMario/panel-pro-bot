import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const API = 'https://discord.com/api/v10';
const headers = { 'Access-Control-Allow-Origin': 'https://panel-pro.ro', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const botHeaders = (token: string) => ({ Authorization: `Bot ${token}`, 'User-Agent': 'Panel Pro Discord Bot (+https://panel-pro.ro)', 'Content-Type': 'application/json' });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const expected = Deno.env.get('PANEL_PRO_CRON_SECRET') || await getPlatformSecret(createClient(Deno.env.get('SUPABASE_URL')!, serviceKey()), 'panel_pro_cron_secret');
  const supplied = request.headers.get('x-cron-secret') || '';
  if (expected && supplied !== expected) return reply({ error: 'Acces cron neautorizat.' }, 401);
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const { data: due, error } = await db.from('discovery_wheel_reminders').select('id,organization_id,guild_id,discord_id,due_at').eq('status', 'pending').lte('due_at', new Date().toISOString()).order('due_at', { ascending: true }).limit(100);
    if (error) throw error;
    if (!due?.length) return reply({ ok: true, processed: 0 });
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) throw new Error('Tokenul botului Discord nu este configurat.');
    let sent = 0; let failed = 0;
    for (const reminder of due) {
      const { data: claimed } = await db.from('discovery_wheel_reminders').update({ status: 'sending', updated_at: new Date().toISOString(), last_error: null }).eq('id', reminder.id).eq('status', 'pending').select('id').maybeSingle();
      if (!claimed?.id) continue;
      try {
        const dmChannel = await fetch(`${API}/users/@me/channels`, { method: 'POST', headers: botHeaders(botToken), body: JSON.stringify({ recipient_id: String(reminder.discord_id) }) });
        const dm = await dmChannel.json().catch(() => ({}));
        if (!dmChannel.ok || !dm?.id) throw new Error(`Discord DM channel HTTP ${dmChannel.status}`);
        const message = await fetch(`${API}/channels/${dm.id}/messages`, { method: 'POST', headers: botHeaders(botToken), body: JSON.stringify({ content: '🎡 Au trecut 6 ore de la ultima apăsare „Am dat la roată”. Poți da din nou la roată.' }) });
        if (!message.ok) { const detail = await message.json().catch(() => ({})); throw new Error(String(detail?.message || `Discord DM HTTP ${message.status}`)); }
        await db.from('discovery_wheel_reminders').update({ status: 'sent', notified_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }).eq('id', reminder.id);
        sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.from('discovery_wheel_reminders').update({ status: 'pending', updated_at: new Date().toISOString(), last_error: message.slice(0, 500) }).eq('id', reminder.id);
        failed++;
      }
    }
    return reply({ ok: true, processed: sent + failed, sent, failed });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});