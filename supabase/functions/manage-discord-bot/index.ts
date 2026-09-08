import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { deliverDiscordRoute, routeCandidates, validDiscordChannelId } from '../_shared/discord-delivery.ts';
import { mergeModuleDefinitions, readGlobalModules, sanitizeModuleOverrides } from '../_shared/global-bot-settings.ts';
import { discordPremiumButton } from '../_shared/discord-premium.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const OFFICIAL_GUILD_ID = '1544703486384537603';
const MODULES: Record<string, { label: string; premium: boolean; title: string; description: string; color: number; buttons: any[] }> = {
  pontaj: { label: 'Pontaj și ture', premium: false, title: '🕒 Pontaj · Panel Pro', description: 'Alege tura și folosește butoanele pentru Start, Pauză și Stop.', color: 0x22c55e, buttons: [{ label: 'Tura de zi', style: 1, id: 'panel:pontaj:shift_day' }, { label: 'Tura de noapte', style: 1, id: 'panel:pontaj:shift_night' }, { label: 'Start', style: 3, id: 'panel:pontaj:start' }, { label: 'Pauză', style: 2, id: 'panel:pontaj:pause' }, { label: 'Stop', style: 4, id: 'panel:pontaj:stop' }, { label: 'Pontajul meu', style: 1, id: 'panel:pontaj:my_stats' }] },
  requests_organization: { label: 'Învoiri organizație', premium: true, title: '📝 Învoiri · Organizație', description: 'Trimite și consultă învoirile organizației.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:organization:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:organization:mine' }] },
  requests_departments: { label: 'Învoiri angajați', premium: false, title: '📝 Învoiri · Angajați', description: 'Trimite și consultă învoirile angajaților.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:departments:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:departments:mine' }] },
  organization: { label: 'Anunțuri organizație', premium: true, title: '📢 Anunțuri · Organizație', description: 'Publică anunțuri, întrebări și sondaje pentru organizație.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:organization:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:organization:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:organization:create:poll' }] },
  departments: { label: 'Anunțuri angajați', premium: true, title: '📢 Anunțuri · Angajați', description: 'Publică anunțuri, întrebări și sondaje pentru angajați.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:departments:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:departments:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:departments:create:poll' }] },
  contracts: { label: 'Contracte', premium: true, title: '📄 Contracte · Panel Pro', description: 'Generează și trimite contracte folosind șablonul organizației.', color: 0x14b8a6, buttons: [{ label: 'Creează contract', style: 1, id: 'panel:contracts:create' }, { label: 'Setează contractul', style: 2, id: 'panel:contracts:settings' }, { label: 'Info contract', style: 1, id: 'panel:contracts:info' }] },
  marketplace: { label: 'Marketplace legal', premium: true, title: '🛒 Marketplace · Legal', description: 'Publică și consultă anunțuri pentru vehicule, bunuri și servicii.', color: 0x2563eb, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:marketplace:legal:create' }, { label: 'Anunțurile mele', style: 2, id: 'panel:marketplace:legal:mine' }] },
  illegal_marketplace: { label: 'Marketplace ilegal', premium: true, title: '🚨 Marketplace · Ilegal', description: 'Publică și consultă anunțuri Black Market, cu acces controlat.', color: 0xef4444, buttons: [{ label: 'Publică anunț', style: 4, id: 'panel:marketplace:illegal:create' }, { label: 'Anunțurile mele', style: 2, id: 'panel:marketplace:illegal:mine' }] },
  event_reminders: { label: 'Evenimente și remindere', premium: true, title: '🗓️ Evenimente și remindere', description: 'Înregistrează evenimente și trimite remindere automate pe durata aleasă.', color: 0xf59e0b, buttons: [{ label: 'Adaugă eveniment', style: 1, id: 'panel:discovery:reminder_create' }, { label: 'Info remindere', style: 2, id: 'panel:discovery:reminder_info' }] },
  contract_identity_weekly: { label: 'Raport săptămânal contracte', premium: true, title: '📋 Raport săptămânal contracte', description: 'Generează exportul săptămânal cu numele și CNP-ul angajaților.', color: 0x14b8a6, buttons: [{ label: 'Generează raport', style: 1, id: 'panel:discovery:weekly_report' }, { label: 'Info raport', style: 2, id: 'panel:discovery:report_info' }] },
  actions_organization: { label: 'Acțiuni organizație', premium: true, title: '🎯 Acțiuni · Organizație', description: 'Înregistrează și consultă acțiunile organizației.', color: 0x3b82f6, buttons: [{ label: 'Acțiune', style: 1, id: 'panel:actions:organization:create' }, { label: 'Clasament acțiuni', style: 2, id: 'panel:actions:organization:stats' }] },
  stash: { label: 'Stash', premium: true, title: '📦 Stash · Administrare', description: 'Gestionează articolele, cererile și donațiile Stash.', color: 0x22c55e, buttons: [{ label: 'Adaugă în Stash', style: 3, id: 'panel:stash:create' }, { label: 'Cereri în așteptare', style: 1, id: 'panel:stash:pending_requests' }, { label: 'Donații în așteptare', style: 1, id: 'panel:stash:pending_donations' }] },
  stash_requests: { label: 'Cereri Stash', premium: true, title: '📨 Cereri Stash', description: 'Solicită articole și urmărește cererile trimise pentru aprobare.', color: 0x3b82f6, buttons: [{ label: 'Solicită articol', style: 1, id: 'panel:stash:request' }, { label: 'Cereri în așteptare', style: 2, id: 'panel:stash:pending_requests' }] },
  stash_donations: { label: 'Donații Stash', premium: true, title: '🎁 Donații Stash', description: 'Înregistrează donații și trimite-le spre aprobare administrativă.', color: 0x22c55e, buttons: [{ label: 'Donează articol', style: 3, id: 'panel:stash:donate' }, { label: 'Donații în așteptare', style: 2, id: 'panel:stash:pending_donations' }] },
  status_live: { label: 'Status live', premium: true, title: '📡 Status live · Panel Pro', description: 'Statusul este actualizat automat cu pontajele și pauzele active.', color: 0x06b6d4, buttons: [] },
};
const LOG_ROUTES: Record<string, string> = {
  organization: 'log_announcements_organization', departments: 'log_announcements_departments', pontaj: 'log_pontaj',
  requests_organization: 'log_requests_organization', requests_departments: 'log_requests_departments', contracts: 'log_contracts', contract_identity_weekly: 'log_contract_identity_weekly',
  actions_organization: 'log_actions_organization', marketplace: 'log_marketplace', illegal_marketplace: 'log_illegal_marketplace', stash: 'log_stash', stash_requests: 'log_stash_requests', stash_donations: 'log_stash_donations', event_reminders: 'log_event_reminders'
};
const LOG_LABELS: Record<string, string> = {
  log_announcements_organization: 'Log anunțuri organizație', log_announcements_departments: 'Log anunțuri angajați', log_pontaj: 'Log pontaj',
  log_requests_organization: 'Log învoiri organizație', log_requests_departments: 'Log învoiri angajați', log_contracts: 'Log contracte',
  log_actions_organization: 'Log acțiuni organizație', log_marketplace: 'Log Marketplace legal', log_illegal_marketplace: 'Log Marketplace ilegal', log_contract_identity_weekly: 'Log raport săptămânal contracte', log_stash: 'Log Stash', log_stash_requests: 'Log cereri Stash', log_stash_donations: 'Log donații Stash', log_event_reminders: 'Log evenimente și remindere'
};
const MODULE_EMOJIS: Record<string, string> = {
  pontaj: '🕒', requests_organization: '📝', requests_departments: '📝', organization: '📢', departments: '📢',
  contracts: '📄', marketplace: '🛒', illegal_marketplace: '🚨', event_reminders: '🗓️', contract_identity_weekly: '📋',
  actions_organization: '🎯', stash: '📦', stash_requests: '📨', stash_donations: '🎁', status_live: '📡',
};
const headersFor = (request: Request) => {
  const origin = String(request.headers.get('origin') || '');
  const allowed = /^https?:\/\/(?:[a-z0-9-]+\.)*localhost(:\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) || origin === 'https://panel-pro.ro' || origin === 'https://bot.panel-pro.ro' ? origin : 'https://bot.panel-pro.ro';
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin', 'Content-Type': 'application/json' };
};
const reply = (request: Request, data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: headersFor(request) });
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());
const clean = (value: unknown, max = 200) => String(value ?? '').trim().slice(0, max);
const customModuleKey = (value: unknown) => { const key = clean(value, 40).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''); return /^custom_[a-z0-9_]{2,36}$/.test(key) ? key : `custom_${key || 'modul'}`.slice(0, 40); };
const sanitizeCustomModules = (input: any) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Modulele personalizate sunt invalide.');
  const result: Record<string, any> = {};
  for (const [rawKey, raw] of Object.entries(input)) {
    if (!raw || typeof raw !== 'object') continue;
    const key = customModuleKey(rawKey); const value: any = raw;
    const label = clean(value.label || value.title, 80); const title = clean(value.title || label, 256); const description = clean(value.description, 4096);
    if (!label || !title) throw new Error(`Modulul ${key} trebuie să aibă titlu și nume.`);
    const handler = ['none', 'announcement', 'request', 'approval', 'report'].includes(String(value.handler || '').trim().toLowerCase()) ? String(value.handler || '').trim().toLowerCase() : 'none';
    const form_schema = Array.isArray(value.form_schema) ? value.form_schema.slice(0, 5).map((field: any, index: number) => ({ id: clean(field?.id || `field_${index + 1}`, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_'), label: clean(field?.label || `Câmp ${index + 1}`, 80), type: ['short_text', 'long_text', 'number', 'date', 'url', 'select'].includes(String(field?.type || 'short_text')) ? String(field.type) : 'short_text', required: field?.required !== false, placeholder: clean(field?.placeholder, 120), validation: field?.validation && typeof field.validation === 'object' ? { pattern: clean(field.validation.pattern, 120), min: Number.isFinite(Number(field.validation.min)) ? Number(field.validation.min) : null, max: Number.isFinite(Number(field.validation.max)) ? Number(field.validation.max) : null } : { pattern: '', min: null, max: null }, options: Array.isArray(field?.options) ? field.options.slice(0, 25).map((option: any) => clean(option, 80)).filter(Boolean) : [] })).filter((field: any) => field.label) : [];
    const workflow = value.workflow && typeof value.workflow === 'object' ? { announcement_mode: ['public', 'private'].includes(value.workflow.announcement_mode) ? value.workflow.announcement_mode : 'public', approval_role: clean(value.workflow.approval_role, 80), report_limit: Math.min(100, Math.max(1, Number(value.workflow.report_limit) || 20)), logging_enabled: value.workflow.logging_enabled !== false, log_events: Array.isArray(value.workflow.log_events) ? value.workflow.log_events.filter((item: any) => ['submission','approval','rejection','error'].includes(String(item))).slice(0, 10) : ['submission','approval','rejection','error'], notify_submitter: value.workflow.notify_submitter !== false, actions: Array.isArray(value.workflow.actions) ? value.workflow.actions.filter((item: any) => ['save_submission', 'send_log', 'notify_submitter', 'update_message', 'review_buttons', 'run_report'].includes(String(item))).slice(0, 10) : [] } : { announcement_mode: 'public', approval_role: '', report_limit: 20, logging_enabled: true, log_events: ['submission', 'approval', 'rejection', 'error'], notify_submitter: true, actions: [] };
    const embed = value.embed && typeof value.embed === 'object' ? { author_name: clean(value.embed.author_name, 256), author_icon: clean(value.embed.author_icon, 500), thumbnail: clean(value.embed.thumbnail, 500), image: clean(value.embed.image, 500), footer_text: clean(value.embed.footer_text, 2048), footer_icon: clean(value.embed.footer_icon, 500), timestamp: value.embed.timestamp === true, fields: Array.isArray(value.embed.fields) ? value.embed.fields.slice(0, 25).map((field: any) => ({ name: clean(field?.name, 256), value: clean(field?.value, 1024), inline: field?.inline === true })).filter((field: any) => field.name && field.value) : [] } : { author_name: '', author_icon: '', thumbnail: '', image: '', footer_text: '', footer_icon: '', timestamp: false, fields: [] };
    const buttons = Array.isArray(value.buttons) ? value.buttons.slice(0, 5).map((button: any, index: number) => ({ id: `panel:custom:${key}:${index}`, label: clean(button?.label || `Acțiunea ${index + 1}`, 80), type: ['button', 'link', 'select', 'modal'].includes(String(button?.type || '').toLowerCase()) ? String(button.type).toLowerCase() : 'button', style: [1, 2, 3, 4, 5].includes(Number(button?.style)) ? Number(button.style) : 1, url: clean(button?.url, 500), action: ['open_form', 'save_submission', 'send_log', 'notify_submitter', 'update_message', 'approve', 'reject', 'report', 'none'].includes(String(button?.action || '').toLowerCase()) ? String(button.action).toLowerCase() : 'open_form', action_config: button?.action_config && typeof button.action_config === 'object' ? { message: clean(button.action_config.message, 2000), status: ['pending', 'approved', 'rejected', 'published', 'closed'].includes(String(button.action_config.status)) ? String(button.action_config.status) : '', module_key: customModuleKey(button.action_config.module_key || key) } : { message: '', status: '', module_key: key }, options: Array.isArray(button?.options) ? button.options.slice(0, 25).map((option: any) => ({ label: clean(option?.label, 80), value: clean(option?.value || option?.label, 100), description: clean(option?.description, 100) })).filter((option: any) => option.label && option.value) : [] })).filter((button: any) => button.label) : [];
    const response_flow = value.response_flow && typeof value.response_flow === 'object' ? { enabled: value.response_flow.enabled === true, title: clean(value.response_flow.title || `${label} · Răspuns`, 256), log_key: `log_${key}_response`, reason_required: value.response_flow.reason_required === true, notify_submitter: value.response_flow.notify_submitter !== false } : { enabled: false, title: `${label} · Răspuns`, log_key: `log_${key}_response`, reason_required: false, notify_submitter: true };
    const responses = value.responses && typeof value.responses === 'object' ? { success: clean(value.responses.success, 2000), error: clean(value.responses.error, 2000), confirmation: clean(value.responses.confirmation, 2000), visibility: value.responses.visibility === 'public' ? 'public' : 'private' } : { success: '', error: '', confirmation: '', visibility: 'private' };
    const limits = value.limits && typeof value.limits === 'object' ? { cooldown_seconds: Math.min(86400, Math.max(0, Number(value.limits.cooldown_seconds) || 0)), max_pending: Math.min(1000, Math.max(0, Number(value.limits.max_pending) || 0)), max_per_user: Math.min(1000, Math.max(0, Number(value.limits.max_per_user) || 0)), allow_attachments: value.limits.allow_attachments === true, max_text_length: Math.min(4000, Math.max(100, Number(value.limits.max_text_length) || 1800)) } : { cooldown_seconds: 0, max_pending: 0, max_per_user: 0, allow_attachments: false, max_text_length: 1800 };
    const permissions = value.permissions && typeof value.permissions === 'object' ? { mode: ['everyone', 'mapped_role', 'manager', 'owner'].includes(String(value.permissions.mode)) ? String(value.permissions.mode) : 'everyone', role_ids: Array.isArray(value.permissions.role_ids) ? value.permissions.role_ids.slice(0, 25).map(String).filter((roleId: string) => /^\d{15,22}$/.test(roleId)) : [] } : { mode: 'everyone', role_ids: [] };
    result[key] = { key, label, title, description, color: Number.isInteger(Number(value.color)) ? Math.max(0, Math.min(0xffffff, Number(value.color))) : 0x5865f2, embed, handler, active: value.active !== false, premium: value.premium === true, command_name: clean(value.command_name, 32).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32), form_schema, workflow, responses, limits, permissions, log_key: `log_${key}`, buttons };
  }
  return result;
};
const botHeaders = (token: string) => ({ Authorization: `Bot ${token}`, 'User-Agent': 'Panel Pro Discord Bot (+https://panel-pro.ro)' });

async function discordUser(token: string) {
  const response = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Sesiunea Discord a expirat. Conectează-te din nou.');
  return response.json();
}

async function refreshGuildEntitlements(db: any, guildId: string, organizationId: string, applicationId: string) {
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  if (!botToken) return;
  const response = await fetch(`${DISCORD_API}/applications/${applicationId}/entitlements?guild_id=${encodeURIComponent(guildId)}&limit=100`, { headers: botHeaders(botToken) });
  if (!response.ok) return;
  const items = await response.json().catch(() => []);
  const skuIds = new Set(String(Deno.env.get('DISCORD_PREMIUM_GUILD_SKU_IDS') || Deno.env.get('DISCORD_PREMIUM_GUILD_SKU_ID') || '').split(',').map((value) => value.trim()).filter((value) => id(value)));
  for (const item of Array.isArray(items) ? items : []) {
    const skuId = String(item?.sku_id || '').trim(); const entitlementId = String(item?.id || '').trim();
    if (!skuIds.has(skuId) || !entitlementId) continue;
    const active = !item?.deleted && (!item?.ends_at || Date.parse(String(item.ends_at)) > Date.now());
    const { data: existing } = await db.from('discovery_guild_entitlements').select('id,raw_entitlement').eq('guild_id', guildId).eq('organization_id', organizationId).eq('sku_id', skuId).eq('raw_entitlement->>id', entitlementId).maybeSingle();
    if (existing?.raw_entitlement?.panel_revoked === true) continue;
    const payload = { guild_id: guildId, organization_id: organizationId, sku_id: skuId, owner_type: 2, purchaser_user_id: item?.user_id || null, active, starts_at: item?.starts_at || new Date().toISOString(), ends_at: item?.ends_at || null, raw_entitlement: item, updated_at: new Date().toISOString() };
    if (existing?.id) await db.from('discovery_guild_entitlements').update(payload).eq('id', existing.id);
    else await db.from('discovery_guild_entitlements').insert(payload);
  }
}

async function ensureDiscordOrganization(db: any, user: any, guild: any, applicationId: string) {
  const guildId = String(guild.id);
  const { data: linked, error: linkedError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (linkedError) throw linkedError;
  if (linked?.organization_id) {
    const { data: linkedOrganization, error: linkedOrganizationError } = await db.from('discovery_organizations').select('access_mode,slug').eq('id', linked.organization_id).maybeSingle();
    if (linkedOrganizationError) throw linkedOrganizationError;
    if (linkedOrganization?.access_mode === 'discord_only' || String(linkedOrganization?.slug || '').startsWith('discord-')) {
      const liveName = clean(guild.name || '', 120);
      if (liveName) {
        await Promise.all([
          db.from('discovery_organizations').update({ name: liveName, updated_at: new Date().toISOString() }).eq('id', linked.organization_id),
          db.from('discovery_guilds').update({ guild_name: liveName }).eq('organization_id', linked.organization_id).eq('guild_id', guildId),
          db.from('discovery_bot_installations').update({ guild_name: liveName, last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('guild_id', guildId),
        ]);
      }
    }
    return linked;
  }
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  const botGuildResponse = await fetch(`${DISCORD_API}/guilds/${guildId}`, { headers: botHeaders(botToken) });
  if (!botGuildResponse.ok) return null;
  const now = new Date().toISOString();
  const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: organization, error: organizationError } = await db.from('discovery_organizations').insert({ slug: `discord-${guildId}`, name: clean(guild.name || `Server Discord ${guildId}`, 120), access_mode: 'discord_only', lifecycle_status: 'active', active: true, updated_at: now }).select('id,name,access_mode,active').single();
  if (organizationError) {
    if (organizationError.code === '23505') return (await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle()).data;
    throw organizationError;
  }
  const organizationId = String(organization.id);
  const results = await Promise.all([
    db.from('discovery_guilds').insert({ organization_id: organizationId, guild_id: guildId, guild_name: clean(guild.name || guildId, 120), kind: 'primary', enabled: true }),
    db.from('discovery_settings').insert({ organization_id: organizationId, discord_client_id: applicationId || '1531023771211792384', panel_public_url: '', discord_channel_routes: {}, updated_at: now, updated_by_discord_id: String(user.id) }),
    db.from('discovery_app_settings').insert({ organization_id: organizationId, key: 'organization_package', value: { code: 'discord', unlimited: true, expires_at: null }, updated_at: now }),
    db.from('discovery_app_settings').insert({ organization_id: organizationId, key: 'discord_trial', value: { starts_at: now, ends_at: trialEnds, duration_days: 30 }, updated_at: now }),
    db.from('discovery_members').insert({ organization_id: organizationId, discord_id: String(user.id), panel_role: 'Administrator', permission_level: 99, active: true, last_verified_at: now }),
  ]);
  const failed = results.find((result: any) => result?.error);
  if (failed?.error) throw failed.error;
  return { organization_id: organizationId, kind: 'primary' };
}

async function ownedGuilds(db: any, user: any, applicationId: string, platformAdmin = false, diagnostics: Record<string, any> = {}) {
  const token = String(user.access_token);
  let guilds: any[] = [];
  if (platformAdmin) {
    const { data: registered, error: registeredError } = await db.from('discovery_guilds').select('guild_id,guild_name').eq('enabled', true).order('guild_name');
    if (registeredError) throw registeredError;
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    for (const registeredGuild of registered || []) {
      const guildId = String(registeredGuild.guild_id || '').trim();
      if (!id(guildId) || !botToken) continue;
      const response = await fetch(`${DISCORD_API}/guilds/${guildId}`, { headers: botHeaders(botToken) });
      if (response.ok) {
        const guild = await response.json().catch(() => ({}));
        guilds.push({ ...guild, id: guildId, name: guild.name || registeredGuild.guild_name || guildId, owner: false });
      }
    }
    diagnostics.oauth_guild_count = guilds.length;
    diagnostics.oauth_scope_required = false;
  } else {
    const response = await fetch(`${DISCORD_API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Sesiunea Discord a expirat sau tokenul nu mai este valid. Reconectează-te prin Discord.');
      if (response.status === 403) throw new Error('Discord a refuzat lista serverelor. Reautorizează aplicația cu scope-ul OAuth guilds.');
      throw new Error(`Serverele Discord nu pot fi încărcate momentan (Discord HTTP ${response.status}).`);
    }
    guilds = await response.json();
    diagnostics.oauth_guild_count = Array.isArray(guilds) ? guilds.length : 0;
  }
  diagnostics.owner_guild_count = 0;
  diagnostics.bot_check_count = 0;
  diagnostics.bot_check_failures = [];
  const result = [];
  for (const guild of Array.isArray(guilds) ? guilds : []) {
    if (guild.owner) diagnostics.owner_guild_count += 1;
    if (!id(guild.id)) continue;
    diagnostics.bot_check_count += 1;
    const linked = await ensureDiscordOrganization(db, user, guild, applicationId);
    if (!linked?.organization_id) {
      diagnostics.bot_check_failures.push({ guild_id: String(guild.id), guild_name: clean(guild.name || guild.id, 120), reason: 'Botul nu a fost găsit în server sau DISCORD_BOT_TOKEN nu are acces.' });
      continue;
    }
    const { data: organization, error } = await db.from('discovery_organizations').select('id,name,access_mode,active').eq('id', linked.organization_id).maybeSingle();
    if (error) throw error;
    if (organization?.access_mode !== 'discord_only' && !platformAdmin) continue;
    if (String(guild.id) === OFFICIAL_GUILD_ID && !platformAdmin) continue;
    const { data: packageSetting } = await db.from('discovery_app_settings').select('key,value').eq('organization_id', linked.organization_id).in('key', ['organization_package', 'discord_trial', 'discord_bot_admin_roles', 'discord_bot_admin_users']);
    const packageValue = (packageSetting || []).find((item: any) => item.key === 'organization_package')?.value || {};
    const trialValue = (packageSetting || []).find((item: any) => item.key === 'discord_trial')?.value || {};
    const adminRolesValue = (packageSetting || []).find((item: any) => item.key === 'discord_bot_admin_roles')?.value || {};
    const adminRoleIds = Array.isArray(adminRolesValue?.role_ids) ? adminRolesValue.role_ids.map(String) : [];
    const adminUsersValue = (packageSetting || []).find((item: any) => item.key === 'discord_bot_admin_users')?.value || {};
    const adminUserIds = Array.isArray(adminUsersValue?.discord_ids) ? adminUsersValue.discord_ids.map(String) : [];
    const isOwner = Boolean(guild.owner);
    const isRoleAdmin = !isOwner && adminRoleIds.length ? (await memberRoleIds(db, String(guild.id), String(user.id))).some((roleId: string) => adminRoleIds.includes(roleId)) : false;
    const isUserAdmin = !isOwner && adminUserIds.includes(String(user.id));
    if (!platformAdmin && !isOwner && !isRoleAdmin && !isUserAdmin) continue;
    await refreshGuildEntitlements(db, String(guild.id), String(organization?.id || linked.organization_id), applicationId);
    const { data: entitlement } = await db.from('discovery_guild_entitlements').select('sku_id,ends_at,active').eq('guild_id', String(guild.id)).eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const premium = Boolean(entitlement && (!entitlement.ends_at || Date.parse(String(entitlement.ends_at)) > Date.now()));
    const trial = !premium && Date.parse(String(trialValue.ends_at || '')) > Date.now();
    result.push({ id: String(guild.id), name: clean(guild.name || guild.id, 120), organization_id: String(organization?.id || linked.organization_id), organization_name: clean(organization?.name || guild.name, 120), access_mode: organization?.access_mode || 'discord_only', bot_installed: true, is_owner: isOwner, can_manage_access: Boolean(platformAdmin || isOwner), plan: premium ? 'premium' : trial ? 'trial' : 'free', trial_ends_at: trialValue.ends_at || null, premium_ends_at: entitlement?.ends_at || null, sku_id: entitlement?.sku_id || null });
  }
  return result;
}

async function reconcileInstallations(db: any) {
  const { data: installations, error } = await db.from('discovery_bot_installations').select('guild_id,status').eq('status', 'active');
  if (error) {
    if (error.code === '42P01') return { checked: 0, removed: 0 };
    throw error;
  }
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  if (!botToken) return { checked: 0, removed: 0, skipped: 'DISCORD_BOT_TOKEN lipsește.' };
  let removed = 0;
  for (const installation of installations || []) {
    const guildId = String(installation.guild_id || '');
    if (!id(guildId)) continue;
    const response = await fetch(`${DISCORD_API}/guilds/${guildId}`, { headers: botHeaders(botToken) });
    if (response.status === 404) {
      await db.from('discovery_bot_installations').update({ status: 'removed', removed_at: new Date().toISOString(), last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('guild_id', guildId);
      removed += 1;
    } else if (response.ok) {
      const guild = await response.json().catch(() => ({}));
      await db.from('discovery_bot_installations').update({ guild_name: clean(guild.name || '', 120) || undefined, last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('guild_id', guildId);
    }
  }
  return { checked: (installations || []).length, removed };
}

async function channels(db: any, guildId: string) {
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, { headers: botHeaders(botToken) });
  if (!response.ok) throw new Error(`Canalele Discord nu pot fi citite (HTTP ${response.status}). Verifică accesul botului.`);
  const raw = await response.json();
  const categories = new Map((Array.isArray(raw) ? raw : []).filter((item: any) => Number(item.type) === 4).map((item: any) => [String(item.id), item.name]));
  return (Array.isArray(raw) ? raw : []).filter((item: any) => [0, 5].includes(Number(item.type)) && id(item.id)).map((item: any) => ({ id: String(item.id), name: clean(item.name || item.id, 100), category_name: categories.get(String(item.parent_id || '')) || '', type: Number(item.type) })).sort((a: any, b: any) => `${a.category_name}/${a.name}`.localeCompare(`${b.category_name}/${b.name}`, 'ro'));
}

// Potrivește automat modulele și jurnalele cu canalele existente. Numele
// canalelor pot conține emoji sau diacritice, de aceea comparația este
// normalizată și nu depinde de formatul exact al denumirii.
function autoRouteChannels(channelList: any[], guildId: string, currentRoutes: Record<string, any> = {}, definitions: Record<string, any> = MODULES) {
  const normalize = (value: unknown) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const rows = (Array.isArray(channelList) ? channelList : []).map((channel: any) => ({ ...channel, search: normalize(`${channel.category_name || ''} ${channel.name || ''}`), nameSearch: normalize(channel.name || '') }));
  const blocked = (row: any) => /(^| )(log|audit|staff|cereri suport|incidente)( |$)/.test(row.search);
  const matchers: Record<string, string[]> = {
    pontaj: ['pontaj', 'ture'], requests_organization: ['invoiri organizatie', 'cereri organizatie'], requests_departments: ['invoiri angajati', 'invoiri departamente'],
    organization: ['anunturi organizatie'], departments: ['anunturi angajati'], contracts: ['contracte'], contract_identity_weekly: ['raport saptamanal contracte'],
    actions_organization: ['actiuni organizatie'], marketplace: ['marketplace legal'], illegal_marketplace: ['marketplace ilegal'], event_reminders: ['evenimente', 'remindere'],
    stash_requests: ['cereri stash'], stash_donations: ['donatii stash'], stash: ['stash'], status_live: ['status live', 'status servicii', 'status api'],
  };
  const routes: Record<string, any> = { ...(currentRoutes || {}) }; const matched: Record<string, string> = {}; const unmatched: string[] = [];
  for (const [key, definition] of Object.entries(definitions || {})) {
    const terms = matchers[key] || [normalize((definition as any).label || key)];
    const exactName = normalize((definition as any).label || key).replace(/ /g, '-');
    const preferred = rows.filter((row: any) => !blocked(row) && terms.some((term) => row.search.includes(normalize(term))));
    const found = preferred.find((row: any) => normalize(row.name || '').replace(/ /g, '-') === exactName)
      || preferred.find((row: any) => normalize(row.category_name || '') === 'panel pro' || normalize(row.category_name || '').includes('panel pro'))
      || preferred[0];
    if (found) { matched[key] = String(found.id); routes[key] = { ...(routes[key] || {}), primary: { ...(routes[key]?.primary || {}), channel_id: String(found.id), guild_id: guildId, enabled: true } }; }
    else if (!routes[key]?.primary?.channel_id) unmatched.push(key);
  }
  const logFallback = rows.find((row: any) => row.nameSearch === 'staff log' || row.nameSearch.includes('staff log'))?.id;
  const logTerms: Record<string, string[]> = { log_pontaj: ['pontaj'], log_requests_organization: ['invoiri organizatie'], log_requests_departments: ['invoiri angajati'], log_announcements_organization: ['anunturi organizatie'], log_announcements_departments: ['anunturi angajati'], log_contracts: ['contracte'], log_contract_identity_weekly: ['raport saptamanal contracte'], log_actions_organization: ['actiuni organizatie'], log_marketplace: ['marketplace legal'], log_illegal_marketplace: ['marketplace ilegal'], log_stash: ['stash'], log_stash_requests: ['cereri stash'], log_stash_donations: ['donatii stash'], log_event_reminders: ['evenimente', 'remindere'] };
  for (const logKey of Object.values(LOG_ROUTES)) {
    const terms = logTerms[logKey] || []; const found = rows.find((row: any) => /(^| )(log|audit)( |$)/.test(row.search) && terms.some((term) => row.search.includes(normalize(term)))); const channelId = found?.id || logFallback;
    if (channelId) routes[logKey] = { ...(routes[logKey] || {}), primary: { ...(routes[logKey]?.primary || {}), channel_id: String(channelId), guild_id: guildId, enabled: true } };
  }
  const support = (needle: string) => rows.find((row: any) => row.nameSearch.includes(needle))?.id;
  for (const [key, needle] of [['support_tickets', 'deschide ticket'], ['support_questions', 'intrebari'], ['support_suggestions', 'sugestii'], ['support_bug_reports', 'raporteaza problema'], ['support_feedback', 'trimite feedback'], ['status_servicii', 'status servicii'], ['staff_log', 'staff log'], ['support_requests_log', 'cereri suport'], ['audit_actions', 'audit actiuni'], ['incidents', 'incidente'], ['community_welcome', 'bun venit'], ['community_departures', 'plecari'], ['community_promotions', 'avansari'], ['billing_thanks', 'multumim clienti']] as const) {
    const channelId = support(needle); if (channelId) routes[key] = { ...(routes[key] || {}), primary: { ...(routes[key]?.primary || {}), channel_id: String(channelId), guild_id: guildId, enabled: true } };
  }
  return { routes, matched, unmatched };
}

async function guildRoles(db: any, guildId: string) {
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, { headers: botHeaders(botToken) });
  if (!response.ok) throw new Error(`Rolurile Discord nu pot fi citite (HTTP ${response.status}).`);
  const raw = await response.json();
  return (Array.isArray(raw) ? raw : []).filter((role: any) => id(role.id) && !role.managed).map((role: any) => ({ id: String(role.id), name: clean(role.name || role.id, 100), position: Number(role.position || 0) })).sort((a: any, b: any) => b.position - a.position || a.name.localeCompare(b.name, 'ro'));
}

async function memberRoleIds(db: any, guildId: string, discordId: string) {
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordId}`, { headers: botHeaders(botToken) });
  if (!response.ok) return [];
  const member = await response.json().catch(() => ({}));
  return Array.isArray(member?.roles) ? member.roles.map((value: any) => String(value)) : [];
}

async function provisionOfficialServer(db: any, guildId: string) {
  const token = await getPlatformSecret(db, 'discord_bot_token'); const base = DISCORD_API + '/guilds/' + guildId; const headers = { ...botHeaders(token), 'Content-Type': 'application/json' };
  const api = async (path: string, body?: any) => { const r = await fetch(base + path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers }); const responseBody = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`Discord API ${path} HTTP ${r.status}: ${String(responseBody?.message || 'Missing Permissions')}`); return responseBody; };
  const botIdentity = await fetch(`${DISCORD_API}/users/@me`, { headers }); const botUser = await botIdentity.json().catch(() => ({})); if (!botIdentity.ok) throw new Error(`Discord API /users/@me HTTP ${botIdentity.status}: ${String(botUser?.message || 'Bot token invalid')}`); const botUserId = String(botUser?.id || '');
  const existingRoles = await api('/roles'); const roleNames = ['Administrator','Staff','Support','Moderator','Premium','Member']; const roleIds: Record<string,string> = {};
  for (const name of roleNames) { const found = (Array.isArray(existingRoles) ? existingRoles : []).find((r:any) => !r.managed && String(r.name).toLowerCase() === name.toLowerCase()); const role = found || await api('/roles', { name, permissions: '0', color: name === 'Premium' ? 0xf59e0b : name === 'Administrator' ? 0x5865f2 : 0x334155, hoist: name !== 'Member', mentionable: true }); roleIds[name] = String(role.id); }
  const existing = await api('/channels'); const channelIds: Record<string,string> = {}; const categories = ['📌 START AICI','📚 DOCUMENTAȚIE','🛠️ SUPORT','🌐 COMUNITATE','💎 PREMIUM','📊 INFORMAȚII BOT','🔒 STAFF']; const categoryIds: Record<string,string> = {};
  for (const name of categories) { const found=(Array.isArray(existing)?existing:[]).find((c:any)=>Number(c.type)===4&&String(c.name)===name); categoryIds[name]=String(found?.id || (await api('/channels',{name,type:4})).id); }
  const groups: Record<string,string[]> = { '📌 START AICI':['👋・bun-venit','🚪・plecări','📈・avansări','🎉・mulțumim-clienților','📖・ghid-panel-pro','✅・cum-incepi','📜・reguli','🔐・confidențialitate','📢・anunțuri-oficiale','🆕・noutăți'], '📚 DOCUMENTAȚIE':['📘・documentație','⚙️・configurare-bot','🧩・module-disponibile','🎛️・permisiuni','📝・exemple-module','❓・întrebări-frecvente','🔗・comenzi-disponibile'], '🛠️ SUPORT':['🎫・deschide-ticket','🙋・întrebări','💡・sugestii','🐞・raportează-problemă','📎・trimite-feedback','🟢・status-servicii'], '🌐 COMUNITATE':['💬・discuții-generale','🎮・discuții-roleplay','🤝・prezentări-servere','🏆・showcase-configurări','📸・capturi-din-servere','🗳️・sondaje-comunitate','📅・evenimente'], '💎 PREMIUM':['⭐・panel-pro-premium','🚀・funcții-premium','🎁・oferte-și-beneficii','💎・preturi-si-premium'], '📊 INFORMAȚII BOT':['📈・statistici-bot','🤖・comenzi-bot','🔄・istoric-versiuni','🛡️・securitate','📡・status-api','🌍・limbi-disponibile'], '🔒 STAFF':['🛡️・staff-chat','📋・staff-log','🚨・incidente','📥・cereri-suport','🧾・audit-acțiuni'] };
  const voiceGroups: Record<string,string[]> = { '🛠️ SUPORT':['🔊・așteptare-support','🔊・support-1','🔊・support-2'], '🌐 COMUNITATE':['🔊・comunitate-1','🔊・comunitate-2'], '💎 PREMIUM':['💎・premium-voice-1','💎・premium-voice-2','💎・premium-voice-3'], '🔒 STAFF':['🔒・staff-voice'] };
  const readOnly=new Set(['👋・bun-venit','🚪・plecări','📈・avansări','🎉・mulțumim-clienților','📖・ghid-panel-pro','✅・cum-incepi','📜・reguli','🔐・confidențialitate','📢・anunțuri-oficiale','🆕・noutăți','📘・documentație','⚙️・configurare-bot','🧩・module-disponibile','🎛️・permisiuni','📝・exemple-module','❓・întrebări-frecvente','🔗・comenzi-disponibile','💎・preturi-si-premium','🟢・status-servicii']); let created=0;
  for (const cat of Object.keys(groups)) for (const name of groups[cat]) { const aliases = name === '📜・reguli' ? ['📜・reguli','rules'] : name === '🧩・module-disponibile' ? ['🧩・module-disponibile','module-disponibile','module disponibile'] : [name]; const existingChannel=(Array.isArray(existing)?existing:[]).find((c:any)=>Number(c.type)===0&&aliases.includes(String(c.name))); const overwrites:any[]=[]; if(readOnly.has(name)) overwrites.push({id:guildId,type:0,allow:'1024',deny:'2048'}); if(botUserId) overwrites.push({id:botUserId,type:1,allow:'68608'}); if(cat==='🔒 STAFF') { overwrites.push({id:guildId,type:0,allow:'0',deny:'1024'}); overwrites.push({id:roleIds.Staff,type:0,allow:'68608'}); overwrites.push({id:roleIds.Support,type:0,allow:'68608'}); } if(cat==='💎 PREMIUM' && name!=='💎・preturi-si-premium') { overwrites.push({id:guildId,type:0,allow:'0',deny:'1024'}); overwrites.push({id:roleIds.Premium,type:0,allow:'68608'}); } if(existingChannel){channelIds[name]=String(existingChannel.id); if(name==='📜・reguli') channelIds.rules=String(existingChannel.id); if(name==='🧩・module-disponibile') { channelIds['module-disponibile']=String(existingChannel.id); channelIds['module disponibile']=String(existingChannel.id); } if(readOnly.has(name) || cat==='🔒 STAFF' || (cat==='💎 PREMIUM' && name!=='💎・preturi-si-premium')) await fetch(`${DISCORD_API}/channels/${existingChannel.id}`,{method:'PATCH',headers,body:JSON.stringify({permission_overwrites:overwrites})}); continue;} const made=await api('/channels',{name,type:0,parent_id:categoryIds[cat],permission_overwrites:overwrites}); channelIds[name]=String(made.id); created++; }
  for (const cat of Object.keys(voiceGroups)) for (const name of voiceGroups[cat]) { const existingChannel=(Array.isArray(existing)?existing:[]).find((c:any)=>Number(c.type)===2&&String(c.name)===name); const waiting=name.includes('așteptare'); const premiumVoice=cat==='💎 PREMIUM'; const staffVoice=cat==='🔒 STAFF'; const supportVoice=cat==='🛠️ SUPORT'; const overwrites:any[] = staffVoice ? [{id:guildId,type:0,allow:'0',deny:'1024'},{id:roleIds.Staff,type:0,allow:'19923968'},{id:roleIds.Support,type:0,allow:'19923968'}] : premiumVoice ? [{id:guildId,type:0,allow:'0',deny:'1049600'},{id:roleIds.Premium,type:0,allow:'3146752'},{id:roleIds.Staff,type:0,allow:'19923968'},{id:roleIds.Support,type:0,allow:'19923968'}] : supportVoice ? [{id:guildId,type:0,allow:waiting?'1024':'2098176',deny:waiting?'2097152':'1048576'},{id:roleIds.Staff,type:0,allow:'19923968'},{id:roleIds.Support,type:0,allow:'19923968'}] : [{id:guildId,type:0,allow:'3146752',deny:'0'},{id:roleIds.Staff,type:0,allow:'19923968'},{id:roleIds.Support,type:0,allow:'19923968'}]; if(botUserId) overwrites.push({id:botUserId,type:1,allow:'25166848'}); if(existingChannel){channelIds[name]=String(existingChannel.id); await fetch(`${DISCORD_API}/channels/${existingChannel.id}`,{method:'PATCH',headers,body:JSON.stringify({permission_overwrites:overwrites})}); continue;} const made=await api('/channels',{name,type:2,parent_id:categoryIds[cat],permission_overwrites:overwrites}); channelIds[name]=String(made.id); created++; }
  const messages: Record<string, any> = {
    '👋・bun-venit': { embeds: [{ title: '👋 Bun venit pe Panel Pro Bot', description: 'Administrare Discord mai simplă, într-un singur loc.\n\n🌐 Panoul oficial: https://bot.panel-pro.ro\n\nÎncepe cu canalul 📖・ghid-panel-pro.', color: 0x5865f2 }] },
    '🚪・plecări': { embeds: [{ title: '🚪 Plecări', description: 'Aici apar mesajele elegante atunci când un membru părăsește comunitatea.', color: 0xef4444 }] },
    '🎉・mulțumim-clienților': { embeds: [{ title: '🎉 Mulțumim că ești alături de Panel Pro', description: 'Activările de Trial, Premium și planul gratuit vor fi confirmate aici automat.', color: 0x22d3ee }] },
    '📈・avansări': { embeds: [{ title: '📈 Avansări și roluri', description: 'Felicităm membrii atunci când primesc un rol nou sau avansează în comunitate.', color: 0xf59e0b }] },
    '🚪・plecări': { embeds: [{ title: '🚪 Plecări', description: 'Aici apar mesajele elegante atunci când un membru părăsește comunitatea.', color: 0xef4444 }] },
    '📈・avansări': { embeds: [{ title: '📈 Avansări și roluri', description: 'Felicităm membrii atunci când primesc un rol nou sau avansează în comunitate.', color: 0xf59e0b }] },
    '📖・ghid-panel-pro': { embeds: [{ title: '📖 Ghid Panel Pro', description: '**1.** Adaugă botul pe server.\n**2.** Intră pe https://bot.panel-pro.ro și conectează-te cu Discord.\n**3.** Alege serverul și configurează modulele.\n**4.** Alege canalele pentru embed și log.\n**5.** Publică și testează fiecare modul.\n\nPentru ajutor, deschide un ticket în 🎫・deschide-ticket.', color: 0x22d3ee }] },
    '🎫・deschide-ticket': { embeds: [{ title: '🎫 Suport Panel Pro', description: 'Ai nevoie de ajutor? Deschide un ticket privat și echipa noastră va răspunde în cel mai scurt timp.', color: 0x5865f2 }], components: [{ type: 1, components: [{ type: 2, style: 1, label: '🎫 Deschide ticket', custom_id: 'panel:ticket:open' }] }] },
    '🤖・comenzi-bot': { embeds: [{ title: '🤖 Comenzi Panel Pro', description: '`/panel status` — verifică statusul botului\n`/panel publica` — publică un modul cu butoane\n`/panel config` — configurează canalele\n`/panel publica modul:stash` — publică Stash\n`/panel publica modul:contracts` — publică Contracte\n`/panel publica modul:event_reminders` — publică Evenimente și remindere\n\nModulele personalizate cu comandă slash apar automat după sincronizare.', color: 0x8b5cf6 }] },
    '📜・termeni-si-conditii': { embeds: [{ title: '📜 Termeni și condiții', description: 'Panel Pro Bot este un instrument de administrare pentru servere Discord. Utilizarea botului presupune respectarea regulilor Discord și a legilor aplicabile.\n\nDatele sunt folosite pentru funcțiile activate de administratorul serverului. Administratorii serverelor sunt responsabili pentru configurarea permisiunilor și conținutul introdus.\n\nNu distribui tokenuri, parole sau date sensibile în canalele publice. Pentru întrebări, folosește suportul oficial.', color: 0xf59e0b }] },
    '💎・preturi-si-premium': { embeds: [{ title: '💎 Panel Pro Premium · $9.99 / lună', description: 'Activează funcțiile complete Panel Pro pentru serverul tău Discord.\n\n**Include:**\n• Pontaj și ture\n• Anunțuri și sondaje\n• Contracte\n• Stash\n• Loguri organizate\n\nDetalii și activare: https://bot.panel-pro.ro\nNu efectua plăți prin mesaje private sau linkuri neverificate.', color: 0xf59e0b }] },
    '✅・cum-incepi': { embeds: [{ title: '✅ Cum începi', description: '**1.** Adaugă Panel Pro Bot pe server.\n**2.** Deschide https://bot.panel-pro.ro și conectează-te cu Discord.\n**3.** Alege serverul și configurează modulele.\n**4.** Selectează canalul embedului și canalul de log.\n**5.** Publică modulul și testează butoanele.\n\nPentru suport, folosește 🎫・deschide-ticket.', color: 0x22c55e }] },
    '📢・anunțuri-oficiale': { embeds: [{ title: '📢 Anunțuri oficiale', description: 'Anunțurile oficiale Panel Pro, schimbările de serviciu și comunicările importante vor fi publicate aici.', color: 0x5865f2 }] },
    '🆕・noutăți': { embeds: [{ title: '🆕 Noutăți Panel Pro', description: 'Versiuni noi, funcții lansate și îmbunătățiri ale botului. Pentru istoricul complet, consultă 🔄・istoric-versiuni.', color: 0x22d3ee }] },
    '📜・reguli': { embeds: [{ title: '📜 Regulile comunității', description: 'Respectă membrii și echipa Panel Pro. Nu publica spam, conținut ilegal, date personale, tokenuri sau parole. Folosește canalele potrivite și oferă detalii clare când ceri ajutor. Moderatorii pot închide sau elimina conținutul care încalcă regulile.', color: 0xf59e0b }] },
    '🔐・confidențialitate': { embeds: [{ title: '🔐 Confidențialitate și securitate', description: 'Panel Pro folosește datele necesare funcțiilor activate de administratorul serverului. Nu trimite parole, tokenuri sau chei API în ticketuri ori canale publice. Verifică întotdeauna domeniul https://bot.panel-pro.ro înainte de autentificare.', color: 0x06b6d4 }] },
    '📘・documentație': { embeds: [{ title: '📘 Documentație Panel Pro', description: 'Documentația explică instalarea botului, configurarea canalelor, permisiunile, modulele și fluxurile de log. Începe cu 📖・ghid-panel-pro, apoi consultă ⚙️・configurare-bot și 🎛️・permisiuni.', color: 0x22d3ee }] },
    '⚙️・configurare-bot': { embeds: [{ title: '⚙️ Configurarea botului', description: 'Folosește `/panel config` pentru a configura canalul unui embed și canalul de log. Folosește `/panel publica` pentru a publica un modul. După modificări, verifică `/panel status` și testează fiecare buton.', color: 0x5865f2 }] },
    '🧩・module-disponibile': { embeds: [{ title: '🧩 Module disponibile', description: 'Modulele Panel Pro includ Pontaj, Învoiri, Anunțuri, Contracte, Stash, Marketplace, Acțiuni, Evenimente și remindere, Rapoarte și module personalizate. Modulele Premium depind de abonamentul activ.', color: 0x8b5cf6 }] },
    '🎛️・permisiuni': { embeds: [{ title: '🎛️ Permisiuni și roluri', description: 'Rolul botului trebuie să aibă View Channel, Send Messages, Embed Links, Manage Channels și Manage Roles. Rolurile Staff și Support gestionează suportul, Premium vede canalele Premium, iar Member este rolul standard.', color: 0x14b8a6 }] },
    '📝・exemple-module': { embeds: [{ title: '📝 Exemple de module', description: '**Cerere cu aprobare:** formular → staff → aprobare/respingere → log.\n**Sondaj:** întrebare → voturi → rezultate.\n**Eveniment:** detalii → reminder automat → log.\n**Ticket:** formular privat → Support → transcript și închidere.', color: 0x3b82f6 }] },
    '❓・întrebări-frecvente': { embeds: [{ title: '❓ Întrebări frecvente', description: '**Cum instalez botul?** Folosește butonul de instalare de pe https://bot.panel-pro.ro.\n\n**Cum public un modul?** Rulează `/panel publica` sau folosește pagina de configurare.\n\n**Unde ajung logurile?** În canalul de log ales pentru modul.\n\n**Cum cer ajutor?** Deschide un ticket în 🎫・deschide-ticket.\n\n**De ce nu funcționează un buton?** Verifică permisiunile botului și ruta canalului de log.', color: 0x06b6d4 }] },
    '🔗・comenzi-disponibile': { embeds: [{ title: '🔗 Comenzi disponibile', description: '`/panel status` — verifică configurarea.\n`/panel publica` — publică un modul.\n`/panel config` — configurează canale și loguri.\n`/panel ticket` — deschide un ticket privat.\n\nModulele personalizate cu comandă apar după sincronizarea comenzilor.', color: 0x5865f2 }] },
    '🙋・întrebări': { embeds: [{ title: '🙋 Întrebări despre Panel Pro', description: 'Pentru întrebări generale, caută mai întâi în ❓・întrebări-frecvente. Pentru date de configurare sau informații private, deschide un ticket.', color: 0x22d3ee }] },
    '💡・sugestii': { embeds: [{ title: '💡 Sugestii', description: 'Propune funcții sau îmbunătățiri concrete. Descrie problema rezolvată și modul în care ai folosi funcția.', color: 0xf59e0b }] },
    '🐞・raportează-problemă': { embeds: [{ title: '🐞 Raportează o problemă', description: 'Include modulul, comanda sau butonul afectat, serverul, ora aproximativă și mesajul de eroare. Nu include tokenuri sau date personale; pentru informații sensibile deschide un ticket.', color: 0xef4444 }] },
    '📎・trimite-feedback': { embeds: [{ title: '📎 Feedback', description: 'Feedback-ul tău ne ajută să îmbunătățim Panel Pro. Spune ce a funcționat, ce a fost neclar și ce ai schimba.', color: 0x8b5cf6 }] },
    '🟢・status-servicii': { embeds: [{ title: '🟢 Status servicii', description: 'Pentru incidente active și mentenanță, urmărește acest canal. Problemele individuale se trimit în 🎫・deschide-ticket.', color: 0x22c55e }] },
    '⭐・panel-pro-premium': { embeds: [{ title: '⭐ Panel Pro Premium', description: 'Premium oferă acces la module și funcții suplimentare conform planului activ. Verifică detaliile actuale pe https://bot.panel-pro.ro.', color: 0xf59e0b }] },
    '🚀・funcții-premium': { embeds: [{ title: '🚀 Funcții Premium', description: 'Aici sunt anunțate funcțiile Premium disponibile și actualizările lor. Accesul este verificat automat după abonamentul serverului.', color: 0xf59e0b }] },
    '🎁・oferte-și-beneficii': { embeds: [{ title: '🎁 Oferte și beneficii', description: 'Ofertele oficiale Panel Pro vor fi publicate aici. Verifică întotdeauna domeniul și nu efectua plăți prin mesaje private.', color: 0xf59e0b }] },
    '🛡️・securitate': { embeds: [{ title: '🛡️ Securitate', description: 'Panel Pro nu solicită tokenul Discord sau parola în mesaje. Folosește doar https://bot.panel-pro.ro și raportează imediat linkurile suspecte.', color: 0x06b6d4 }] },
    '🌍・limbi-disponibile': { embeds: [{ title: '🌍 Limbi disponibile', description: 'Interfața și mesajele Panel Pro sunt optimizate pentru limba română. Disponibilitatea altor limbi depinde de modul și versiunea activă.', color: 0x3b82f6 }] },
    '🛡️・staff-chat': { embeds: [{ title: '🛡️ Staff · comunicare', description: 'Canal intern pentru coordonarea echipei de suport și moderare. Nu publica date sensibile care nu sunt necesare.', color: 0x334155 }] },
    '📋・staff-log': { embeds: [{ title: '📋 Staff · jurnal', description: 'Canal intern pentru evenimente operaționale și verificări ale echipei.', color: 0x334155 }] },
    '🚨・incidente': { embeds: [{ title: '🚨 Incidente', description: 'Înregistrează aici incidentele care afectează serviciile sau comunitatea. Include impactul și pașii de remediere.', color: 0xef4444 }] },
    '📥・cereri-suport': { embeds: [{ title: '📥 Cereri suport', description: 'Rezumat intern al cererilor de suport care necesită urmărire.', color: 0x334155 }] },
    '🧾・audit-acțiuni': { embeds: [{ title: '🧾 Audit acțiuni', description: 'Jurnal intern pentru verificarea acțiunilor administrative și a modificărilor importante.', color: 0x334155 }] }
    ,'💬・discuții-generale': { embeds: [{ title: '💬 Discuții generale', description: 'Discută despre administrarea comunităților Discord și experiența cu Panel Pro. Păstrează conversațiile civilizate și relevante.', color: 0x5865f2 }] }
    ,'🎮・discuții-roleplay': { embeds: [{ title: '🎮 Discuții RolePlay', description: 'Schimbă idei despre servere RolePlay, organizare și module utile.', color: 0x8b5cf6 }] }
    ,'🤝・prezentări-servere': { embeds: [{ title: '🤝 Prezintă-ți serverul', description: 'Prezintă pe scurt serverul tău și modul în care folosești Panel Pro. Fără spam sau mesaje repetate.', color: 0x22c55e }] }
    ,'🏆・showcase-configurări': { embeds: [{ title: '🏆 Showcase configurări', description: 'Arată configurații și fluxuri Panel Pro utile comunității.', color: 0xf59e0b }] }
    ,'📸・capturi-din-servere': { embeds: [{ title: '📸 Capturi din servere', description: 'Distribuie capturi relevante din serverul tău. Ascunde datele personale și informațiile confidențiale.', color: 0x3b82f6 }] }
    ,'🗳️・sondaje-comunitate': { embeds: [{ title: '🗳️ Sondaje comunitate', description: 'Sondaje despre funcții, documentație și direcția comunității Panel Pro.', color: 0x8b5cf6 }] }
    ,'📅・evenimente': { embeds: [{ title: '📅 Evenimente', description: 'Anunță evenimentele comunității și oferă detalii clare despre dată și participare.', color: 0xf59e0b }] }
    ,'📈・statistici-bot': { embeds: [{ title: '📈 Statistici bot', description: 'Informații despre disponibilitatea și activitatea generală a botului vor fi publicate aici.', color: 0x06b6d4 }] }
    ,'🔄・istoric-versiuni': { embeds: [{ title: '🔄 Istoric versiuni', description: 'Actualizări, remedieri și schimbări importante ale Panel Pro Bot.', color: 0x5865f2 }] }
    ,'📡・status-api': { embeds: [{ title: '📡 Status API', description: 'Acest canal este rezervat pentru starea serviciilor API și notificări de mentenanță. Pentru probleme de acces, deschide un ticket.', color: 0x06b6d4 }] }
  };
  try {
    const { data: setting } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id','global').maybeSingle();
    const custom = setting?.custom_modules && typeof setting.custom_modules === 'object' ? Object.values(setting.custom_modules) as any[] : [];
    const builtins = Object.values(MODULES).map((m:any) => `${m.premium ? '⭐ Premium' : '🆓 Free'} · ${m.label}`);
    const customLines = custom.filter((m:any)=>m && m.active !== false).map((m:any)=>`${m.premium ? '⭐ Premium' : '🆓 Free'} · ${m.label || m.title || 'Modul personalizat'}`);
    const all = [...builtins, ...customLines];
    if (messages['🧩・module-disponibile']?.embeds?.[0]) { const embed=messages['🧩・module-disponibile'].embeds[0]; embed.description=`Catalog actualizat automat · ${new Date().toLocaleString('ro-RO')}\n\nAlege modulele potrivite comunității tale din https://bot.panel-pro.ro.`; embed.fields=[{name:'🆓 Module Free',value:builtins.filter((line)=>line.startsWith('🆓')).map((line)=>'• '+line.replace('🆓 Free · ','')).join('\n')||'Momentan nu există module Free.',inline:false},{name:'⭐ Module Premium',value:all.filter((line)=>line.startsWith('⭐')).map((line)=>'• '+line.replace('⭐ Premium · ','')).join('\n')||'Momentan nu există module Premium.',inline:false},{name:'⚙️ Module personalizate',value:customLines.filter((line)=>!builtins.includes(line)).map((line)=>'• '+line.replace(/^\S+ (?:Free|Premium) · /,'')).join('\n')||'Creează module personalizate din dashboard.',inline:false}]; }
  } catch (error) { console.error('[provision] module catalog failed', error); }
  for (const [name, body] of Object.entries(messages)) { const id=channelIds[name]; if(!id) continue; const existingMessages=await fetch(DISCORD_API + '/channels/' + id + '/messages?limit=50',{headers}).then((r)=>r.ok?r.json():[]).catch(()=>[]); const title=String(body?.embeds?.[0]?.title||''); const current=Array.isArray(existingMessages)&&existingMessages.find((m:any)=>(m.embeds||[]).some((e:any)=>String(e.title||'')===title)); if(current?.id){ const r=await fetch(DISCORD_API + '/channels/' + id + '/messages/'+current.id,{method:'PATCH',headers,body:JSON.stringify({allowed_mentions:{parse:[]},...body})}); if(!r.ok && r.status!==429) console.error('[provision update]',name,r.status); continue; } const r=await fetch(DISCORD_API + '/channels/' + id + '/messages',{method:'POST',headers,body:JSON.stringify({allowed_mentions:{parse:[]},...body})}); if(!r.ok && r.status!==429) console.error('[provision]',name,r.status); }
  let routeConfiguration: any = null;
  let demoConfiguration: any = null;
  try {
    const linked = await db.from('discovery_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
    if (linked.data?.organization_id) {
      const current = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', linked.data.organization_id).maybeSingle();
      const available = await channels(db, guildId);
      const automatic = autoRouteChannels(available, guildId, current.data?.discord_channel_routes || {}, MODULES);
      const saved = await db.from('discovery_settings').update({ discord_channel_routes: automatic.routes, updated_at: new Date().toISOString() }).eq('organization_id', linked.data.organization_id);
      if (!saved.error) routeConfiguration = { matched: automatic.matched, unmatched: automatic.unmatched };
    }
  } catch (error) { console.error('[provision routes]', error); }
  try { demoConfiguration = await provisionDemoCategory(db, guildId); } catch (error) { console.error('[provision demo]', error); }
  return { roles: roleNames.length, categories: categories.length, channels: Object.values(groups).flat().length + Object.values(voiceGroups).flat().length, voice_channels: Object.values(voiceGroups).flat(), created_channels: created, role_ids: roleIds, route_configuration: routeConfiguration, demo_configuration: demoConfiguration };
}
async function syncOfficialRoles(db: any, guildId: string) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  const headers = { ...botHeaders(token), 'Content-Type': 'application/json' };
  const get = async (path: string) => { const r = await fetch(`${DISCORD_API}${path}`, { headers }); if (!r.ok) throw new Error(`Discord API ${path} HTTP ${r.status}`); return await r.json().catch(() => ({})); };
  const roles = await get(`/guilds/${guildId}/roles`); const roleMap = Object.fromEntries((Array.isArray(roles) ? roles : []).map((r: any) => [String(r.name || '').toLowerCase(), String(r.id)]));
  if (!roleMap.member || !roleMap.premium) throw new Error('Rolurile Member și Premium trebuie create înainte de sincronizare.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle(); if (guildError) throw guildError; if (!guild?.organization_id) throw new Error('Serverul oficial nu este asociat unei organizații.');
  const { data: entitlement, error: entitlementError } = await db.from('discovery_guild_entitlements').select('ends_at,active').eq('guild_id', guildId).eq('organization_id', guild.organization_id).eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(); if (entitlementError) throw entitlementError;
  const { data: trial, error: trialError } = await db.from('discovery_app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'discord_trial').maybeSingle(); if (trialError) throw trialError;
  const premiumActive = Boolean(entitlement && (!entitlement.ends_at || Date.parse(String(entitlement.ends_at)) > Date.now())) || Date.parse(String(trial?.value?.ends_at || '')) > Date.now();
  const members: any[] = []; let after = '';
  for (let page = 0; page < 20; page++) { const batch = await get(`/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`); if (!Array.isArray(batch) || !batch.length) break; members.push(...batch); if (batch.length < 1000) break; after = String(batch[batch.length - 1].user?.id || ''); if (!after) break; }
  let assigned = 0; let removed = 0;
  for (const member of members) { const userId = String(member.user?.id || ''); if (!/^\d{15,22}$/.test(userId)) continue; const current = new Set((member.roles || []).map(String)); if (!current.has(roleMap.member)) { const r = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleMap.member}`, { method: 'PUT', headers }); if (r.ok) assigned++; }
    if (premiumActive && !current.has(roleMap.premium)) { const r = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleMap.premium}`, { method: 'PUT', headers }); if (r.ok) assigned++; }
    if (!premiumActive && current.has(roleMap.premium)) { const r = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleMap.premium}`, { method: 'DELETE', headers }); if (r.ok) removed++; }
  }
  const result = { guild_id: guildId, members: members.length, premium_active: premiumActive, assigned, removed };
  await db.from('discovery_lifecycle_events').insert({ organization_id: guild.organization_id, event_type: 'official_roles_synced', actor_discord_id: null, details: result });
  return result;
}

async function announceExistingCommunity(db: any, guildId: string) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  const headers = { ...botHeaders(token), 'Content-Type': 'application/json' };
  const channelsResponse = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, { headers });
  const channels = await channelsResponse.json().catch(() => []);
  const welcome = (Array.isArray(channels) ? channels : []).find((channel: any) => Number(channel.type) === 0 && /bun.?venit/i.test(String(channel.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  if (!welcome?.id) throw new Error('Canalul bun venit nu a fost găsit. Rulează mai întâi configurarea serverului oficial.');
  const membersResponse = await fetch(`${DISCORD_API}/guilds/${guildId}/members?limit=1`, { headers });
  const members = membersResponse.headers.get('x-total-count');
  const description = `Mulțumim tuturor celor care fac deja parte din comunitatea Panel Pro. De acum, intrările, plecările și avansările vor fi anunțate automat aici.`;
  const response = await fetch(`${DISCORD_API}/channels/${welcome.id}/messages`, { method: 'POST', headers, body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '👋 Bun venit comunității existente!', description, fields: [{ name: 'Comunitate', value: members ? `${members} membri` : 'Membrii existenți ai serverului', inline: true }, { name: 'Ce urmează', value: 'Mesajele automate sunt active pentru evenimentele noi.', inline: true }], color: 0x22d3ee, footer: { text: 'Panel Pro · mesaj pentru comunitatea existentă' }, timestamp: new Date().toISOString() }] }) });
  if (!response.ok) throw new Error(`Mesajul nu a putut fi trimis (HTTP ${response.status}).`);
  return { channel_id: String(welcome.id), members: members ? Number(members) : null };
}

async function autoConfigureGuild(db: any, guildId: string, organizationId: string, plan: string) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) throw new Error('Configurarea nu poate porni: tokenul botului Discord lipsește din Supabase.');
  const headers = { ...botHeaders(token), 'Content-Type': 'application/json' };
  const base = `${DISCORD_API}/guilds/${guildId}`;
  const api = async (path: string, options: RequestInit = {}) => {
    const maxAttempts = options.method === 'GET' || !options.method ? 2 : 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(base + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return body;
      if (response.status === 429 && attempt < maxAttempts) {
        const retryAfter = Number(body?.retry_after || response.headers.get('retry-after') || 0);
        await new Promise((resolve) => setTimeout(resolve, Math.min(3000, Math.max(250, Math.round(retryAfter * 1000)))));
        continue;
      }
      // A legacy channel can disappear between the list and delete calls. Treat
      // that as already cleaned up so one stale channel cannot abort setup.
      if (options.method === 'DELETE' && [403, 404].includes(response.status)) return { skipped: true, status: response.status };
      throw new Error(`Discord API ${path} HTTP ${response.status}: ${String(body?.message || 'Botul nu are permisiunile necesare.')}`);
    }
    throw new Error(`Discord API ${path}: răspuns nereușit.`);
  };
  const run = async <T>(name: string, action: () => Promise<T>) => { try { return await action(); } catch (error) { const message = error instanceof Error ? error.message : String(error); throw new Error(`Configurarea s-a oprit la „${name}”: ${message}`); } };
  let existing = await run('citirea canalelor existente', () => api('/channels'));
  const botResponse = await fetch(`${DISCORD_API}/users/@me`, { headers }); const bot = await botResponse.json().catch(() => ({}));
  if (!botResponse.ok || !bot?.id) throw new Error(`Configurarea s-a oprit la „verificarea botului”: Discord HTTP ${botResponse.status}.`);
  const botId = String(bot?.id || '');
  const categoryName = '🧩 PANEL PRO';
  const category = (Array.isArray(existing) ? existing : []).find((channel: any) => Number(channel.type) === 4 && String(channel.name) === categoryName) || await run('crearea categoriei Panel Pro', () => api('/channels', { method: 'POST', body: JSON.stringify({ name: categoryName, type: 4 }) }));
  const definitions = { ...Object.fromEntries(Object.entries(mergeModuleDefinitions(MODULES, await readGlobalModules(db))).map(([key, definition]) => [key, { ...definition, log_key: LOG_ROUTES[key] || '' }])), ...sanitizeCustomModules((await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle()).data?.custom_modules || {}) } as Record<string, any>;
  const eligible = Object.entries(definitions).filter(([, definition]: [string, any]) => plan !== 'free' || definition.premium !== true);
  const routes = { ...((await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', organizationId).maybeSingle()).data?.discord_channel_routes || {}) } as Record<string, any>;
  const created: string[] = []; const channelIds: Record<string, string> = {};
  const slug = (value: string) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'modul';
  const botChannelPrefixes = new Set(['📌・', ...Object.values(MODULE_EMOJIS).map((emoji) => `${emoji}・`)]);
  const overwrite = (readOnly = false) => { const rows: any[] = [{ id: guildId, type: 0, allow: '1024', deny: readOnly ? '2048' : '0' }]; if (botId) rows.push({ id: botId, type: 1, allow: '68608' }); return rows; };
  const desiredNames = new Set(eligible.map(([key, definition]) => `${MODULE_EMOJIS[key] || '🧩'}・${slug(definition.label || key)}`));
  for (const [key, definition] of eligible) if (definition.log_key) desiredNames.add(`${MODULE_EMOJIS[key] || '🧩'}・log-${slug(definition.label || key)}`);
  const oldManaged = (Array.isArray(existing) ? existing : []).filter((channel: any) => Number(channel.type) === 0 && String(channel.parent_id || '') === String(category.id) && !desiredNames.has(String(channel.name || '')) && (String(channel.name || '') === '📋・loguri-panel-pro' || [...botChannelPrefixes].some((prefix) => String(channel.name || '').startsWith(prefix))));
  const skippedDeletes: string[] = [];
  for (const channel of oldManaged) {
    const deletion = await run(`ștergerea canalului vechi „${channel.name}”`, () => api(`/channels/${channel.id}`, { method: 'DELETE' }));
    if (deletion?.skipped) skippedDeletes.push(String(channel.name));
  }
  if (oldManaged.length) existing = existing.filter((channel: any) => !oldManaged.some((old: any) => String(old.id) === String(channel.id)));
  // Remove duplicate managed channels with the same generated name, keeping
  // the first channel so existing permissions and history remain intact.
  const duplicateChannels = new Map<string, any[]>();
  for (const channel of Array.isArray(existing) ? existing : []) {
    if (Number(channel.type) !== 0 || String(channel.parent_id || '') !== String(category.id) || !desiredNames.has(String(channel.name || ''))) continue;
    const list = duplicateChannels.get(String(channel.name)) || []; list.push(channel); duplicateChannels.set(String(channel.name), list);
  }
  for (const list of duplicateChannels.values()) {
    for (const duplicate of list.slice(1)) {
      const deletion = await run(`ștergerea canalului duplicat „${duplicate.name}”`, () => api(`/channels/${duplicate.id}`, { method: 'DELETE' }));
      if (deletion?.skipped) skippedDeletes.push(String(duplicate.name));
      existing = existing.filter((channel: any) => String(channel.id) !== String(duplicate.id));
    }
  }
  for (const [key, definition] of eligible) {
    const name = `${MODULE_EMOJIS[key] || '🧩'}・${slug(definition.label || key)}`;
    const found = (Array.isArray(existing) ? existing : []).find((channel: any) => Number(channel.type) === 0 && String(channel.parent_id || '') === String(category.id) && String(channel.name) === name);
    const channel = found || await run(`crearea canalului „${name}”`, () => api('/channels', { method: 'POST', body: JSON.stringify({ name, type: 0, parent_id: String(category.id), topic: 'Panel Pro Bot · canal gestionat automat', permission_overwrites: overwrite(false) }) }));
    channelIds[key] = String(channel.id); if (!found) created.push(name);
    routes[key] = { ...(routes[key] || {}), primary: { ...(routes[key]?.primary || {}), channel_id: String(channel.id), guild_id: guildId, enabled: true } };
  }
  const logChannels: Record<string, any> = {};
  for (const [key, definition] of eligible) {
    if (!definition.log_key) continue;
    const logName = `${MODULE_EMOJIS[key] || '🧩'}・log-${slug(definition.label || key)}`;
    const logFound = (Array.isArray(existing) ? existing : []).find((channel: any) => Number(channel.type) === 0 && String(channel.parent_id || '') === String(category.id) && String(channel.name) === logName);
    const logChannel = logFound || await run(`crearea canalului de log „${logName}”`, () => api('/channels', { method: 'POST', body: JSON.stringify({ name: logName, type: 0, parent_id: String(category.id), topic: 'Panel Pro Bot · log gestionat automat', permission_overwrites: overwrite(true) }) }));
    logChannels[key] = logChannel;
    if (!logFound) created.push(logName);
    routes[definition.log_key] = { ...(routes[definition.log_key] || {}), primary: { ...(routes[definition.log_key]?.primary || {}), channel_id: String(logChannel.id), guild_id: guildId, enabled: true } };
  }
  const { error: saveError } = await run('salvarea rutelor canalelor', () => db.from('discovery_settings').update({ discord_channel_routes: routes, updated_at: new Date().toISOString() }).eq('organization_id', organizationId)); if (saveError) throw saveError;
  let published = 0;
  for (const [key] of eligible) {
    if (key === 'status_live') {
      const [{ data: shifts }, { data: members }] = await Promise.all([
        db.from('discovery_shifts').select('discord_id,colleague_name,status,started_at,duration_ms,paused_seconds').eq('organization_id', organizationId).in('status', ['active', 'paused']).is('end_time', null),
        db.from('discovery_members').select('discord_id,panel_role').eq('organization_id', organizationId),
      ]);
      const now = Date.now(); const names = new Map((members || []).map((item: any) => [String(item.discord_id), item.panel_role || item.discord_id]));
      const elapsed = (shift: any) => { const started = Date.parse(String(shift.started_at || '')); const seconds = shift.status === 'paused' ? Math.floor((Number(shift.duration_ms) || 0) / 1000) : Math.max(0, Math.floor((now - started) / 1000) - (Number(shift.paused_seconds) || 0)); return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
      const active = (shifts || []).filter((item: any) => item.status !== 'paused'); const paused = (shifts || []).filter((item: any) => item.status === 'paused');
      const line = (item: any, icon: string) => `${icon} **${item.colleague_name || names.get(String(item.discord_id)) || 'Utilizator'}** — ${elapsed(item)}`;
      const section = (title: string, items: any[], icon: string) => `${title} (${items.length})\n${items.length ? items.map((item: any) => line(item, icon)).join('\n') : '_Nimeni_'}`;
      const livePayload = { embeds: [{ title: `📡 STATUS LIVE · ${organizationId}`, description: `${section('🟢 În pontaj', active, '🟢')}\n\n${section('☕ În pauză', paused, '☕')}\n\n📊 **Total:** ${(shifts || []).length}\n⏱️ **Actualizat:** <t:${Math.floor(now / 1000)}:R>`, color: 0x2f9e44, timestamp: new Date(now).toISOString(), footer: { text: 'Panel Pro · actualizare live' } }] };
      const existingMessageId = String(routes[key]?.primary?.message_id || '');
      if (!existingMessageId && routes[key]?.primary?.channel_id) {
        const response = await fetch(`${DISCORD_API}/channels/${routes[key].primary.channel_id}/messages?limit=100`, { headers });
        const messages = await response.json().catch(() => []); const liveMessages = (Array.isArray(messages) ? messages : []).filter((message: any) => (message.embeds || []).some((embed: any) => String(embed.title || '').toLowerCase().startsWith('📡 status live')));
        for (const duplicate of liveMessages.slice(1)) await fetch(`${DISCORD_API}/channels/${routes[key].primary.channel_id}/messages/${duplicate.id}`, { method: 'DELETE', headers }).catch(() => null);
        if (liveMessages[0]?.id) routes[key].primary.message_id = String(liveMessages[0].id);
      }
      const targetMessageId = String(routes[key]?.primary?.message_id || '');
      const delivery = await run('publicarea Status Live real', () => deliverDiscordRoute(db, { discord_channel_routes: routes }, key, JSON.stringify(livePayload), { messageIds: { primary: targetMessageId }, postOnly: false }));
      const delivered = delivery.results?.find((item: any) => item.target === 'primary' && item.id); if (delivered?.id) { routes[key].primary.message_id = String(delivered.id); published++; }
      continue;
    }
    const routeChannelId = String(routes[key]?.primary?.channel_id || '');
    const expectedTitle = String(definitions[key]?.title || '');
    const titleNeedle = slug(definitions[key]?.label || key).split('-')[0] || key;
    if (routeChannelId && expectedTitle) {
      const messagesResponse = await fetch(`${DISCORD_API}/channels/${routeChannelId}/messages?limit=100`, { headers });
      const messages = await messagesResponse.json().catch(() => []);
      const normalizeTitle = (value: unknown) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      const duplicates = (Array.isArray(messages) ? messages : []).filter((message: any) => (message.embeds || []).some((embed: any) => normalizeTitle(embed.title).includes(titleNeedle)));
      // Discord returns newest first. Keep the newest message and remove older
      // copies before editing it, preventing setup from creating visible spam.
      for (const duplicate of duplicates.slice(1)) {
        await fetch(`${DISCORD_API}/channels/${routeChannelId}/messages/${duplicate.id}`, { method: 'DELETE', headers }).catch(() => null);
      }
      if (duplicates[0]?.id && !routes[key]?.primary?.message_id) routes[key].primary.message_id = String(duplicates[0].id);
    }
    const existingMessageId = String(routes[key]?.primary?.message_id || '');
    const delivery = await run(`actualizarea embedului „${definitions[key]?.label || key}”`, () => deliverDiscordRoute(db, { discord_channel_routes: routes }, key, JSON.stringify(payload(key, false, definitions)), { messageIds: { primary: existingMessageId }, postOnly: false }));
    const delivered = delivery.results?.find((item: any) => item.target === 'primary' && item.id);
    if (delivered?.id) {
      routes[key] = { ...(routes[key] || {}), primary: { ...(routes[key]?.primary || {}), message_id: String(delivered.id) } };
      published++;
    }
  }
  await db.from('discovery_settings').update({ discord_channel_routes: routes, updated_at: new Date().toISOString() }).eq('organization_id', organizationId);
  return { category: categoryName, created_channels: created, skipped_deletes: skippedDeletes, modules: eligible.map(([key, definition]) => ({ key, label: definition.label, log_channel: logChannels[key]?.name || null })), published };
}

async function provisionDemoCategory(db: any, guildId: string) {
  if (guildId !== OFFICIAL_GUILD_ID) throw new Error('Demo este disponibil doar pe serverul oficial Panel Pro.');
  const token = await getPlatformSecret(db, 'discord_bot_token');
  const headers = { ...botHeaders(token), 'Content-Type': 'application/json' };
  const base = `${DISCORD_API}/guilds/${guildId}`;
  const api = async (path: string, options: RequestInit = {}) => { const response = await fetch(base + path, { ...options, headers: { ...headers, ...(options.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Discord API ${path} HTTP ${response.status}: ${String(body?.message || 'Missing Permissions')}`); return body; };
  const existing = await api('/channels');
  const categoryName = '🧪 DEMO · MODULE PANEL PRO';
  const category = (Array.isArray(existing) ? existing : []).find((channel: any) => Number(channel.type) === 4 && String(channel.name) === categoryName) || await api('/channels', { method: 'POST', body: JSON.stringify({ name: categoryName, type: 4 }) });
  const definitions = { ...mergeModuleDefinitions(MODULES, await readGlobalModules(db)) } as Record<string, any>;
  const created: string[] = [];
  const oldDemoChannels = (Array.isArray(existing) ? existing : []).filter((channel: any) => Number(channel.type) === 0 && String(channel.parent_id || '') === String(category.id) && /^demo-/i.test(String(channel.name || '')));
  for (const oldChannel of oldDemoChannels) await fetch(`${DISCORD_API}/channels/${oldChannel.id}`, { method: 'DELETE', headers }).catch(() => null);
  const channelsByName = new Map((Array.isArray(existing) ? existing : []).filter((channel: any) => Number(channel.type) === 0 && !oldDemoChannels.some((old: any) => String(old.id) === String(channel.id))).map((channel: any) => [String(channel.name), channel]));
  for (const [key, definition] of Object.entries(definitions)) {
    const name = String((definition as any).label || key).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]+/gu, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'modul';
    const channel = channelsByName.get(name) || await api('/channels', { method: 'POST', body: JSON.stringify({ name, type: 0, parent_id: String(category.id) }) });
    if (!channelsByName.has(name)) { channelsByName.set(name, channel); created.push(name); }
    const messages = await fetch(`${DISCORD_API}/channels/${channel.id}/messages?limit=50`, { headers }).then((response) => response.ok ? response.json() : []).catch(() => []);
    const demo = payload(key, false, definitions);
    demo.embeds = (demo.embeds || []).map((embed: any) => ({ ...embed, title: `🧪 DEMO · ${embed.title || definition.label}`, description: `${embed.description || ''}\n\n**Exemplu interactiv:** apasă butoanele pentru a vedea cum ar funcționa modulul în serverul real. Rezultatele rămân doar în această demonstrație.` }));
    demo.components = (demo.components || []).map((row: any) => ({ ...row, components: (row.components || []).map((component: any) => component.custom_id ? { ...component, custom_id: `panel:demo:${component.custom_id}` } : component) }));
    const title = String(demo.embeds?.[0]?.title || '');
    const current = Array.isArray(messages) && messages.find((message: any) => (message.embeds || []).some((embed: any) => String(embed.title || '') === title));
    const requestOptions: RequestInit = { method: current?.id ? 'PATCH' : 'POST', headers, body: JSON.stringify({ allowed_mentions: { parse: [] }, ...demo }) };
    await fetch(`${DISCORD_API}/channels/${channel.id}/messages${current?.id ? `/${current.id}` : ''}`, requestOptions);
  }
  return { category_id: String(category.id), category_name: categoryName, modules: Object.keys(definitions).length, created_channels: created };
}

function payload(moduleKey: string, donation: boolean, definitions = MODULES) {
  const definition = definitions[moduleKey];
  const rows: any[] = [];
  for (let index = 0; index < definition.buttons.length; index += 5) rows.push({ type: 1, components: definition.buttons.slice(index, index + 5).map((button: any) => {
    if (button.type === 'link' && /^https?:\/\//i.test(button.url || '')) return { type: 2, style: 5, label: button.label, url: button.url };
    if (button.type === 'select') return { type: 3, custom_id: button.id, placeholder: button.label, min_values: 1, max_values: 1, options: (button.options || []).slice(0, 25).map((option: any) => ({ label: option.label, value: option.value, ...(option.description ? { description: option.description } : {}) })) };
    return { type: 2, style: button.style === 5 ? 1 : button.style, label: button.label, custom_id: button.id };
  }) });
  if (donation) rows.push({ type: 1, components: [{ type: 2, style: 5, label: 'Donează pentru dezvoltare', url: 'https://revolut.me/mariomihail' }] });
  const embed = definition.embed && typeof definition.embed === 'object' ? { ...(definition.embed.author_name ? { author: { name: definition.embed.author_name, ...(definition.embed.author_icon ? { icon_url: definition.embed.author_icon } : {}) } } : {}), title: definition.title, description: definition.description, color: definition.color, ...(definition.embed.thumbnail ? { thumbnail: { url: definition.embed.thumbnail } } : {}), ...(definition.embed.image ? { image: { url: definition.embed.image } } : {}), ...(definition.embed.fields?.length ? { fields: definition.embed.fields } : {}), ...(definition.embed.footer_text ? { footer: { text: definition.embed.footer_text, ...(definition.embed.footer_icon ? { icon_url: definition.embed.footer_icon } : {}) } } : { footer: { text: 'Panel Pro · configurat din pagina botului' } }), ...(definition.embed.timestamp ? { timestamp: new Date().toISOString() } : {}) } : { title: definition.title, description: definition.description, color: definition.color, footer: { text: 'Panel Pro · configurat din pagina botului' } };
  return { username: 'Panel Pro', allowed_mentions: { parse: [] }, embeds: [embed], components: rows };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(request) });
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));
    const accessToken = clean(body.access_token, 500);
    if (!accessToken) return reply(request, { error: 'Conectarea Discord este necesară.' }, 401);
    const discord = await discordUser(accessToken);
    let platformAdmin = await isPlatformAdminAccount(db, discord.id);
    const panelSessionToken = clean(request.headers.get('x-panel-session'), 500);
    if (!platformAdmin && panelSessionToken) {
      try {
        const panelSession = await requirePanelSession(db, request, 0, true);
        platformAdmin = await isPlatformAdminAccount(db, panelSession.discord_id);
      } catch (_) {
        // Sesiunea panel este opțională pentru utilizatorii Discord-only.
      }
    }
    const applicationId = id(body.application_id) ? String(body.application_id) : '1531023771211792384';
    const action = clean(body.action, 30) || 'bootstrap';
    const personalView = clean(body.view_scope, 30) === 'personal';
    const diagnostics: Record<string, any> = {};
    if (action === 'provision_official_server' || action === 'sync_official_roles' || action === 'announce_existing_community') { if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate configura serverul oficial.' }, 403); const target=clean(body.guild_id,30); if (target !== '1544703486384537603') return reply(request,{error:'Serverul oficial nu este valid.'},400); const result=action === 'provision_official_server' ? await provisionOfficialServer(db,target) : action === 'sync_official_roles' ? await syncOfficialRoles(db,target) : await announceExistingCommunity(db,target); return reply(request,{ok:true,guild_id:target,result}); }
    if (action === 'bootstrap') {
      const discoveryBotToken = await getPlatformSecret(db, 'discord_bot_token');
      const botIdentityResponse = discoveryBotToken
        ? await fetch(`${DISCORD_API}/users/@me`, { headers: botHeaders(discoveryBotToken) })
        : null;
      const botIdentity = botIdentityResponse?.ok ? await botIdentityResponse.json().catch(() => ({})) : null;
      diagnostics.bot_identity = botIdentity?.id
        ? { id: String(botIdentity.id), username: clean(botIdentity.global_name || botIdentity.username, 120) }
        : { configured: Boolean(discoveryBotToken), http_status: botIdentityResponse?.status || 0 };
    }
    // Reconcilierea verifică fiecare instalare Discord și poate dura mult.
    // Este necesară doar în consola administratorului global; utilizatorii
    // obișnuiți trebuie să primească imediat serverele eligibile.
    const reconciliation = action === 'bootstrap' && platformAdmin && !personalView ? await reconcileInstallations(db) : null;
    // Operațiunile globale nu trebuie să depindă de scope-ul OAuth `guilds`.
    // Administratorul global poate deschide constructorul chiar dacă tokenul
    // Discord existent a fost emis înainte de adăugarea scope-ului.
    const globalOnlyAction = ['custom_modules', 'save_custom_modules', 'global_config', 'save_global_config', 'assistant_catalog', 'assistant_schema_check', 'provision_official_server', 'sync_official_roles', 'announce_existing_community'].includes(action);
    const guilds = globalOnlyAction
      ? []
      : await ownedGuilds(db, { ...discord, access_token: accessToken }, applicationId, platformAdmin || !personalView, diagnostics);
    if (action === 'bootstrap') {
      const { data: customSetting, error: customSettingError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (customSettingError) throw customSettingError;
      const customModules = sanitizeCustomModules(customSetting?.custom_modules || {});
      const modules = Object.fromEntries(Object.entries(MODULES).map(([key, value]) => [key, { label: value.label, title: value.title, description: value.description, color: value.color, buttons: value.buttons, premium: value.premium, log_key: LOG_ROUTES[key] || '', log_label: LOG_LABELS[LOG_ROUTES[key] || ''] || '' }]));
      for (const [key, value] of Object.entries(customModules)) modules[key] = { label: value.label, title: value.title, description: value.description, color: value.color, buttons: value.buttons, premium: value.premium === true, active: value.active !== false, log_key: value.log_key, log_label: `Log ${value.label}`, response_flow: value.response_flow || { enabled: false, log_key: `log_${key}_response` } };
      return reply(request, { ok: true, user: { id: String(discord.id), username: clean(discord.global_name || discord.username, 120), platform_admin: platformAdmin }, platform_admin: platformAdmin, guilds, diagnostics, reconciliation, modules });
    }
    if (action === 'custom_modules' || action === 'save_custom_modules') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate administra modulele personalizate.' }, 403);
      const { data: setting, error: settingError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (settingError) throw settingError;
      if (action === 'save_custom_modules') {
        const customModules = sanitizeCustomModules(body.custom_modules || {});
        const { error } = await db.from('discovery_bot_global_settings').upsert({ id: 'global', custom_modules: customModules, updated_by_discord_id: String(discord.id), updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw error;
        return reply(request, { ok: true, custom_modules: customModules });
      }
      const { data: registeredGuilds, error: registeredGuildsError } = await db.from('discovery_guilds').select('guild_id,guild_name,organization_id').eq('enabled', true).order('guild_name');
      if (registeredGuildsError) throw registeredGuildsError;
      const guildsForSelector = (registeredGuilds || []).filter((item: any) => id(item.guild_id)).map((item: any) => ({ id: String(item.guild_id), name: clean(item.guild_name || item.guild_id, 120), organization_id: String(item.organization_id || ''), bot_installed: true, is_owner: false, can_manage_access: true }));
      return reply(request, { ok: true, platform_admin: platformAdmin, guilds: guildsForSelector, custom_modules: setting?.custom_modules && typeof setting.custom_modules === 'object' ? setting.custom_modules : {} });
    }
    if (action === 'assistant_catalog' || action === 'assistant_schema_check') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate consulta catalogul asistentului.' }, 403);
      const { data: customSetting, error: catalogError } = await db.from('discovery_bot_global_settings').select('custom_modules,updated_at').eq('id', 'global').maybeSingle();
      if (catalogError) throw catalogError;
      const customModules = sanitizeCustomModules(customSetting?.custom_modules || {});
      if (action === 'assistant_schema_check') {
        const checks = [];
        const requiredColumns: Record<string, string[]> = { discovery_bot_global_settings: ['id','custom_modules','modules'], discovery_custom_module_submissions: ['id','organization_id','guild_id','module_key','status','review_note','values_json'], discovery_guilds: ['guild_id','organization_id','enabled'] };
        for (const [table, columns] of Object.entries(requiredColumns)) {
          const { error } = await db.from(table).select(columns.join(','), { head: true, count: 'exact' }).limit(1);
          checks.push({ table, required_columns: columns, ok: !error, error: error ? String(error.message || error) : null });
        }
        return reply(request, { ok: true, checks, isolation: { organization_scoped: true, guild_scoped: true } });
      }
      const handlers = Object.fromEntries(Object.entries(MODULES).map(([key, value]) => [key, { label: value.label, buttons: value.buttons.map((button: any) => ({ label: button.label, id: button.id })), source: 'core' }]));
      for (const [key, value] of Object.entries(customModules)) handlers[key] = { label: value.label, buttons: value.buttons.map((button: any) => ({ label: button.label, id: button.id || '', action: button.action || 'open_form' })), source: 'custom' };
      const interactionRoutes = ['panel:actions:*','panel:announcements:*','panel:bot_access:*','panel:contracts:*','panel:custom:*','panel:custom_submit:*','panel:custom_review:*','panel:custom_reason:*','panel:discipline:*','panel:discovery:*','panel:marketplace:*','panel:pontaj:*','panel:requests:*','panel:stash:*'];
      return reply(request, { ok: true, catalog_version: customSetting?.updated_at || null, handlers, actions: ['open_form', 'save_submission', 'send_log', 'notify_submitter', 'update_message', 'approve', 'reject', 'report', 'none'], interaction_routes: interactionRoutes, tables: ['discovery_bot_global_settings', 'discovery_custom_module_submissions', 'discovery_guilds'], schema_checks: ['module definition', 'submission storage', 'guild isolation'] });
    }    if (action === 'global_config' || action === 'save_global_config') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate modifica setările globale ale botului.' }, 403);
      const current = await readGlobalModules(db);
      if (action === 'save_global_config') {
        const modules = sanitizeModuleOverrides(MODULES, body.modules);
        const { error } = await db.from('discovery_bot_global_settings').upsert({ id: 'global', modules, updated_by_discord_id: String(discord.id), updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw error;
        return reply(request, { ok: true, modules: mergeModuleDefinitions(MODULES, modules) });
      }
      return reply(request, { ok: true, modules: mergeModuleDefinitions(MODULES, current) });
    }
    const guildId = clean(body.guild_id, 30);
    const selectedGuild = guilds.find((guild: any) => guild.id === guildId);
    if (!selectedGuild) return reply(request, { error: platformAdmin ? 'Serverul nu este disponibil sau botul nu este instalat.' : 'Serverul nu este disponibil: trebuie să fii owner și botul trebuie să fie instalat.' }, 403);
    if (action === 'rename_guild') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate redenumi un server din registrul Discovery.' }, 403);
      const name = clean(body.name, 120);
      if (name.length < 2) return reply(request, { error: 'Numele serverului trebuie să aibă cel puțin 2 caractere.' }, 400);
      const now = new Date().toISOString();
      const organizationId = String(selectedGuild.organization_id || '');
      await Promise.all([
        db.from('discovery_organizations').update({ name, updated_at: now }).eq('id', organizationId),
        db.from('discovery_guilds').update({ guild_name: name }).eq('organization_id', organizationId).eq('guild_id', guildId),
        db.from('discovery_bot_installations').update({ guild_name: name, updated_at: now, last_event_at: now }).eq('guild_id', guildId),
      ]);
      return reply(request, { ok: true, guild_id: guildId, name });
    }
    if (action === 'extend_trial') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate prelungi Trial-ul.' }, 403);
      const days = Number(body.days);
      if (!Number.isInteger(days) || days < 1 || days > 3650) return reply(request, { error: 'Durata Trial trebuie să fie între 1 și 3650 zile.' }, 400);
      const { data: setting, error: settingError } = await db.from('discovery_app_settings').select('value').eq('organization_id', selectedGuild.organization_id).eq('key', 'discord_trial').maybeSingle();
      if (settingError) throw settingError;
      const currentEnd = setting?.value?.ends_at && Date.parse(String(setting.value.ends_at)) > Date.now() ? Date.parse(String(setting.value.ends_at)) : Date.now();
      const endsAt = new Date(currentEnd + days * 86400000).toISOString();
      const { error } = await db.from('discovery_app_settings').upsert({ organization_id: selectedGuild.organization_id, key: 'discord_trial', value: { ...(setting?.value || {}), starts_at: setting?.value?.starts_at || new Date().toISOString(), ends_at: endsAt, duration_days: days }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
      return reply(request, { ok: true, guild_id: guildId, trial_ends_at: endsAt });
    }
    if (action === 'remove_installation') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate elimina o instalare.' }, 403);
      const now = new Date().toISOString();
      const { error } = await db.from('discovery_bot_installations').update({ status: 'removed', removed_at: now, last_event_at: now, updated_at: now }).eq('guild_id', guildId);
      if (error) throw error;
      return reply(request, { ok: true, guild_id: guildId, status: 'removed' });
    }
    if (action === 'grant_premium') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate acorda Premium manual.' }, 403);
      const skuId = String(Deno.env.get('DISCORD_PREMIUM_GUILD_SKU_ID') || Deno.env.get('DISCORD_PREMIUM_GUILD_SKU_IDS') || '1545022271117066260').split(',').map((value) => value.trim()).find((value) => id(value)) || '';
      if (!skuId) return reply(request, { error: 'SKU-ul Premium nu este configurat în secretele Supabase.' }, 500);
      const days = Number(body.days);
      if (!Number.isFinite(days) || (days !== 0 && (!Number.isInteger(days) || days < 1 || days > 3650))) return reply(request, { error: 'Durata Premium trebuie să fie între 1 și 3650 zile sau 0 pentru fără expirare.' }, 400);
      await db.from('discovery_guild_entitlements').update({ active: false, updated_at: new Date().toISOString() }).eq('guild_id', guildId).eq('active', true);
      const now = new Date().toISOString();
      const endsAt = days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString();
      const { data: entitlement, error } = await db.from('discovery_guild_entitlements').insert({ guild_id: guildId, organization_id: selectedGuild.organization_id, sku_id: skuId, owner_type: 2, active: true, starts_at: now, ends_at: endsAt, purchaser_user_id: String(discord.id), raw_entitlement: { source: 'platform_admin_grant', granted_by: String(discord.id), days } }).select('id,guild_id,sku_id,starts_at,ends_at,active').single();
      if (error) throw error;
      return reply(request, { ok: true, entitlement });
    }
    if (action === 'revoke_premium') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate retrage Premium.' }, 403);
      const now = new Date().toISOString();
      const { data: activeEntitlements, error: readError } = await db.from('discovery_guild_entitlements').select('id,raw_entitlement').eq('guild_id', guildId).eq('organization_id', selectedGuild.organization_id).eq('active', true);
      if (readError) throw readError;
      const updates = (activeEntitlements || []).map((item: any) => db.from('discovery_guild_entitlements').update({ active: false, raw_entitlement: { ...(item.raw_entitlement || {}), panel_revoked: true, revoked_at: now }, updated_at: now }).eq('id', item.id));
      await Promise.all(updates);
      return reply(request, { ok: true, guild_id: guildId, premium_active: false, revoked: updates.length });
    }
    if (action === 'send_premium_purchase') {
      const skuId = String(Deno.env.get('DISCORD_PREMIUM_GUILD_SKU_IDS') || Deno.env.get('DISCORD_PREMIUM_GUILD_SKU_ID') || '').split(',').map((value) => value.trim()).find((value) => id(value)) || '';
      if (!skuId) return reply(request, { error: 'SKU-ul Premium Discord nu este configurat.' }, 503);
      const botToken = await getPlatformSecret(db, 'discord_bot_token');
      const dmResponse = await fetch(`${DISCORD_API}/users/@me/channels`, { method: 'POST', headers: { ...botHeaders(botToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient_id: String(discord.id) }) });
      if (!dmResponse.ok) return reply(request, { error: 'Nu am putut deschide conversația privată pe Discord.' }, 502);
      const dm = await dmResponse.json().catch(() => ({}));
      if (!dm?.id) return reply(request, { error: 'Discord nu a returnat un canal privat valid.' }, 502);
      const renewal = body.renewal === true;
      const messageResponse = await fetch(`${DISCORD_API}/channels/${dm.id}/messages`, { method: 'POST', headers: { ...botHeaders(botToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `💎 Premium Panel Pro pentru serverul **${selectedGuild.name}**\n${renewal ? 'Apasă butonul de mai jos pentru a prelungi Premium direct prin Discord.' : 'Apasă butonul de mai jos pentru a cumpăra Premium direct prin Discord.'}`, components: discordPremiumButton(skuId) }) });
      if (!messageResponse.ok) {
        const discordError = await messageResponse.json().catch(() => ({}));
        const validation = discordError?.errors ? clean(JSON.stringify(discordError.errors), 500) : '';
        const detail = clean([discordError?.message, discordError?.code, validation].filter(Boolean).join(' · '), 700);
        return reply(request, { error: `Mesajul Premium nu a putut fi trimis pe Discord${detail ? `: ${detail}` : '.'}`, discord_status: messageResponse.status, discord_error: discordError?.errors || null }, 502);
      }
      return reply(request, { ok: true, sent_to_discord: true });
    }
    const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', selectedGuild.organization_id).maybeSingle();
    if (settingsError) throw settingsError;
    if (action === 'dashboard_overview' || action === 'repair_guild' || action === 'auto_configure_routes' || action === 'auto_configure_guild' || action === 'set_module_enabled') {
      const customSetting = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (customSetting.error) throw customSetting.error;
      const definitions = { ...mergeModuleDefinitions(MODULES, await readGlobalModules(db)), ...sanitizeCustomModules(customSetting.data?.custom_modules || {}) } as Record<string, any>;
      const routes = { ...(settings?.discord_channel_routes || {}) } as Record<string, any>;
      const allowedPremium = selectedGuild.plan !== 'free';
      if (action === 'auto_configure_guild') return reply(request, { ok: true, guild_id: guildId, plan: selectedGuild.plan, result: await autoConfigureGuild(db, guildId, selectedGuild.organization_id, selectedGuild.plan) });
      if (action === 'set_module_enabled') {
        const moduleKey = clean(body.module_key, 50);
        if (!definitions[moduleKey]) return reply(request, { error: 'Modulul selectat nu există.' }, 404);
        if (body.enabled === true && !routes[moduleKey]?.primary?.channel_id) return reply(request, { error: 'Configurează mai întâi canalul embed pentru acest modul.' }, 400);
        routes[moduleKey] = { ...(routes[moduleKey] || {}), primary: { ...(routes[moduleKey]?.primary || {}), enabled: body.enabled === true } };
        const { error: toggleError } = await db.from('discovery_settings').update({ discord_channel_routes: routes, updated_at: new Date().toISOString(), updated_by_discord_id: String(discord.id) }).eq('organization_id', selectedGuild.organization_id);
        if (toggleError) throw toggleError;
        return reply(request, { ok: true, module_key: moduleKey, enabled: body.enabled === true, routes });
      }
      const botToken = await getPlatformSecret(db, 'discord_bot_token');
      const botResponse = await fetch(`${DISCORD_API}/guilds/${guildId}`, { headers: botHeaders(botToken) });
      const botOnline = botResponse.ok;
      const botIdentityResponse = await fetch(`${DISCORD_API}/users/@me`, { headers: botHeaders(botToken) });
      const botIdentity = botIdentityResponse.ok ? await botIdentityResponse.json().catch(() => ({})) : {};
      const botMemberResponse = botIdentity.id ? await fetch(`${DISCORD_API}/guilds/${guildId}/members/${botIdentity.id}`, { headers: botHeaders(botToken) }) : null;
      const botMember = botMemberResponse?.ok ? await botMemberResponse.json().catch(() => ({})) : {};
      // Discord's guild-member endpoint does not include an aggregated permissions field.
      // Calculate the bot's base guild permissions from @everyone plus its assigned roles.
      let permissionValue = 0n;
      if (botMemberResponse?.ok) {
        const rolesResponse = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, { headers: botHeaders(botToken) });
        const roles = rolesResponse.ok ? await rolesResponse.json().catch(() => []) : [];
        const botRoleIds = new Set((Array.isArray(botMember.roles) ? botMember.roles : []).map((roleId: any) => String(roleId)));
        for (const role of Array.isArray(roles) ? roles : []) {
          if (String(role.id) === guildId || botRoleIds.has(String(role.id))) {
            try { permissionValue |= BigInt(String(role.permissions || '0')); } catch (_) {}
          }
        }
      }
      if ((permissionValue & 8n) === 8n) permissionValue = (1n << 53n) - 1n;
      const requiredPermissions = [{ key: 'view_channel', label: 'View Channel', bit: 1024n }, { key: 'send_messages', label: 'Send Messages', bit: 2048n }, { key: 'embed_links', label: 'Embed Links', bit: 16384n }];
      const missingPermissions = requiredPermissions.filter((item) => (permissionValue & item.bit) !== item.bit).map((item) => item.label);
      let channelList: any[] = [];
      let channelError = '';
      try { channelList = await channels(db, guildId); } catch (error) { channelError = error instanceof Error ? error.message : 'Canalele Discord nu au putut fi verificate.'; }
      if ((action === 'dashboard_overview' || action === 'auto_configure_routes' || action === 'repair_guild') && !channelError) {
        const routableDefinitions = Object.fromEntries(Object.entries(definitions).filter(([, definition]: [string, any]) => allowedPremium || definition.premium !== true));
        const automatic = autoRouteChannels(channelList, guildId, routes, routableDefinitions);
        Object.assign(routes, automatic.routes);
        if (!allowedPremium) Object.keys(definitions).filter((key) => definitions[key].premium === true).forEach((key) => { delete routes[key]; });
        const { error: routeError } = await db.from('discovery_settings').update({ discord_channel_routes: routes, updated_at: new Date().toISOString(), updated_by_discord_id: String(discord.id) }).eq('organization_id', selectedGuild.organization_id);
        if (routeError) throw routeError;
        if (action === 'auto_configure_routes') return reply(request, { ok: true, configured: true, matched: automatic.matched, unmatched: automatic.unmatched, channels: { total: channelList.length }, routes });
      }
      const availableChannels = new Set(channelList.map((channel: any) => String(channel.id)));
      const modules = Object.entries(definitions).map(([key, definition]: [string, any]) => ({ key, label: definition.label, premium: definition.premium === true, active: definition.active !== false, enabled: routes[key]?.primary?.enabled !== false, embed_configured: Boolean(routes[key]?.primary?.channel_id && availableChannels.has(String(routes[key].primary.channel_id))), log_configured: Boolean(definition.log_key && routes[definition.log_key]?.primary?.channel_id && availableChannels.has(String(routes[definition.log_key].primary.channel_id))) }));
      const [activityResult, auditResult] = await Promise.all([
        db.from('discovery_custom_module_submissions').select('id,module_key,subject,status,created_at,updated_at').eq('organization_id', selectedGuild.organization_id).eq('guild_id', guildId).order('created_at', { ascending: false }).limit(12),
        db.from('discovery_audit_log').select('id,action,target_type,target_id,created_at,details').eq('organization_id', selectedGuild.organization_id).order('created_at', { ascending: false }).limit(12),
      ]);
      // Activitatea este suplimentară; un tabel de istoric indisponibil nu trebuie să blocheze dashboardul.
      if (action === 'repair_guild') {
        for (const item of modules.filter((module) => module.active && module.embed_configured && (allowedPremium || !module.premium))) {
          const route = routes[item.key]?.primary || {};
          const delivery = await deliverDiscordRoute(db, { discord_channel_routes: routes }, item.key, JSON.stringify(payload(item.key, false, definitions)), { messageIds: { primary: String(route.message_id || '') }, postOnly: false });
          const result = delivery.results?.find((entry: any) => entry.target === 'primary');
          if (result?.id) routes[item.key] = { ...(routes[item.key] || {}), primary: { ...route, message_id: String(result.id) } };
        }
        const { error: repairError } = await db.from('discovery_settings').update({ discord_channel_routes: routes, updated_at: new Date().toISOString(), updated_by_discord_id: String(discord.id) }).eq('organization_id', selectedGuild.organization_id);
        if (repairError) throw repairError;
      }
      const activity = [...(activityResult.data || []), ...(auditResult.data || []).map((item: any) => ({ id: item.id, module_key: item.target_id || '', subject: item.action || item.target_type || 'Activitate', status: 'system', created_at: item.created_at, updated_at: item.created_at }))].sort((a: any, b: any) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at))).slice(0, 15);
      return reply(request, { ok: true, repaired: action === 'repair_guild', bot: { online: botOnline, missing_permissions: missingPermissions, permission_status: botMemberResponse ? (missingPermissions.length ? 'missing' : 'ok') : 'unknown' }, channels: { total: channelList.length, error: channelError || null }, modules, subscription: { plan: selectedGuild.plan, trial_ends_at: selectedGuild.trial_ends_at || null, premium_ends_at: selectedGuild.premium_ends_at || null, includes: selectedGuild.plan === 'free' ? ['Pontaj', 'Învoiri angajați'] : ['Toate modulele Panel Pro'] }, activity, routes });
    }
    if (action === 'test_custom_module') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate testa module personalizate.' }, 403);
      const { data: moduleSetting, error: moduleError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (moduleError) throw moduleError;
      const customModules = sanitizeCustomModules(moduleSetting?.custom_modules || {});
      const moduleKey = customModuleKey(body.module_key); const definition = customModules[moduleKey];
      if (!definition) return reply(request, { error: 'Modulul personalizat nu există.' }, 404);
      const channelId = clean(body.channel_id || body.embed_channel_id, 30);
      const availableIds = new Set((await channels(db, guildId)).map((channel: any) => channel.id));
      if (!validDiscordChannelId(channelId) || !availableIds.has(channelId)) return reply(request, { error: 'Canalul de test este invalid.' }, 400);
      const testDefinition = { [moduleKey]: definition };
      const delivery = await deliverDiscordRoute(db, { discord_channel_routes: { [moduleKey]: { primary: { channel_id: channelId, enabled: true } } } }, moduleKey, JSON.stringify(payload(moduleKey, false, testDefinition)), { postOnly: true });
      return reply(request, { ok: true, test: true, result: delivery.results?.[0] || null, failures: delivery.failures || [] });
    }    if (action === 'publish_custom_module') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate publica module personalizate.' }, 403);
      const { data: moduleSetting, error: moduleError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (moduleError) throw moduleError;
      const customModules = sanitizeCustomModules(moduleSetting?.custom_modules || {});
      const moduleKey = customModuleKey(body.module_key); const definition = customModules[moduleKey];
      if (!definition) return reply(request, { error: 'Modulul personalizat nu există.' }, 404);
      if (definition.active === false) return reply(request, { error: 'Modulul este dezactivat. Activează-l înainte de publicare.' }, 409);
      const availableChannels = await channels(db, guildId); const availableIds = new Set(availableChannels.map((channel: any) => channel.id));
      const embedChannel = clean(body.embed_channel_id, 30); const logChannel = clean(body.log_channel_id, 30);
      if (!validDiscordChannelId(embedChannel) || !availableIds.has(embedChannel)) return reply(request, { error: 'Canalul pentru embed este invalid.' }, 400);
      if (logChannel && (!validDiscordChannelId(logChannel) || !availableIds.has(logChannel))) return reply(request, { error: 'Canalul de log este invalid.' }, 400);
      const nextRoutes = { ...(settings?.discord_channel_routes || {}), [moduleKey]: { primary: { channel_id: embedChannel, guild_id: guildId, enabled: true, ...(settings?.discord_channel_routes?.[moduleKey]?.primary?.message_id ? { message_id: settings.discord_channel_routes[moduleKey].primary.message_id } : {}) } } } as any;
      if (logChannel) nextRoutes[definition.log_key] = { primary: { channel_id: logChannel, guild_id: guildId, enabled: true } };
      else delete nextRoutes[definition.log_key];
      const customDefinitions = { [moduleKey]: { ...definition, buttons: definition.buttons.map((button: any) => ({ ...button, id: button.id })) } };
      const delivery = await deliverDiscordRoute(db, { ...settings, discord_channel_routes: nextRoutes }, moduleKey, JSON.stringify(payload(moduleKey, false, customDefinitions)), { postOnly: false });
      const result = delivery.results?.[0];
      if (result?.id) nextRoutes[moduleKey].primary.message_id = String(result.id);
      const { error: saveError } = await db.from('discovery_settings').update({ discord_channel_routes: nextRoutes, updated_at: new Date().toISOString(), updated_by_discord_id: String(discord.id) }).eq('organization_id', selectedGuild.organization_id);
      if (saveError) throw saveError;
      return reply(request, { ok: true, result, routes: nextRoutes, failures: delivery.failures || [] });
    }
    if (action === 'channels') return reply(request, { ok: true, channels: await channels(db, guildId), routes: settings?.discord_channel_routes || {} });
    if (action === 'admin_roles') {
      if (!selectedGuild.can_manage_access) return reply(request, { error: 'Doar ownerul serverului poate modifica rolurile care au acces la configurarea botului.' }, 403);
      const [{ data: roles }, { data: setting }] = await Promise.all([
        guildRoles(db, guildId),
        db.from('discovery_app_settings').select('value').eq('organization_id', selectedGuild.organization_id).eq('key', 'discord_bot_admin_roles').maybeSingle(),
      ]);
      const { data: memberSetting } = await db.from('discovery_app_settings').select('value').eq('organization_id', selectedGuild.organization_id).eq('key', 'discord_bot_admin_users').maybeSingle();
      return reply(request, { ok: true, roles: roles || [], role_ids: Array.isArray(setting?.value?.role_ids) ? setting.value.role_ids.map(String) : [], member_ids: Array.isArray(memberSetting?.value?.discord_ids) ? memberSetting.value.discord_ids.map(String) : [] });
    }
    if (action === 'save_admin_roles') {
      if (!selectedGuild.can_manage_access) return reply(request, { error: 'Doar ownerul serverului poate modifica rolurile care au acces la configurarea botului.' }, 403);
      const requestedRoleIds = Array.isArray(body.role_ids) ? [...new Set(body.role_ids.map((value: any) => String(value).trim()).filter((value: string) => id(value)))] : [];
      if (requestedRoleIds.length > 25) return reply(request, { error: 'Poți selecta maximum 25 de roluri.' }, 400);
      const availableRoleIds = new Set((await guildRoles(db, guildId)).map((role: any) => String(role.id)));
      if (requestedRoleIds.some((roleId: string) => !availableRoleIds.has(roleId))) return reply(request, { error: 'Unul dintre rolurile selectate nu mai există pe server.' }, 400);
      const { error } = await db.from('discovery_app_settings').upsert({ organization_id: selectedGuild.organization_id, key: 'discord_bot_admin_roles', value: { role_ids: requestedRoleIds }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
      return reply(request, { ok: true, role_ids: requestedRoleIds });
    }
    if (action === 'save_admin_members') {
      if (!selectedGuild.can_manage_access) return reply(request, { error: 'Doar ownerul serverului poate modifica accesul individual.' }, 403);
      const requestedMemberIds = Array.isArray(body.member_ids) ? [...new Set(body.member_ids.map((value: any) => String(value).trim()).filter((value: string) => id(value)))] : [];
      if (requestedMemberIds.length > 50) return reply(request, { error: 'Poți acorda acces individual pentru maximum 50 de persoane.' }, 400);
      const botToken = await getPlatformSecret(db, 'discord_bot_token');
      for (const memberId of requestedMemberIds) {
        const memberResponse = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${memberId}`, { headers: botHeaders(botToken) });
        if (!memberResponse.ok) return reply(request, { error: `Utilizatorul ${memberId} nu este membru pe acest server sau nu poate fi verificat.` }, 400);
      }
      const { error } = await db.from('discovery_app_settings').upsert({ organization_id: selectedGuild.organization_id, key: 'discord_bot_admin_users', value: { discord_ids: requestedMemberIds }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
      return reply(request, { ok: true, member_ids: requestedMemberIds });
    }
    if (action === 'search_guild_members') {
      if (!selectedGuild.can_manage_access) return reply(request, { error: 'Doar ownerul serverului poate căuta membri pentru acordarea accesului.' }, 403);
      const query = clean(body.query, 80);
      const botToken = await getPlatformSecret(db, 'discord_bot_token');
      const members: any[] = [];
      let after = '';
      for (let page = 0; page < 20; page += 1) {
        const params = new URLSearchParams({ limit: '1000' });
        if (query.length >= 2) params.set('query', query);
        if (after) params.set('after', after);
        const membersResponse = await fetch(`${DISCORD_API}/guilds/${guildId}/members?${params.toString()}`, { headers: botHeaders(botToken) });
        if (!membersResponse.ok) return reply(request, { error: `Membrii Discord nu pot fi încărcați (HTTP ${membersResponse.status}). Activează Server Members Intent pentru bot.` }, 400);
        const pageMembers = await membersResponse.json().catch(() => []);
        if (!Array.isArray(pageMembers) || !pageMembers.length) break;
        members.push(...pageMembers);
        if (query.length >= 2 || pageMembers.length < 1000) break;
        after = String(pageMembers[pageMembers.length - 1]?.user?.id || '');
        if (!id(after)) break;
      }
      return reply(request, { ok: true, members: (Array.isArray(members) ? members : []).map((member: any) => ({ id: String(member.user?.id || ''), username: clean(member.user?.username || '', 80), global_name: clean(member.user?.global_name || '', 80), display_name: clean(member.nick || member.user?.global_name || member.user?.username || member.user?.id || '', 80), avatar: member.user?.avatar || null })).filter((member: any) => id(member.id)) });
    }
    const allowedPremium = selectedGuild.plan !== 'free';
    if (action === 'contract_template' || action === 'save_contract_template') {
      if (!allowedPremium) return reply(request, { error: 'Editorul de contracte este disponibil în Trial sau Premium.' }, 403);
      if (action === 'contract_template') {
        const { data: templateSetting, error } = await db.from('discovery_app_settings').select('value').eq('organization_id', selectedGuild.organization_id).eq('key', 'contract_template').maybeSingle();
        if (error) throw error;
        return reply(request, { ok: true, contract_template: templateSetting?.value || null });
      }
      const title = clean(body.title, 160);
      const template = clean(body.template, 50000);
      const position = clean(body.position, 120);
      const salary = clean(body.salary, 120);
      const schedule = clean(body.schedule, 120);
      const address = clean(body.address, 240);
      if (template.length < 20) return reply(request, { error: 'Șablonul contractului este prea scurt.' }, 400);
      const allowedVariables = new Set(['COMPANY','ADDRESS','MANAGER','EMPLOYEE_NAME','CNP','PHONE','POSITION','START_DATE','PROGRAM','SALARY']);
      const unknownVariables = [...template.matchAll(/{{([A-Z0-9_]+)}}/g)].map((match) => match[1]).filter((value, index, values) => !allowedVariables.has(value) && values.indexOf(value) === index);
      if (unknownVariables.length) return reply(request, { error: `Variabile necunoscute: ${unknownVariables.map((value) => `{{${value}}}`).join(', ')}.` }, 400);
      const { data: saved, error } = await db.from('discovery_app_settings').upsert({ organization_id: selectedGuild.organization_id, key: 'contract_template', value: { title: title || 'Contract de muncă', template, defaults: { position, salary, schedule, address } }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' }).select('value').single();
      if (error) throw error;
      return reply(request, { ok: true, contract_template: saved?.value || null });
    }
    if (action === 'stash_locations' || action === 'save_stash_location' || action === 'delete_stash_location') {
      const missingLocationsTable = (error: any) => ['42P01', 'PGRST205', 'PGRST204', '42P10'].includes(String(error?.code || '')) || /discovery_stash_locations.*(not found|does not exist)/i.test(String(error?.message || ''));
      if (selectedGuild.plan === 'free') return reply(request, { error: 'Locațiile Stash sunt disponibile în Trial sau Premium.' }, 403);
      const organizationId = selectedGuild.organization_id;
      if (action === 'stash_locations') {
        const { data, error } = await db.from('discovery_stash_locations').select('id,name,description,active').eq('organization_id', organizationId).order('name');
        if (error && missingLocationsTable(error)) {
          const { data: setting } = await db.from('discovery_app_settings').select('value').eq('organization_id', organizationId).eq('key', 'stash_locations').maybeSingle();
          return reply(request, { ok: true, locations: Array.isArray(setting?.value?.locations) ? setting.value.locations : [] });
        }
        if (error) throw error;
        return reply(request, { ok: true, locations: data || [] });
      }
      if (action === 'delete_stash_location') {
        const { error } = await db.from('discovery_stash_locations').update({ active: false, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', String(body.id || ''));
        if (error && missingLocationsTable(error)) {
          const { data: setting } = await db.from('discovery_app_settings').select('value').eq('organization_id', organizationId).eq('key', 'stash_locations').maybeSingle();
          const locations = (Array.isArray(setting?.value?.locations) ? setting.value.locations : []).map((item: any) => item.id === String(body.id || '') ? { ...item, active: false } : item);
          await db.from('discovery_app_settings').upsert({ organization_id: organizationId, key: 'stash_locations', value: { locations }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
          return reply(request, { ok: true });
        }
        if (error) throw error;
        return reply(request, { ok: true });
      }
      const name = clean(body.name, 100);
      const description = clean(body.description, 300);
      if (name.length < 2) return reply(request, { error: 'Numele locației este obligatoriu.' }, 400);
      const { data, error } = await db.from('discovery_stash_locations').upsert({ organization_id: organizationId, name, description, active: true, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,name' }).select('id,name,description,active').single();
      if (error && missingLocationsTable(error)) {
        const { data: setting } = await db.from('discovery_app_settings').select('value').eq('organization_id', organizationId).eq('key', 'stash_locations').maybeSingle();
        const locations = Array.isArray(setting?.value?.locations) ? setting.value.locations : [];
        const existing = locations.find((item: any) => String(item.name || '').trim().toLowerCase() === name.toLowerCase());
        const location = existing ? { ...existing, description, active: true } : { id: crypto.randomUUID(), name, description, active: true };
        const next = existing ? locations.map((item: any) => item.id === existing.id ? location : item) : [...locations, location];
        await db.from('discovery_app_settings').upsert({ organization_id: organizationId, key: 'stash_locations', value: { locations: next }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
        return reply(request, { ok: true, location });
      }
      if (error) throw error;
      return reply(request, { ok: true, location: data });
    }
    if (action === 'save') {
      const requested = body.routes && typeof body.routes === 'object' ? body.routes : {};
      const available = new Set((await channels(db, guildId)).map((channel: any) => channel.id));
      const { data: customSetting, error: customSettingError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (customSettingError) throw customSettingError;
      const customModules = sanitizeCustomModules(customSetting?.custom_modules || {});
      const moduleDefinitions = { ...MODULES, ...customModules };
      const routeKeys = Object.keys(moduleDefinitions);
      const nextRoutes: Record<string, any> = { ...(settings?.discord_channel_routes || {}) };
      for (const routeKey of routeKeys) {
        if (moduleDefinitions[routeKey].premium && !allowedPremium && requested[routeKey]) continue;
        const selected = requested[routeKey] && typeof requested[routeKey] === 'object' ? requested[routeKey] : { embed: requested[routeKey] };
        const channelId = clean(selected.embed, 30);
        const logChannelId = clean(selected.log, 30);
        if (!channelId) { delete nextRoutes[routeKey]; const staleLogKey = moduleDefinitions[routeKey].log_key || LOG_ROUTES[routeKey]; if (staleLogKey) { delete nextRoutes[staleLogKey]; for (const event of ['submission','approval','rejection','error']) delete nextRoutes[`${staleLogKey}_${event}`]; } continue; }
        if (!validDiscordChannelId(channelId) || !available.has(channelId)) return reply(request, { error: `Canal invalid pentru modulul ${moduleDefinitions[routeKey].label}.` }, 400);
        nextRoutes[routeKey] = { ...(nextRoutes[routeKey] || {}), primary: { ...(nextRoutes[routeKey]?.primary || {}), channel_id: channelId, guild_id: guildId, enabled: true } };
        const moduleLogKey = moduleDefinitions[routeKey].log_key || LOG_ROUTES[routeKey];
        if (moduleLogKey) {
          if (logChannelId && (!validDiscordChannelId(logChannelId) || !available.has(logChannelId))) return reply(request, { error: `Canal de log invalid pentru modulul ${moduleDefinitions[routeKey].label}.` }, 400);
          if (logChannelId) nextRoutes[moduleLogKey] = { ...(nextRoutes[moduleLogKey] || {}), primary: { ...(nextRoutes[moduleLogKey]?.primary || {}), channel_id: logChannelId, guild_id: guildId, enabled: true } };
          else delete nextRoutes[moduleLogKey];
          const eventLogs = selected.event_logs && typeof selected.event_logs === 'object' ? selected.event_logs : {};
          for (const event of ['submission','approval','rejection','error']) {
            const eventKey = `${moduleLogKey}_${event}`; const eventChannel = clean(eventLogs[event], 30);
            if (eventChannel && (!validDiscordChannelId(eventChannel) || !available.has(eventChannel))) return reply(request, { error: `Canal de log invalid pentru evenimentul ${event} al modulului ${moduleDefinitions[routeKey].label} .` }, 400);
            if (eventChannel) nextRoutes[eventKey] = { ...(nextRoutes[eventKey] || {}), primary: { ...(nextRoutes[eventKey]?.primary || {}), channel_id: eventChannel, guild_id: guildId, enabled: true } }; else delete nextRoutes[eventKey];
          }
        }
      }
      const { error } = await db.from('discovery_settings').update({ discord_channel_routes: nextRoutes, updated_at: new Date().toISOString(), updated_by_discord_id: String(discord.id) }).eq('organization_id', selectedGuild.organization_id);
      if (error) throw error;
      return reply(request, { ok: true, routes: nextRoutes });
    }
    if (action === 'publish') {
      const moduleKey = clean(body.module, 50);
      const { data: customSetting, error: customSettingError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (customSettingError) throw customSettingError;
      const definition = { ...mergeModuleDefinitions(MODULES, await readGlobalModules(db)), ...sanitizeCustomModules(customSetting?.custom_modules || {}) }[moduleKey];
      if (!definition) return reply(request, { error: 'Modul invalid.' }, 400);
      if (definition.premium && !allowedPremium) return reply(request, { error: 'Acest modul este disponibil după activarea Premium sau pe durata trialului.' }, 403);
      const configured = settings?.discord_channel_routes?.[moduleKey]?.primary;
      if (!configured?.channel_id) return reply(request, { error: `Alege mai întâi canalul pentru ${definition.label}.` }, 400);
      const delivery = await deliverDiscordRoute(db, { ...settings, discord_channel_routes: { [moduleKey]: { primary: configured } } }, moduleKey, JSON.stringify(payload(moduleKey, !allowedPremium)), { postOnly: false });
      const result = delivery.results?.[0];
      if (result?.id) {
        const nextRoutes = { ...(settings?.discord_channel_routes || {}) };
        nextRoutes[moduleKey] = { ...(nextRoutes[moduleKey] || {}), primary: { ...configured, message_id: String(result.id) } };
        await db.from('discovery_settings').update({ discord_channel_routes: nextRoutes, updated_at: new Date().toISOString(), updated_by_discord_id: String(discord.id) }).eq('organization_id', selectedGuild.organization_id);
      }
      return reply(request, { ok: true, result, failures: delivery.failures || [] });
    }
    return reply(request, { error: 'Acțiune necunoscută.' }, 400);
  } catch (error) {
    const detail = error instanceof Error ? error.message : (error && typeof error === 'object' ? String((error as any).message || (error as any).details || (error as any).hint || '') : '');
    return reply(request, { error: detail || 'Eroare internă.' }, 400);
  }
});



