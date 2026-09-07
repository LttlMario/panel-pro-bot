import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const DISCORD_PUBLIC_KEY = () => String(Deno.env.get('DISCORD_PUBLIC_KEY') || Deno.env.get('DISCORD_APPLICATION_PUBLIC_KEY') || '').trim();
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());
const hexBytes = (value: string, length: number) => {
  if (!new RegExp(`^[0-9a-f]{${length * 2}}$`, 'i').test(value)) return null;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
async function claimNotification(db: any, organizationId: string, eventKey: string, eventType: string, guildId: string) {
  const { data } = await db.from('discovery_discord_notification_events').insert({ organization_id: organizationId, event_key: eventKey, event_type: eventType, guild_id: guildId }).select('event_key').maybeSingle();
  return Boolean(data?.event_key);
}

async function verifySignature(request: Request, rawBody: string) {
  const publicKey = hexBytes(DISCORD_PUBLIC_KEY(), 32);
  const signature = hexBytes(String(request.headers.get('x-signature-ed25519') || '').trim(), 64);
  const timestamp = String(request.headers.get('x-signature-timestamp') || '').trim();
  if (!publicKey || !signature || !/^\d{1,20}$/.test(timestamp)) return false;
  try {
    const key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, new TextEncoder().encode(`${timestamp}${rawBody}`));
  } catch (error) {
    console.error('[discord-app-events] signature verification failed', error);
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Metoda nu este permisă.' }, 405);
  const rawBody = await request.text();
  if (!(await verifySignature(request, rawBody))) return json({ error: 'Semnătură Discord invalidă.' }, 401);
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return json({ error: 'Payload invalid.' }, 400); }
  if (Number(body?.type) === 0) return new Response(null, { status: 204 });
  if (Number(body?.type) !== 1 || !body?.event?.type) return new Response(null, { status: 204 });
  const event = body.event;
  const data = event.data || {};
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default);
  const eventType = String(event.type);
  const guild = data.guild || {};
  const guildId = String(guild.id || data.guild_id || '').trim();
  // Premium Apps sends entitlement lifecycle events through the same app
  // events endpoint. Persist the latest guild entitlement so all bot
  // interactions and the Panel Pro dashboard see the purchase immediately.
  if (['ENTITLEMENT_CREATE', 'ENTITLEMENT_UPDATE', 'ENTITLEMENT_DELETE'].includes(eventType)) {
    const entitlementId = String(data.id || '').trim();
    const entitlementGuildId = String(data.guild_id || guildId).trim();
    const skuId = String(data.sku_id || '').trim();
    if (!id(entitlementGuildId) || !entitlementId || !/^\d{15,22}$/.test(skuId)) return new Response(null, { status: 204 });
    const { data: linked, error: linkedError } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', entitlementGuildId).eq('enabled', true).maybeSingle();
    if (linkedError) throw linkedError;
    if (!linked?.organization_id) return new Response(null, { status: 204 });
    const isDeleted = eventType === 'ENTITLEMENT_DELETE' || data.deleted === true;
    const startsAt = data.starts_at || new Date().toISOString();
    const endsAt = data.ends_at || null;
    const { data: existing } = await db.from('discovery_guild_entitlements').select('id').eq('guild_id', entitlementGuildId).eq('organization_id', linked.organization_id).eq('sku_id', skuId).eq('raw_entitlement->>id', entitlementId).maybeSingle();
    const payload = {
      guild_id: entitlementGuildId,
      organization_id: linked.organization_id,
      sku_id: skuId,
      owner_type: 2,
      purchaser_user_id: data.user_id || null,
      active: !isDeleted,
      starts_at: startsAt,
      ends_at: endsAt,
      raw_entitlement: data,
      updated_at: new Date().toISOString(),
    };
    const result = existing?.id
      ? await db.from('discovery_guild_entitlements').update(payload).eq('id', existing.id)
      : await db.from('discovery_guild_entitlements').insert(payload);
    if (result.error) throw result.error;
    await db.from('discovery_lifecycle_events').insert({
      organization_id: linked.organization_id,
      event_type: `discord_${eventType.toLowerCase()}`,
      actor_discord_id: data.user_id || null,
      details: { entitlement_id: entitlementId, guild_id: entitlementGuildId, sku_id: skuId, active: !isDeleted },
    });
    const { data: settings } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', linked.organization_id).maybeSingle();
    const channelId = String(settings?.discord_channel_routes?.billing_thanks?.primary?.channel_id || '').trim();
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (/^\d{15,22}$/.test(channelId) && botToken && await claimNotification(db, linked.organization_id, `entitlement:${entitlementId}:${eventType}`, 'entitlement', entitlementGuildId)) {
      const purchasedBy = data.user_id ? `<@${data.user_id}>` : 'comunitatea ta';
      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: 'POST', headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ allowed_mentions: { users: data.user_id ? [String(data.user_id)] : [] }, embeds: [{ title: isDeleted ? '🔔 Abonamentul Panel Pro s-a încheiat' : '🎉 Mulțumim pentru activarea planului!', description: isDeleted ? `Abonamentul pentru ${purchasedBy} nu mai este activ. Funcțiile Premium se actualizează automat.` : `Mulțumim, ${purchasedBy}! **Panel Pro Premium** este activ pentru serverul tău.`, fields: [{ name: 'Ce urmează', value: isDeleted ? 'Poți reactiva abonamentul oricând din pagina Premium.' : 'Funcțiile eligibile se activează automat. Poți verifica statusul din dashboard.', inline: false }, { name: 'Suport', value: 'Pentru ajutor, deschide un ticket în canalul de suport.', inline: false }], color: isDeleted ? 0xef4444 : 0xf59e0b, footer: { text: 'Panel Pro · confirmare abonament' }, timestamp: new Date().toISOString() }] }) });
      if (!response.ok) console.error('[discord-app-events] billing message failed', response.status);
    }
    return new Response(null, { status: 204 });
  }
  if (eventType === 'APPLICATION_AUTHORIZED' && Number(data.integration_type) === 0 && id(guildId)) {
    const { data: linked } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
    const now = String(event.timestamp || new Date().toISOString());
    const { error } = await db.from('discovery_bot_installations').upsert({
      guild_id: guildId,
      guild_name: String(guild.name || `Server Discord ${guildId}`).trim().slice(0, 120),
      authorized_by_discord_id: id(data.user?.id) ? String(data.user.id) : null,
      organization_id: linked?.organization_id || null,
      integration_type: 0,
      status: 'active',
      installed_at: now,
      removed_at: null,
      last_event_at: now,
      raw_event: body,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'guild_id' });
    if (error) { console.error('[discord-app-events] install upsert failed', error); return json({ error: 'Nu s-a putut salva instalarea.' }, 500); }
    if (linked?.organization_id) {
      const { data: settings } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', linked.organization_id).maybeSingle();
      const channelId = String(settings?.discord_channel_routes?.billing_thanks?.primary?.channel_id || '').trim();
      const botToken = await getPlatformSecret(db, 'discord_bot_token');
      if (/^\d{15,22}$/.test(channelId) && botToken && await claimNotification(db, linked.organization_id, `installation:${guildId}`, 'installation', guildId)) {
        const { data: trialSetting } = await db.from('discovery_app_settings').select('value').eq('organization_id', linked.organization_id).eq('key', 'discord_trial').maybeSingle();
        const trialActive = Date.parse(String(trialSetting?.value?.ends_at || '')) > Date.now();
        const planText = trialActive ? 'perioada Trial' : 'planul gratuit';
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: 'POST', headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: trialActive ? '🧪 Mulțumim pentru activarea Trialului!' : '💙 Mulțumim că ești alături de Panel Pro!', description: `Serverul tău folosește ${planText} Panel Pro. Îți mulțumim că faci parte din comunitate! Funcțiile eligibile sunt disponibile automat.`, color: trialActive ? 0x8b5cf6 : 0x3b82f6, footer: { text: 'Panel Pro · comunitate' }, timestamp: new Date().toISOString() }] }) });
        if (!response.ok) console.error('[discord-app-events] free welcome message failed', response.status);
      }
    }
  }
  // Discord's deauthorization event contains the user, but not a guild. It is
  // intentionally not used to remove guild rows because a user can deauthorize
  // while the bot remains installed in a server.
  return new Response(null, { status: 204 });
});
