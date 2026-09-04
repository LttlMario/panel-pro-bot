import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';

const headersFor = (request: Request) => { const origin = String(request.headers.get('origin') || ''); const allowed = /^https?:\/\/(?:[a-z0-9-]+\.)*localhost(:\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) || origin === 'https://panel-pro.ro' || origin === 'https://bot.panel-pro.ro' ? origin : 'https://bot.panel-pro.ro'; return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', Vary: 'Origin' }; };
const reply = (request: Request, data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: headersFor(request) });
const routeChoices = [
  ['Anunțuri organizație', 'organization'], ['Anunțuri angajați', 'departments'], ['Pontaj', 'pontaj'], ['Log pontaj', 'log_pontaj'],
  ['Învoiri organizație', 'requests_organization'], ['Învoiri angajați', 'requests_departments'], ['Log învoiri organizație', 'log_requests_organization'], ['Log învoiri angajați', 'log_requests_departments'],
  ['Contracte', 'contracts'], ['Log contracte', 'log_contracts'], ['Marketplace legal', 'discovery_marketplace_legal'], ['Log Marketplace legal', 'log_marketplace'], ['Marketplace ilegal', 'illegal_marketplace'], ['Log Marketplace ilegal', 'log_illegal_marketplace'], ['Acțiuni organizație', 'actions_organization'], ['Log acțiuni organizație', 'log_actions_organization'], ['Evenimente și remindere', 'event_reminders'], ['Raport săptămânal contracte', 'contract_identity_weekly'], ['Status live', 'status_live'],
  ['Stash', 'stash'], ['Log Stash', 'log_stash'], ['Cereri Stash', 'stash_requests'], ['Log cereri Stash', 'log_stash_requests'], ['Donații Stash', 'stash_donations'], ['Log donații Stash', 'log_stash_donations'],
].map(([name, value]) => ({ name, value }));
const commands = [{
  name: 'panel', description: 'Afișează meniul și administrează Panel Pro', options: [
    { type: 1, name: 'status', description: 'Verifică toate canalele configurate' },
    { type: 1, name: 'publica', description: 'Publică un embed cu butoane', options: [{ type: 3, name: 'modul', description: 'Embedul de publicat', required: true, choices: [['Anunțuri organizație', 'organization'], ['Anunțuri angajați', 'departments'], ['Pontaj', 'pontaj'], ['Învoiri organizație', 'requests_organization'], ['Învoiri angajați', 'requests_departments'], ['Contracte', 'contracts'], ['Marketplace legal', 'discovery_marketplace_legal'], ['Marketplace ilegal', 'illegal_marketplace'], ['Evenimente și remindere', 'event_reminders'], ['Raport săptămânal contracte', 'contract_identity_weekly'], ['Status live', 'status_live'], ['Stash', 'stash'], ['Cereri Stash', 'stash_requests'], ['Donații Stash', 'stash_donations']].map(([name, value]) => ({ name, value })) }] },
    { type: 1, name: 'config', description: 'Configurează embedul și canalul de log', options: [{ type: 3, name: 'modul', description: 'Modulul pentru canal', required: true, choices: routeChoices }, { type: 7, name: 'canal', description: 'Canalul pentru embedul cu butoane', required: true, channel_types: [0] }, { type: 7, name: 'canal_log', description: 'Canalul pentru rezultate și loguri', required: false, channel_types: [0] }] },
  ],
}];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(request) });
  if (request.method !== 'POST') return reply(request, { error: 'Metodă invalidă.' }, 405);
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));
    let session: any = null;
    try { session = await requirePanelSession(db, request, 0, true); } catch (_) {}
    if (!session && body.access_token) { const response = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${String(body.access_token).slice(0, 500)}` } }); const user = response.ok ? await response.json().catch(() => ({})) : null; if (user?.id) session = { discord_id: String(user.id), organization_id: null }; }
    if (!session || !(await isPlatformAdminAccount(db, session.discord_id))) return reply(request, { error: 'Acces permis doar administratorului platformei.' }, 403);
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) return reply(request, { error: 'Tokenul botului Discord nu este configurat.' }, 409);
    // Discovery are Application ID separat de botul Panel Pro. Nu alegem
    // primul client_id din organizații, deoarece poate aparține celuilalt bot.
    let applicationId = String(Deno.env.get('DISCORD_DISCOVERY_APPLICATION_ID') || Deno.env.get('DISCORD_APPLICATION_ID') || '1531023771211792384').trim();
    if (!/^\d{15,22}$/.test(applicationId)) {
      const { data: setting, error } = await db.from('discovery_settings').select('discord_client_id').not('discord_client_id', 'is', null).neq('discord_client_id', '').limit(1).maybeSingle();
      if (error) throw error;
      applicationId = String(setting?.discord_client_id || '').trim();
    }
    if (!/^\d{15,22}$/.test(applicationId)) return reply(request, { error: 'Discord Application ID nu este configurat.' }, 409);
    const { data: globalSettings, error: globalSettingsError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
    if (globalSettingsError) throw globalSettingsError;
    const customCommands = Object.values(globalSettings?.custom_modules && typeof globalSettings.custom_modules === 'object' ? globalSettings.custom_modules : {})
      .filter((module: any) => module?.active !== false && /^[a-z0-9_-]{1,32}$/.test(String(module?.command_name || '').trim().toLowerCase()))
      .slice(0, 10)
      .map((module: any) => ({ type: 1, name: String(module.command_name).trim().toLowerCase(), description: String(module.label || 'Modul Panel Pro').trim().slice(0, 100) }));
    const syncedCommands = [{ ...commands[0], options: [...commands[0].options, ...customCommands] }];
    const requestInit = { method: 'PUT', headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(syncedCommands) };
    const globalResponse = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, requestInit);
    if (!globalResponse.ok) return reply(request, { error: `Discord a respins comenzile globale (HTTP ${globalResponse.status}).`, details: await globalResponse.text() }, 400);
    const { data: guilds, error: guildsError } = await db.from('discovery_guilds').select('guild_id').eq('enabled', true);
    if (guildsError) throw guildsError;
    const guildResults = [];
    const syncedGuildIds = new Set<string>();
    for (const guild of guilds || []) {
      const guildId = String(guild.guild_id || '').trim();
      if (!/^\d{15,22}$/.test(guildId)) continue;
      const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, requestInit);
      guildResults.push({ guild_id: guildId, ok: response.ok, status: response.status });
      syncedGuildIds.add(guildId);
    }
    // Actualizează și serverele în care botul este instalat, chiar dacă încă
    // nu au fost asociate unei organizații în Supabase. Astfel o comandă de
    // server veche nu mai suprascrie lista globală actualizată.
    const botGuildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers: { Authorization: `Bot ${botToken}` } });
    if (botGuildsResponse.ok) {
      const botGuilds = await botGuildsResponse.json().catch(() => []);
      for (const guild of Array.isArray(botGuilds) ? botGuilds : []) {
        const guildId = String(guild?.id || '').trim();
        if (!/^\d{15,22}$/.test(guildId) || syncedGuildIds.has(guildId)) continue;
        const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, requestInit);
        guildResults.push({ guild_id: guildId, ok: response.ok, status: response.status });
        syncedGuildIds.add(guildId);
      }
    }
    if (session.organization_id) await db.from('discovery_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'discord_commands_synced', target_type: 'discord_application', target_id: applicationId, details: { command_count: syncedCommands.length, custom_command_count: customCommands.length, scope: 'global_and_configured_guilds', guild_count: guildResults.length } });
    const failedGuilds = guildResults.filter((item) => !item.ok).length;
    return reply(request, { ok: true, application_id: applicationId, command_count: syncedCommands.length, custom_command_count: customCommands.length, guild_count: guildResults.length, failed_guilds: failedGuilds, scope: 'global_and_configured_guilds', message: `Comenzile botului Discovery (${applicationId}) au fost sincronizate global și pe ${guildResults.length} server${guildResults.length === 1 ? '' : 'e'} configurat${guildResults.length === 1 ? '' : 'e'}. Pe serverele configurate ar trebui să apară imediat.` });
  } catch (error) { return reply(request, { error: error instanceof Error ? error.message : 'Eroare internă.' }, 400); }
});
