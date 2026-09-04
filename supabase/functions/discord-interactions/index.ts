import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { resolvePackageFeatures } from '../_shared/package-features.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, requestDiscordTarget, routeCandidates } from '../_shared/discord-delivery.ts';
import { discordPremiumAccess, discordPremiumButton, discordPremiumConfigured, discordPremiumMessage, discordPremiumModule } from '../_shared/discord-premium.ts';
import { readGlobalModules } from '../_shared/global-bot-settings.ts';

const DISCORD_PUBLIC_KEY = () => String(Deno.env.get('DISCORD_PUBLIC_KEY') || Deno.env.get('DISCORD_APPLICATION_PUBLIC_KEY') || '').trim();
const DISCORD_API = 'https://discord.com/api/v10';
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const interactionMessage = (content: string, extra: Record<string, unknown> = {}) => ({ type: 4, data: { content, flags: 64, ...extra } });
const commandSubcommand = (interaction: any) => Array.isArray(interaction?.data?.options) ? interaction.data.options.find((option: any) => option?.type === 1) : null;
const commandOptions = (interaction: any) => Array.isArray(commandSubcommand(interaction)?.options) ? commandSubcommand(interaction).options : (Array.isArray(interaction?.data?.options) ? interaction.data.options : []);
const commandOption = (interaction: any, name: string) => commandOptions(interaction).find((option: any) => option?.name === name)?.value;
const PANEL_ROUTE_LABELS: Record<string, string> = {
  organization: 'Anunțuri organizație', departments: 'Anunțuri angajați', pontaj: 'Pontaj', log_pontaj: 'Log pontaj',
  requests_organization: 'Învoiri organizație', requests_departments: 'Învoiri angajați', log_requests_organization: 'Log învoiri organizație', log_requests_departments: 'Log învoiri angajați',
  contracts: 'Contracte', log_contracts: 'Log contracte', marketplace: 'Marketplace legal', log_marketplace: 'Log Marketplace legal', illegal_marketplace: 'Marketplace ilegal', log_illegal_marketplace: 'Log Marketplace ilegal', actions_organization: 'Acțiuni organizație', log_actions_organization: 'Log acțiuni organizație', actions_organization_weekly: 'Log acțiuni', status_live: 'Status live',
  stash: 'Stash', log_stash: 'Log Stash', stash_requests: 'Cereri Stash', log_stash_requests: 'Log cereri Stash', stash_donations: 'Donații Stash', log_stash_donations: 'Log donații Stash', event_reminders: 'Evenimente și remindere', contract_identity_weekly: 'Raport săptămânal contracte', log_contract_identity_weekly: 'Log raport săptămânal contracte',
};
const panelRouteKeys = Object.keys(PANEL_ROUTE_LABELS);
const PANEL_LOG_ROUTES: Record<string, string> = {
  organization: 'log_announcements_organization', departments: 'log_announcements_departments', pontaj: 'log_pontaj',
  requests_organization: 'log_requests_organization', requests_departments: 'log_requests_departments', contracts: 'log_contracts', marketplace: 'log_marketplace', illegal_marketplace: 'log_illegal_marketplace',
  actions_organization: 'log_actions_organization', stash: 'log_stash', stash_requests: 'log_stash_requests', stash_donations: 'log_stash_donations', event_reminders: 'log_event_reminders', contract_identity_weekly: 'log_contract_identity_weekly',
};
const isDiscordManager = (interaction: any) => {
  try { return (BigInt(String(interaction?.member?.permissions || '0')) & 40n) !== 0n; } catch { return false; }
};
async function isGuildOwner(db: any, guildId: string, discordId: string) {
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}`, { headers: { Authorization: `Bot ${botToken}` } });
  if (!response.ok) return false;
  const guild = await response.json().catch(() => ({}));
  return String(guild?.owner_id || '') === String(discordId);
}
async function botAccessOrganization(db: any, interaction: any) {
  const guildId = String(interaction?.guild_id || '');
  const discordId = String(interaction?.member?.user?.id || interaction?.user?.id || '');
  const { data: guild, error } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (error) throw error;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  if (!(await isGuildOwner(db, guildId, discordId))) throw new Error('Doar ownerul serverului poate modifica rolurile de configurare.');
  return { guildId, discordId, organizationId: String(guild.organization_id) };
}
async function botAccessRolePicker(db: any, interaction: any) {
  const context = await botAccessOrganization(db, interaction);
  const [{ data: setting, error: settingError }, { data: roles, error: rolesError }] = await Promise.all([
    db.from('discovery_app_settings').select('value').eq('organization_id', context.organizationId).eq('key', 'discord_bot_admin_roles').maybeSingle(),
    (async () => { const token = await getPlatformSecret(db, 'discord_bot_token'); const response = await fetch(`${DISCORD_API}/guilds/${context.guildId}/roles`, { headers: { Authorization: `Bot ${token}` } }); return response.ok ? { data: await response.json(), error: null } : { data: [], error: new Error(`Rolurile Discord nu pot fi citite (HTTP ${response.status}).`) }; })(),
  ]);
  if (settingError) throw settingError;
  if (rolesError) throw rolesError;
  const selected = Array.isArray(setting?.value?.role_ids) ? setting.value.role_ids.map(String) : [];
  const roleText = selected.length ? selected.map((roleId: string) => `<@&${roleId}>`).join(', ') : 'doar ownerul';
  const available = (Array.isArray(roles) ? roles : []).filter((role: any) => !role.managed && /^\d{15,22}$/.test(String(role.id))).map((role: any) => ({ id: String(role.id), name: String(role.name || role.id).slice(0, 100) }));
  return interactionMessage('', { embeds: [{ title: '🔐 Acces configurare bot Discovery', description: `Roluri autorizate în prezent: ${roleText}.\n\nSelectează rolurile care vor putea deschide și configura botul în pagina web. Dacă nu alegi niciun rol, accesul rămâne doar pentru owner.`, color: 0xf59e0b, footer: { text: `Roluri disponibile: ${available.length}` } }], components: [{ type: 1, components: [{ type: 6, custom_id: 'panel:bot_access:select', placeholder: 'Alege rolurile autorizate', min_values: 0, max_values: Math.min(25, Math.max(1, available.length)) }] }, { type: 1, components: [{ type: 2, style: 3, label: 'Salvează rolurile', custom_id: 'panel:bot_access:save' }] }] });
}
async function saveBotAccessRoles(db: any, interaction: any) {
  const context = await botAccessOrganization(db, interaction);
  const roleIds = Array.isArray(interaction?.data?.values) ? [...new Set(interaction.data.values.map((value: any) => String(value)).filter((value: string) => /^\d{15,22}$/.test(value)))].slice(0, 25) : [];
  const token = await getPlatformSecret(db, 'discord_bot_token');
  const rolesResponse = await fetch(`${DISCORD_API}/guilds/${context.guildId}/roles`, { headers: { Authorization: `Bot ${token}` } });
  const roles = rolesResponse.ok ? await rolesResponse.json().catch(() => []) : [];
  const available = new Set((Array.isArray(roles) ? roles : []).filter((role: any) => !role.managed).map((role: any) => String(role.id)));
  if (roleIds.some((roleId: string) => !available.has(roleId))) throw new Error('Unul dintre rolurile selectate nu mai există pe server.');
  const { error } = await db.from('discovery_app_settings').upsert({ organization_id: context.organizationId, key: 'discord_bot_admin_roles', value: { role_ids: roleIds }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
  if (error) throw error;
  return interactionMessage(`Accesul la configurarea botului a fost salvat. Roluri autorizate: ${roleIds.length ? roleIds.map((roleId: string) => `<@&${roleId}>`).join(', ') : 'doar ownerul'}.`);
}
function discoveryReminderModal() {
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number, value = '') => ({ type: 4, custom_id, label, style, required, placeholder, max_length, ...(value ? { value } : {}) });
  return { type: 9, data: { custom_id: 'panel:discovery:reminder_submit', title: 'Adaugă eveniment și reminder', components: [input('title', 'Titlu eveniment', 1, true, 'Ex: Car Meet', 160), input('event_date', 'Data (zz.ll.aaaa)', 1, true, '20.09.2026', 10, romanianDisplayDate()), input('reminder_days', 'Durata reminderului în zile', 1, false, '14', 4), input('details', 'Detalii / notițe', 2, false, 'Locație, oră și informații utile', 1200)].map((field) => ({ type: 1, components: [field] })) } };
}
function discoveryDisplayDate(value: string) {
  const raw = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  return /^\d{2}\.\d{2}\.\d{4}$/.test(raw) ? raw : raw;
}
async function createDiscoveryReminder(db: any, interaction: any) {
  const guildId = String(interaction.guild_id || '');
  const discordId = String(interaction.member?.user?.id || interaction.user?.id || '');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const values = modalValues(interaction);
  const title = String(values.title || '').trim().slice(0, 160);
  const eventDate = String(values.event_date || '').trim();
  const details = String(values.details || '').trim().slice(0, 5000);
  const days = Math.max(1, Math.min(365, Number(values.reminder_days || 14) || 14));
  const eventDateKey = requestDateKey(eventDate);
  if (title.length < 2 || !eventDateKey) throw new Error('Completează un titlu și o dată validă în formatul zz.ll.aaaa.');
  const { data, error } = await db.from('discovery_events').insert({ organization_id: guild.organization_id, title, event_type: 'other', event_date: eventDateKey, details, evidence_url: null, status: 'active', created_by_discord_id: discordId, updated_at: new Date().toISOString() }).select('id,title,event_date').single();
  if (error) throw error;
  await db.from('discovery_app_settings').upsert({ organization_id: guild.organization_id, key: `discord_event_reminder_days:${data.id}`, value: { days }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
  const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const displayName = String(interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || interaction.user?.global_name || interaction.user?.username || discordId).trim().slice(0, 120);
  const logPayload = { allowed_mentions: { parse: [] }, embeds: [{ title: `🗓️ Eveniment nou · ${title}`, description: details || 'Evenimentul a fost înregistrat din botul Discord.', color: 0xf59e0b, fields: [{ name: 'Data evenimentului', value: discoveryDisplayDate(eventDateKey), inline: true }, { name: 'Durata reminderelor', value: `${days} zile`, inline: true }, { name: 'Publicat de', value: displayName, inline: true }], footer: { text: 'Panel Pro · log evenimente și remindere' }, timestamp: new Date().toISOString() }] };
  const delivery = await deliverDiscordRoute(db, settings, 'event_reminders', JSON.stringify(logPayload), { postOnly: true });
  if (!delivery.results.length) throw new Error(delivery.failures.join(' | ') || 'Evenimentul a fost salvat, dar nu există un canal de log configurat pentru evenimente.');
  return interactionMessage(`Evenimentul **${title}** a fost salvat și trimis în canalul de log. Reminderul va rula automat timp de **${days} zile**.`);
}

async function ensureDiscordOnlyOrganization(db: any, interaction: any) {
  const guildId = String(interaction?.guild_id || '').trim();
  const discordId = String(interaction?.member?.user?.id || interaction?.user?.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Serverul Discord nu a putut fi identificat.');
  const { data: existing, error: existingError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (existingError) throw existingError;
  if (existing?.organization_id) {
    const { data: existingSettings, error: packageError } = await db.from('discovery_app_settings').select('key,value').eq('organization_id', existing.organization_id).in('key', ['organization_package', 'discord_trial']);
    if (packageError) throw packageError;
    const packageSetting = (existingSettings || []).find((item: any) => item.key === 'organization_package');
    if (packageSetting?.value?.code === 'discord') {
      if (!(existingSettings || []).some((item: any) => item.key === 'discord_trial')) {
        const startsAt = new Date().toISOString();
        const { error: trialError } = await db.from('discovery_app_settings').insert({ organization_id: existing.organization_id, key: 'discord_trial', value: { starts_at: startsAt, ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), duration_days: 30 }, updated_at: startsAt });
        if (trialError) throw trialError;
      }
      const manager = isDiscordManager(interaction);
      const { error: memberError } = await db.from('discovery_members').upsert({ organization_id: existing.organization_id, discord_id: discordId, panel_role: manager ? 'Administrator' : 'Membru', permission_level: manager ? 99 : 1, active: true, last_verified_at: new Date().toISOString() }, { onConflict: 'organization_id,discord_id' });
      if (memberError) throw memberError;
    }
    return existing;
  }
  if (!isDiscordManager(interaction)) throw new Error('Serverul nu este configurat pentru Panel Pro. Ownerul serverului sau un administrator cu Manage Server trebuie să ruleze mai întâi /panel config.');

  const applicationId = String(interaction?.application_id || '').trim();
  const guildName = String(interaction?.guild?.name || interaction?.guild_name || `Server Discord ${guildId}`).trim().slice(0, 120);
  const slug = `discord-${guildId}`;
  const now = new Date().toISOString();
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: organization, error: organizationError } = await db.from('discovery_organizations').insert({
    slug, name: guildName, access_mode: 'discord_only', lifecycle_status: 'active', active: true, updated_at: now,
  }).select('id,name,address,active').single();
  if (organizationError) {
    if (organizationError.code === '23505') {
      const { data: retry, error: retryError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
      if (retryError) throw retryError;
      if (retry?.organization_id) return retry;
    }
    throw organizationError;
  }
  const organizationId = String(organization.id);
  const [guildResult, settingsResult, packageResult, memberResult, trialResult] = await Promise.all([
    db.from('discovery_guilds').insert({ organization_id: organizationId, guild_id: guildId, guild_name: guildName, kind: 'primary', enabled: true }),
    db.from('discovery_settings').insert({ organization_id: organizationId, discord_client_id: applicationId || '0', panel_public_url: '', discord_channel_routes: {}, updated_at: now, updated_by_discord_id: discordId }),
    db.from('discovery_app_settings').insert({ organization_id: organizationId, key: 'organization_package', value: { code: 'discord', unlimited: true, expires_at: null }, updated_at: now }),
    db.from('discovery_members').insert({ organization_id: organizationId, discord_id: discordId, panel_role: 'Administrator', permission_level: 99, active: true, last_verified_at: now }),
    db.from('discovery_app_settings').insert({ organization_id: organizationId, key: 'discord_trial', value: { starts_at: now, ends_at: trialEndsAt, duration_days: 30 }, updated_at: now }),
  ]);
  const failed = [guildResult, settingsResult, packageResult, memberResult, trialResult].find((result: any) => result?.error);
  if (failed?.error) throw failed.error;
  await db.from('discovery_lifecycle_events').insert({ organization_id: organizationId, event_type: 'discord_only_initialized', actor_discord_id: discordId, details: { guild_id: guildId } });
  return { organization_id: organizationId, kind: 'primary' };
}
const controlPayload = async (db: any, routeKey: string, trialText = '', includeDonation = true, includePremium = true, includeTrial = false) => {
  const definitions: Record<string, { title: string; description: string; color: number; buttons: any[] }> = {
    organization: { title: '📢 Anunțuri · Organizație', description: 'Publică anunțuri, întrebări și sondaje pentru organizație.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:organization:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:organization:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:organization:create:poll' }] },
    departments: { title: '📢 Anunțuri · Angajați', description: 'Publică anunțuri, întrebări și sondaje pentru angajați.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:departments:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:departments:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:departments:create:poll' }] },
    pontaj: { title: '🕒 Pontaj · Panel Pro', description: 'Alege tura și folosește butoanele pentru Start, Pauză și Stop.', color: 0x22c55e, buttons: [{ label: 'Tura de zi', style: 1, id: 'panel:pontaj:shift_day' }, { label: 'Tura de noapte', style: 1, id: 'panel:pontaj:shift_night' }, { label: 'Start', style: 3, id: 'panel:pontaj:start' }, { label: 'Pauză', style: 2, id: 'panel:pontaj:pause' }, { label: 'Stop', style: 4, id: 'panel:pontaj:stop' }, { label: 'Pontajul meu', style: 1, id: 'panel:pontaj:my_stats' }] },
    requests_organization: { title: '📝 Învoiri · Organizație', description: 'Trimite și consultă învoirile organizației.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:organization:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:organization:mine' }] },
    requests_departments: { title: '📝 Învoiri · Angajați', description: 'Trimite și consultă învoirile angajaților.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:departments:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:departments:mine' }] },
      contracts: { title: '📄 Contracte · Panel Pro', description: 'Generează și trimite contracte folosind șablonul organizației.', color: 0x14b8a6, buttons: [{ label: 'Creează contract', style: 1, id: 'panel:contracts:create' }, { label: 'Setează contractul', style: 2, id: 'panel:contracts:settings' }, { label: 'Info contract', style: 1, id: 'panel:contracts:info' }] },
      status_live: { title: '📡 Status live · Panel Pro', description: 'Acest embed este actualizat automat la fiecare minut cu pontajele și pauzele active. Configurează canalul Status live, apoi pornește sincronizarea din pagina Status live.', color: 0x06b6d4, buttons: [] },
    stash: { title: '📦 Stash · Administrare', description: 'Gestionează articolele Stash. Cererile și donațiile se gestionează din embedurile lor separate.', color: 0x22c55e, buttons: [{ label: 'Adaugă în Stash', style: 3, id: 'panel:stash:create' }, { label: 'Gestionează articole', style: 2, id: 'panel:stash:manage_items' }] },
    stash_requests: { title: '📨 Cereri Stash', description: 'Solicită articole și urmărește cererile trimise pentru aprobare.', color: 0x3b82f6, buttons: [{ label: 'Solicită articol', style: 1, id: 'panel:stash:request' }, { label: 'Cereri în așteptare', style: 2, id: 'panel:stash:pending_requests' }] },
    stash_donations: { title: '🎁 Donații Stash', description: 'Înregistrează donații și trimite-le spre aprobare administrativă.', color: 0x22c55e, buttons: [{ label: 'Donează articol', style: 3, id: 'panel:stash:donate' }, { label: 'Donații în așteptare', style: 2, id: 'panel:stash:pending_donations' }] },
    actions_organization: { title: '🎯 Acțiuni · Organizație', description: 'Înregistrează și consultă acțiunile organizației.', color: 0x3b82f6, buttons: [{ label: 'Acțiune', style: 1, id: 'panel:actions:organization:create' }, { label: 'Clasament acțiuni', style: 2, id: 'panel:actions:organization:stats' }] },
    marketplace: { title: '🛒 Marketplace · Legal', description: 'Publică și gestionează anunțuri de vânzare, cumpărare și servicii. Imaginile se adaugă ulterior din panelul web.', color: 0x2563eb, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:marketplace:legal:create' }, { label: 'Anunțurile mele', style: 2, id: 'panel:marketplace:legal:mine' }] },
    illegal_marketplace: { title: '🚨 Marketplace · Ilegal', description: 'Publică și gestionează anunțuri Black Market. Imaginile nu sunt incluse momentan în formularul Discord.', color: 0xef4444, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:marketplace:illegal:create' }, { label: 'Anunțurile mele', style: 2, id: 'panel:marketplace:illegal:mine' }] },
    event_reminders: { title: '🗓️ Evenimente și remindere', description: 'Înregistrează evenimente și trimite remindere automate pe durata aleasă.', color: 0xf59e0b, buttons: [{ label: 'Adaugă eveniment', style: 1, id: 'panel:discovery:reminder_create' }, { label: 'Info remindere', style: 2, id: 'panel:discovery:reminder_info' }] },
    contract_identity_weekly: { title: '📋 Raport săptămânal contracte', description: 'Generează exportul săptămânal cu numele și CNP-ul angajaților.', color: 0x14b8a6, buttons: [{ label: 'Generează raport', style: 1, id: 'panel:discovery:weekly_report' }, { label: 'Info raport', style: 2, id: 'panel:discovery:report_info' }] },
  };
  const base = definitions[routeKey] || { title: `⚙️ ${PANEL_ROUTE_LABELS[routeKey] || 'Panel Pro'}`, description: 'Embed de administrare Panel Pro.', color: 0x5865f2, buttons: [] };
  const override = (await readGlobalModules(db))[routeKey] || {};
  const definition = { ...base, ...override, buttons: Array.isArray(override.buttons) ? override.buttons.map((button: any, index: number) => ({ ...base.buttons[index], ...button })).filter((button: any) => button?.id) : base.buttons };
    const components: any[] = [];
    for (let index = 0; index < definition.buttons.length && components.length < 4; index += 5) {
      components.push({ type: 1, components: definition.buttons.slice(index, index + 5).map((button: any) => ({ type: 2, style: button.style, label: button.label, custom_id: button.id })) });
    }
  if (includeDonation) components.push({ type: 1, components: [{ type: 2, style: 5, label: 'Donează pentru dezvoltare', url: 'https://revolut.me/mariomihail' }] });
  if (includeTrial) components.push({ type: 1, components: [{ type: 2, style: 3, label: '🎁 Activează Trial 30 zile', custom_id: 'panel:discovery:trial_activate' }] });
  if (includePremium && discordPremiumConfigured()) components.push(...discordPremiumButton());
  return { allowed_mentions: { parse: [] }, embeds: [{ title: definition.title, description: [definition.description, trialText].filter(Boolean).join('\n\n'), color: definition.color, footer: { text: 'Panel Pro · configurat din Discord' } }], components };
};
const readableError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const message = String(value.message || value.details || value.hint || '').trim();
    if (message) return message;
  }
  return fallback;
};

async function discordTrialNotice(db: any, organizationId: string) {
  const { data, error } = await db.from('discovery_app_settings').select('value').eq('organization_id', organizationId).eq('key', 'discord_trial').maybeSingle();
  if (error) throw error;
  const startsAt = Date.parse(String(data?.value?.starts_at || ''));
  const endsAt = Date.parse(String(data?.value?.ends_at || ''));
  if (!Number.isFinite(endsAt)) return '';
  if (endsAt <= Date.now()) return '⚪ Perioada de probă Premium a expirat. Pontajul și Învoirile rămân gratuite.';
  const days = Math.max(1, Math.ceil((endsAt - Date.now()) / (24 * 60 * 60 * 1000)));
  const startText = Number.isFinite(startsAt) ? new Date(startsAt).toLocaleDateString('ro-RO') : '—';
  const endText = new Date(endsAt).toLocaleDateString('ro-RO');
  return `🟢 Trial Premium activ: **${days} zile rămase** (${startText} – ${endText}). Poți activa abonamentul Premium oricând folosind butonul de mai jos.`;
}
async function discordTrialSetting(db: any, organizationId: string) {
  const { data, error } = await db.from('discovery_app_settings').select('value').eq('organization_id', organizationId).eq('key', 'discord_trial').maybeSingle();
  if (error) throw error;
  return data?.value || null;
}
async function activateDiscordTrial(db: any, interaction: any) {
  if (!isDiscordManager(interaction)) throw new Error('Doar ownerul sau un administrator al serverului poate activa Trial-ul.');
  const guildId = String(interaction.guild_id || '');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const existing = await discordTrialSetting(db, String(guild.organization_id));
  if (existing) return interactionMessage('Trial-ul a fost deja folosit sau este deja activ pe acest server.');
  const startsAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db.from('discovery_app_settings').insert({ organization_id: guild.organization_id, key: 'discord_trial', value: { starts_at: startsAt, ends_at: endsAt, duration_days: 30 }, updated_at: startsAt });
  if (error) throw error;
  return interactionMessage('Trial-ul Premium de 30 de zile a fost activat pentru acest server.');
}

async function deferInteraction(interaction: any, updateOnly = false) {
  const interactionId = String(interaction?.id || '').trim();
  const applicationId = String(interaction?.application_id || '').trim();
  const interactionToken = String(interaction?.token || '').trim();
  if (!/^\d{15,22}$/.test(interactionId) || !/^\d{15,22}$/.test(applicationId) || !interactionToken) throw new Error('Interacțiunea Discord nu are un token valid.');
  const response = await fetch(`${DISCORD_API}/interactions/${interactionId}/${encodeURIComponent(interactionToken)}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateOnly ? { type: 6 } : { type: 5, data: { flags: 64 } }),
  });
  if (!response.ok && response.status !== 204) throw new Error(`Discord nu a confirmat interacțiunea (HTTP ${response.status}).`);
  return { applicationId, interactionToken };
}

async function sendFollowup(applicationId: string, interactionToken: string, data: any) {
  const response = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${encodeURIComponent(interactionToken)}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(data?.data || {}), flags: 64 }),
  });
  if (!response.ok) {
    console.error('[discord-interactions] follow-up failed', response.status, await response.text().catch(() => ''));
    return '';
  }
  const message = await response.json().catch(() => ({}));
  return String(message?.id || '').trim();
}

async function deleteFollowup(applicationId: string, interactionToken: string, messageId: string) {
  if (!messageId) return;
  const response = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${encodeURIComponent(interactionToken)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) console.error('[discord-interactions] follow-up delete failed', response.status, await response.text().catch(() => ''));
}

async function runDeferredCommand(interaction: any, work: () => Promise<any>, fallback: string) {
  const deferred = await deferInteraction(interaction, false);
  let result;
  try { result = await work(); } catch (error) { console.error('[discord-interactions] command failed', error); result = interactionMessage(readableError(error, fallback)); }
  await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
  return new Response(null, { status: 204 });
}

const hexBytes = (value: string, length: number) => {
  if (!new RegExp(`^[0-9a-f]{${length * 2}}$`, 'i').test(value)) return null;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
};

async function verifyDiscordSignature(request: Request, rawBody: string) {
  const publicKey = hexBytes(DISCORD_PUBLIC_KEY(), 32);
  const signature = hexBytes(String(request.headers.get('x-signature-ed25519') || '').trim(), 64);
  const timestamp = String(request.headers.get('x-signature-timestamp') || '').trim();
  if (!publicKey || !signature || !/^\d{1,20}$/.test(timestamp)) return false;
  try {
    const key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, new TextEncoder().encode(`${timestamp}${rawBody}`));
  } catch (error) {
    console.error('[discord-interactions] signature verification failed', error);
    return false;
  }
}

function romanianParts(date = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}

function romanianDate(date = new Date()) {
  const parts = romanianParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function romanianTime(date = new Date()) {
  const parts = romanianParts(date);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`;
}

function zonedDateAt(year: number, month: number, day: number, hour: number, minute: number) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  const observed = romanianParts(new Date(wanted));
  const observedUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
  return new Date(wanted + (wanted - observedUtc));
}

function shiftDeadline(shiftType: string, now = new Date()) {
  const parts = romanianParts(now);
  const configured = shiftType === 'noapte' ? [23, 0] : [19, 59];
  let marker = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  let deadline = zonedDateAt(marker.getUTCFullYear(), marker.getUTCMonth() + 1, marker.getUTCDate(), configured[0], configured[1]);
  if (deadline.getTime() <= now.getTime()) {
    marker.setUTCDate(marker.getUTCDate() + 1);
    deadline = zonedDateAt(marker.getUTCFullYear(), marker.getUTCMonth() + 1, marker.getUTCDate(), configured[0], configured[1]);
  }
  return deadline;
}

function shiftAllowed(shiftType: string, now = new Date()) {
  const parts = romanianParts(now);
  const current = parts.hour * 100 + parts.minute;
  if (shiftType === 'zi') return current > 2300 || current < 1959;
  if (shiftType === 'noapte') return current >= 2000 && current < 2300;
  return false;
}

function workedSeconds(shift: any, now = new Date()) {
  const started = new Date(String(shift.started_at || '')).getTime();
  if (!Number.isFinite(started)) return 0;
  let paused = Number(shift.paused_seconds) || 0;
  if (shift.status === 'paused' && shift.paused_at) paused += Math.max(0, Math.floor((now.getTime() - new Date(String(shift.paused_at)).getTime()) / 1000));
  return Math.max(0, Math.floor((now.getTime() - started) / 1000) - paused);
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 3600).toString().padStart(2, '0')}:${Math.floor((safe % 3600) / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

async function resolveContext(db: any, interaction: any) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');

  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('discovery_organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');

  const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const configuredChannel = settings?.discord_channel_routes?.pontaj?.[target];
  if (configuredChannel?.enabled === false || String(configuredChannel?.channel_id || '') !== channelId) throw new Error('Acest canal nu este configurat pentru panoul Pontaj al organizației.');

  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('discovery_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const { data: organizationMember, error: memberError } = await db.from('discovery_members').select('panel_role,permission_level,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Nu ai un rol configurat pentru Pontaj în această organizație.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru' };
}

async function resolveRequestContext(db: any, interaction: any, audience: 'organization' | 'departments') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('discovery_organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routeKey = audience === 'organization' ? 'requests_organization' : 'requests_departments';
  const logRouteKey = audience === 'organization' ? 'log_requests_organization' : 'log_requests_departments';
  const alternateRouteKey = audience === 'organization' ? 'requests_departments' : 'requests_organization';
  const configuredChannel = settings?.discord_channel_routes?.[routeKey]?.[target]
    || settings?.discord_channel_routes?.requests?.[target]
    || settings?.discord_channel_routes?.[alternateRouteKey]?.[target];
  if (configuredChannel?.enabled === false || String(configuredChannel?.channel_id || '') !== channelId) throw new Error(`Acest canal nu este configurat pentru panoul Învoiri · ${audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('discovery_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const { data: organizationMember, error: memberError } = await db.from('discovery_members').select('panel_role,permission_level,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  const { data: actionSettings, error: actionError } = await db.from('discovery_app_settings').select('key,value').eq('organization_id', guild.organization_id).in('key', ['action_permissions', 'organization_package']);
  if (actionError) throw actionError;
  const actionSetting = (actionSettings || []).find((item: any) => item.key === 'action_permissions');
  const discordOnly = (actionSettings || []).find((item: any) => item.key === 'organization_package')?.value?.code === 'discord';
  const permissionKey = audience === 'organization' ? 'cereri.organization' : 'cereri.departments';
  const allowedRoles = Array.isArray(actionSetting?.value?.[permissionKey]) ? actionSetting.value[permissionKey].map(String) : [];
  if (!platformAdmin && !discordOnly && !memberRolesHasAny(memberRoles, allowedRoles)) throw new Error(`Nu ai permisiunea configurată pentru Învoiri · ${audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, audience, routeKey, logRouteKey, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru' };
}

function memberRolesHasAny(memberRoles: Set<string>, allowedRoles: string[]) {
  return allowedRoles.some((role) => memberRoles.has(String(role)));
}

function announcementRoutes(audience: 'organization' | 'departments') {
  return audience === 'organization'
    ? { control: 'organization', log: 'log_announcements_organization' }
    : { control: 'departments', log: 'log_announcements_departments' };
}

function channelMatches(settings: any, routeKey: string, target: string, channelId: string) {
  const configured = settings?.discord_channel_routes?.[routeKey]?.[target];
  return configured?.enabled !== false && String(configured?.channel_id || '') === String(channelId || '');
}

async function resolveAnnouncementContext(db: any, interaction: any, audience: 'organization' | 'departments', permission: 'read' | 'write') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');

  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('discovery_organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routes = announcementRoutes(audience);
  if (!channelMatches(settings, routes.control, target, channelId) && !channelMatches(settings, routes.log, target, channelId)) throw new Error(`Acest canal nu este configurat pentru panoul ${audience === 'organization' ? 'Anunțuri · Organizație' : 'Anunțuri · Angajați'}.`);

  const { data: permissionSettings, error: permissionError } = await db.from('discovery_app_settings').select('key,value').eq('organization_id', guild.organization_id).in('key', ['communication_permissions', 'page_permissions', 'action_permissions', 'organization_package']);
  if (permissionError) throw permissionError;
  const byKey = new Map((permissionSettings || []).map((item: any) => [String(item.key), item.value]));
  const communication = byKey.get('communication_permissions');
  const communicationConfigured = communication && typeof communication === 'object';
  const pagePermissions = byKey.get('page_permissions') && typeof byKey.get('page_permissions') === 'object' ? byKey.get('page_permissions') : {};
  const actionPermissions = byKey.get('action_permissions') && typeof byKey.get('action_permissions') === 'object' ? byKey.get('action_permissions') : {};
  const packageFeatures = resolvePackageFeatures(byKey.get('organization_package') || {});
  const discordOnly = byKey.get('organization_package')?.code === 'discord';
  const feature = audience === 'organization' ? 'announcements_organization' : 'announcements_departments';

  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('discovery_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const { data: organizationMember, error: memberError } = await db.from('discovery_members').select('panel_role,permission_level,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  const activePanelRole = String(organizationMember?.panel_role || '').trim().toLowerCase();
  const effectiveRoleIds = new Set<string>([...memberRoles]);
  for (const mapping of mappings || []) {
    if (activePanelRole && String(mapping.panel_role || '').trim().toLowerCase() === activePanelRole) effectiveRoleIds.add(String(mapping.discord_role_id));
  }
  const configuredRoles = communicationConfigured
    ? (Array.isArray(communication?.[audience]?.[permission]) ? communication[audience][permission].map(String) : [])
    : (permission === 'read' ? (Array.isArray(pagePermissions['anunturi.html']) ? pagePermissions['anunturi.html'].map(String) : []) : (Array.isArray(actionPermissions['anunturi.publish']) ? actionPermissions['anunturi.publish'].map(String) : []));
  const hasAccess = platformAdmin || discordOnly || (packageFeatures.includes(feature) && [...effectiveRoleIds].some((roleId) => configuredRoles.includes(roleId)));
  if (!hasAccess) throw new Error(`Nu ai permisiunea de ${permission === 'read' ? 'citire' : 'scriere'} pentru ${audience === 'organization' ? 'Anunțuri · Organizație' : 'Anunțuri · Angajați'}.`);
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, audience, routeKey: routes.log, controlRouteKey: routes.control, logRouteKey: routes.log, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru' };
}

async function resolveManagementContext(db: any, interaction: any, audience: 'organization' | 'departments', permission: 'read' | 'write' | 'sanction', routeKey: string, feature: string, permissionSettingKey: string, permissionKey: string) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('discovery_organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routes = announcementRoutes(audience);
  if (!channelMatches(settings, routeKey, target, channelId) && !channelMatches(settings, routes.log, target, channelId)) throw new Error(`Acest canal nu este configurat pentru ${routeKey}.`);
  const { data: permissionSettings, error: permissionError } = await db.from('discovery_app_settings').select('key,value').eq('organization_id', guild.organization_id).in('key', ['discipline_permissions', 'action_permissions', 'organization_package']);
  if (permissionError) throw permissionError;
  const byKey = new Map((permissionSettings || []).map((item: any) => [String(item.key), item.value]));
  const permissionConfig = byKey.get(permissionSettingKey);
  const packageFeatures = resolvePackageFeatures(byKey.get('organization_package') || {});
  const discordOnly = byKey.get('organization_package')?.code === 'discord';
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('discovery_role_mappings').select('discord_role_id,panel_role,priority,permission_level').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const { data: organizationMember, error: memberError } = await db.from('discovery_members').select('panel_role,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const activePanelRole = String(organizationMember?.panel_role || '').trim().toLowerCase();
  const effectiveRoleIds = new Set<string>([...memberRoles]);
  for (const mapping of mappings || []) if (activePanelRole && String(mapping.panel_role || '').trim().toLowerCase() === activePanelRole) effectiveRoleIds.add(String(mapping.discord_role_id));
  const configuredRoles = Array.isArray(permissionConfig?.[audience]?.[permission])
    ? permissionConfig[audience][permission].map(String)
    : Array.isArray(permissionConfig?.[permissionKey]) ? permissionConfig[permissionKey].map(String) : [];
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  if (!platformAdmin && !discordOnly && (!packageFeatures.includes(feature) || ![...effectiveRoleIds].some((roleId) => configuredRoles.includes(roleId)))) throw new Error(`Nu ai permisiunea necesară pentru ${audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, audience, logRouteKey: routes.log, role: mappings?.find((mapping: any) => effectiveRoleIds.has(String(mapping.discord_role_id)))?.panel_role || organizationMember?.panel_role || 'Membru' };
}

async function resolveContractContext(db: any, interaction: any, routeKey = 'contracts') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const [{ data: resolvedOrganization, error: resolvedOrganizationError }, { data: resolvedSettings, error: resolvedSettingsError }] = await Promise.all([
    db.from('discovery_organizations').select('id,name,address,active').eq('id', guild.organization_id).maybeSingle(),
    db.from('discovery_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle(),
  ]);
  if (resolvedOrganizationError) throw resolvedOrganizationError;
  if (!resolvedOrganization?.active) throw new Error('Organizația este dezactivată.');
  if (resolvedSettingsError) throw resolvedSettingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  if (!channelMatches(resolvedSettings, routeKey, target, channelId)) throw new Error(`Acest canal nu este configurat pentru panoul ${routeKey === 'log_contracts' ? 'Log contracte' : 'Contracte'}.`);
  const [{ data: packageSetting, error: packageError }, { data: permissionSetting, error: permissionError }, { data: mappings, error: mappingsError }, { data: organizationMember, error: memberError }, platformAdmin] = await Promise.all([
    db.from('discovery_app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'organization_package').maybeSingle(),
    db.from('discovery_app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'page_permissions').maybeSingle(),
    db.from('discovery_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true),
    db.from('discovery_members').select('panel_role,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle(),
    isPlatformAdminAccount(db, discordId),
  ]);
  if (packageError) throw packageError;
  if (permissionError) throw permissionError;
  if (mappingsError) throw mappingsError;
  if (memberError) throw memberError;
  const packageFeatures = resolvePackageFeatures(packageSetting?.value || {});
  const discordOnly = packageSetting?.value?.code === 'discord';
  if (!packageFeatures.includes('contracts')) throw new Error('Contractele nu sunt incluse în pachetul organizației.');
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const allowedRoles = Array.isArray(permissionSetting?.value?.['contracte.html']) ? permissionSetting.value['contracte.html'].map(String) : [];
  const effectiveRoleIds = new Set<string>([...memberRoles]);
  const activePanelRole = String(organizationMember?.panel_role || '').trim().toLowerCase();
  for (const mapping of mappings || []) if (activePanelRole && String(mapping.panel_role || '').trim().toLowerCase() === activePanelRole) effectiveRoleIds.add(String(mapping.discord_role_id));
  if (!platformAdmin && !discordOnly && allowedRoles.length && ![...effectiveRoleIds].some((roleId) => allowedRoles.includes(roleId))) throw new Error('Nu ai permisiunea configurată pentru pagina Contracte.');
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization: resolvedOrganization, settings: resolvedSettings, platformAdmin, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru', logRouteKey: 'log_contracts' };
}

async function resolveContractActionContext(db: any, interaction: any) {
  try { return await resolveContractContext(db, interaction, 'contracts'); }
  catch (_) { return await resolveContractContext(db, interaction, 'log_contracts'); }
}

function modalValues(interaction: any) {
  const values: Record<string, any> = {};
  for (const row of interaction?.data?.components || []) {
    const components = row?.components || (row?.component ? [row.component] : []);
    for (const component of components) {
      const id = String(component?.custom_id || '').trim();
      if (!id) continue;
      if (Array.isArray(component?.values)) values[id] = component.values.map((value: unknown) => String(value));
      else if (Array.isArray(component?.component?.values)) values[id] = component.component.values.map((value: unknown) => String(value));
      else values[id] = String(component?.value || '').trim();
    }
  }
  return values;
}

const communityReactionChoices = ['✅', '❌', '👍', '❤️', '🤔'];

function communityPostComponents(post: any, options: any[] = []) {
  const audience = post.audience === 'departments' ? 'departments' : 'organization';
  const rows: any[] = [{ type: 1, components: communityReactionChoices.map((reaction, index) => ({ type: 2, style: 2, label: reaction, custom_id: `panel:announcements:${audience}:react:${post.id}:${index}` })) }];
  if (post.post_type === 'poll') {
    const pollOptions = options.slice(0, 10);
    for (let index = 0; index < pollOptions.length; index += 5) {
      rows.push({ type: 1, components: pollOptions.slice(index, index + 5).map((option: any) => ({ type: 2, style: 1, label: String(option.option_text || `Opțiunea ${option.position + 1}`).slice(0, 80), custom_id: `panel:announcements:${audience}:vote:${post.id}:${option.position}` })) });
    }
  }
  rows.push({ type: 1, components: [
    { type: 2, style: 2, label: 'Editează', custom_id: `panel:announcements:${audience}:edit:${post.id}` },
    { type: 2, style: 4, label: 'Șterge', custom_id: `panel:announcements:${audience}:delete:${post.id}` },
  ] });
  return rows.slice(0, 5);
}

function communityPostEmbed(post: any, options: any[] = [], votes: any[] = [], reactions: any[] = [], settings: any = {}) {
  const audience = post.audience === 'departments' ? 'Angajați' : 'Organizație';
  const site = String(settings?.panel_public_url || 'https://panel-pro.ro').replace(/\/$/, '');
  const postUrl = `${site}/anunturi.html?post=${post.id}`;
  const fields: any[] = [];
  if (post.post_type === 'poll') {
    const total = votes.length;
    fields.push({ name: `🗳️ Rezultate · ${total} vot${total === 1 ? '' : 'uri'}`, value: options.map((option: any) => {
      const count = votes.filter((vote: any) => String(vote.option_id) === String(option.id)).length;
      const percentage = total ? Math.round((count * 100) / total) : 0;
      return `▫️ ${String(option.option_text || 'Opțiune').slice(0, 80)} — ${count} (${percentage}%)`;
    }).join('\n').slice(0, 1024) || 'Încă nu există opțiuni.' });
  }
  fields.push({ name: 'Reacții', value: communityReactionChoices.map((reaction) => `${reaction} ${reactions.filter((item: any) => item.reaction === reaction).length}`).join(' · '), inline: false });
  fields.push({ name: post.post_type === 'poll' ? 'Votare' : 'Interacțiuni', value: post.post_type === 'poll' ? 'Alege o opțiune de mai jos.' : 'Folosește reacțiile de mai jos pentru a răspunde.', inline: false });
  return {
    title: String(post.title || 'Comunicare').slice(0, 256),
    description: String(post.content || '—').slice(0, 4096),
    color: post.post_type === 'poll' ? 0x8b5cf6 : post.audience === 'organization' ? 0x22d3ee : 0x5865f2,
    url: postUrl,
    fields,
    footer: { text: `${post.post_type === 'poll' ? 'Sondaj' : post.post_type === 'question' ? 'Întrebare' : 'Anunț'} · ${audience} · ${String(post.author_name || 'Panel Pro').slice(0, 60)}` },
    timestamp: post.updated_at || post.created_at || new Date().toISOString(),
  };
}

async function loadCommunityPost(db: any, organizationId: string, postId: string) {
  const { data: post, error: postError } = await db.from('discovery_community_posts').select('*').eq('organization_id', organizationId).eq('id', postId).maybeSingle();
  if (postError) throw postError;
  if (!post) throw new Error('Postarea nu mai există în organizația activă.');
  const [optionsResult, votesResult, reactionsResult] = await Promise.all([
    db.from('discovery_poll_options').select('id,post_id,option_text,position').eq('organization_id', organizationId).eq('post_id', postId).order('position'),
    db.from('discovery_poll_votes').select('post_id,option_id,user_discord_id').eq('organization_id', organizationId).eq('post_id', postId),
    db.from('discovery_reactions').select('post_id,user_discord_id,reaction').eq('organization_id', organizationId).eq('post_id', postId),
  ]);
  if (optionsResult.error) throw optionsResult.error;
  if (votesResult.error) throw votesResult.error;
  if (reactionsResult.error) throw reactionsResult.error;
  return { post, options: optionsResult.data || [], votes: votesResult.data || [], reactions: reactionsResult.data || [] };
}

function communityPayload(data: any) {
  return JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [communityPostEmbed(data.post, data.options, data.votes, data.reactions, data.settings)], components: communityPostComponents(data.post, data.options) });
}

function communityMessageRefs(post: any) {
  const refs = Array.isArray(post?.discord_message_ids) ? post.discord_message_ids : [];
  const map: Record<string, string> = {};
  for (const ref of refs) {
    if (ref?.target && /^\d{15,22}$/.test(String(ref.id || ''))) map[String(ref.target)] = String(ref.id);
  }
  if (!Object.keys(map).length && /^\d{15,22}$/.test(String(post?.discord_message_id || ''))) map.primary = String(post.discord_message_id);
  return map;
}

async function saveCommunityMessageRefs(db: any, organizationId: string, postId: string, results: any[]) {
  if (!results.length) return;
  const refs = results.filter((item: any) => item.id).map((item: any) => ({ target: String(item.target || ''), channel_id: String(item.channel_id || ''), id: String(item.id) }));
  const first = refs[0];
  const { error } = await db.from('discovery_community_posts').update({ discord_message_id: first?.id || null, discord_message_ids: refs, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', postId);
  if (error) throw error;
}

async function syncCommunityPostDiscord(db: any, context: any, data: any) {
  const messageIds = communityMessageRefs(data.post);
  const delivery = await deliverDiscordRoute(db, context.settings, context.routeKey, communityPayload({ ...data, settings: context.settings }), { messageIds });
  await saveCommunityMessageRefs(db, String(context.organization.id), String(data.post.id), delivery.results || []);
  return delivery;
}

function announcementModal(audience: 'organization' | 'departments', postType: 'announcement' | 'question' | 'poll', post: any = null, options: any[] = []) {
  const label = audience === 'organization' ? 'Organizație' : 'Angajați';
  const input = (custom_id: string, labelText: string, style: number, required: boolean, placeholder: string, max_length: number, value = '') => ({ type: 4, custom_id, label: labelText, style, required, placeholder, max_length, ...(value ? { value } : {}) });
  const editing = Boolean(post?.id);
  const customId = editing ? `panel:announcements:${audience}:edit_submit:${post.id}:${postType}` : `panel:announcements:${audience}:submit:${postType}`;
  const components: any[] = [
    { type: 1, components: [input('title', 'Titlu', 1, true, 'Titlul comunicării', 140, String(post?.title || ''))] },
    { type: 1, components: [input('content', 'Conținut', 2, false, 'Scrie mesajul...', 4000, String(post?.content || ''))] },
  ];
  if (postType === 'poll') components.push({ type: 1, components: [input('poll_options', 'Opțiuni sondaj', 2, true, 'Câte o opțiune pe fiecare rând', 1000, options.map((option: any) => option.option_text).join('\n'))] });
  return { type: 9, data: { custom_id: customId, title: `${editing ? 'Editează' : 'Creează'} ${postType === 'poll' ? 'sondaj' : postType === 'question' ? 'întrebare' : 'anunț'} · ${label}`, components } };
}

function parseCommunityOptions(value: string) {
  return [...new Set(String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))].slice(0, 10);
}

async function sendAnnouncementLog(db: any, context: any, post: any, action: string) {
  const title = String(post?.title || 'Comunicare').slice(0, 256);
  const content = String(post?.content || '—').slice(0, 1024);
  const type = post?.post_type === 'poll' ? 'Sondaj' : post?.post_type === 'question' ? 'Întrebare' : 'Anunț';
  const audience = context.audience === 'organization' ? 'Organizație' : 'Angajați';
  try {
    const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{
      title: `📝 ${action} · ${audience}`,
      color: action.toLowerCase().includes('șters') ? 0xef4444 : 0x64748b,
      fields: [
        { name: '👤 Autor', value: String(post.author_name || context.displayName || 'Utilizator').slice(0, 1024), inline: true },
        { name: '📌 Tip', value: type, inline: true },
        { name: '🧾 Titlu', value: title, inline: false },
        { name: '💬 Conținut', value: content, inline: false },
      ],
      footer: { text: `Panel Pro · Log anunțuri · ${audience}` },
      timestamp: new Date().toISOString(),
    }] }));
    return delivery;
  } catch (error) {
    console.error('[discord-interactions] announcement log failed', error);
    return { results: [], failures: [error instanceof Error ? error.message : 'Logul Anunțuri nu a putut fi trimis.'] };
  }
}

function disciplineTargetPicker(audience: 'organization' | 'departments', kind: 'warning' | 'sanction') {
  const label = audience === 'organization' ? 'Organizație' : 'Angajați';
  return { type: 4, data: { content: `Selectează utilizatorul Discord vizat pentru ${kind === 'warning' ? 'avertisment' : 'sancțiune'} · ${label}.`, flags: 64, components: [{ type: 1, components: [{ type: 5, custom_id: `panel:discipline:${audience}:${kind}:target`, placeholder: 'Selectează utilizatorul de pe server', min_values: 1, max_values: 1 }]}] } };
}

function contractModal() {
  const input = (custom_id: string, label: string, placeholder: string, max_length: number, required = true, value = '') => ({ type: 4, custom_id, label, style: 1, required, placeholder, max_length, ...(value ? { value } : {}) });
  return { type: 9, data: { custom_id: 'panel:contracts:submit', title: 'Generează contract', components: [
    { type: 1, components: [input('employee_name', 'Nume și prenume', 'Introdu numele și prenumele', 120)] },
    { type: 1, components: [input('cnp', 'CNP angajat', 'Introdu CNP-ul angajatului', 120)] },
    { type: 1, components: [input('phone', 'Număr de telefon', '07xx xxx xxx', 80)] },
    { type: 1, components: [input('start_date', 'Data începerii (opțional)', 'zz.ll.aaaa', 10, false, romanianDisplayDate())] },
  ] } };
}

function contractSettingsModal() {
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required, placeholder, max_length });
  return { type: 9, data: { custom_id: 'panel:contracts:settings_submit', title: 'Setează contractul', components: [
    { type: 1, components: [input('title', 'Numele contractului', 1, true, 'Ex: Contract de colaborare', 100)] },
    { type: 1, components: [input('position', 'Funcție implicită', 1, false, 'Ex: Angajat', 100)] },
    { type: 1, components: [input('salary', 'Salariu implicit', 1, false, 'Ex: 100 lei/lună', 120)] },
    { type: 1, components: [input('schedule', 'Program implicit', 1, false, 'Ex: 20:00-23:00', 120)] },
    { type: 1, components: [input('template', 'Șablonul contractului', 2, true, 'Lipește textul contractului și folosește variabilele de mai jos', 4000)] },
  ] } };
}

function contractInfoMessage() {
  return interactionMessage('', { embeds: [{ title: 'ℹ️ Cum configurezi contractul', description: 'În șablon, folosește exact variabilele de mai jos între acolade duble. La generare, botul le înlocuiește automat cu datele organizației și ale angajatului.', color: 0x14b8a6, fields: [
    { name: 'Date completate automat', value: '`{{COMPANY}}` companie\n`{{ADDRESS}}` adresă\n`{{MANAGER}}` manager\n`{{POSITION}}` funcție\n`{{SALARY}}` salariu\n`{{PROGRAM}}` program\n`{{START_DATE}}` data începerii\n`{{CONTRACT_NUMBER}}` număr contract', inline: true },
    { name: 'Date cerute la generare', value: '`{{EMPLOYEE_NAME}}` nume și prenume\n`{{CNP}}` CNP\n`{{PHONE}}` număr de telefon', inline: true },
    { name: 'Exemplu', value: 'Angajat: `{{EMPLOYEE_NAME}}`\nCNP: `{{CNP}}`\nTelefon: `{{PHONE}}`\nSalariu: `{{SALARY}}`', inline: false },
  ], footer: { text: 'Panel Pro · Contracte Discord' } }] });
}

function contractTemplateVariables() {
  return new Set(['{{COMPANY}}', '{{ADDRESS}}', '{{MANAGER}}', '{{EMPLOYEE_NAME}}', '{{CNP}}', '{{PHONE}}', '{{POSITION}}', '{{SALARY}}', '{{PROGRAM}}', '{{START_DATE}}', '{{CONTRACT_NUMBER}}']);
}

async function handleContractSettingsSubmit(db: any, context: any, interaction: any, values: Record<string, any>) {
  if (!isDiscordManager(interaction) && !context.platformAdmin) throw new Error('Doar ownerul serverului sau un administrator cu Manage Server poate seta contractul.');
  const title = contractValue(values.title, '');
  const template = String(values.template ?? '').trim().slice(0, 50000);
  const position = contractValue(values.position, 'Angajat');
  const salary = contractValue(values.salary, '');
  const schedule = contractValue(values.schedule, '20:00-23:00');
  if (title.length < 2) return interactionMessage('Numele contractului este obligatoriu.');
  if (template.length < 20) return interactionMessage('Șablonul contractului este prea scurt.');
  const unknown = [...template.matchAll(/{{[A-Z0-9_]+}}/g)].map((match) => match[0]).filter((value) => !contractTemplateVariables().has(value));
  if (unknown.length) return interactionMessage(`Variabile necunoscute în șablon: ${[...new Set(unknown)].join(', ')}`);
  const { error } = await db.from('discovery_app_settings').upsert({ organization_id: context.organization.id, key: 'contract_template', value: { title, template, defaults: { position, salary: salary || null, schedule } }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
  if (error) throw error;
  return interactionMessage(`Șablonul **${title}** a fost salvat. La generare se completează automat organizația, managerul, funcția, salariul, programul, data și numărul contractului; angajatul completează numele, CNP-ul și telefonul.`);
}

function disciplineModal(audience: 'organization' | 'departments', kind: 'warning' | 'sanction', targetId = '') {
  const label = audience === 'organization' ? 'Organizație' : 'Angajați';
  const input = (custom_id: string, labelText: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label: labelText, style, required, placeholder, max_length });
  const components: any[] = [{ type: 1, components: [input('reason', 'Motiv', 2, true, 'Explică motivul...', 4000)] }, { type: 1, components: [input('notes', 'Note (opțional)', 2, false, 'Detalii suplimentare...', 4000)] }];
  if (kind === 'warning') components.push({ type: 1, components: [input('evidence_url', 'Dovadă (opțional)', 1, false, 'https://...', 500)] });
  else components.push(
    { type: 1, components: [input('amount_currency', 'Sumă și monedă', 1, true, 'Exemplu: 500 USD', 40)] },
    { type: 1, components: [input('due_at', 'Scadență (opțional)', 1, false, 'zz.ll.aaaa', 10)] },
    { type: 1, components: [input('evidence_url', 'Dovadă (opțional)', 1, false, 'https://...', 500)] },
  );
  return { type: 9, data: { custom_id: `panel:discipline:${audience}:submit:${kind}:${targetId}`, title: `${kind === 'warning' ? 'Avertisment' : 'Sancțiune'} · ${label}`, components } };
}

function actionModal() {
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required, placeholder, max_length });
  return { type: 9, data: { custom_id: 'panel:actions:organization:details', title: 'Acțiune · Organizație', components: [
    { type: 1, components: [input('action_type', 'Tip acțiune', 1, true, 'Minat, Farmat, Patrulă...', 40)] },
    { type: 1, components: [input('action_label', 'Denumire', 1, true, 'Exemplu: Car meet', 120)] },
    { type: 1, components: [input('description', 'Descriere', 2, false, 'Ce s-a făcut...', 4000)] },
    { type: 1, components: [input('notes', 'Note (opțional)', 2, false, 'Detalii suplimentare...', 4000)] },
  ] } };
}

function actionParticipantPicker(draftId: string) {
  return interactionMessage('Alege participanții direct din lista serverului. Poți selecta până la 25 de persoane.', {
    components: [
      { type: 1, components: [{ type: 5, custom_id: `panel:actions:organization:participants:${draftId}`, placeholder: 'Caută și selectează participanții', min_values: 1, max_values: 25 }] },
      { type: 1, components: [{ type: 2, style: 2, label: 'Salvează fără participanți', custom_id: `panel:actions:organization:participants_skip:${draftId}` }] },
    ],
  });
}

function disciplineComponents(audience: 'organization' | 'departments', kind: 'warning' | 'sanction', id: string) {
  const prefix = `panel:discipline:${audience}`;
  return [{ type: 1, components: kind === 'warning' ? [
    { type: 2, style: 3, label: 'Marchează rezolvat', custom_id: `${prefix}:resolve:warning:${id}` },
    { type: 2, style: 4, label: 'Șterge', custom_id: `${prefix}:delete:warning:${id}` },
  ] : [
    { type: 2, style: 3, label: 'Marchează achitată', custom_id: `${prefix}:resolve:sanction:${id}` },
    { type: 2, style: 2, label: 'Anulează', custom_id: `${prefix}:cancel:sanction:${id}` },
    { type: 2, style: 4, label: 'Șterge', custom_id: `${prefix}:delete:sanction:${id}` },
  ] }];
}

function disciplineEmbed(record: any, kind: 'warning' | 'sanction', context: any, action = 'nou') {
  const audience = context.audience === 'organization' ? 'Organizație' : 'Angajați';
  const resolved = kind === 'warning' ? ['resolved', 'revoked'].includes(String(record.status)) : ['paid', 'waived', 'cancelled'].includes(String(record.status));
  const status = kind === 'warning' ? (record.status === 'resolved' ? 'Rezolvat' : record.status === 'revoked' ? 'Revocat' : 'Activ') : ({ paid: 'Achitată', waived: 'Anulată', cancelled: 'Anulată' } as any)[record.status] || 'Emisă';
  const fields: any[] = [
    { name: '👤 Vizat', value: String(record.target_name || context.organization.name).slice(0, 1024), inline: true },
    { name: '📌 Status', value: status, inline: true },
    { name: '💬 Motiv', value: String(record.reason || '—').slice(0, 1024), inline: false },
  ];
  if (kind === 'sanction') fields.splice(2, 0, { name: '💰 Sumă', value: `${record.amount} ${record.currency}`, inline: true }, { name: '📊 Avertismente active', value: String(record.warning_count_snapshot || 0), inline: true });
  if (record.notes) fields.push({ name: '📝 Note', value: String(record.notes).slice(0, 1024), inline: false });
  if (record.evidence_url) fields.push({ name: '📎 Dovadă', value: String(record.evidence_url).slice(0, 1024), inline: false });
  if (record.due_at) fields.push({ name: '📅 Scadență', value: new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'short' }).format(new Date(record.due_at)), inline: true });
  return { title: `${kind === 'warning' ? '⚠️ Avertisment' : '💰 Sancțiune'} ${action === 'nou' ? 'nou(ă)' : action} · ${audience}`, description: `Înregistrare salvată în Panel Pro pentru organizația **${context.organization.name}**.`, color: resolved ? 0x64748b : kind === 'warning' ? 0xf59e0b : 0xef4444, fields, footer: { text: `Panel Pro · ${kind === 'warning' ? 'Avertismente' : 'Sancțiuni'} · ${record.issued_by_name || context.displayName}` }, timestamp: new Date().toISOString() };
}

function actionComponents(id: string) {
  return [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge acțiunea', custom_id: `panel:actions:organization:delete:${id}` }] }];
}

function actionEmbed(record: any, context: any) {
  const participants = Array.isArray(record.participants) ? record.participants : [];
  return { title: `✅ Acțiune nouă · ${String(record.action_label || 'Acțiune').slice(0, 120)}`, description: String(record.description || 'A fost înregistrată o acțiune a organizației.').slice(0, 4096), color: 0x22c55e, fields: [
    { name: '📌 Tip', value: String(record.action_type || 'Personalizat'), inline: true },
    { name: '👥 Participanți', value: participants.length ? participants.map((item: any) => `• ${item.name || item.discord_id}`).join('\n').slice(0, 1024) : 'Nespecificați', inline: false },
    ...(record.notes ? [{ name: '📝 Note', value: String(record.notes).slice(0, 1024), inline: false }] : []),
  ], footer: { text: `Panel Pro · Acțiuni · ${record.created_by_name || context.displayName}` }, timestamp: new Date().toISOString() };
}

async function actionStats(db: any, context: any, days = 7) {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - (Math.max(1, Math.min(365, days)) - 1) * 86400000);
  const { data, error } = await db.from('discovery_actions').select('action_label,participants,created_at').eq('organization_id', context.organization.id).gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString()).order('created_at', { ascending: false });
  if (error) throw error;
  const people = new Map<string, { name: string; count: number }>();
  const types = new Map<string, number>();
  for (const row of data || []) {
    const label = String(row.action_label || 'Acțiune');
    types.set(label, (types.get(label) || 0) + 1);
    for (const participant of Array.isArray(row.participants) ? row.participants : []) {
      const id = String(participant?.discord_id || '').trim();
      if (!id) continue;
      const current = people.get(id) || { name: String(participant?.name || id), count: 0 };
      current.count += 1;
      people.set(id, current);
    }
  }
  const ranking = [...people.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'ro')).slice(0, 10);
  const rankingText = ranking.length ? ranking.map((person, index) => `${index + 1}. **${person.name}** — ${person.count} participări`).join('\n') : 'Nu există participări în perioada aleasă.';
  const typesText = [...types.entries()].sort((left, right) => right[1] - left[1]).map(([label, count]) => `${label}: ${count}`).join(' · ') || '—';
  return interactionMessage('', { embeds: [{ title: `📊 Clasament acțiuni · ${context.organization.name}`, color: 0x22c55e, fields: [
    { name: 'Perioadă', value: `Ultimele ${days} zile`, inline: true },
    { name: 'Acțiuni', value: String((data || []).length), inline: true },
    { name: 'Tipuri', value: typesText.slice(0, 1024), inline: false },
    { name: 'Top participanți', value: rankingText.slice(0, 1024), inline: false },
  ], footer: { text: 'Panel Pro · clasament salvat în Supabase' }, timestamp: new Date().toISOString() }] });
}

async function loadDiscordMember(discordId: string, guildId: string, db: any) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) throw new Error('Botul Discord nu este configurat.');
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordId}`, { headers: { Authorization: `Bot ${token}` } });
  if (!response.ok) throw new Error(`Membrul Discord nu a putut fi citit (HTTP ${response.status}).`);
  const member = await response.json();
  const user = member?.user || {};
  return { discord_id: String(user.id || discordId), name: String(member?.nick || user.global_name || user.username || discordId).trim(), username: String(user.username || '').trim(), role_ids: Array.isArray(member?.roles) ? member.roles.map((id: any) => String(id)) : [] };
}

function contractTemplateFallback() {
  return `CONTRACT INDIVIDUAL DE MUNCĂ

Angajator: {{COMPANY}}, reprezentată de {{MANAGER}}.
Adresă: {{ADDRESS}}.

Angajat: {{EMPLOYEE_NAME}}
CNP: {{CNP}}
Telefon: {{PHONE}}

Funcție: {{POSITION}}
Salariu: {{SALARY}}
Program: {{PROGRAM}}
Data începerii: {{START_DATE}}
Număr contract: {{CONTRACT_NUMBER}}

Contractul este încheiat pe perioadă nedeterminată, iar orice modificare se face prin act adițional semnat de ambele părți.

ANGAJATOR: {{MANAGER}}
ANGAJAT: {{EMPLOYEE_NAME}}`;
}

function contractValue(value: unknown, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 1000);
}

function replaceContractPlaceholders(template: string, values: Record<string, string>) {
  return String(template || '').replace(/{{([A-Z0-9_]+)}}/g, (match, key) => values[key] ?? match).slice(0, 50000);
}

async function nextContractNumber(db: any, organizationId: string, dateText: string) {
  const { data, error } = await db.from('discovery_contracts').select('contract_number').eq('organization_id', organizationId).ilike('contract_number', `CN-${dateText}-%`).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const prefix = `CN-${dateText}-`;
  const highest = (data || []).reduce((max: number, item: any) => {
    const value = String(item?.contract_number || '');
    if (!value.startsWith(prefix)) return max;
    const number = Number.parseInt(value.slice(prefix.length), 10);
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(5, '0')}`;
}

function contractEmbed(contract: any, organization: any, title: string, instructionText = '') {
  const fields = [
    { name: '👤 Angajat', value: contract.employee_name, inline: true },
    { name: '🪪 CNP', value: contract.cnp, inline: true },
    { name: '📞 Telefon', value: contract.phone, inline: true },
    { name: '💼 Funcție', value: contract.position, inline: true },
    { name: '💰 Salariu', value: contract.salary, inline: true },
    { name: '🕒 Program', value: contract.schedule, inline: true },
    { name: '📅 Data începerii', value: discoveryDisplayDate(contract.start_date), inline: true },
    { name: '🔢 Număr contract', value: contract.contract_number, inline: true },
    { name: '👔 Manager', value: contract.manager, inline: true },
  ];
  if (instructionText) fields.push({ name: '📎 Imagini necesare', value: instructionText, inline: false });
  return {
    title: `📄 ${title} · ${organization.name}`.slice(0, 256),
    description: 'Contractul a fost generat din șablonul configurat în Panel Pro și salvat în istoricul organizației.',
    color: 0x14b8a6,
    fields,
    footer: { text: 'Panel Pro · Log contracte · datele sunt salvate în Supabase' },
    timestamp: new Date().toISOString(),
  };
}

function contractComponents(contractId: string, includePublish = true) {
  const components: any[] = [{ type: 2, style: 1, label: 'Copiază contractul', custom_id: `panel:contracts:copy:${contractId}` }];
  if (includePublish) components.push({ type: 2, style: 3, label: 'Trimite contractul', custom_id: `panel:contracts:publish:${contractId}` });
  return [{ type: 1, components }];
}

function contractCopyModal(contract: any) {
  const text = String(contract?.contract_text || '').trim().slice(0, 4000);
  return { type: 9, data: { custom_id: `panel:contracts:copy:modal:${String(contract?.id || '')}`, title: `Contract ${String(contract?.contract_number || '').slice(0, 28)}`, components: [{ type: 1, components: [{ type: 4, custom_id: 'contract_text', label: 'Contract generat · Ctrl+A / Ctrl+C', style: 2, required: true, value: text, max_length: 4000 }]}] } };
}

async function loadSavedContract(db: any, context: any, contractId: string) {
  const { data: contract, error: contractError } = await db.from('discovery_contracts').select('id,employee_id,contract_number,contract_text,phone,position,salary,schedule,start_date,created_by_discord_id,discord_message_id,discord_message_ids').eq('organization_id', context.organization.id).eq('id', contractId).maybeSingle();
  if (contractError) throw contractError;
  if (!contract) return null;
  const { data: employee, error: employeeError } = await db.from('discovery_employees').select('full_name,cnp,discord_id').eq('organization_id', context.organization.id).eq('id', contract.employee_id).maybeSingle();
  if (employeeError) throw employeeError;
  return { ...contract, employee_name: employee?.full_name || 'Angajat', cnp: employee?.cnp || '—', manager: context.displayName };
}

async function handleContractSubmit(db: any, context: any, values: Record<string, any>) {
  const employeeName = contractValue(values.employee_name, '');
  const cnp = contractValue(values.cnp, '');
  const phone = contractValue(values.phone, '');
  if (!employeeName) return interactionMessage('Numele și prenumele sunt obligatorii.');
  if (!cnp) return interactionMessage('CNP-ul angajatului este obligatoriu.');
  if (!phone) return interactionMessage('Numărul de telefon al angajatului este obligatoriu.');
  const { data: templateSetting, error: templateError } = await db.from('discovery_app_settings').select('value').eq('organization_id', context.organization.id).eq('key', 'contract_template').maybeSingle();
  if (templateError) throw templateError;
  const custom = templateSetting?.value && typeof templateSetting.value === 'object' ? templateSetting.value : {};
  const defaults = custom.defaults && typeof custom.defaults === 'object' ? custom.defaults : {};
  const today = romanianDisplayDate();
  const requestedStartDate = contractValue(values.start_date, today);
  const startDateKey = requestDateKey(requestedStartDate);
  if (!startDateKey) return interactionMessage('Data începerii trebuie să fie în format **zz.ll.aaaa**.');
  const startDate = discoveryDisplayDate(startDateKey);
  const contractNumber = await nextContractNumber(db, String(context.organization.id), today);
  const contract = {
    employee_name: employeeName,
    cnp,
    phone,
    position: contractValue(defaults.position, 'Angajat'),
    salary: contractValue(defaults.salary, '100 lei/lună'),
    schedule: contractValue(defaults.schedule, '20:00-23:00'),
    start_date: startDate,
    contract_number: contractNumber,
    manager: context.displayName,
  };
  const template = String(custom.template || contractTemplateFallback()).trim().slice(0, 50000);
  const contractText = replaceContractPlaceholders(template, {
    COMPANY: contractValue(context.organization.name, 'Organizație'),
    ADDRESS: contractValue(context.organization.address, '—'),
    MANAGER: contract.manager,
    EMPLOYEE_NAME: contract.employee_name,
    CNP: contract.cnp,
    PHONE: contract.phone,
    POSITION: contract.position,
    SALARY: contract.salary,
    PROGRAM: contract.schedule,
    START_DATE: contract.start_date,
    CONTRACT_NUMBER: contract.contract_number,
  });
  const now = new Date().toISOString();
  const { data: existingEmployee, error: existingEmployeeError } = await db.from('discovery_employees').select('id').eq('organization_id', context.organization.id).eq('cnp', contract.cnp).maybeSingle();
  if (existingEmployeeError) throw existingEmployeeError;
  let employee: any;
  if (existingEmployee?.id) {
    const { data: updatedEmployee, error: updateEmployeeError } = await db.from('discovery_employees').update({ full_name: contract.employee_name, status: 'active', left_at: null, archived_at: null, updated_at: now }).eq('organization_id', context.organization.id).eq('id', existingEmployee.id).select('id').single();
    if (updateEmployeeError) throw updateEmployeeError;
    employee = updatedEmployee;
  } else {
    const { data: upsertedEmployee, error: employeeError } = await db.from('discovery_employees').upsert({ organization_id: context.organization.id, full_name: contract.employee_name, cnp: contract.cnp, status: 'active', left_at: null, archived_at: null, updated_at: now }, { onConflict: 'organization_id,cnp' }).select('id').single();
    if (employeeError) throw employeeError;
    employee = upsertedEmployee;
  }
  const { data: saved, error: contractError } = await db.from('discovery_contracts').insert({ organization_id: context.organization.id, employee_id: employee.id, contract_number: contract.contract_number, contract_text: contractText, phone: contract.phone, position: contract.position, salary: contract.salary, schedule: contract.schedule, start_date: contract.start_date, created_by_discord_id: context.discordId }).select('id').single();
  if (contractError) {
    if (contractError.code === '23505') return interactionMessage('Numărul contractului există deja. Încearcă din nou.');
    throw contractError;
  }
  return interactionMessage(`Contractul **${contract.contract_number}** a fost generat și salvat. Copiază-l, apoi apasă **Trimite contractul**. Contractul va fi publicat în canalul ales pentru Log contracte, iar imaginile le poți lipi manual sub mesaj.`, { embeds: [contractEmbed(contract, context.organization, 'Contract generat')], components: contractComponents(String(saved.id)) });
}

async function handleContractPublish(db: any, context: any, contractId: string) {
  const contract = await loadSavedContract(db, context, contractId);
  if (!contract) return interactionMessage('Contractul nu mai există în istoricul organizației.');
  if (contract.discord_message_id) return interactionMessage('Contractul este deja publicat în Log contracte.');
  const destinations = routeCandidates(context.settings, context.logRouteKey);
  if (!destinations.some((item: any) => item.candidates.length)) return interactionMessage(`Contractul **${contract.contract_number}** este generat, dar canalul „Log contracte” nu este configurat.`);
  const payload = JSON.stringify({
    allowed_mentions: { parse: [] },
    embeds: [contractEmbed(contract, context.organization, 'Contract nou', 'Atașează imaginile cu buletinul și contractul sub acest mesaj.')]
  });
  const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, payload, { postOnly: true });
  const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [String(item.target), String(item.id)]));
  if (Object.keys(messageIds).length) {
    const firstMessageId = Object.values(messageIds)[0] as string;
    const { error: messageUpdateError } = await db.from('discovery_contracts').update({ discord_message_id: firstMessageId, discord_message_ids: messageIds }).eq('organization_id', context.organization.id).eq('id', contract.id);
    if (messageUpdateError) throw messageUpdateError;
  }
  const destination = destinations.find((item: any) => item.target === context.target)?.candidates?.[0];
  const channelLink = destination?.channel_id ? `https://discord.com/channels/${context.guildId}/${destination.channel_id}` : '';
  return interactionMessage(
    `Contractul **${contract.contract_number}** pentru **${contract.employee_name}** a fost trimis în canalul ales pentru Log contracte.`,
    channelLink
      ? { components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Adaugă imagini', url: channelLink }] }] }
      : {}
  );
}

async function sendDisciplineDiscord(db: any, context: any, kind: 'warning' | 'sanction', record: any, action = 'nou') {
  const routeKey = context.logRouteKey || announcementRoutes(context.audience).log;
  const destinations = routeCandidates(context.settings, routeKey);
  if (!destinations.some((item: any) => item.candidates.length)) throw new Error(`Canalul Discord pentru ${routeKey} nu este configurat.`);
  const payload = JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [disciplineEmbed(record, kind, context, action)], components: disciplineComponents(context.audience, kind, String(record.id)) });
  const delivery = await deliverDiscordRoute(db, context.settings, routeKey, payload, { messageIds: record.discord_message_id ? { [context.target]: String(record.discord_message_id) } : {} });
  return delivery.results?.[0]?.id || null;
}

async function handleDisciplineSubmit(db: any, context: any, interaction: any, kind: 'warning' | 'sanction', values: Record<string, string>, targetId: string) {
  const target = await loadDiscordMember(targetId, context.guildId, db);
  const now = new Date().toISOString();
  if (kind === 'warning') {
    const countQuery = db.from('discovery_disciplinary_warnings').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('target_scope', context.audience).eq('status', 'active');
    if (target.discord_id) countQuery.eq('target_discord_id', target.discord_id);
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    if (Number(count || 0) >= 3) return interactionMessage('Destinatarul are deja 3 avertismente active. Poți aplica o sancțiune financiară.');
    const reason = String(values.reason || '').trim();
    if (reason.length < 3) return interactionMessage('Motivul trebuie să aibă cel puțin 3 caractere.');
    const { data: record, error } = await db.from('discovery_disciplinary_warnings').insert({ organization_id: context.organization.id, target_scope: context.audience, target_discord_id: target.discord_id, target_name: target.name, reason, notes: String(values.notes || '').trim(), evidence_url: String(values.evidence_url || '').trim() || null, issued_by_discord_id: context.discordId, issued_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
    if (error) throw error;
    const messageId = await sendDisciplineDiscord(db, context, 'warning', record);
    if (messageId) await db.from('discovery_disciplinary_warnings').update({ discord_message_id: messageId }).eq('organization_id', context.organization.id).eq('id', record.id);
    return interactionMessage(`Avertismentul a fost salvat și trimis în canalul Discord configurat pentru ${context.audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  }
  const countQuery = db.from('discovery_disciplinary_warnings').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('target_scope', context.audience).eq('status', 'active');
  if (target.discord_id) countQuery.eq('target_discord_id', target.discord_id);
  const { count, error: countError } = await countQuery;
  if (countError) throw countError;
  const amountMatch = /^\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*([A-Za-z0-9]{2,8})?\s*$/.exec(String(values.amount_currency || ''));
  const amount = amountMatch ? Number(amountMatch[1].replace(',', '.')) : NaN;
  const currency = String(amountMatch?.[2] || 'USD').toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z0-9]{2,8}$/.test(currency)) return interactionMessage('Introdu o sumă validă, de exemplu **500 USD**.');
  const reason = String(values.reason || '').trim();
  if (reason.length < 3) return interactionMessage('Motivul trebuie să aibă cel puțin 3 caractere.');
  let dueAt: string | null = null;
  if (String(values.due_at || '').trim()) { const parsed = requestDateTime(values.due_at, true); if (!parsed) return interactionMessage('Scadența trebuie să fie în format **zz.ll.aaaa**.'); dueAt = parsed.toISOString(); }
  const { data: record, error } = await db.from('discovery_disciplinary_sanctions').insert({ organization_id: context.organization.id, target_scope: context.audience, target_discord_id: target.discord_id, target_name: target.name, warning_count_snapshot: Number(count || 0), amount, currency, reason, notes: String(values.notes || '').trim(), evidence_url: String(values.evidence_url || '').trim() || null, due_at: dueAt, issued_by_discord_id: context.discordId, issued_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
  if (error) throw error;
  const messageId = await sendDisciplineDiscord(db, context, 'sanction', record);
  if (messageId) await db.from('discovery_disciplinary_sanctions').update({ discord_message_id: messageId }).eq('organization_id', context.organization.id).eq('id', record.id);
  return interactionMessage('Sancțiunea a fost salvată și trimisă în canalul Discord configurat.');
}

async function publishActionRecord(db: any, context: any, record: any) {
  // Panoul de control rămâne în canalul de anunțuri, dar rezultatul acțiunii
  // se publică separat pe ruta configurată pentru „Acțiuni organizație”.
  const routeKey = 'log_actions_organization';
  const destinations = routeCandidates(context.settings, routeKey);
  if (!destinations.some((item: any) => item.candidates.length)) return interactionMessage('Acțiunea a fost salvată în Supabase, dar canalul „Log acțiuni organizație” nu este configurat.');
  const delivery = await deliverDiscordRoute(db, context.settings, routeKey, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [actionEmbed(record, context)], components: actionComponents(String(record.id)) }));
  const messageId = delivery.results?.[0]?.id || null;
  if (messageId) await db.from('discovery_actions').update({ discord_message_id: messageId }).eq('organization_id', context.organization.id).eq('id', record.id);
  return interactionMessage(`Acțiunea a fost salvată și publicată în ${delivery.results.length || 0} canal Discord.`);
}

async function createActionDraft(db: any, context: any, values: Record<string, string>) {
  const type = String(values.action_type || '').trim().slice(0, 40);
  const label = String(values.action_label || '').trim().slice(0, 120);
  if (type.length < 2 || label.length < 2) return interactionMessage('Completează tipul și denumirea acțiunii.');
  const now = new Date().toISOString();
  await db.from('discovery_action_drafts').delete().lt('expires_at', now);
  const { data: draft, error } = await db.from('discovery_action_drafts').insert({ organization_id: context.organization.id, guild_id: context.guildId, created_by_discord_id: context.discordId, created_by_name: context.displayName, action_type: type, action_label: label, description: String(values.description || '').trim().slice(0, 4000), notes: String(values.notes || '').trim().slice(0, 4000), expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }).select('id').single();
  if (error) throw error;
  return actionParticipantPicker(String(draft.id));
}

async function finalizeActionDraft(db: any, context: any, draftId: string, participantIds: string[]) {
  const { data: draft, error: draftError } = await db.from('discovery_action_drafts').select('*').eq('id', draftId).eq('organization_id', context.organization.id).eq('guild_id', context.guildId).eq('created_by_discord_id', context.discordId).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (draftError) throw draftError;
  if (!draft) return interactionMessage('Selecția participanților a expirat. Apasă din nou pe butonul Acțiune.');
  const ids = [...new Set(participantIds.map(String).filter((id) => /^\d{15,22}$/.test(id)))].slice(0, 25);
  const participants = [];
  for (const id of ids) participants.push(await loadDiscordMember(id, context.guildId, db));
  const now = new Date().toISOString();
  const { data: record, error } = await db.from('discovery_actions').insert({ organization_id: context.organization.id, action_type: draft.action_type, action_label: draft.action_label, description: draft.description || '', notes: draft.notes || '', guild_id: context.guildId, guild_name: '', participants, created_by_discord_id: context.discordId, created_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
  await db.from('discovery_action_drafts').delete().eq('id', draft.id);
  if (error) throw error;
  return publishActionRecord(db, context, record);
}

function requestModal(audience: 'organization' | 'departments') {
  const label = audience === 'organization' ? 'Organizație' : 'Angajați';
  const input = (custom_id: string, labelText: string, style: number, required: boolean, placeholder: string, max_length: number, value = '') => ({ type: 4, custom_id, label: labelText, style, required, placeholder, max_length, ...(value ? { value } : {}) });
  return { type: 9, data: { custom_id: `panel:requests:${audience}:submit`, title: `Învoire · ${label}`, components: [
    { type: 1, components: [input('start_date', 'Data începerii', 1, true, 'zz.ll.aaaa', 10, romanianDisplayDate())] },
    { type: 1, components: [input('end_date', 'Data sfârșitului', 1, true, 'zz.ll.aaaa', 10)] },
    { type: 1, components: [input('reason', 'Motiv / mențiuni', 2, true, 'Explică pe scurt situația...', 1000)] },
    { type: 1, components: [input('proof_url', 'Dovadă / document (opțional)', 1, false, 'https://...', 500)] },
  ] } };
}

function marketplaceModal(kind: 'legal' | 'illegal') {
  const illegal = kind === 'illegal';
  const fields: any[] = [
    { type: 4, custom_id: 'name', label: 'Nume afișat', style: 1, required: true, max_length: 120 },
    { type: 4, custom_id: 'phone', label: 'Număr de telefon', style: 1, required: true, max_length: 40 },
    { type: 4, custom_id: 'action', label: 'Tip: Vânzare / Cumpărare / Servicii', style: 1, required: true, max_length: 20 },
    { type: 4, custom_id: 'products', label: 'Produse / descriere', style: 2, required: true, max_length: 1400, placeholder: 'Descrierea anunțului' },
    { type: 4, custom_id: 'price', label: 'Preț (opțional)', style: 1, required: false, max_length: 80, placeholder: 'Ex: 50.000$ · lasă gol pentru Negociabil' },
  ];
  return { type: 9, data: { custom_id: `panel:marketplace:${kind}:submit`, title: illegal ? 'Anunț Marketplace ilegal' : 'Anunț Marketplace legal', components: fields.map((field) => ({ type: 1, components: [field] })) } };
}

async function resolveMarketplaceContext(db: any, interaction: any, kind: 'legal' | 'illegal') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  const routeKey = kind === 'illegal' ? 'illegal_marketplace' : 'discovery_marketplace_legal';
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const [{ data: organization, error: organizationError }, { data: settings, error: settingsError }, { data: packageSetting, error: packageError }] = await Promise.all([
    db.from('discovery_organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle(),
    db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle(),
    db.from('discovery_app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'organization_package').maybeSingle(),
  ]);
  if (organizationError) throw organizationError;
  if (settingsError) throw settingsError;
  if (packageError) throw packageError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  if (!channelMatches(settings, routeKey, target, channelId)) throw new Error(`Acest canal nu este configurat pentru ${PANEL_ROUTE_LABELS[routeKey]}.`);
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  const discordOnly = packageSetting?.value?.code === 'discord';
  if (!platformAdmin && !discordOnly && !isDiscordManager(interaction)) throw new Error('Nu ai permisiunea de a publica anunțuri în acest marketplace.');
  const logRouteKey = kind === 'illegal' ? 'log_illegal_marketplace' : 'log_marketplace';
  if (!settings?.discord_channel_routes?.[logRouteKey]?.[target]?.channel_id) throw new Error(`Configurează mai întâi canalul de log pentru ${PANEL_ROUTE_LABELS[routeKey]}. Anunțul nu va fi publicat în canalul embedului.`);
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, routeKey, logRouteKey };
}

function marketplaceEmbed(kind: 'legal' | 'illegal', values: Record<string, any>, context: any, id = '') {
  const illegal = kind === 'illegal';
  const fields = [
    { name: 'Nume', value: String(values.name || '—').slice(0, 1024), inline: true },
    { name: 'Telefon', value: String(values.phone || '—').slice(0, 1024), inline: true },
    { name: 'Tip acțiune', value: String(values.action || '—').slice(0, 1024), inline: true },
    { name: 'Categorie', value: String(values.category || 'General').slice(0, 1024), inline: true },
    ...(illegal && values.subcategory ? [{ name: 'Subcategorie', value: String(values.subcategory).slice(0, 1024), inline: true }] : []),
    { name: 'Produse / descriere', value: String(values.products || '—').slice(0, 1024), inline: false },
    { name: 'Preț', value: String(values.price || 'Negociabil').slice(0, 1024), inline: true },
  ];
  return { allowed_mentions: { parse: [] }, embeds: [{ title: illegal ? '🚨 Anunț nou · Marketplace ilegal' : '🛒 Anunț nou · Marketplace legal', description: `Publicat de **${String(context.displayName || context.discordId)}**.`, color: illegal ? 0xef4444 : 0x2563eb, fields, footer: { text: 'Panel Pro · fără imagini în versiunea Discord' }, timestamp: new Date().toISOString() }], components: id ? [{ type: 1, components: [{ type: 2, style: 5, label: 'Deschide în panel', url: `https://panel-pro.ro/${illegal ? 'marketplace-ilegal.html' : 'marketplace.html'}?anunt=${encodeURIComponent(id)}` }] }] : [] };
}

async function handleMarketplaceSubmit(db: any, context: any, kind: 'legal' | 'illegal', values: Record<string, any>) {
  const table = kind === 'illegal' ? 'discovery_marketplace_illegal' : 'discovery_marketplace_legal';
  const name = String(values.name || '').trim();
  const products = String(values.products || '').trim();
  if (!name || !products) throw new Error('Completează numele și descrierea anunțului.');
  const row: any = { nume: name.slice(0, 120), telefon: String(values.phone || '').trim().slice(0, 40), tip_actiune: String(values.action || 'Vânzare').trim().slice(0, 30), categorie: String(values.category || 'General').trim().slice(0, 80) || 'General', produse: products.slice(0, 4000), pret: String(values.price || 'Negociabil').trim().slice(0, 80) || 'Negociabil', imagini_json: '[]', imagine_url: null, created_by_discord_id: context.discordId };
  if (kind === 'illegal') { row.organization_id = null; row.subcategorie = String(values.subcategory || '').trim().slice(0, 100) || null; }
  else row.organization_id = context.organization.id;
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw error;
  const payload = JSON.stringify(marketplaceEmbed(kind, values, context, String(data.id)));
  // Canalul modulului conține doar embedul cu butoane. Anunțurile create
  // din Discord se publică exclusiv în canalul de log configurat.
  const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, payload, { postOnly: true });
  const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
  if (Object.keys(messageIds).length) await db.from(table).update({ discord_message_ids: messageIds }).eq('id', data.id);
  if (!delivery.results?.length) return interactionMessage(`Anunțul a fost salvat, dar logul nu a putut fi trimis: ${delivery.failures?.join(' | ') || 'Discord nu a acceptat mesajul.'}`);
  return interactionMessage(`Anunțul a fost salvat și publicat în canalul de log configurat pentru ${PANEL_ROUTE_LABELS[context.routeKey]}.`);
}

async function resolveStashContext(db: any, interaction: any, routeKey: 'stash' | 'log_stash' | 'stash_requests' | 'stash_donations', permission: 'write' | 'request' | 'manage_requests' | 'donate' | 'approve_donation') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const [{ data: organization, error: organizationError }, { data: settings, error: settingsError }, { data: packageSetting, error: packageError }, { data: permissionSetting, error: permissionError }] = await Promise.all([
    db.from('discovery_organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle(),
    db.from('discovery_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle(),
    db.from('discovery_app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'organization_package').maybeSingle(),
    db.from('discovery_app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'action_permissions').maybeSingle(),
  ]);
  if (organizationError || settingsError || packageError || permissionError) throw organizationError || settingsError || packageError || permissionError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const discordOnly = packageSetting?.value?.code === 'discord';
  if (!resolvePackageFeatures(packageSetting?.value || {}).includes('stash')) throw new Error('Stash nu este inclus în pachetul organizației.');
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  if (!channelMatches(settings, routeKey, target, channelId)) throw new Error(`Acest canal nu este configurat pentru panoul ${routeKey === 'stash' ? 'Stash' : routeKey === 'log_stash' ? 'Log stash' : routeKey === 'stash_requests' ? 'Cereri stash' : 'Donații stash'}.`);
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('discovery_role_mappings').select('discord_role_id,panel_role,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const { data: member, error: memberError } = await db.from('discovery_members').select('panel_role').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const roleIds = new Set(member?.panel_role ? [...memberRoles, ...(mappings || []).filter((row: any) => String(row.panel_role || '').toLowerCase() === String(member.panel_role).toLowerCase()).map((row: any) => String(row.discord_role_id))] : [...memberRoles]);
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  const configured = Array.isArray(permissionSetting?.value?.[`stash.${permission}`]) ? permissionSetting.value[`stash.${permission}`].map(String) : [];
  if (!platformAdmin && !discordOnly && !configured.some((id: string) => roleIds.has(id))) throw new Error('Nu ai permisiunea configurată pentru această funcție Stash.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, logRouteKey: permission === 'request' || permission === 'manage_requests' ? 'log_stash_requests' : permission === 'donate' || permission === 'approve_donation' ? 'log_stash_donations' : 'log_stash' };
}

function stashModal(kind: 'item' | 'request' | 'donation') {
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required, placeholder, max_length });
  const rows = kind === 'item'
    ? [input('title', 'Articol', 1, true, 'Numele articolului', 140), input('category', 'Categorie', 1, true, 'Categoria', 60), input('quantity', 'Număr iteme', 1, true, '0', 20), input('description', 'Detalii', 2, false, 'Detalii despre articol', 1000)]
    : kind === 'request'
      ? [input('item_title', 'Articol solicitat', 1, true, 'Numele articolului', 140), input('quantity', 'Cantitate', 1, true, '0', 20), input('note', 'Motivul cererii', 2, true, 'De ce este necesar articolul?', 1000)]
      : [input('title', 'Articol donat', 1, true, 'Numele articolului', 140), input('category', 'Categorie', 1, true, 'Categoria', 60), input('quantity', 'Număr iteme', 1, true, '0', 20), input('note', 'Notă', 2, false, 'Detalii donație', 1000)];
  return { type: 9, data: { custom_id: `panel:stash:${kind}:submit`, title: kind === 'item' ? 'Adaugă în Stash' : kind === 'request' ? 'Cerere Stash' : 'Donație Stash', components: rows.map((row) => ({ type: 1, components: [row] })) } };
}

function stashRejectionModal(id: string, sourceMessageId = '') {
  return {
    type: 9,
    data: {
      custom_id: `panel:stash:reject_submit:${id}:${/^\d{15,22}$/.test(sourceMessageId) ? sourceMessageId : ''}`,
      title: 'Motiv respingere cerere',
      components: [{ type: 1, components: [{ type: 4, custom_id: 'rejection_reason', label: 'Motivul respingerii', style: 2, required: true, placeholder: 'Explică de ce cererea este respinsă.', max_length: 1000 }] }],
    },
  };
}

function stashPendingView(kind: 'request' | 'donation', rows: any[]) {
  const label = kind === 'request' ? 'cererile' : 'donațiile';
  if (!rows.length) return interactionMessage(`Nu există ${label} în așteptare.`);
  const options = rows.slice(0, 25).map((row: any) => ({ label: String(kind === 'request' ? row.item_title : row.title).slice(0, 100), value: String(row.id), description: `${row.quantity} iteme · ${String(kind === 'request' ? row.requested_by_name : row.donated_by_name).slice(0, 70)}`.slice(0, 100) }));
  return interactionMessage(`Selectează ${kind === 'request' ? 'cererea' : 'donația'} pe care vrei să o gestionezi.`, { components: [{ type: 1, components: [{ type: 3, custom_id: `panel:stash:select_${kind}`, placeholder: `Alege ${kind === 'request' ? 'o cerere' : 'o donație'}`, min_values: 1, max_values: 1, options }] }] });
}

function stashDecisionView(kind: 'request' | 'donation', id: string, row: any) {
  const title = kind === 'request' ? row.item_title : row.title;
  return interactionMessage(`Ai selectat **${String(title).slice(0, 120)}** · ${row.quantity} iteme.`, { components: [{ type: 1, components: [{ type: 2, style: 3, label: 'Aprobă', custom_id: `panel:stash:decision_${kind}:approved:${id}` }, { type: 2, style: 4, label: 'Respinge', custom_id: `panel:stash:decision_${kind}:rejected:${id}` }] }] });
}

function stashManageItemsView(rows: any[]) {
  if (!rows.length) return interactionMessage('Nu există articole disponibile în Stash.');
  const options = rows.slice(0, 25).map((row: any) => ({ label: String(row.title || 'Articol').slice(0, 100), value: String(row.id), description: `${row.quantity} ${row.unit || 'buc.'} · ${String(row.category || 'General').slice(0, 70)}`.slice(0, 100) }));
  return interactionMessage('Selectează articolul pe care vrei să îl modifici sau să îl elimini.', { components: [{ type: 1, components: [{ type: 3, custom_id: 'panel:stash:select_manage_item', placeholder: 'Alege un articol din Stash', min_values: 1, max_values: 1, options }] }] });
}

function stashItemActionView(id: string, row: any) {
  return interactionMessage(`Ai selectat **${String(row.title).slice(0, 120)}** · ${row.quantity} ${row.unit || 'buc.'}.`, { components: [{ type: 1, components: [{ type: 2, style: 2, label: 'Arhivează', custom_id: `panel:stash:item_action:archive:${id}` }, { type: 2, style: 4, label: 'Șterge definitiv', custom_id: `panel:stash:item_action:delete:${id}` }] }] });
}

function stashInventoryEmbed(rows: any[]) {
  const available = rows.filter((row: any) => String(row.status || 'available') === 'available');
  const description = available.length
    ? available.slice(0, 25).map((row: any, index: number) => `**${index + 1}. ${String(row.title).slice(0, 100)}** · ${row.quantity} ${row.unit || 'buc.'} · ${String(row.category || 'General').slice(0, 60)}`).join('\n')
    : 'Nu există articole disponibile momentan pentru cereri.';
  return { allowed_mentions: { parse: [] }, embeds: [{ title: '📦 Inventar Stash · Disponibil pentru cereri', description, color: 0x22c55e, footer: { text: `Panel Pro · ${available.length} articole disponibile` }, timestamp: new Date().toISOString() }] };
}

function stashChangeEmbed(action: 'archived' | 'deleted', row: any) {
  return { allowed_mentions: { parse: [] }, embeds: [{ title: action === 'archived' ? '🗄️ Articol Stash arhivat' : '🗑️ Articol Stash șters', description: `Articolul **${String(row.title || 'Articol').slice(0, 120)}** a fost ${action === 'archived' ? 'arhivat' : 'șters definitiv'} din Stash.`, fields: [{ name: 'Cantitate', value: `${row.quantity} ${row.unit || 'buc.'}`, inline: true }, { name: 'Categorie', value: String(row.category || 'General'), inline: true }, { name: 'Modificat de', value: String(row.updated_by_name || row.created_by_name || 'Administrator'), inline: true }], color: action === 'archived' ? 0xf59e0b : 0xef4444, timestamp: new Date().toISOString() }] };
}

async function publishStashInventory(db: any, context: any, change: 'archived' | 'deleted', row: any) {
  const { data: available, error } = await db.from('discovery_stash_items').select('title,category,quantity,unit,status').eq('organization_id', context.organization.id).eq('status', 'available').order('created_at', { ascending: false }).limit(25);
  if (error) throw error;
  await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify(stashChangeEmbed(change, row)), { postOnly: true });
  await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify(stashInventoryEmbed(available || [])), { postOnly: true });
}

async function updateOrDeleteStashItemMessage(db: any, context: any, row: any, action: 'archived' | 'deleted') {
  const refs = row?.discord_message_ids && typeof row.discord_message_ids === 'object' ? row.discord_message_ids : {};
  const routes = context.settings?.discord_channel_routes?.log_stash || {};
  for (const [target, messageId] of Object.entries(refs)) {
    if (!/^\d{15,22}$/.test(String(messageId))) continue;
    const channelId = String(routes?.[target as string]?.channel_id || '').trim();
    if (!/^\d{15,22}$/.test(channelId)) continue;
    if (action === 'deleted') {
      await requestDiscordTarget(db, { target: String(target), transport: 'bot', channel_id: channelId }, null, { method: 'DELETE', messageId: String(messageId) }).catch(() => null);
    } else {
      await requestDiscordTarget(db, { target: String(target), transport: 'bot', channel_id: channelId }, JSON.stringify(stashChangeEmbed('archived', row)), { method: 'PATCH', messageId: String(messageId) }).catch(() => null);
    }
  }
}

async function handleStashItemAction(db: any, context: any, id: string, action: 'archived' | 'deleted') {
  const { data: row, error: loadError } = await db.from('discovery_stash_items').select('*').eq('organization_id', context.organization.id).eq('id', id).maybeSingle();
  if (loadError) throw loadError;
  if (!row) throw new Error('Articolul Stash nu mai există.');
  if (action === 'archived') {
    const updated = { ...row, status: 'archived', updated_by_name: context.displayName };
    const { error } = await db.from('discovery_stash_items').update({ status: 'archived', updated_by_discord_id: context.discordId, updated_at: new Date().toISOString() }).eq('organization_id', context.organization.id).eq('id', id);
    if (error) throw error;
    await updateOrDeleteStashItemMessage(db, context, updated, action);
    await publishStashInventory(db, context, action, updated);
    return interactionMessage(`Articolul **${row.title}** a fost arhivat, iar inventarul disponibil a fost actualizat.`);
  }
  await updateOrDeleteStashItemMessage(db, context, row, action);
  const { error } = await db.from('discovery_stash_items').delete().eq('organization_id', context.organization.id).eq('id', id);
  if (error) throw error;
  await publishStashInventory(db, context, action, row);
  return interactionMessage(`Articolul **${row.title}** a fost șters definitiv, iar inventarul disponibil a fost actualizat.`);
}

function stashApprovalEmbed(kind: 'request' | 'donation', row: any) {
  const request = kind === 'request';
  return {
    allowed_mentions: { parse: [] },
    content: request
      ? '🔔 NOTIFICARE STASH · A fost înregistrată o cerere nouă, care așteaptă aprobare.'
      : '🔔 NOTIFICARE STASH · A fost înregistrată o donație nouă, care așteaptă aprobare.',
    embeds: [{
      title: request ? '📨 Cerere Stash · În așteptare' : '🎁 Donație Stash · În așteptare',
      description: request ? 'Această cerere așteaptă aprobarea unui administrator.' : 'Această donație așteaptă aprobarea unui administrator.',
      color: request ? 0xf59e0b : 0xa78bfa,
      fields: request ? [
        { name: 'Articol', value: String(row.item_title || '—'), inline: true },
        { name: 'Cantitate', value: `${row.quantity} iteme`, inline: true },
        { name: 'Solicitat de', value: String(row.requested_by_name || '—'), inline: true },
        { name: 'Motivul cererii', value: String(row.note || 'Nu a fost specificat.'), inline: false },
      ] : [
        { name: 'Articol', value: String(row.title || '—'), inline: true },
        { name: 'Categorie', value: String(row.category || 'General'), inline: true },
        { name: 'Cantitate', value: `${row.quantity} iteme`, inline: true },
        { name: 'Donat de', value: String(row.donated_by_name || '—'), inline: true },
        { name: 'Detalii', value: String(row.note || 'Fără detalii.'), inline: false },
      ],
      footer: { text: 'Panel Pro · necesită aprobare' },
      timestamp: new Date().toISOString(),
    }],
  };
}

async function publishStashApproval(db: any, context: any, kind: 'request' | 'donation', row: any) {
  const delivery = await deliverDiscordRoute(db, context.settings, 'stash', JSON.stringify(stashApprovalEmbed(kind, row)), { postOnly: true });
  const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [String(item.target || 'primary'), String(item.id)]));
  if (Object.keys(messageIds).length) {
    const table = kind === 'request' ? 'discovery_stash_requests' : 'discovery_stash_donations';
    const { error } = await db.from(table).update({ discord_message_ids: messageIds }).eq('organization_id', context.organization.id).eq('id', row.id);
    if (error) throw error;
  }
  return delivery.results?.length || 0;
}

async function deleteStashApprovalMessages(db: any, context: any, kind: 'request' | 'donation', row: any) {
  const refs = row?.discord_message_ids && typeof row.discord_message_ids === 'object' ? row.discord_message_ids : {};
  const routes = context.settings?.discord_channel_routes?.stash || {};
  for (const [target, messageId] of Object.entries(refs)) {
    if (!/^\d{15,22}$/.test(String(messageId))) continue;
    const channelId = String(routes?.[target as string]?.channel_id || '').trim();
    if (!/^\d{15,22}$/.test(channelId)) continue;
    await requestDiscordTarget(db, { target: String(target), transport: 'bot', channel_id: channelId }, null, { method: 'DELETE', messageId: String(messageId) }).catch((error) => console.error(`[discord-interactions] stash ${kind} approval message delete failed`, error));
  }
}

async function loadStashDecisionRow(db: any, context: any, kind: 'request' | 'donation', id: string) {
  const table = kind === 'request' ? 'discovery_stash_requests' : 'discovery_stash_donations';
  const { data, error } = await db.from(table).select('*').eq('organization_id', context.organization.id).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'pending') throw new Error('Elementul selectat nu mai este în așteptare.');
  return data;
}

async function handleStashDecision(db: any, context: any, kind: 'request' | 'donation', id: string, decision: 'approved' | 'rejected', decisionReason = '') {
  const row = await loadStashDecisionRow(db, context, kind, id);
  const now = new Date().toISOString();
  if (kind === 'request') {
    const requestNote = String(row.note || '').trim();
    const storedNote = decision === 'rejected' && decisionReason
      ? `${requestNote}\n\n[Motiv respingere] ${decisionReason}`.trim()
      : requestNote;
    const { data, error } = await db.from('discovery_stash_requests').update({ status: decision, note: storedNote, handled_by_discord_id: context.discordId, handled_by_name: context.displayName, handled_at: now, updated_at: now }).eq('organization_id', context.organization.id).eq('id', id).eq('status', 'pending').select('*').single();
    if (error) throw error;
    const fields = [
      { name: 'Articol', value: String(data.item_title), inline: true },
      { name: 'Număr iteme', value: String(data.quantity), inline: true },
      { name: 'Solicitat de', value: String(data.requested_by_name), inline: true },
      { name: 'Motivul cererii', value: String(requestNote || 'Nu a fost specificat.'), inline: false },
      decision === 'approved'
        ? { name: 'Aprobată de', value: String(data.handled_by_name || context.displayName), inline: true }
        : { name: 'Motivul respingerii', value: String(decisionReason || 'Nu a fost specificat.'), inline: false },
      { name: 'Respinsă de', value: String(data.handled_by_name || context.displayName), inline: true },
      { name: 'Status', value: decision === 'approved' ? 'Aprobată' : 'Respinsă', inline: true },
    ];
    if (decision === 'approved') fields.splice(fields.length - 2, 1);
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash_requests', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: decision === 'approved' ? '✅ Cerere Stash aprobată' : '❌ Cerere Stash respinsă', fields, color: decision === 'approved' ? 0x22c55e : 0xef4444, timestamp: now }] }), { postOnly: true });
    const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    if (Object.keys(messageIds).length) await db.from('discovery_stash_requests').update({ discord_message_ids: messageIds }).eq('organization_id', context.organization.id).eq('id', id);
    await deleteStashApprovalMessages(db, context, kind, row);
    return interactionMessage(`Cererea a fost ${decision === 'approved' ? 'aprobată' : 'respinsă'} și logul a fost actualizat.`);
  }
  if (decision === 'approved') {
    const { data: item, error: itemError } = await db.from('discovery_stash_items').insert({ organization_id: context.organization.id, title: row.title, category: row.category || 'General', quantity: row.quantity, unit: 'buc.', description: row.note || '', status: 'available', source_type: 'donation', created_by_discord_id: row.donated_by_discord_id, created_by_name: row.donated_by_name, updated_by_discord_id: context.discordId, created_at: now, updated_at: now }).select('*').single();
    if (itemError) throw itemError;
    const { data: donation, error } = await db.from('discovery_stash_donations').update({ status: 'approved', reviewed_by_discord_id: context.discordId, reviewed_by_name: context.displayName, reviewed_at: now, stash_item_id: item.id, updated_at: now }).eq('organization_id', context.organization.id).eq('id', id).eq('status', 'pending').select('*').single();
    if (error) throw error;
    const itemDelivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '✅ Donație aprobată și adăugată în Stash', fields: [{ name: 'Articol', value: String(item.title), inline: true }, { name: 'Categorie', value: String(item.category), inline: true }, { name: 'Număr iteme', value: String(item.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Disponibil', inline: true }], color: 0x22c55e, timestamp: now }], components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge articolul', custom_id: `panel:stash:delete_item:${item.id}` }] }] }), { postOnly: true });
    const itemMessageIds = Object.fromEntries((itemDelivery.results || []).filter((entry: any) => entry.id).map((entry: any) => [entry.target, String(entry.id)]));
    if (Object.keys(itemMessageIds).length) await db.from('discovery_stash_items').update({ discord_message_ids: itemMessageIds }).eq('organization_id', context.organization.id).eq('id', item.id);
    const donationDelivery = await deliverDiscordRoute(db, context.settings, 'log_stash_donations', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '✅ Donație Stash aprobată', fields: [{ name: 'Articol', value: String(donation.title), inline: true }, { name: 'Număr iteme', value: String(donation.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Aprobată', inline: true }], color: 0x22c55e, timestamp: now }] }), { postOnly: true });
    const donationMessageIds = Object.fromEntries((donationDelivery.results || []).filter((entry: any) => entry.id).map((entry: any) => [entry.target, String(entry.id)]));
    if (Object.keys(donationMessageIds).length) await db.from('discovery_stash_donations').update({ discord_message_ids: donationMessageIds }).eq('organization_id', context.organization.id).eq('id', id);
    await deleteStashApprovalMessages(db, context, kind, row);
  } else {
    const { data: donation, error } = await db.from('discovery_stash_donations').update({ status: 'rejected', reviewed_by_discord_id: context.discordId, reviewed_by_name: context.displayName, reviewed_at: now, updated_at: now }).eq('organization_id', context.organization.id).eq('id', id).eq('status', 'pending').select('*').single();
    if (error) throw error;
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash_donations', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '❌ Donație Stash respinsă', fields: [{ name: 'Articol', value: String(donation.title), inline: true }, { name: 'Număr iteme', value: String(donation.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Respinsă', inline: true }], color: 0xef4444, timestamp: now }] }), { postOnly: true });
    const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    if (Object.keys(messageIds).length) await db.from('discovery_stash_donations').update({ discord_message_ids: messageIds }).eq('organization_id', context.organization.id).eq('id', id);
    await deleteStashApprovalMessages(db, context, kind, row);
  }
  return interactionMessage(`Donația a fost ${decision === 'approved' ? 'aprobată și adăugată în Stash' : 'respinsă'}.`);
}

async function handleStashSubmit(db: any, context: any, kind: 'item' | 'request' | 'donation', values: Record<string, string>) {
  const quantity = Number(values.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return interactionMessage('Introdu o cantitate validă.');
  const now = new Date().toISOString();
  if (kind === 'item') {
    const title = String(values.title || '').trim();
    if (title.length < 2) return interactionMessage('Numele articolului este obligatoriu.');
    const { data, error } = await db.from('discovery_stash_items').insert({ organization_id: context.organization.id, title, category: String(values.category || 'General').trim(), quantity, unit: 'buc.', description: String(values.description || '').trim(), status: 'available', source_type: 'manual', created_by_discord_id: context.discordId, created_by_name: context.displayName, updated_by_discord_id: context.discordId, created_at: now, updated_at: now }).select('*').single();
    if (error) throw error;
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '📦 Articol nou în Stash', color: 0x22c55e, fields: [{ name: 'Articol', value: title, inline: true }, { name: 'Categorie', value: String(values.category || 'General').trim(), inline: true }, { name: 'Număr iteme', value: String(quantity), inline: true }, { name: 'Status', value: 'Disponibil', inline: true }, { name: 'Detalii', value: String(values.description || '').trim() || 'Fără detalii.', inline: false }, { name: 'Retrageri recente', value: 'Nu au fost înregistrate retrageri.', inline: false }], footer: { text: `Postat de ${context.displayName}` }, timestamp: now }], components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge articolul', custom_id: `panel:stash:delete_item:${data.id}` }] }] }), { postOnly: true });
    const itemMessageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    if (Object.keys(itemMessageIds).length) await db.from('discovery_stash_items').update({ discord_message_ids: itemMessageIds }).eq('organization_id', context.organization.id).eq('id', data.id);
    return interactionMessage(`Articolul **${data.title}** a fost adăugat în Stash.${delivery.results.length ? '' : `\n⚠️ Logul nu a fost trimis: ${delivery.failures.join(' | ')}`}`);
  }
  if (kind === 'request') {
    const title = String(values.item_title || '').trim();
    if (title.length < 2) return interactionMessage('Articolul solicitat este obligatoriu.');
    const reason = String(values.note || '').trim();
    if (reason.length < 2) return interactionMessage('Motivul cererii este obligatoriu.');
    const { data, error } = await db.from('discovery_stash_requests').insert({ organization_id: context.organization.id, item_title: title, quantity, note: reason, status: 'pending', requested_by_discord_id: context.discordId, requested_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
    if (error) throw error;
    try {
      await publishStashApproval(db, context, 'request', data);
      return interactionMessage('Cererea Stash a fost înregistrată și trimisă pentru aprobare.');
    } catch (approvalError) {
      console.error('[discord-interactions] stash request approval delivery failed', approvalError);
      return interactionMessage('Cererea Stash a fost salvată ca **în așteptare**, dar nu am putut publica solicitarea în embedul administrativ Stash. Verifică ruta Stash.');
    }
  }
  const title = String(values.title || '').trim();
  if (title.length < 2) return interactionMessage('Numele articolului donat este obligatoriu.');
  const { data, error } = await db.from('discovery_stash_donations').insert({ organization_id: context.organization.id, title, category: String(values.category || 'General').trim(), quantity, unit: 'buc.', note: String(values.note || '').trim(), status: 'pending', donated_by_discord_id: context.discordId, donated_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
  if (error) throw error;
  try {
    await publishStashApproval(db, context, 'donation', data);
    return interactionMessage('Donația Stash a fost înregistrată și trimisă pentru aprobare.');
  } catch (approvalError) {
    console.error('[discord-interactions] stash donation approval delivery failed', approvalError);
    return interactionMessage('Donația Stash a fost salvată ca **în așteptare**, dar nu am putut publica solicitarea în embedul administrativ Stash. Verifică ruta Stash.');
  }
}

function requestDateTime(value: string, endOfDay = false) {
  const raw = String(value || '').trim();
  const displayMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const match = displayMatch ? [displayMatch[0], displayMatch[3], displayMatch[2], displayMatch[1]] : isoMatch;
  if (!match) return null;
  return zonedDateAt(Number(match[1]), Number(match[2]), Number(match[3]), endOfDay ? 23 : 0, endOfDay ? 59 : 0);
}

function romanianDisplayDate(date = new Date()) {
  const parts = romanianParts(date);
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`;
}

function requestDateKey(value: string) {
  const date = requestDateTime(value);
  if (!date) return '';
  const parts = romanianParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function requestDateLabel(value: string, endOfDay = false) {
  const date = requestDateTime(value, endOfDay);
  return date ? new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'short' }).format(date) : value;
}

function requestEmbed(absence: any, context: any, title = 'Învoire nouă') {
  const end = String(absence.end_date || absence.end_at || '').slice(0, 10) || String(absence.start_date || '').slice(0, 10);
  const start = String(absence.start_date || absence.start_at || '').slice(0, 10);
  const audience = context.audience === 'organization' ? 'Organizație' : 'Angajați';
  return { title: `📋 ${title} · ${audience}`, color: title.toLowerCase().includes('șters') ? 0xef4444 : 0xf59e0b, fields: [
    { name: '👤 Membru', value: String(context.displayName || absence.colleague_name || 'Utilizator Discord').slice(0, 1024), inline: true },
    { name: '📌 Tip', value: String(absence.notice_type || 'Învoire').slice(0, 1024), inline: true },
    { name: '📅 Începe', value: requestDateLabel(start), inline: true },
    { name: '📅 Se termină', value: requestDateLabel(end, true), inline: true },
    { name: '💬 Motiv', value: String(absence.reason || absence.notes || '—').slice(0, 1024), inline: false },
    { name: '📎 Dovadă', value: String(absence.proof_url || 'Nu a fost atașat un link.').slice(0, 1024), inline: false },
  ], footer: { text: `Panel Pro · Log învoiri · ${audience}` }, timestamp: new Date().toISOString() };
}

async function saveAbsenceLogMessageIds(db: any, organizationId: string, absenceId: string, messageIds: Record<string, string>) {
  if (!Object.keys(messageIds).length) return;
  const { data: current, error: readError } = await db.from('discovery_absences').select('discord_log_message_ids').eq('id', absenceId).eq('organization_id', organizationId).maybeSingle();
  if (readError) throw readError;
  const merged = { ...(current?.discord_log_message_ids || {}), ...messageIds };
  const { error } = await db.from('discovery_absences').update({ discord_log_message_ids: merged }).eq('id', absenceId).eq('organization_id', organizationId);
  if (error) throw error;
}

async function sendAbsenceLog(db: any, context: any, absence: any, title = 'Învoire nouă', messageIds: Record<string, string> = {}) {
  try {
    const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [requestEmbed(absence, context, title)] }), { messageIds });
    const nextMessageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    await saveAbsenceLogMessageIds(db, String(context.organization.id), String(absence.id), nextMessageIds);
    return { error: delivery.results.length ? '' : delivery.failures.join(' | '), messageIds: nextMessageIds };
  } catch (error) {
    console.error('[discord-interactions] absence log failed', error);
    return { error: error instanceof Error ? error.message : 'Logul Discord nu a putut fi trimis.', messageIds: {} };
  }
}

async function myRequests(db: any, context: any) {
  const { data, error } = await db.from('discovery_absences').select('notice_type,start_date,end_at,reason,created_at').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).eq('request_audience', context.audience).order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  const rows = data || [];
  const value = rows.length ? rows.map((item: any) => `• **${String(item.notice_type || 'Învoire')}** · ${requestDateLabel(String(item.start_date || '').slice(0, 10))} → ${requestDateLabel(String(item.end_at || '').slice(0, 10), true)} · înregistrată`).join('\n').slice(0, 4000) : 'Nu ai încă învoiri înregistrate.';
  return interactionMessage('', { embeds: [{ title: `📚 Învoirile mele · ${context.organization.name}`, color: 3447003, description: value, footer: { text: 'Panel Pro · istoricul tău' }, timestamp: new Date().toISOString() }] });
}

async function handleRequestSubmit(db: any, context: any, interaction: any, values: Record<string, string>) {
  const noticeType = 'Învoire';
  const start = requestDateTime(values.start_date);
  const end = requestDateTime(values.end_date, true);
  if (!start || !end || end.getTime() < start.getTime()) return interactionMessage('Completează date valide în format **zz.ll.aaaa**, iar sfârșitul trebuie să fie după început.');
  const startDate = requestDateKey(values.start_date);
  const endDate = requestDateKey(values.end_date);
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  const reason = String(values.reason || '').trim().slice(0, 1000);
  if (!reason) return interactionMessage('Motivul învoirii este obligatoriu.');
  const proofUrl = String(values.proof_url || '').trim().slice(0, 500) || null;
  if (proofUrl) { try { const parsed = new URL(proofUrl); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid'); } catch { return interactionMessage('Dovada trebuie să fie un link HTTP sau HTTPS valid.'); } }
  const now = new Date().toISOString();
  const absence = { organization_id: context.organization.id, discord_id: context.discordId, request_audience: context.audience, colleague_name: `${context.displayName} [${context.role}]`, notice_type: noticeType, reason, start_date: startDate, days, notes: reason, start_at: start.toISOString(), end_at: end.toISOString(), proof_url: proofUrl, created_at: now };
  const { data: created, error } = await db.from('discovery_absences').insert(absence).select('*').single();
  if (error) throw error;
  const logResult = await sendAbsenceLog(db, context, created, 'Învoire nouă');
  return interactionMessage(`Învoirea a fost înregistrată pentru **${startDate.split('-').reverse().join('.')} – ${endDate.split('-').reverse().join('.')}**.${logResult.error ? `\n⚠️ Logul Discord nu a fost trimis: ${logResult.error}` : ''}`);
}

async function handleAnnouncementSubmit(db: any, context: any, interaction: any, postType: 'announcement' | 'question' | 'poll', values: Record<string, string>, postId = '') {
  const title = String(values.title || '').trim().slice(0, 140);
  const content = String(values.content || '').trim().slice(0, 4000);
  if (!title) return interactionMessage('Titlul este obligatoriu.');
  const options = postType === 'poll' ? parseCommunityOptions(values.poll_options) : [];
  if (postType === 'poll' && options.length < 2) return interactionMessage('Sondajul trebuie să aibă minimum două opțiuni, câte una pe fiecare rând.');

  if (postId) {
    const current = await loadCommunityPost(db, String(context.organization.id), postId);
    if (current.post.audience !== context.audience) throw new Error('Postarea nu aparține acestei categorii.');
    const { error: updateError } = await db.from('discovery_community_posts').update({ title, content, updated_at: new Date().toISOString() }).eq('organization_id', context.organization.id).eq('id', postId);
    if (updateError) throw updateError;
    if (postType === 'poll') {
      const { error: deleteError } = await db.from('discovery_poll_options').delete().eq('organization_id', context.organization.id).eq('post_id', postId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await db.from('discovery_poll_options').insert(options.map((option, position) => ({ organization_id: context.organization.id, post_id: postId, option_text: option, position })));
      if (insertError) throw insertError;
    }
    const refreshed = await loadCommunityPost(db, String(context.organization.id), postId);
    await syncCommunityPostDiscord(db, context, refreshed);
    return interactionMessage('Postarea a fost actualizată în baza de date și în Discord.');
  }

  const now = new Date().toISOString();
  const { data: created, error: createError } = await db.from('discovery_community_posts').insert({
    organization_id: context.organization.id,
    audience: context.audience,
    post_type: postType,
    title,
    content,
    author_discord_id: context.discordId,
    author_name: context.displayName,
    created_at: now,
    updated_at: now,
  }).select('*').single();
  if (createError) throw createError;
  if (postType === 'poll') {
    const { error: optionsError } = await db.from('discovery_poll_options').insert(options.map((option, position) => ({ organization_id: context.organization.id, post_id: created.id, option_text: option, position })));
    if (optionsError) throw optionsError;
  }
  const data = await loadCommunityPost(db, String(context.organization.id), String(created.id));
  try {
    const delivery = await deliverDiscordRoute(db, context.settings, context.routeKey, communityPayload({ ...data, settings: context.settings }));
    await saveCommunityMessageRefs(db, String(context.organization.id), String(created.id), delivery.results || []);
    return interactionMessage(`Postarea a fost salvată și publicată în ${delivery.results.length} canal${delivery.results.length === 1 ? '' : 'e'} Discord.`);
  } catch (error) {
    console.error('[discord-interactions] community post delivery failed', error);
    return interactionMessage(`Postarea a fost salvată în Supabase, dar nu a putut fi publicată pe Discord: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
  }
}

async function handleAnnouncementButton(db: any, interaction: any, context: any, parts: string[]) {
  const action = parts[3] || '';
  const postId = parts[4] || '';
  if (!postId) return interactionMessage('Postarea nu este validă.');
  const data = await loadCommunityPost(db, String(context.organization.id), postId);
  if (data.post.audience !== context.audience) throw new Error('Postarea nu aparține acestei categorii.');

  if (action === 'react') {
    const reactionIndex = Number(parts[5]);
    const reaction = communityReactionChoices[reactionIndex];
    if (!reaction) return interactionMessage('Reacția nu este validă.');
    const existing = data.reactions.find((item: any) => String(item.user_discord_id) === String(context.discordId) && item.reaction === reaction);
    const query = existing
      ? db.from('discovery_reactions').delete().eq('organization_id', context.organization.id).eq('post_id', postId).eq('user_discord_id', context.discordId).eq('reaction', reaction)
      : db.from('discovery_reactions').insert({ organization_id: context.organization.id, post_id: postId, user_discord_id: context.discordId, reaction });
    const { error } = await query;
    if (error) throw error;
    const refreshed = await loadCommunityPost(db, String(context.organization.id), postId);
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, communityPayload({ ...refreshed, settings: context.settings }), { method: 'PATCH', messageId: String(interaction.message?.id || '') });
    return interactionMessage(`${existing ? 'Reacția a fost retrasă' : 'Reacția a fost adăugată'}.`);
  }

  if (action === 'vote') {
    if (data.post.post_type !== 'poll') return interactionMessage('Această postare nu este un sondaj.');
    const requestedOption = parts[5] || '';
    const option = data.options.find((item: any) => String(item.id) === String(requestedOption) || String(item.position) === String(requestedOption));
    if (!option) return interactionMessage('Opțiunea sondajului nu este validă.');
    const { error } = await db.from('discovery_poll_votes').upsert({ organization_id: context.organization.id, post_id: postId, option_id: option.id, user_discord_id: context.discordId }, { onConflict: 'post_id,user_discord_id' });
    if (error) throw error;
    const refreshed = await loadCommunityPost(db, String(context.organization.id), postId);
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, communityPayload({ ...refreshed, settings: context.settings }), { method: 'PATCH', messageId: String(interaction.message?.id || '') });
    return interactionMessage('Votul a fost salvat și rezultatele au fost actualizate.');
  }

  if (action === 'delete') {
    const refs = Array.isArray(data.post.discord_message_ids) ? data.post.discord_message_ids : [];
    for (const ref of refs) {
      if (!ref?.channel_id || !ref?.id) continue;
      await requestDiscordTarget(db, { target: String(ref.target || 'primary'), transport: 'bot', channel_id: String(ref.channel_id) }, null, { method: 'DELETE', messageId: String(ref.id) }).catch(() => null);
    }
    if (!refs.length && interaction.message?.id) await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message.id) }).catch(() => null);
    const { error } = await db.from('discovery_community_posts').delete().eq('organization_id', context.organization.id).eq('id', postId);
    if (error) throw error;
    return interactionMessage('Postarea a fost ștearsă din baza de date și din Discord.');
  }

  return interactionMessage('Acest buton Anunțuri nu este disponibil.');
}

async function handleDisciplineAction(db: any, interaction: any, context: any, parts: string[]) {
  const action = parts[3] || '';
  const kind = parts[4] === 'sanction' ? 'sanction' : 'warning';
  const id = String(parts[5] || '').trim();
  if (!id) return interactionMessage('Înregistrarea disciplinară nu este validă.');
  const table = kind === 'warning' ? 'discovery_disciplinary_warnings' : 'discovery_disciplinary_sanctions';
  const { data: record, error: loadError } = await db.from(table).select('*').eq('organization_id', context.organization.id).eq('id', id).maybeSingle();
  if (loadError) throw loadError;
  if (!record) return interactionMessage('Înregistrarea disciplinară nu mai există.');
  if (String(record.target_scope) !== context.audience) return interactionMessage('Înregistrarea nu aparține acestei categorii.');
  if (action === 'delete') {
    const { error } = await db.from(table).delete().eq('organization_id', context.organization.id).eq('id', id);
    if (error) throw error;
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message?.id || record.discord_message_id || '') }).catch(() => null);
    return interactionMessage('Înregistrarea disciplinară a fost ștearsă.');
  }
  const nextStatus = kind === 'warning' ? (action === 'revoke' ? 'revoked' : 'resolved') : (action === 'cancel' ? 'cancelled' : 'paid');
  const { data: updated, error } = await db.from(table).update({ status: nextStatus, resolved_at: new Date().toISOString(), resolved_by_discord_id: context.discordId, resolution_note: action === 'cancel' ? 'Anulată din Discord.' : 'Actualizată din Discord.', updated_at: new Date().toISOString() }).eq('organization_id', context.organization.id).eq('id', id).select('*').single();
  if (error) throw error;
  const routeKey = context.logRouteKey || announcementRoutes(context.audience).log;
  await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [disciplineEmbed(updated, kind, context, nextStatus === 'paid' ? 'achitată' : nextStatus === 'cancelled' ? 'anulată' : 'rezolvat(ă)')], components: disciplineComponents(context.audience, kind, id) }), { method: 'PATCH', messageId: String(interaction.message?.id || record.discord_message_id || '') }).catch((error) => console.error(`[discord-interactions] ${routeKey} update failed`, error));
  return interactionMessage(`Înregistrarea a fost ${kind === 'sanction' ? (nextStatus === 'paid' ? 'marcată ca achitată' : 'anulată') : 'marcată ca rezolvată'}.`);
}

async function handleActionButton(db: any, interaction: any, context: any, parts: string[]) {
  const id = String(parts[4] || '').trim();
  if (!id) return interactionMessage('Acțiunea nu este validă.');
  const { data: record, error: loadError } = await db.from('discovery_actions').select('*').eq('organization_id', context.organization.id).eq('id', id).maybeSingle();
  if (loadError) throw loadError;
  if (!record) return interactionMessage('Acțiunea nu mai există.');
  const { error } = await db.from('discovery_actions').delete().eq('organization_id', context.organization.id).eq('id', id);
  if (error) throw error;
  await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message?.id || record.discord_message_id || '') }).catch(() => null);
  return interactionMessage('Acțiunea a fost ștearsă din baza de date și din Discord.');
}

async function activeShift(db: any, organizationId: string, discordId: string) {
  const { data, error } = await db.from('discovery_shifts').select('*').eq('organization_id', organizationId).eq('discord_id', discordId).in('status', ['active', 'paused']).is('end_time', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

function shiftLogEmbed(shift: any, context: any, action: 'started' | 'paused' | 'resumed' | 'completed', now = new Date()) {
  const shiftType = String(shift.shift_type || '').toUpperCase();
  const completed = action === 'completed';
  const paused = action === 'paused';
  const duration = completed ? String(shift.duration || formatDuration(Number(shift.duration_ms || 0) / 1000)) : formatDuration(workedSeconds(shift, now));
  const end = String(shift.end_time || '').trim() || (paused ? 'În pauză' : 'În desfășurare');
  const fields = [
    { name: '👤 Angajat', value: context.displayName, inline: true },
    { name: '📅 Data', value: String(shift.date || romanianDate(now)), inline: true },
    { name: '⏰ Început', value: `${String(shift.date || romanianDate(now))} · ${String(shift.start_time || romanianTime(now))}`, inline: false },
    { name: '⏱️ Interval', value: `${String(shift.start_time || romanianTime(now))} - ${end}`, inline: false },
    { name: '⏳ Timp Total Lucrat', value: `**${duration}**`, inline: true },
  ];
  if (completed) fields.push({ name: '📝 Motiv', value: String(shift.stop_reason || 'Încheiere manuală'), inline: false });
  else fields.push({ name: '📌 Status', value: paused ? 'În pauză' : 'În tură', inline: true });
  return {
    title: `${completed ? '⏹️ Pontaj Încheiat' : paused ? '⏸️ Pontaj Pauză' : action === 'resumed' ? '▶️ Pontaj Reluat' : '▶️ Pontaj Start'} - Tură de ${shiftType}`,
    color: completed ? (shift.shift_type === 'zi' ? 16766720 : 65535) : paused ? 16776960 : 3066993,
    fields,
    footer: { text: 'Panel Pro · Pontaj' },
    timestamp: now.toISOString(),
  };
}

async function sendActionNotification(db: any, settings: any, embed: any, messageIds: Record<string, string> = {}) {
  const destinations = routeCandidates(settings, 'log_pontaj');
  if (!destinations.some((item) => item.candidates.length)) return { error: 'Canalul „Log pontaj” nu este configurat pentru această organizație.', messageIds: {} };
  try {
    const delivery = await deliverDiscordRoute(db, settings, 'log_pontaj', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [embed] }), { messageIds });
    const nextMessageIds = Object.fromEntries(delivery.results.filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    return { error: delivery.results.length > 0 ? '' : delivery.failures.join(' | ') || 'Discord nu a acceptat mesajul.', messageIds: nextMessageIds };
  } catch (error) {
    console.error('[discord-interactions] action notification failed', error);
    return { error: error instanceof Error ? error.message : 'Eroare Discord necunoscută.', messageIds: {} };
  }
}

async function saveLogMessageIds(db: any, organizationId: string, shiftId: string, messageIds: Record<string, string>) {
  if (!Object.keys(messageIds).length) return;
  const { data: current, error: readError } = await db.from('discovery_shifts').select('discord_log_message_ids').eq('id', shiftId).eq('organization_id', organizationId).maybeSingle();
  if (readError) throw readError;
  const merged = { ...(current?.discord_log_message_ids || {}), ...messageIds };
  const { error } = await db.from('discovery_shifts').update({ discord_log_message_ids: merged, updated_at: new Date().toISOString() }).eq('id', shiftId).eq('organization_id', organizationId);
  if (error) throw error;
}

async function updateControlPanel(db: any, context: any, message: any, actionLabel: string) {
  const messageId = String(message?.id || '').trim();
  if (!/^\d{15,22}$/.test(messageId)) return;
  const embed = message?.embeds?.[0];
  if (!embed) return;
  const fields = Array.isArray(embed.fields) ? embed.fields.filter((field: any) => String(field.name || '') !== 'Ultima acțiune') : [];
  fields.push({ name: 'Ultima acțiune', value: `${context.displayName} · ${actionLabel}`, inline: false });
  const payload = { allowed_mentions: { parse: [] }, embeds: [{ ...embed, fields, timestamp: new Date().toISOString() }] };
  try {
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, JSON.stringify(payload), { method: 'PATCH', messageId });
  } catch (error) {
    console.error('[discord-interactions] control panel update failed', error);
  }
}

async function saveSelection(db: any, context: any, shiftType: string) {
  const { error } = await db.from('discovery_shift_selections').upsert({ organization_id: context.organization.id, discord_id: context.discordId, shift_type: shiftType, selected_at: new Date().toISOString() }, { onConflict: 'organization_id,discord_id' });
  if (error) throw error;
}

async function selectedShift(db: any, context: any) {
  const { data, error } = await db.from('discovery_shift_selections').select('shift_type,selected_at').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).maybeSingle();
  if (error) throw error;
  return data?.shift_type === 'zi' || data?.shift_type === 'noapte' ? String(data.shift_type) : '';
}

async function myStats(db: any, context: any) {
  const now = new Date();
  const end = romanianDate(now);
  const startDate = new Date(`${end}T12:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  const start = startDate.toISOString().slice(0, 10);
  const { data: shifts, error } = await db.from('discovery_shifts').select('date,shift_type,status,duration,duration_ms,started_at,ended_at,paused_at,paused_seconds').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).gte('date', start).lte('date', end).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const rows = shifts || [];
  const total = rows.reduce((sum: number, shift: any) => sum + (['active', 'paused'].includes(String(shift.status)) ? workedSeconds(shift, now) : Number(shift.duration_ms) >= 0 ? Math.floor(Number(shift.duration_ms) / 1000) : 0), 0);
  const day = rows.filter((shift: any) => String(shift.shift_type) === 'zi').reduce((sum: number, shift: any) => sum + (['active', 'paused'].includes(String(shift.status)) ? workedSeconds(shift, now) : Math.floor(Number(shift.duration_ms || 0) / 1000)), 0);
  const night = rows.filter((shift: any) => String(shift.shift_type) === 'noapte').reduce((sum: number, shift: any) => sum + (['active', 'paused'].includes(String(shift.status)) ? workedSeconds(shift, now) : Math.floor(Number(shift.duration_ms || 0) / 1000)), 0);
  const active = rows.find((shift: any) => ['active', 'paused'].includes(String(shift.status)));
  const activeLabel = active ? `${active.status === 'paused' ? 'În pauză' : 'În tură'} · ${String(active.shift_type || '').toUpperCase()} · ${formatDuration(workedSeconds(active, now))}` : 'Nicio tură activă';
  return interactionMessage('', { embeds: [{ title: `📊 Pontajul meu · ${context.organization.name}`, color: 3447003, fields: [
    { name: 'Perioadă', value: `${start} – ${end}`, inline: false },
    { name: 'Total lucrat', value: `**${formatDuration(total)}**`, inline: true },
    { name: 'Ture de zi', value: formatDuration(day), inline: true },
    { name: 'Ture de noapte', value: formatDuration(night), inline: true },
    { name: 'Status curent', value: activeLabel, inline: false },
  ], footer: { text: 'Panel Pro · datele sunt salvate în Supabase' }, timestamp: now.toISOString() }] });
}

async function handleButton(db: any, interaction: any, context: any, action: string) {
  const orgId = String(context.organization.id);
  if (action === 'shift_day' || action === 'shift_night') {
    const shiftType = action === 'shift_day' ? 'zi' : 'noapte';
    if (!shiftAllowed(shiftType)) {
      return interactionMessage(shiftType === 'noapte'
        ? 'Tura de noapte poate fi selectată între **20:00 și 23:00**.'
        : 'Tura de zi nu poate fi selectată în intervalul configurat pentru tura de noapte.');
    }
    await saveSelection(db, context, shiftType);
    await updateControlPanel(db, context, interaction.message, shiftType === 'zi' ? 'a selectat tura de zi' : 'a selectat tura de noapte');
    return interactionMessage(`Ai selectat tura de **${shiftType}**. Acum poți apăsa **Start**.`);
  }
  if (action === 'my_stats') return myStats(db, context);
  if (!['start', 'pause', 'stop'].includes(action)) return interactionMessage('Acest buton Pontaj nu este încă disponibil.');

  const current = await activeShift(db, orgId, context.discordId);
  if (action === 'start') {
    if (current) return interactionMessage('Ai deja o tură activă. Folosește **Pauză** sau **Stop**.');
    const shiftType = await selectedShift(db, context);
    if (!shiftType) return interactionMessage('Selectează mai întâi **Tura de zi** sau **Tura de noapte**.');
    if (!shiftAllowed(shiftType)) return interactionMessage(shiftType === 'noapte' ? 'Tura de noapte poate fi pornită între **20:00 și 23:00**.' : 'Tura de zi nu poate fi pornită în intervalul configurat pentru tura de noapte.');
    const now = new Date();
    const { data: created, error } = await db.from('discovery_shifts').insert({ organization_id: orgId, discord_id: context.discordId, colleague_name: context.displayName, date: romanianDate(now), start_time: romanianTime(now), end_time: null, duration: '00:00:00', duration_ms: 0, shift_type: shiftType, status: 'active', started_at: now.toISOString(), auto_stop_at: shiftDeadline(shiftType, now).toISOString(), paused_seconds: 0, paused_at: null, stop_reason: null, created_at: now.toISOString(), updated_at: now.toISOString() }).select('*').single();
    if (error) throw error;
    const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(created, context, 'started', now));
    if (logResult?.messageIds) await saveLogMessageIds(db, orgId, String(created.id), logResult.messageIds);
    await updateControlPanel(db, context, interaction.message, `a pornit tura de ${shiftType}`);
    return interactionMessage(`Pontaj pornit: tura de **${shiftType}**.\nSe oprește automat la ora configurată în panel.${logResult?.error ? `\n⚠️ Logul Discord nu a fost trimis: ${logResult.error}` : ''}`);
  }
  if (!current) return interactionMessage('Nu există o tură activă pentru contul tău.');
  if (action === 'pause') {
    const now = new Date();
    const update = current.status === 'paused'
      ? { status: 'active', paused_at: null, paused_seconds: (Number(current.paused_seconds) || 0) + Math.max(0, Math.floor((now.getTime() - new Date(String(current.paused_at)).getTime()) / 1000)), duration_ms: Number(current.duration_ms) || 0, updated_at: now.toISOString() }
      : { status: 'paused', paused_at: now.toISOString(), duration_ms: workedSeconds(current, now) * 1000, updated_at: now.toISOString() };
    const { data, error } = await db.from('discovery_shifts').update(update).eq('id', current.id).eq('organization_id', orgId).in('status', ['active', 'paused']).select('*').single();
    if (error) throw error;
    const paused = data.status === 'paused';
    const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(data, context, paused ? 'paused' : 'resumed', now), current.discord_log_message_ids || {});
    if (logResult?.messageIds) await saveLogMessageIds(db, orgId, String(current.id), logResult.messageIds);
    await updateControlPanel(db, context, interaction.message, paused ? 'a pus tura pe pauză' : 'a reluat tura');
    return interactionMessage(`${paused ? 'Tura a fost pusă pe pauză.' : 'Tura a fost reluată.'}${logResult?.error ? `\n⚠️ Logul Discord nu a fost trimis: ${logResult.error}` : ''}`);
  }
  const now = new Date();
  const seconds = workedSeconds(current, now);
  const update = { status: 'completed', end_time: romanianTime(now), duration: formatDuration(seconds), duration_ms: seconds * 1000, ended_at: now.toISOString(), stop_reason: 'Încheiere manuală', updated_at: now.toISOString() };
  const { data, error } = await db.from('discovery_shifts').update(update).eq('id', current.id).eq('organization_id', orgId).in('status', ['active', 'paused']).select('*').maybeSingle();
  if (error) throw error;
  if (!data) return interactionMessage('Tura a fost deja închisă sau nu mai este disponibilă.');
  const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(data, context, 'completed', now), current.discord_log_message_ids || {});
  if (logResult?.messageIds) await saveLogMessageIds(db, orgId, String(current.id), logResult.messageIds);
  await updateControlPanel(db, context, interaction.message, 'a oprit pontajul');
  return interactionMessage(`Pontaj oprit. Timp lucrat: **${data.duration}**.${logResult?.error ? `\n⚠️ Logul Discord nu a fost trimis: ${logResult.error}` : ''}`);
}

function customModuleKey(value: unknown) {
  const key = String(value || '').trim().toLowerCase();
  return /^custom_[a-z0-9_]{2,36}$/.test(key) ? key : '';
}

async function readCustomModule(db: any, moduleKey: string) {
  const { data, error } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
  if (error) throw error;
  const raw = data?.custom_modules?.[moduleKey];
  if (!raw || typeof raw !== 'object') throw new Error('Modulul personalizat nu mai există.');
  const buttons = Array.isArray(raw.buttons) ? raw.buttons.slice(0, 5).map((button: any, index: number) => ({
    label: String(button?.label || `Acțiunea ${index + 1}`).trim().slice(0, 80),
    style: [1, 2, 3, 4].includes(Number(button?.style)) ? Number(button.style) : 1,
    type: ['button', 'link', 'select', 'modal'].includes(String(button?.type || '').toLowerCase()) ? String(button.type).toLowerCase() : 'button',
    url: String(button?.url || '').trim().slice(0, 500),
    action: ['open_form', 'save_submission', 'send_log', 'notify_submitter', 'update_message', 'approve', 'reject', 'report', 'none'].includes(String(button?.action || '').toLowerCase()) ? String(button.action).toLowerCase() : 'open_form',
    action_config: button?.action_config && typeof button.action_config === 'object' ? button.action_config : {},
    options: Array.isArray(button?.options) ? button.options.slice(0, 25) : [],
  })).filter((button: any) => button.label) : [];
  return {
    key: moduleKey,
    label: String(raw.label || moduleKey).trim().slice(0, 120),
    title: String(raw.title || raw.label || moduleKey).trim().slice(0, 256),
    description: String(raw.description || '').trim().slice(0, 4000),
    handler: String(raw.handler || 'none').trim().toLowerCase(),
    active: raw.active !== false,
    form_schema: Array.isArray(raw.form_schema) ? raw.form_schema.slice(0, 5) : [],
    workflow: raw.workflow && typeof raw.workflow === 'object' ? raw.workflow : {},
    responses: raw.responses && typeof raw.responses === 'object' ? raw.responses : {},
    limits: raw.limits && typeof raw.limits === 'object' ? raw.limits : {},
    permissions: raw.permissions && typeof raw.permissions === 'object' ? raw.permissions : {},
    log_key: `log_${moduleKey}`,
    buttons,
  };
}

function customModulePanelPayload(module: any) {
  const embed = {
    ...(module.embed?.author_name ? { author: { name: module.embed.author_name, ...(module.embed.author_icon ? { icon_url: module.embed.author_icon } : {}) } } : {}),
    title: module.title,
    description: module.description,
    color: Number(module.color || 0x5865f2),
    ...(module.embed?.thumbnail ? { thumbnail: { url: module.embed.thumbnail } } : {}),
    ...(module.embed?.image ? { image: { url: module.embed.image } } : {}),
    ...(module.embed?.fields?.length ? { fields: module.embed.fields } : {}),
    ...(module.embed?.footer_text ? { footer: { text: module.embed.footer_text, ...(module.embed.footer_icon ? { icon_url: module.embed.footer_icon } : {}) } } : {}),
    ...(module.embed?.timestamp ? { timestamp: new Date().toISOString() } : {}),
  };
  const components: any[] = [];
  for (let index = 0; index < module.buttons.length; index += 5) {
    components.push({ type: 1, components: module.buttons.slice(index, index + 5).map((button: any, offset: number) => {
      const buttonIndex = index + offset;
      if (button.type === 'link' && /^https?:\/\//i.test(button.url || '')) return { type: 2, style: 5, label: button.label, url: button.url };
      if (button.type === 'select') return { type: 3, custom_id: `panel:custom:${module.key}:${buttonIndex}`, placeholder: button.label, min_values: 1, max_values: 1, options: (button.options || []).slice(0, 25) };
      return { type: 2, style: [1, 2, 3, 4].includes(Number(button.style)) ? Number(button.style) : 1, label: button.label, custom_id: `panel:custom:${module.key}:${buttonIndex}` };
    }) });
  }
  return { allowed_mentions: { parse: [] }, embeds: [embed], components };
}

async function notifyCustomModuleSubmitter(db: any, discordId: string, content: string) {
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  if (!botToken) throw new Error('DISCORD_BOT_TOKEN lipsește din configurația Supabase.');
  const headers = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json', 'User-Agent': 'Panel Pro Discord Bot (+https://panel-pro.ro)' };
  const channelResponse = await fetch(`${DISCORD_API}/users/@me/channels`, { method: 'POST', headers, body: JSON.stringify({ recipient_id: discordId }) });
  if (!channelResponse.ok) throw new Error(`Discord nu a permis deschiderea mesajului privat (HTTP ${channelResponse.status}).`);
  const channel = await channelResponse.json().catch(() => ({}));
  if (!/^\d{15,22}$/.test(String(channel.id || ''))) throw new Error('Discord nu a returnat un canal privat valid.');
  const messageResponse = await fetch(`${DISCORD_API}/channels/${encodeURIComponent(String(channel.id || ''))}/messages`, { method: 'POST', headers, body: JSON.stringify({ allowed_mentions: { parse: [] }, content: content.slice(0, 2000) }) });
  if (!messageResponse.ok) throw new Error(`Discord nu a permis trimiterea notificării private (HTTP ${messageResponse.status}).`);
}

function customModuleModal(module: any, actionKey = 'open_form') {
  const handler = module.handler === 'request' ? 'cerere' : module.handler === 'approval' ? 'solicitare pentru aprobare' : module.handler === 'report' ? 'raport' : 'mesaj';
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required, placeholder, max_length });
  const fields = Array.isArray(module.form_schema) && module.form_schema.length ? module.form_schema : [{ id: 'subject', label: 'Titlu', type: 'short_text', required: true, placeholder: 'Scrie un titlu' }, { id: 'details', label: 'Detalii', type: 'long_text', required: true, placeholder: 'Descrie solicitarea sau informația' }];
  return { type: 9, data: { custom_id: `panel:custom_submit:${module.key}:${actionKey}`, title: `${module.label} · ${handler}`.slice(0, 45), components: fields.slice(0, 5).map((field: any) => ({ type: 1, components: [input(String(field.id || 'field').slice(0, 40), String(field.label || 'Câmp').slice(0, 45), field.type === 'long_text' ? 2 : 1, field.required !== false, field.type === 'select' && Array.isArray(field.options) && field.options.length ? `Opțiuni: ${field.options.slice(0, 8).join(', ')}`.slice(0, 100) : String(field.placeholder || '').slice(0, 100), field.type === 'long_text' ? 1800 : 160)] })) } };
}

async function resolveCustomModuleContext(db: any, interaction: any, module: any) {
  const guildId = String(interaction.guild_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const [{ data: organization, error: organizationError }, { data: settings, error: settingsError }] = await Promise.all([
    db.from('discovery_organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle(),
    db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle(),
  ]);
  if (organizationError) throw organizationError;
  if (settingsError) throw settingsError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const route = settings?.discord_channel_routes?.[module.key]?.[target];
  if (!route?.channel_id) throw new Error('Modulul nu are încă un canal embed configurat.');
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const permissionMode = String(module.permissions?.mode || 'everyone');
  if (permissionMode === 'manager' && !isDiscordManager(interaction)) throw new Error('Nu ai permisiunea necesară pentru acest modul.');
  if (permissionMode === 'owner' && !(await isGuildOwner(db, guildId, discordId))) throw new Error('Doar ownerul serverului poate folosi acest modul.');
  if (permissionMode === 'mapped_role' && !(module.permissions?.role_ids || []).some((roleId: string) => memberRoles.has(String(roleId)))) throw new Error('Nu ai rolul necesar pentru acest modul.');
  const limits = module.limits || {};
  if (Number(limits.cooldown_seconds) > 0 || Number(limits.max_per_user) > 0 || Number(limits.max_pending) > 0) {
    const { data: recent, error: recentError } = await db.from('discovery_custom_module_submissions').select('id,status,created_at').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('module_key', module.key).order('created_at', { ascending: false }).limit(Math.max(100, Number(limits.max_per_user) || 1));
    if (recentError) throw recentError;
    const rows = recent || [];
    if (Number(limits.cooldown_seconds) > 0 && rows.some((row: any) => String(row.submitted_by_discord_id || '') === discordId && Date.now() - Date.parse(String(row.created_at)) < Number(limits.cooldown_seconds) * 1000)) throw new Error(`Așteaptă ${Number(limits.cooldown_seconds)} secunde înainte de o nouă trimitere.`);
    if (Number(limits.max_per_user) > 0 && rows.filter((row: any) => String(row.submitted_by_discord_id || '') === discordId).length >= Number(limits.max_per_user)) throw new Error('Ai atins limita de trimiteri pentru acest modul.');
    if (Number(limits.max_pending) > 0 && rows.filter((row: any) => row.status === 'pending').length >= Number(limits.max_pending)) throw new Error('Modulul a atins limita de solicitări în așteptare.');
  }
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, discordId, displayName, organization, settings, target, route };
}

async function handleCustomModuleSubmit(db: any, interaction: any, module: any) {
  const context = await resolveCustomModuleContext(db, interaction, module);
  const values = modalValues(interaction);
  const fields = Array.isArray(module.form_schema) && module.form_schema.length ? module.form_schema : [{ id: 'subject', label: 'Titlu' }, { id: 'details', label: 'Detalii' }];
  const subject = String(values.subject || values[fields[0]?.id] || module.label).trim().slice(0, 160);
  const details = String(values.details || fields.map((field: any) => `${field.label}: ${values[field.id] || '—'}`).join('\n')).trim().slice(0, Math.min(4000, Math.max(100, Number(module.limits?.max_text_length) || 1800)));
  if (!subject || !details) throw new Error('Completează titlul și detaliile.');
  for (const field of fields) { const value = String(values[field.id] || '').trim(); if (field.required !== false && !value) throw new Error(`Completează câmpul „${field.label}”.`); if (field.type === 'url' && value && !/^https?:\/\//i.test(value)) throw new Error(`Câmpul „${field.label}” trebuie să fie un URL valid.`); if (field.type === 'number' && value && !/^[-+]?\d+(?:[.,]\d+)?$/.test(value)) throw new Error(`Câmpul „${field.label}” trebuie să fie numeric.`); if (field.type === 'date' && value && Number.isNaN(Date.parse(value))) throw new Error(`Câmpul „${field.label}” trebuie să fie o dată validă.`); if (field.type === 'select' && value && Array.isArray(field.options) && field.options.length && !field.options.map((option: any) => String(option).toLowerCase()).includes(value.toLowerCase())) throw new Error(`Alege una dintre opțiunile disponibile pentru „${field.label}”.`); }
  const actionKey = String(interaction.data?.custom_id || '').split(':')[3] || 'open_form';
  const { data: submission, error: submissionError } = await db.from('discovery_custom_module_submissions').insert({ organization_id: context.organization.id, guild_id: context.guildId, module_key: module.key, submitted_by_discord_id: context.discordId, submitted_by_name: context.displayName, handler: module.handler, action_key: actionKey, values_json: values, source_message_id: String(interaction.message?.id || ''), source_channel_id: context.channelId, subject, details, status: module.handler === 'announcement' ? 'published' : 'pending' }).select('id').single();
  if (submissionError) throw submissionError;
  const configuredActions = Array.isArray(module.workflow?.actions) ? module.workflow.actions : [];
  const actions = new Set(configuredActions.length ? configuredActions : ['save_submission', 'send_log']);
  if (['save_submission', 'send_log', 'notify_submitter', 'update_message'].includes(actionKey)) actions.add(actionKey);
  const logRoute = context.settings?.discord_channel_routes?.[module.log_key]?.[context.target];
  let logWarning = '';
  if (actions.has('send_log') && logRoute?.channel_id) {
    const logPayload = { allowed_mentions: { parse: [] }, embeds: [{ title: `🧩 ${module.label}`, description: `**${subject}**\n${details}`, color: module.handler === 'approval' ? 0xf59e0b : 0x5865f2, fields: [{ name: 'Trimis de', value: `<@${context.discordId}>`, inline: true }, { name: 'Server', value: context.organization.name, inline: true }, { name: 'ID solicitare', value: String(submission?.id || '—'), inline: true }], footer: { text: `Handler: ${module.handler}` }, timestamp: new Date().toISOString() }], components: (module.handler === 'approval' || actions.has('review_buttons')) && submission?.id ? [{ type: 1, components: [{ type: 2, style: 3, label: 'Aprobă', custom_id: `panel:custom_review:${module.key}:${submission.id}:approved` }, { type: 2, style: 4, label: 'Respinge', custom_id: `panel:custom_review:${module.key}:${submission.id}:rejected` }] }] : [] };
    const delivery = await deliverDiscordRoute(db, context.settings, module.log_key, JSON.stringify(logPayload), { postOnly: true });
    if (delivery.failures?.length) logWarning = '\n⚠️ Logul nu a putut fi trimis în canalul configurat.';
  }
  if (actions.has('update_message') && context.route?.message_id) {
    const update = await deliverDiscordRoute(db, context.settings, module.key, JSON.stringify(customModulePanelPayload(module)), { messageIds: { [context.target]: String(context.route.message_id) }, postOnly: false });
    if (update.failures?.length) logWarning += '\n⚠️ Embedul inițial nu a putut fi actualizat.';
  }
  if (actions.has('notify_submitter')) {
    try {
      await notifyCustomModuleSubmitter(db, context.discordId, module.responses?.success || `Solicitarea ta pentru „${module.label}” a fost înregistrată.`);
    } catch (_) {
      logWarning += '\n⚠️ Notificarea privată nu a putut fi trimisă.';
    }
  }
  const responseText = module.responses?.success || `Am înregistrat ${module.handler === 'approval' ? 'solicitarea pentru aprobare' : 'formularul'} pentru **${module.label}**.`;
  return interactionMessage(`${responseText}${logWarning}`, { flags: module.responses?.visibility === 'public' ? 0 : 64 });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  const rawBody = await request.text();
  if (!(await verifyDiscordSignature(request, rawBody))) return reply({ error: 'Semnătură Discord invalidă.' }, 401);
  let interaction: any;
  try { interaction = JSON.parse(rawBody); } catch { return reply({ error: 'Payload Discord invalid.' }, 400); }
  if (Number(interaction?.type) === 1) return reply({ type: 1 });
  const isApplicationCommand = Number(interaction?.type) === 2;
  if (isApplicationCommand) {
    const commandName = String(interaction?.data?.name || '').trim().toLowerCase();
    if (commandName === 'panel') {
      const subcommand = String(commandSubcommand(interaction)?.name || '').trim().toLowerCase();
      const guildId = String(interaction?.guild_id || '').trim();
      if (subcommand && !['status', 'publica', 'config'].includes(subcommand)) {
        const key = serviceKey();
        if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
        const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
        await ensureDiscordOnlyOrganization(db, interaction);
        const { data: setting, error: settingError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
        if (settingError) throw settingError;
        const moduleEntry = Object.entries(setting?.custom_modules && typeof setting.custom_modules === 'object' ? setting.custom_modules : {}).find(([, value]: any) => String(value?.command_name || '').trim().toLowerCase() === subcommand) as [string, any] | undefined;
        if (moduleEntry) {
          const module = await readCustomModule(db, customModuleKey(moduleEntry[0]));
          if (!module.active) return reply(interactionMessage('Acest modul este dezactivat momentan.'));
          if (module.handler === 'none') return reply(interactionMessage(`Modulul **${module.label}** este informativ și nu are un formular activ.`));
          return reply(customModuleModal(module));
        }
      }
      if (subcommand === 'publica') {
        const routeKey = String(commandOption(interaction, 'modul') || '').trim();
        if (!isDiscordManager(interaction)) return reply(interactionMessage('Doar ownerul serverului sau un administrator cu permisiunea Manage Server poate publica embeduri.'));
        if (!panelRouteKeys.includes(routeKey)) return reply(interactionMessage('Modulul selectat nu este valid.'));
        const key = serviceKey();
        if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
        return runDeferredCommand(interaction, async () => {
          const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
          await ensureDiscordOnlyOrganization(db, interaction);
          const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
          if (guildError) throw guildError;
          if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
          const { data: publishOrganization, error: publishOrganizationError } = await db.from('discovery_organizations').select('access_mode').eq('id', guild.organization_id).maybeSingle();
          if (publishOrganizationError) throw publishOrganizationError;
          if (publishOrganization?.access_mode === 'discord_only' && discordPremiumModule(routeKey) && discordPremiumConfigured() && !(await discordPremiumAccess(db, String(guild.organization_id), interaction, guildId))) return discordPremiumMessage();
          const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
          if (settingsError) throw settingsError;
          const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
          const route = settings?.discord_channel_routes?.[routeKey]?.[target];
          if (!route?.channel_id) throw new Error(`Canalul pentru **${PANEL_ROUTE_LABELS[routeKey]}** nu este configurat pe serverul acesta. Folosește mai întâi comanda /panel config.`);
          const premiumActive = publishOrganization?.access_mode === 'discord_only' && discordPremiumConfigured()
            ? await discordPremiumAccess(db, String(guild.organization_id), interaction, guildId)
            : false;
          const trialValue = publishOrganization?.access_mode === 'discord_only' && !premiumActive ? await discordTrialSetting(db, String(guild.organization_id)) : null;
          const trialActive = Date.parse(String(trialValue?.ends_at || '')) > Date.now();
          const trialText = trialActive ? await discordTrialNotice(db, String(guild.organization_id)) : '';
          if (routeKey === 'status_live') {
            const cronSecret = await getPlatformSecret(db, 'status_live_cron_secret');
            if (!cronSecret) throw new Error('Secretul pentru sincronizarea Status live nu este configurat.');
            const syncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/status-live-sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
              body: JSON.stringify({ organization_id: guild.organization_id, force: true }),
            });
            const syncData = await syncResponse.json().catch(() => ({}));
            if (!syncResponse.ok) throw new Error(String(syncData?.error || 'Statusul live nu a putut fi publicat.'));
            return interactionMessage(`Statusul live a fost publicat și va fi actualizat automat. În pontaj: **${Number(syncData.active || 0)}**, în pauză: **${Number(syncData.paused || 0)}**.`);
          }
          await deliverDiscordRoute(db, { discord_channel_routes: settings.discord_channel_routes }, routeKey, JSON.stringify(await controlPayload(db, routeKey, trialText, !premiumActive, !premiumActive, !premiumActive && !trialValue)), { postOnly: true });
          return interactionMessage(`Embedul **${PANEL_ROUTE_LABELS[routeKey]}** a fost publicat în <#${route.channel_id}>.`);
        }, 'Embedul nu a putut fi publicat.');
      }
      if (subcommand === 'config') {
        const routeKey = String(commandOption(interaction, 'modul') || '').trim();
        const channelId = String(commandOption(interaction, 'canal') || '').trim();
        const logChannelId = String(commandOption(interaction, 'canal_log') || '').trim();
        if (!isDiscordManager(interaction)) return reply(interactionMessage('Doar ownerul serverului sau un administrator cu permisiunea Manage Server poate modifica setările.'));
        if (!panelRouteKeys.includes(routeKey) || !/^\d{15,22}$/.test(channelId)) return reply(interactionMessage('Modulul sau canalul selectat nu este valid.'));
        const key = serviceKey();
        if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
        const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
        await ensureDiscordOnlyOrganization(db, interaction);
        const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
        if (guildError) throw guildError;
        if (!guild?.organization_id) return reply(interactionMessage('Serverul Discord nu este asociat unei organizații Panel Pro.'));
        const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
        if (settingsError) throw settingsError;
        const routes = structuredClone(settings?.discord_channel_routes || {});
        const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
        routes[routeKey] = { ...(routes[routeKey] || {}), [target]: { ...(routes[routeKey]?.[target] || {}), channel_id: channelId, guild_id: guildId, enabled: true } };
        const logRouteKey = PANEL_LOG_ROUTES[routeKey];
        if (logChannelId && logRouteKey) routes[logRouteKey] = { ...(routes[logRouteKey] || {}), [target]: { ...(routes[logRouteKey]?.[target] || {}), channel_id: logChannelId, guild_id: guildId, enabled: true } };
        const { error: updateError } = await db.from('discovery_settings').update({ discord_channel_routes: routes, updated_at: new Date().toISOString(), updated_by_discord_id: String(interaction?.member?.user?.id || interaction?.user?.id || '') }).eq('organization_id', guild.organization_id);
        if (updateError) throw updateError;
        return reply(interactionMessage(`Canalul ${channelId} a fost salvat pentru **${PANEL_ROUTE_LABELS[routeKey]}**${logChannelId && logRouteKey ? `, iar canalul de log ${logChannelId} pentru **${PANEL_ROUTE_LABELS[logRouteKey]}**` : ''} (${target === 'primary' ? 'principal' : 'secundar'}).`));
      }
      if (subcommand === 'status') {
        const key = serviceKey();
        if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
        const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
        await ensureDiscordOnlyOrganization(db, interaction);
        const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
        if (guildError) throw guildError;
        if (!guild?.organization_id) return reply(interactionMessage('Serverul Discord nu este asociat unei organizații Panel Pro.'));
        const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
        if (settingsError) throw settingsError;
        const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
        const routes = settings?.discord_channel_routes || {};
        const lines = panelRouteKeys.map((routeKey) => `${routes?.[routeKey]?.[target]?.channel_id ? '✅' : '⬜'} ${PANEL_ROUTE_LABELS[routeKey]}${routes?.[routeKey]?.[target]?.channel_id ? ` · <#${routes[routeKey][target].channel_id}>` : ''}`);
        const statusOrganization = await db.from('discovery_organizations').select('access_mode').eq('id', guild.organization_id).maybeSingle();
        if (statusOrganization.error) throw statusOrganization.error;
        const statusPremiumActive = statusOrganization.data?.access_mode === 'discord_only' && discordPremiumConfigured()
          ? await discordPremiumAccess(db, String(guild.organization_id), interaction, guildId)
          : false;
        const trialValue = statusOrganization.data?.access_mode === 'discord_only' && !statusPremiumActive ? await discordTrialSetting(db, String(guild.organization_id)) : null;
        const trialActive = Date.parse(String(trialValue?.ends_at || '')) > Date.now();
        const trialText = trialActive ? await discordTrialNotice(db, String(guild.organization_id)) : '';
        const offers = !statusPremiumActive && !trialValue ? [{ type: 2, style: 3, label: '🎁 Activează Trial 30 zile', custom_id: 'panel:discovery:trial_activate' }] : [];
        return reply(interactionMessage('', { embeds: [{ title: '⚙️ Panel Pro · Configurare Discord', description: [trialText, lines.join('\n\n')].filter(Boolean).join('\n\n'), color: 0x5865f2, footer: { text: `Server ${guildId} · ${target}` } }], components: [{ type: 1, components: [{ type: 2, style: 2, label: '🔐 Roluri acces configurare', custom_id: 'panel:bot_access:open' }, { type: 2, style: 1, label: '🗓️ Adaugă reminder', custom_id: 'panel:discovery:reminder_create' }, { type: 2, style: 1, label: '📋 Raport săptămânal', custom_id: 'panel:discovery:weekly_report' }] }, ...(offers.length ? [{ type: 1, components: offers }] : []), ...(discordPremiumConfigured() && !statusPremiumActive ? discordPremiumButton() : [])] }));
      }
      return reply(interactionMessage('', {
        embeds: [{
          title: '🧭 Panel Pro · Meniu Discord',
          description: 'Panel Pro gestionează pontaje, învoiri, anunțuri, sondaje, acțiuni, contracte și Stash direct prin embedurile configurate pe server.',
          color: 0x5865f2,
          fields: [
            { name: 'Cum folosești aplicația', value: 'Apasă butoanele din embedurile Panel Pro publicate în canalele configurate. Fiecare acțiune respectă rolurile și permisiunile organizației.', inline: false },
            { name: 'Date și organizații', value: 'Datele sunt salvate în Supabase și rămân separate pentru organizația serverului Discord.', inline: false },
          ],
          footer: { text: 'Panel Pro · Discord' },
        }],
      }));
    }
    return reply(interactionMessage('Comanda Panel Pro nu este disponibilă.'));
  }
  const customId = String(interaction?.data?.custom_id || '');
  const isComponent = Number(interaction?.type) === 3;
  const isButton = isComponent && Number(interaction?.data?.component_type || 2) === 2;
  const isSelect = isComponent && [3, 5, 6].includes(Number(interaction?.data?.component_type || 0));
  const isModalSubmit = Number(interaction?.type) === 5;
  const isPontaj = customId.startsWith('panel:pontaj:');
  const isRequests = customId.startsWith('panel:requests:');
  const isContracts = customId.startsWith('panel:contracts:');
  const isAnnouncements = customId.startsWith('panel:announcements:');
  const isDiscipline = customId.startsWith('panel:discipline:');
  const isActions = customId.startsWith('panel:actions:');
  const isStash = customId.startsWith('panel:stash:');
  const isMarketplace = customId.startsWith('panel:marketplace:');
  const isBotAccess = customId.startsWith('panel:bot_access:');
  const isDiscovery = customId.startsWith('panel:discovery:');
  const isCustom = customId.startsWith('panel:custom:') || customId.startsWith('panel:custom_submit:') || customId.startsWith('panel:custom_review:');
  if (!isComponent && !isModalSubmit) return reply(interactionMessage('Acest tip de interacțiune nu este disponibil.'));
  if (!isPontaj && !isRequests && !isContracts && !isAnnouncements && !isDiscipline && !isActions && !isStash && !isMarketplace && !isBotAccess && !isDiscovery && !isCustom) return reply(interactionMessage('Acest buton nu aparține unui modul Panel Pro.'));
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    await ensureDiscordOnlyOrganization(db, interaction);
    if (isCustom) {
      if (customId.startsWith('panel:custom_review:')) {
        const reviewParts = customId.slice('panel:custom_review:'.length).split(':');
        const moduleKey = customModuleKey(reviewParts[0]);
        const submissionId = String(reviewParts[1] || '').trim();
        const nextStatus = ['approved', 'rejected'].includes(reviewParts[2]) ? reviewParts[2] : '';
        if (!moduleKey || !submissionId || !nextStatus || !isDiscordManager(interaction)) return reply(interactionMessage('Doar un administrator al serverului poate procesa această aprobare.'));
        const { data: updated, error } = await db.from('discovery_custom_module_submissions').update({ status: nextStatus, reviewed_by_discord_id: String(interaction.member?.user?.id || interaction.user?.id || ''), updated_at: new Date().toISOString() }).eq('id', submissionId).eq('module_key', moduleKey).eq('status', 'pending').select('subject').maybeSingle();
        if (error) throw error;
        return reply(interactionMessage(updated ? `Solicitarea **${updated.subject}** a fost ${nextStatus === 'approved' ? 'aprobată' : 'respinsă'}.` : 'Solicitarea a fost deja procesată sau nu mai există.'));
      }
      const prefix = customId.startsWith('panel:custom_submit:') ? 'panel:custom_submit:' : 'panel:custom:';
      const moduleKey = customModuleKey(customId.slice(prefix.length).split(':')[0]);
      if (!moduleKey) return reply(interactionMessage('Modulul personalizat nu este valid.'));
      const module = await readCustomModule(db, moduleKey);
      if (!module.active) return reply(interactionMessage('Acest modul este dezactivat momentan.'));
      if (isModalSubmit && customId.startsWith('panel:custom_submit:')) {
        return runDeferredCommand(interaction, () => handleCustomModuleSubmit(db, interaction, module), module.responses?.error || 'Formularul modulului nu a putut fi înregistrat.');
      }
      if (!isButton && !isSelect) return reply(interactionMessage('Acțiunea modulului nu este disponibilă.'));
      const buttonIndex = Number(customId.split(':').pop());
      const button = Number.isInteger(buttonIndex) && buttonIndex >= 0 ? module.buttons?.[buttonIndex] : null;
      const buttonAction = String(button?.action || 'open_form');
      if (buttonAction === 'none') return reply(interactionMessage(button?.action_config?.message || module.responses?.confirmation || `Ai apăsat „${button?.label || module.label}”.`));
      if (buttonAction === 'report') {
        const context = await resolveCustomModuleContext(db, interaction, module);
        const { count, error } = await db.from('discovery_custom_module_submissions').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('guild_id', context.guildId).eq('module_key', module.key);
        if (error) throw error;
        return reply(interactionMessage(button?.action_config?.message || `📊 **${module.label}**\nÎnregistrări totale: **${Number(count || 0)}**.`));
      }
      if (buttonAction === 'approve' || buttonAction === 'reject') {
        if (!isDiscordManager(interaction)) return reply(interactionMessage('Doar un administrator al serverului poate procesa această acțiune.'));
        const context = await resolveCustomModuleContext(db, interaction, module);
        const nextStatus = buttonAction === 'approve' ? 'approved' : 'rejected';
        const { data: pending, error: pendingError } = await db.from('discovery_custom_module_submissions').select('id,subject').eq('organization_id', context.organization.id).eq('guild_id', context.guildId).eq('module_key', module.key).eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (pendingError) throw pendingError;
        if (!pending) return reply(interactionMessage('Nu există solicitări în așteptare.'));
        const { data: updated, error } = await db.from('discovery_custom_module_submissions').update({ status: nextStatus, reviewed_by_discord_id: context.discordId, updated_at: new Date().toISOString() }).eq('id', pending.id).eq('status', 'pending').select('subject').maybeSingle();
        if (error) throw error;
        return reply(interactionMessage(updated ? `${button?.action_config?.message || `Solicitarea „${updated.subject}” a fost ${nextStatus === 'approved' ? 'aprobată' : 'respinsă'}.`}` : 'Solicitarea a fost deja procesată.'));
      }
      if (module.handler === 'report') {
        const context = await resolveCustomModuleContext(db, interaction, module);
        const { count, error } = await db.from('discovery_custom_module_submissions').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('guild_id', context.guildId).eq('module_key', module.key);
        if (error) throw error;
        return reply(interactionMessage(`📊 **${module.label}**\nÎnregistrări totale: **${Number(count || 0)}**.`));
      }
      if (module.handler === 'none') return reply(interactionMessage(`Modulul **${module.label}** este informativ și nu are încă un handler activ.`));
      return reply(customModuleModal(module, buttonAction));
    }
    if (discordPremiumConfigured()) {
      const guildId = String(interaction.guild_id || '').trim();
      if (/^\d{15,22}$/.test(guildId)) {
        const { data: guildAccess, error: guildAccessError } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
        if (guildAccessError) throw guildAccessError;
        if (guildAccess?.organization_id) {
          const { data: premiumOrganization, error: premiumOrganizationError } = await db.from('discovery_organizations').select('access_mode').eq('id', guildAccess.organization_id).maybeSingle();
          if (premiumOrganizationError) throw premiumOrganizationError;
          if (premiumOrganization?.access_mode === 'discord_only' && discordPremiumModule(customId) && !(await discordPremiumAccess(db, String(guildAccess.organization_id), interaction, guildId))) return reply(discordPremiumMessage());
        }
      }
    }
    if (isBotAccess && isButton && customId === 'panel:bot_access:open') return reply(await botAccessRolePicker(db, interaction));
    if (isBotAccess && isSelect && customId === 'panel:bot_access:select') return reply(await saveBotAccessRoles(db, interaction));
    if (isButton && customId === 'panel:discovery:trial_activate') return reply(await activateDiscordTrial(db, interaction));
    if (isButton && customId === 'panel:discovery:reminder_info') return reply(interactionMessage('Reminderele se trimit automat o dată pe zi în canalul configurat. La creare poți alege durata între 1 și 365 de zile.'));
    if (isButton && customId === 'panel:discovery:report_info') return reply(interactionMessage('Raportul săptămânal conține numele și CNP-ul angajaților cu contracte noi în perioada raportată. Se poate genera manual sau automat duminica la 19:00.'));
    if (isButton && customId === 'panel:discovery:reminder_create') return reply(discoveryReminderModal());
    if (isButton && customId === 'panel:discovery:weekly_report') {
      return runDeferredCommand(interaction, async () => {
        const guildId = String(interaction.guild_id || '');
        const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
        if (guildError) throw guildError;
        if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
        const cronSecret = await getPlatformSecret(db, 'cron_secret');
        if (!cronSecret) throw new Error('Secretul pentru raportul săptămânal nu este configurat.');
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-weekly-contract-export`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret }, body: JSON.stringify({ force: true, organization_id: guild.organization_id }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Raportul săptămânal nu a putut fi generat.');
        return interactionMessage(result.results?.[0]?.status === 'sent' ? 'Raportul săptămânal a fost generat și trimis în canalul configurat.' : `Raportul săptămânal nu a fost trimis: ${result.results?.[0]?.status || 'verifică configurația.'}`);
      }, 'Raportul săptămânal nu a putut fi generat.');
    }
    if (isModalSubmit && customId === 'panel:discovery:reminder_submit') {
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await createDiscoveryReminder(db, interaction); } catch (error) { result = interactionMessage(readableError(error, 'Reminderul nu a putut fi salvat.')); }
      await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      return new Response(null, { status: 204 });
    }
    if (isMarketplace && isButton) {
      const parts = customId.split(':');
      const kind = parts[2] === 'illegal' ? 'illegal' : parts[2] === 'legal' ? 'legal' : null;
      if (!kind) return reply(interactionMessage('Marketplace-ul selectat nu este valid.'));
      if (parts[3] === 'create') return reply(marketplaceModal(kind));
      const context = await resolveMarketplaceContext(db, interaction, kind);
      if (parts[3] === 'mine') {
        const table = kind === 'illegal' ? 'discovery_marketplace_illegal' : 'discovery_marketplace_legal';
        let query = db.from(table).select('nume,tip_actiune,categorie,produse,pret,created_at').eq('created_by_discord_id', context.discordId).order('created_at', { ascending: false }).limit(10);
        query = kind === 'illegal' ? query.is('organization_id', null) : query.eq('organization_id', context.organization.id);
        const { data, error } = await query;
        if (error) throw error;
        const lines = (data || []).map((item: any) => `• **${String(item.nume || 'Anunț').slice(0, 80)}** · ${String(item.tip_actiune || '—')} · ${String(item.pret || 'Negociabil')}`).join('\n') || 'Nu ai încă anunțuri publicate.';
        return reply(interactionMessage('', { embeds: [{ title: kind === 'illegal' ? '🚨 Anunțurile mele · Black Market' : '🛒 Anunțurile mele · Marketplace', description: lines.slice(0, 4000), color: kind === 'illegal' ? 0xef4444 : 0x2563eb }] }));
      }
      return reply(interactionMessage('Acțiunea Marketplace nu este disponibilă.'));
    }
    if (isMarketplace && isModalSubmit) {
      const parts = customId.split(':');
      const kind = parts[2] === 'illegal' ? 'illegal' : parts[2] === 'legal' ? 'legal' : null;
      if (!kind || parts[3] !== 'submit') return reply(interactionMessage('Formularul Marketplace nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleMarketplaceSubmit(db, await resolveMarketplaceContext(db, interaction, kind), kind, modalValues(interaction)); }
      catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Anunțul Marketplace nu a putut fi publicat.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isStash && isButton) {
      const parts = customId.split(':');
      if (parts[2] === 'manage_items') {
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveStashContext(db, interaction, 'stash', 'write');
          const { data, error } = await db.from('discovery_stash_items').select('id,title,category,quantity,unit,status').eq('organization_id', context.organization.id).eq('status', 'available').order('created_at', { ascending: false }).limit(25);
          if (error) throw error;
          result = stashManageItemsView(data || []);
        } catch (error) { result = interactionMessage(readableError(error, 'Articolele Stash nu au putut fi încărcate.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
      if (parts[2] === 'item_action') {
        const action = parts[3] === 'archive' ? 'archived' : parts[3] === 'delete' ? 'deleted' : null;
        const itemId = String(parts[4] || '').trim();
        if (!action || !/^[0-9a-f-]{36}$/i.test(itemId)) return reply(interactionMessage('Acțiunea asupra articolului Stash nu este validă.'));
        const deferred = await deferInteraction(interaction, false);
        let result;
        try { result = await handleStashItemAction(db, await resolveStashContext(db, interaction, 'stash', 'write'), itemId, action); }
        catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Articolul Stash nu a putut fi modificat.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (parts[2] === 'pending_requests' || parts[2] === 'pending_donations') {
        const kind = parts[2] === 'pending_requests' ? 'request' : 'donation';
        const permission = kind === 'request' ? 'manage_requests' : 'approve_donation';
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveStashContext(db, interaction, 'stash', permission);
          const { data, error } = await db.from(kind === 'request' ? 'discovery_stash_requests' : 'discovery_stash_donations').select('*').eq('organization_id', context.organization.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(25);
          if (error) throw error;
          result = stashPendingView(kind, data || []);
        } catch (error) { result = interactionMessage(readableError(error, 'Lista Stash nu a putut fi încărcată.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
      if (parts[2] === 'decision_request' || parts[2] === 'decision_donation') {
        const kind = parts[2] === 'decision_request' ? 'request' : 'donation';
        const permission = kind === 'request' ? 'manage_requests' : 'approve_donation';
        const decision = parts[3] === 'approved' ? 'approved' : parts[3] === 'rejected' ? 'rejected' : null;
        if (!decision) return reply(interactionMessage('Decizia Stash nu este validă.'));
        if (kind === 'request' && decision === 'rejected') return reply(stashRejectionModal(String(parts[4] || ''), String(interaction.message?.id || '')));
        const deferred = await deferInteraction(interaction, false);
        let result;
        let context: any = null;
        try {
          context = await resolveStashContext(db, interaction, 'stash', permission);
          result = await handleStashDecision(db, context, kind, String(parts[4] || ''), decision);
        }
        catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Decizia Stash nu a putut fi salvată.')); }
        if (context && interaction.message?.id && result?.data?.content?.includes('a fost')) {
          await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message.id) }).catch(() => null);
        }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (parts[2] === 'delete_item') {
        const itemId = String(parts[3] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(itemId)) return reply(interactionMessage('Articolul Stash selectat nu este valid.'));
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveStashContext(db, interaction, 'log_stash', 'write');
          const { data: item, error: itemError } = await db.from('discovery_stash_items').select('*').eq('organization_id', context.organization.id).eq('id', itemId).maybeSingle();
          if (itemError) throw itemError;
          if (!item) throw new Error('Articolul nu mai există în Stash.');
          const { error: deleteError } = await db.from('discovery_stash_items').delete().eq('organization_id', context.organization.id).eq('id', itemId);
          if (deleteError) throw deleteError;
          await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message?.id || '') });
          await publishStashInventory(db, context, 'deleted', item);
          result = interactionMessage(`Articolul **${item.title}** a fost șters din Stash și din log.`);
        } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Articolul nu a putut fi șters din Stash.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      const kind = parts[2] === 'request' ? 'request' : parts[2] === 'donate' ? 'donation' : parts[2] === 'create' ? 'item' : null;
      if (!kind) return reply(interactionMessage('Acțiunea Stash nu este disponibilă.'));
      return reply(stashModal(kind));
    }
    if (isStash && isSelect) {
      const parts = customId.split(':');
      if (customId === 'panel:stash:select_manage_item') {
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveStashContext(db, interaction, 'stash', 'write');
          const id = String(interaction.data?.values?.[0] || '').trim();
          if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Articolul Stash selectat nu este valid.');
          const { data, error } = await db.from('discovery_stash_items').select('*').eq('organization_id', context.organization.id).eq('id', id).eq('status', 'available').maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('Articolul Stash selectat nu mai este disponibil.');
          result = stashItemActionView(id, data);
        } catch (error) { result = interactionMessage(readableError(error, 'Articolul Stash nu a putut fi încărcat.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
      const kind = parts[2] === 'select_request' ? 'request' : parts[2] === 'select_donation' ? 'donation' : null;
      if (!kind) return reply(interactionMessage('Selecția Stash nu este validă.'));
      const permission = kind === 'request' ? 'manage_requests' : 'approve_donation';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveStashContext(db, interaction, 'stash', permission);
        const id = String(interaction.data?.values?.[0] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Elementul Stash selectat nu este valid.');
        const row = await loadStashDecisionRow(db, context, kind, id);
        result = stashDecisionView(kind, id, row);
      } catch (error) { result = interactionMessage(readableError(error, 'Elementul Stash nu a putut fi încărcat.')); }
      await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      return new Response(null, { status: 204 });
    }
    if (isStash && isModalSubmit) {
      const parts = customId.split(':');
      if (parts[2] === 'reject_submit') {
        const id = String(parts[3] || '').trim();
        const sourceMessageId = String(parts[4] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(interactionMessage('Cererea Stash selectată nu este validă.'));
        const reason = String(modalValues(interaction).rejection_reason || '').trim();
        if (reason.length < 2) return reply(interactionMessage('Motivul respingerii este obligatoriu.'));
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveStashContext(db, interaction, 'stash', 'manage_requests');
          result = await handleStashDecision(db, context, 'request', id, 'rejected', reason);
        } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Cererea Stash nu a putut fi respinsă.')); }
        if (result?.data?.content?.includes('Cererea a fost') && /^\d{15,22}$/.test(sourceMessageId)) {
          await requestDiscordTarget(db, { target: 'primary', transport: 'bot', channel_id: String(interaction.channel_id || '') }, null, { method: 'DELETE', messageId: sourceMessageId }).catch(() => null);
        }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      const kind = parts[2] === 'request' ? 'request' : parts[2] === 'donation' ? 'donation' : parts[2] === 'item' ? 'item' : null;
      if (!kind || parts[3] !== 'submit') return reply(interactionMessage('Formularul Stash nu este valid.'));
      const routeKey = kind === 'request' ? 'stash_requests' : kind === 'donation' ? 'stash_donations' : 'stash';
      const permission = kind === 'request' ? 'request' : kind === 'donation' ? 'donate' : 'write';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleStashSubmit(db, await resolveStashContext(db, interaction, routeKey, permission), kind, modalValues(interaction)); }
      catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Acțiunea Stash nu a putut fi executată.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isContracts && isButton) {
      const parts = customId.split(':');
      if (parts[2] === 'info') return reply(contractInfoMessage());
      if (parts[2] === 'settings') {
        if (!isDiscordManager(interaction)) return reply(interactionMessage('Doar ownerul serverului sau un administrator cu Manage Server poate seta contractul.'));
        return reply(contractSettingsModal());
      }
      if (parts[2] === 'copy') {
        const contractId = String(parts[3] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(contractId)) return reply(interactionMessage('Contractul selectat nu este valid.'));
        const context = await resolveContractActionContext(db, interaction);
        const { data: contract, error } = await db.from('discovery_contracts').select('id,contract_number,contract_text').eq('organization_id', context.organization.id).eq('id', contractId).maybeSingle();
        if (error) throw error;
        if (!contract) return reply(interactionMessage('Contractul nu mai există în istoricul organizației.'));
        return reply(contractCopyModal(contract));
      }
      if (parts[2] === 'publish') {
        const contractId = String(parts[3] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(contractId)) return reply(interactionMessage('Contractul selectat nu este valid.'));
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveContractContext(db, interaction);
          result = await handleContractPublish(db, context, contractId);
        } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Contractul nu a putut fi publicat.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId && !result?.data?.components?.length) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (parts[2] !== 'create') return reply(interactionMessage('Acțiunea Contracte nu este disponibilă.'));
      // Do not perform database validation before opening the modal. Discord
      // requires the modal response within a few seconds; validation repeats
      // safely after the form is submitted.
      return reply(contractModal());
    }
    if (isContracts && isModalSubmit) {
      const parts = customId.split(':');
      if (parts[2] === 'settings_submit') {
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveContractContext(db, interaction);
          result = await handleContractSettingsSubmit(db, context, interaction, modalValues(interaction));
        } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Șablonul contractului nu a putut fi salvat.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (parts[2] === 'copy' && parts[3] === 'modal') return reply(interactionMessage('Contractul este afișat mai sus. Selectează textul cu Ctrl+A și copiază-l cu Ctrl+C.'));
      if (parts[2] !== 'submit') return reply(interactionMessage('Formularul Contracte nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveContractContext(db, interaction);
        result = await handleContractSubmit(db, context, modalValues(interaction));
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Contractul nu a putut fi salvat.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId && !result?.data?.components?.length) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isAnnouncements && isButton) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const action = parts[3] || '';
      const postType = ['announcement', 'question', 'poll'].includes(parts[4]) ? parts[4] as 'announcement' | 'question' | 'poll' : null;
      if (!audience) return reply(interactionMessage('Categoria Anunțuri nu este validă.'));
      if (action === 'create' && postType) return reply(announcementModal(audience, postType));
      if (action === 'edit') {
        const postId = parts[4] || '';
        const { data: guild } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', String(interaction.guild_id || '')).eq('enabled', true).maybeSingle();
        const data = guild ? await loadCommunityPost(db, String(guild.organization_id), postId) : null;
        if (!data) return reply(interactionMessage('Postarea nu mai există.'));
        if (data.post.audience !== audience) return reply(interactionMessage('Postarea nu aparține acestei categorii.'));
        return reply(announcementModal(audience, data.post.post_type === 'poll' ? 'poll' : data.post.post_type === 'question' ? 'question' : 'announcement', data.post, data.options));
      }
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const permission = action === 'delete' ? 'write' : 'read';
        const context = await resolveAnnouncementContext(db, interaction, audience, permission);
        result = await handleAnnouncementButton(db, interaction, context, parts);
      }
      catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea Anunțuri nu a putut fi executată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isAnnouncements && isModalSubmit) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const mode = parts[3] || '';
      const postType = (mode === 'submit' ? parts[4] : parts[5]) as 'announcement' | 'question' | 'poll';
      if (!audience || !['announcement', 'question', 'poll'].includes(postType) || !['submit', 'edit_submit'].includes(mode)) return reply(interactionMessage('Formularul Anunțuri nu este valid.'));
      const postId = mode === 'edit_submit' ? String(parts[4] || '') : '';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveAnnouncementContext(db, interaction, audience, 'write');
        result = await handleAnnouncementSubmit(db, context, interaction, postType, modalValues(interaction), postId);
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Postarea nu a putut fi salvată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isDiscipline && isButton) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const action = parts[3] || '';
      if (!audience) return reply(interactionMessage('Categoria disciplinară nu este validă.'));
       if (action === 'warning' || action === 'sanction') {
         const permission = action === 'sanction' ? 'sanction' : 'write';
         const context = await resolveManagementContext(db, interaction, audience, permission as 'write' | 'sanction', audience === 'organization' ? 'organization' : 'departments', audience === 'organization' ? 'discipline_organization' : 'discipline_departments', 'discipline_permissions', `${audience}.${permission}`);
         return reply(disciplineTargetPicker(audience, action));
      }
      const kind = parts[4] === 'sanction' ? 'sanction' : 'warning';
      const permission = kind === 'sanction' ? 'sanction' : 'write';
      const routeKey = audience === 'departments' ? 'departments' : 'organization';
      const context = await resolveManagementContext(db, interaction, audience, permission as 'write' | 'sanction', routeKey, audience === 'organization' ? 'discipline_organization' : 'discipline_departments', 'discipline_permissions', `${audience}.${permission}`);
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleDisciplineAction(db, interaction, context, parts); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea disciplinară nu a putut fi executată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isDiscipline && isSelect) {
      const parts = customId.split(':');
       const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const kind = parts[3] === 'sanction' ? 'sanction' : parts[3] === 'warning' ? 'warning' : null;
      const targetId = String(interaction?.data?.values?.[0] || '').trim();
      if (!audience || !kind || !/^\d{15,22}$/.test(targetId)) return reply(interactionMessage('Membrul selectat nu este valid.'));
      const permission = kind === 'sanction' ? 'sanction' : 'write';
       await resolveManagementContext(db, interaction, audience, permission as 'write' | 'sanction', audience === 'organization' ? 'organization' : 'departments', audience === 'organization' ? 'discipline_organization' : 'discipline_departments', 'discipline_permissions', `${audience}.${permission}`);
       return reply(disciplineModal(audience, kind, targetId));
    }
    if (isDiscipline && isModalSubmit) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const mode = parts[3] || '';
      const kind = parts[4] === 'sanction' ? 'sanction' : parts[4] === 'warning' ? 'warning' : null;
      const targetId = String(parts[5] || '').trim();
      if (!audience || mode !== 'submit' || !kind) return reply(interactionMessage('Formularul disciplinar nu este valid.'));
      const permission = kind === 'sanction' ? 'sanction' : 'write';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveManagementContext(db, interaction, audience, permission as 'write' | 'sanction', audience === 'organization' ? 'organization' : 'departments', audience === 'organization' ? 'discipline_organization' : 'discipline_departments', 'discipline_permissions', `${audience}.${permission}`);
        result = await handleDisciplineSubmit(db, context, interaction, kind, modalValues(interaction), audience === 'departments' ? targetId : '');
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Înregistrarea disciplinară nu a putut fi salvată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isActions && isButton) {
      const parts = customId.split(':');
      const action = parts[3] || '';
      if (action === 'create') {
        return reply(actionModal());
      }
      if (action === 'stats') {
        const context = await resolveManagementContext(db, interaction, 'organization', 'read', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.read');
        const deferred = await deferInteraction(interaction, false);
        let result;
        try { result = await actionStats(db, context); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Clasamentul nu a putut fi încărcat.'); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (action === 'participants_skip') {
        const draftId = String(parts[4] || '').trim();
        const context = await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
        const deferred = await deferInteraction(interaction, false);
        let result;
        try { result = await finalizeActionDraft(db, context, draftId, []); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea nu a putut fi salvată.'); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      const context = await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleActionButton(db, interaction, context, parts); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea nu a putut fi executată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isActions && isSelect) {
      const parts = customId.split(':');
      if (parts[3] !== 'participants') return reply(interactionMessage('Selectorul participanților nu este valid.'));
      const draftId = String(parts[4] || '').trim();
      const context = await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await finalizeActionDraft(db, context, draftId, Array.isArray(interaction.data?.values) ? interaction.data.values : []); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea nu a putut fi salvată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isActions && isModalSubmit) {
      if (customId !== 'panel:actions:organization:details') return reply(interactionMessage('Formularul Acțiuni nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
        result = await createActionDraft(db, context, modalValues(interaction));
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea nu a putut fi salvată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId && !result?.data?.components?.length) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isRequests && isButton) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const action = parts[3] || '';
      if (!audience) return reply(interactionMessage('Categoria învoirii nu este validă.'));
      if (action === 'new') return reply(requestModal(audience));
      const context = await resolveRequestContext(db, interaction, audience);
      if (!['mine'].includes(action)) return reply(interactionMessage('Acest buton Învoiri nu este încă disponibil.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await myRequests(db, context); } catch (error) { result = interactionMessage(error instanceof Error ? error.message : 'Istoricul învoirilor nu a putut fi încărcat.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isRequests && isModalSubmit) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      if (!audience || parts[3] !== 'submit') return reply(interactionMessage('Formularul Învoiri nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveRequestContext(db, interaction, audience);
        result = await handleRequestSubmit(db, context, interaction, modalValues(interaction));
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Învoirea nu a putut fi înregistrată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (!isPontaj || !isButton) return reply(interactionMessage('Acțiunea Discord nu este disponibilă.'));
    const action = customId.slice('panel:pontaj:'.length);
    const deferred = await deferInteraction(interaction, action !== 'my_stats');
    let result;
    try {
      const context = await resolveContext(db, interaction);
      result = await handleButton(db, interaction, context, action);
    } catch (error) {
      console.error('[discord-interactions]', error);
      result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea Pontaj nu a putut fi executată.');
    }
    const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
    if (followupId) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[discord-interactions]', error);
    return reply(interactionMessage(error instanceof Error ? error.message : 'Acțiunea Pontaj nu a putut fi executată.'));
  }
});
