import { getPlatformSecret } from './platform-secrets.ts';

const parsePlatformOwnerIds = (value: unknown) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter((item) => /^\d{15,22}$/.test(item));

export const isPlatformAdminDiscordId = (discordId: unknown) =>
  parsePlatformOwnerIds(Deno.env.get('PLATFORM_OWNER_DISCORD_IDS')).includes(String(discordId || '').trim());

export async function getPlatformAdminDiscordIds(db: any) {
  // Administratorul global este controlat de secretul Supabase exact cu acest nume.
  const configured = parsePlatformOwnerIds(
    Deno.env.get('PLATFORM_OWNER_DISCORD_IDS') || await getPlatformSecret(db, 'platform_owner_discord_ids'),
  );
  return [...new Set(configured)];
}

export async function isPlatformAdminAccount(db: any, discordId: unknown) {
  const normalizedId = String(discordId || '').trim();
  if (!normalizedId) return false;
  if ((await getPlatformAdminDiscordIds(db)).includes(normalizedId)) return true;
  // Păstrează accesul administratorilor deja validați în Supabase chiar dacă
  // secretul de configurare a fost rotit sau lipsește temporar din funcție.
  const { data, error } = await db.from('discovery_platform_admins').select('discord_id').eq('discord_id', normalizedId).eq('active', true).maybeSingle();
  if (error) {
    if (error.code === '42P01') return false;
    throw error;
  }
  return Boolean(data?.discord_id);
}

export async function isPlatformUserBanned(db: any, discordId: unknown) {
  const normalizedId = String(discordId || '').trim();
  const { data, error } = await db.from('discovery_platform_user_bans')
    .select('discord_id,reason')
    .eq('discord_id', normalizedId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
