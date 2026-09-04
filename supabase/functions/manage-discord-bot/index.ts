import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { deliverDiscordRoute, routeCandidates, validDiscordChannelId } from '../_shared/discord-delivery.ts';
import { mergeModuleDefinitions, readGlobalModules, sanitizeModuleOverrides } from '../_shared/global-bot-settings.ts';

const DISCORD_API = 'https://discord.com/api/v10';
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
  requests_organization: 'log_requests_organization', requests_departments: 'log_requests_departments', contracts: 'log_contracts',
  actions_organization: 'log_actions_organization', marketplace: 'log_marketplace', illegal_marketplace: 'log_illegal_marketplace', stash: 'log_stash', stash_requests: 'log_stash_requests', stash_donations: 'log_stash_donations', event_reminders: 'log_event_reminders'
};
const LOG_LABELS: Record<string, string> = {
  log_announcements_organization: 'Log anunțuri organizație', log_announcements_departments: 'Log anunțuri angajați', log_pontaj: 'Log pontaj',
  log_requests_organization: 'Log învoiri organizație', log_requests_departments: 'Log învoiri angajați', log_contracts: 'Log contracte',
  log_actions_organization: 'Log acțiuni organizație', log_marketplace: 'Log Marketplace legal', log_illegal_marketplace: 'Log Marketplace ilegal', log_stash: 'Log Stash', log_stash_requests: 'Log cereri Stash', log_stash_donations: 'Log donații Stash', log_event_reminders: 'Log evenimente și remindere'
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
    const workflow = value.workflow && typeof value.workflow === 'object' ? { announcement_mode: ['public', 'private'].includes(value.workflow.announcement_mode) ? value.workflow.announcement_mode : 'public', approval_role: clean(value.workflow.approval_role, 80), report_limit: Math.min(100, Math.max(1, Number(value.workflow.report_limit) || 20)), notify_submitter: value.workflow.notify_submitter !== false, actions: Array.isArray(value.workflow.actions) ? value.workflow.actions.filter((item: any) => ['save_submission', 'send_log', 'notify_submitter', 'update_message', 'review_buttons', 'run_report'].includes(String(item))).slice(0, 10) : [] } : { announcement_mode: 'public', approval_role: '', report_limit: 20, notify_submitter: true, actions: [] };
    const embed = value.embed && typeof value.embed === 'object' ? { author_name: clean(value.embed.author_name, 256), author_icon: clean(value.embed.author_icon, 500), thumbnail: clean(value.embed.thumbnail, 500), image: clean(value.embed.image, 500), footer_text: clean(value.embed.footer_text, 2048), footer_icon: clean(value.embed.footer_icon, 500), timestamp: value.embed.timestamp === true, fields: Array.isArray(value.embed.fields) ? value.embed.fields.slice(0, 25).map((field: any) => ({ name: clean(field?.name, 256), value: clean(field?.value, 1024), inline: field?.inline === true })).filter((field: any) => field.name && field.value) : [] } : { author_name: '', author_icon: '', thumbnail: '', image: '', footer_text: '', footer_icon: '', timestamp: false, fields: [] };
    const buttons = Array.isArray(value.buttons) ? value.buttons.slice(0, 5).map((button: any, index: number) => ({ id: `panel:custom:${key}:${index}`, label: clean(button?.label || `Acțiunea ${index + 1}`, 80), type: ['button', 'link', 'select', 'modal'].includes(String(button?.type || '').toLowerCase()) ? String(button.type).toLowerCase() : 'button', style: [1, 2, 3, 4, 5].includes(Number(button?.style)) ? Number(button.style) : 1, url: clean(button?.url, 500), action: ['open_form', 'save_submission', 'send_log', 'notify_submitter', 'update_message', 'approve', 'reject', 'report', 'none'].includes(String(button?.action || '').toLowerCase()) ? String(button.action).toLowerCase() : 'open_form', action_config: button?.action_config && typeof button.action_config === 'object' ? { message: clean(button.action_config.message, 2000), status: ['pending', 'approved', 'rejected', 'published', 'closed'].includes(String(button.action_config.status)) ? String(button.action_config.status) : '', module_key: customModuleKey(button.action_config.module_key || key) } : { message: '', status: '', module_key: key }, options: Array.isArray(button?.options) ? button.options.slice(0, 25).map((option: any) => ({ label: clean(option?.label, 80), value: clean(option?.value || option?.label, 100), description: clean(option?.description, 100) })).filter((option: any) => option.label && option.value) : [] })).filter((button: any) => button.label) : [];
    const responses = value.responses && typeof value.responses === 'object' ? { success: clean(value.responses.success, 2000), error: clean(value.responses.error, 2000), confirmation: clean(value.responses.confirmation, 2000), visibility: value.responses.visibility === 'public' ? 'public' : 'private' } : { success: '', error: '', confirmation: '', visibility: 'private' };
    const limits = value.limits && typeof value.limits === 'object' ? { cooldown_seconds: Math.min(86400, Math.max(0, Number(value.limits.cooldown_seconds) || 0)), max_pending: Math.min(1000, Math.max(0, Number(value.limits.max_pending) || 0)), max_per_user: Math.min(1000, Math.max(0, Number(value.limits.max_per_user) || 0)), allow_attachments: value.limits.allow_attachments === true, max_text_length: Math.min(4000, Math.max(100, Number(value.limits.max_text_length) || 1800)) } : { cooldown_seconds: 0, max_pending: 0, max_per_user: 0, allow_attachments: false, max_text_length: 1800 };
    const permissions = value.permissions && typeof value.permissions === 'object' ? { mode: ['everyone', 'mapped_role', 'manager', 'owner'].includes(String(value.permissions.mode)) ? String(value.permissions.mode) : 'everyone', role_ids: Array.isArray(value.permissions.role_ids) ? value.permissions.role_ids.slice(0, 25).map(String).filter((roleId: string) => /^\d{15,22}$/.test(roleId)) : [] } : { mode: 'everyone', role_ids: [] };
    result[key] = { key, label, title, description, color: Number.isInteger(Number(value.color)) ? Math.max(0, Math.min(0xffffff, Number(value.color))) : 0x5865f2, embed, handler, active: value.active !== false, command_name: clean(value.command_name, 32).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32), form_schema, workflow, responses, limits, permissions, log_key: `log_${key}`, buttons };
  }
  return result;
};
const botHeaders = (token: string) => ({ Authorization: `Bot ${token}`, 'User-Agent': 'Panel Pro Discord Bot (+https://panel-pro.ro)' });

async function discordUser(token: string) {
  const response = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Sesiunea Discord a expirat. Conectează-te din nou.');
  return response.json();
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
    const { data: packageSetting } = await db.from('discovery_app_settings').select('key,value').eq('organization_id', linked.organization_id).in('key', ['organization_package', 'discord_trial', 'discord_bot_admin_roles']);
    const packageValue = (packageSetting || []).find((item: any) => item.key === 'organization_package')?.value || {};
    const trialValue = (packageSetting || []).find((item: any) => item.key === 'discord_trial')?.value || {};
    const adminRolesValue = (packageSetting || []).find((item: any) => item.key === 'discord_bot_admin_roles')?.value || {};
    const adminRoleIds = Array.isArray(adminRolesValue?.role_ids) ? adminRolesValue.role_ids.map(String) : [];
    const isOwner = Boolean(guild.owner);
    const isRoleAdmin = !isOwner && adminRoleIds.length ? (await memberRoleIds(db, String(guild.id), String(user.id))).some((roleId: string) => adminRoleIds.includes(roleId)) : false;
    if (!platformAdmin && !isOwner && !isRoleAdmin) continue;
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
    const globalOnlyAction = ['custom_modules', 'save_custom_modules', 'global_config', 'save_global_config'].includes(action);
    const guilds = globalOnlyAction
      ? []
      : await ownedGuilds(db, { ...discord, access_token: accessToken }, applicationId, platformAdmin || !personalView, diagnostics);
    if (action === 'bootstrap') {
      const { data: customSetting, error: customSettingError } = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (customSettingError) throw customSettingError;
      const customModules = sanitizeCustomModules(customSetting?.custom_modules || {});
      const modules = Object.fromEntries(Object.entries(MODULES).map(([key, value]) => [key, { label: value.label, title: value.title, description: value.description, color: value.color, buttons: value.buttons, premium: value.premium, log_key: LOG_ROUTES[key] || '', log_label: LOG_LABELS[LOG_ROUTES[key] || ''] || '' }]));
      for (const [key, value] of Object.entries(customModules)) modules[key] = { label: value.label, title: value.title, description: value.description, color: value.color, buttons: value.buttons, premium: false, active: value.active !== false, log_key: value.log_key, log_label: `Log ${value.label}` };
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
      return reply(request, { ok: true, platform_admin: platformAdmin, custom_modules: setting?.custom_modules && typeof setting.custom_modules === 'object' ? setting.custom_modules : {} });
    }
    if (action === 'global_config' || action === 'save_global_config') {
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
    const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', selectedGuild.organization_id).maybeSingle();
    if (settingsError) throw settingsError;
    if (action === 'dashboard_overview' || action === 'repair_guild' || action === 'set_module_enabled') {
      const customSetting = await db.from('discovery_bot_global_settings').select('custom_modules').eq('id', 'global').maybeSingle();
      if (customSetting.error) throw customSetting.error;
      const definitions = { ...mergeModuleDefinitions(MODULES, await readGlobalModules(db)), ...sanitizeCustomModules(customSetting.data?.custom_modules || {}) } as Record<string, any>;
      const routes = { ...(settings?.discord_channel_routes || {}) } as Record<string, any>;
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
      let permissionValue = 0n; try { permissionValue = BigInt(String(botMember.permissions || '0')); } catch (_) {}
      const requiredPermissions = [{ key: 'view_channel', label: 'View Channel', bit: 1024n }, { key: 'send_messages', label: 'Send Messages', bit: 2048n }, { key: 'embed_links', label: 'Embed Links', bit: 16384n }];
      const missingPermissions = requiredPermissions.filter((item) => (permissionValue & item.bit) !== item.bit).map((item) => item.label);
      let channelList: any[] = [];
      let channelError = '';
      try { channelList = await channels(db, guildId); } catch (error) { channelError = error instanceof Error ? error.message : 'Canalele Discord nu au putut fi verificate.'; }
      const availableChannels = new Set(channelList.map((channel: any) => String(channel.id)));
      const modules = Object.entries(definitions).map(([key, definition]: [string, any]) => ({ key, label: definition.label, premium: definition.premium === true, active: definition.active !== false, enabled: routes[key]?.primary?.enabled !== false, embed_configured: Boolean(routes[key]?.primary?.channel_id && availableChannels.has(String(routes[key].primary.channel_id))), log_configured: Boolean(definition.log_key && routes[definition.log_key]?.primary?.channel_id && availableChannels.has(String(routes[definition.log_key].primary.channel_id))) }));
      const [activityResult, auditResult] = await Promise.all([
        db.from('discovery_custom_module_submissions').select('id,module_key,subject,status,created_at,updated_at').eq('organization_id', selectedGuild.organization_id).eq('guild_id', guildId).order('created_at', { ascending: false }).limit(12),
        db.from('discovery_audit_log').select('id,action,target_type,target_id,created_at,details').eq('organization_id', selectedGuild.organization_id).order('created_at', { ascending: false }).limit(12),
      ]);
      // Activitatea este suplimentară; un tabel de istoric indisponibil nu trebuie să blocheze dashboardul.
      if (action === 'repair_guild') {
        for (const item of modules.filter((module) => module.active && module.embed_configured)) {
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
    if (action === 'publish_custom_module') {
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
      return reply(request, { ok: true, roles: roles || [], role_ids: Array.isArray(setting?.value?.role_ids) ? setting.value.role_ids.map(String) : [] });
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
      if (template.length < 20) return reply(request, { error: 'Șablonul contractului este prea scurt.' }, 400);
      const allowedVariables = new Set(['COMPANY','ADDRESS','MANAGER','EMPLOYEE_NAME','CNP','PHONE','POSITION','START_DATE','PROGRAM','SALARY']);
      const unknownVariables = [...template.matchAll(/{{([A-Z0-9_]+)}}/g)].map((match) => match[1]).filter((value, index, values) => !allowedVariables.has(value) && values.indexOf(value) === index);
      if (unknownVariables.length) return reply(request, { error: `Variabile necunoscute: ${unknownVariables.map((value) => `{{${value}}}`).join(', ')}.` }, 400);
      const { data: saved, error } = await db.from('discovery_app_settings').upsert({ organization_id: selectedGuild.organization_id, key: 'contract_template', value: { title: title || 'Contract de muncă', template, defaults: { position, salary, schedule } }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' }).select('value').single();
      if (error) throw error;
      return reply(request, { ok: true, contract_template: saved?.value || null });
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
        if (!channelId) { delete nextRoutes[routeKey]; if (moduleDefinitions[routeKey].log_key || LOG_ROUTES[routeKey]) delete nextRoutes[moduleDefinitions[routeKey].log_key || LOG_ROUTES[routeKey]]; continue; }
        if (!validDiscordChannelId(channelId) || !available.has(channelId)) return reply(request, { error: `Canal invalid pentru modulul ${moduleDefinitions[routeKey].label}.` }, 400);
        nextRoutes[routeKey] = { ...(nextRoutes[routeKey] || {}), primary: { ...(nextRoutes[routeKey]?.primary || {}), channel_id: channelId, guild_id: guildId, enabled: true } };
        const moduleLogKey = moduleDefinitions[routeKey].log_key || LOG_ROUTES[routeKey];
        if (moduleLogKey) {
          if (logChannelId && (!validDiscordChannelId(logChannelId) || !available.has(logChannelId))) return reply(request, { error: `Canal de log invalid pentru modulul ${moduleDefinitions[routeKey].label}.` }, 400);
          if (logChannelId) nextRoutes[moduleLogKey] = { ...(nextRoutes[moduleLogKey] || {}), primary: { ...(nextRoutes[moduleLogKey]?.primary || {}), channel_id: logChannelId, guild_id: guildId, enabled: true } };
          else delete nextRoutes[moduleLogKey];
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
  } catch (error) { return reply(request, { error: error instanceof Error ? error.message : 'Eroare internă.' }, 400); }
});
