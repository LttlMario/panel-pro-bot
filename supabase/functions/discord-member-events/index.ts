import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const API = 'https://discord.com/api/v10';
const id = (v: unknown) => /^\d{15,22}$/.test(String(v || ''));
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const esc = (v: unknown) => String(v || '').slice(0, 100);

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Metoda nu este permisă.' }, 405);
  const cronSecret = String(Deno.env.get('CRON_SECRET') || '').trim();
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'Neautorizat.' }, 401);
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
  const token = await getPlatformSecret(db, 'discord_bot_token');
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
  const get = async (path: string) => { const r = await fetch(API + path, { headers }); if (!r.ok) throw new Error(`Discord API ${path} HTTP ${r.status}`); return r.json(); };
  const post = async (channelId: string, body: any) => { if (!id(channelId)) return; const r = await fetch(`${API}/channels/${channelId}/messages`, { method: 'POST', headers, body: JSON.stringify(body) }); if (!r.ok) console.error('[discord-member-events] message failed', r.status, await r.text().catch(() => '')); };
  const { data: installs, error } = await db.from('discovery_bot_installations').select('guild_id,organization_id').eq('status', 'active').not('organization_id', 'is', null);
  if (error) throw error;
  let joins = 0, leaves = 0, promotions = 0, guilds = 0;
  for (const install of installs || []) {
    const guildId = String(install.guild_id || ''), organizationId = String(install.organization_id || ''); if (!id(guildId) || !organizationId) continue;
    const { data: settings } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
    const routes = settings?.discord_channel_routes || {};
    const route = (key: string) => String(routes?.[key]?.primary?.channel_id || '');
    const members: any[] = []; let after = '';
    for (let page = 0; page < 20; page++) { const batch = await get(`/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`); if (!Array.isArray(batch) || !batch.length) break; members.push(...batch); if (batch.length < 1000) break; after = String(batch.at(-1)?.user?.id || ''); if (!after) break; }
    const { data: previous } = await db.from('discovery_discord_member_snapshots').select('discord_id,username,display_name,role_ids').eq('guild_id', guildId);
    const old = new Map((previous || []).map((m: any) => [String(m.discord_id), m]));
    const current = new Map<string, any>();
    for (const member of members) { const uid = String(member?.user?.id || ''); if (!id(uid)) continue; const user = member.user || {}; const row = { guild_id: guildId, organization_id: organizationId, discord_id: uid, username: esc(user.username || uid), display_name: esc(member.nick || user.global_name || user.username || uid), role_ids: Array.isArray(member.roles) ? member.roles.map(String) : [], last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }; current.set(uid, row); const prior = old.get(uid); if (prior) { const before = new Set((Array.isArray(prior.role_ids) ? prior.role_ids : []).map(String)); const added = row.role_ids.filter((role: string) => !before.has(role)); if (added.length && route('community_promotions')) { await post(route('community_promotions'), { allowed_mentions: { users: [uid] }, embeds: [{ title: '📈 Avansare / rol nou', description: `Felicitări, <@${uid}>! Ai primit un rol nou pe server.`, fields: [{ name: 'Membru', value: `<@${uid}>`, inline: true }, { name: 'Roluri adăugate', value: added.map((r: string) => `<@&${r}>`).join(', ').slice(0, 1024), inline: true }], color: 0xf59e0b, footer: { text: 'Panel Pro · notificări comunitate' }, timestamp: new Date().toISOString() }] }); promotions++; } } else if (old.size > 0 && route('community_welcome')) { await post(route('community_welcome'), { allowed_mentions: { users: [uid] }, embeds: [{ title: '👋 Bun venit!', description: `Bine ai venit pe server, <@${uid}>! Explorează canalele și deschide un ticket dacă ai nevoie de ajutor.`, fields: [{ name: 'Membru nou', value: `<@${uid}>`, inline: true }, { name: 'Următorul pas', value: 'Citește regulile și ghidul serverului.', inline: true }], color: 0x22c55e, footer: { text: 'Panel Pro · comunitate' }, timestamp: new Date().toISOString() }] }); joins++; } }
    for (const [uid, prior] of old) if (!current.has(uid) && route('community_departures')) { await post(route('community_departures'), { allowed_mentions: { parse: [] }, embeds: [{ title: '🚪 Membru plecat', description: `**${esc(prior.display_name || prior.username || uid)}** a părăsit serverul.`, color: 0xef4444, footer: { text: 'Panel Pro · notificări comunitate' }, timestamp: new Date().toISOString() }] }); leaves++; }
    if (current.size) await db.from('discovery_discord_member_snapshots').upsert([...current.values()], { onConflict: 'guild_id,discord_id' });
    if (old.size) { const gone = [...old.keys()].filter((uid) => !current.has(uid)); if (gone.length) await db.from('discovery_discord_member_snapshots').delete().eq('guild_id', guildId).in('discord_id', gone); }
    guilds++;
  }
  return json({ ok: true, guilds, joins, leaves, promotions });
});
