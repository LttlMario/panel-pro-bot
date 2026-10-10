import { deliverDiscordRoute } from '../_shared/discord-delivery.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());
const uuid = (value: unknown) => /^[0-9a-f-]{36}$/i.test(String(value || '').trim());
const silent = 64;
const message = (content: string, extra: Record<string, unknown> = {}) => ({ type: 4, data: { content, flags: silent, ...extra } });

const statusLabel = (status: string) => ({ new: '🆕 Nouă', review: '🔎 În analiză', accepted: '✅ Acceptată', rejected: '❌ Respinsă' } as Record<string, string>)[status] || status;

export function proposalModal(audience: 'organization' | 'departments') {
  return { type: 9, data: { custom_id: `panel:proposals:${audience}:submit`, title: audience === 'organization' ? 'Propunere organizație' : 'Propunere angajați', components: [
    { type: 1, components: [{ type: 4, custom_id: 'proposal_title', label: 'Titlu', style: 1, required: true, max_length: 160, placeholder: 'Ex: O nouă activitate pentru server' }] },
    { type: 1, components: [{ type: 4, custom_id: 'proposal_content', label: 'Propunere', style: 2, required: true, max_length: 4000, placeholder: 'Descrie ideea și cum ar putea fi aplicată.' }] },
  ] } };
}

function components(proposal: any, audience: string) {
  if (proposal.status === 'deleted') return [];
  return [{ type: 1, components: [
    { type: 2, style: 3, label: '✅ Susțin', custom_id: `panel:proposals:${audience}:support:${proposal.id}` },
    { type: 2, style: 4, label: '❌ Contra', custom_id: `panel:proposals:${audience}:against:${proposal.id}` },
    { type: 2, style: 4, label: '🗑️ Șterge propunerea', custom_id: `panel:proposals:${audience}:delete:${proposal.id}` },
  ] }];
}

export function proposalPayload(proposal: any, votes: any[] = [], audience = String(proposal?.audience || 'organization')) {
  const support = votes.filter((row) => row.vote === 'support');
  const against = votes.filter((row) => row.vote === 'against');
  const names = (rows: any[]) => rows.map((row) => `• ${String(row.display_name || row.user_discord_id)}`).join('\n').slice(0, 1024) || 'Nimeni încă.';
  return { allowed_mentions: { parse: [] }, embeds: [{ title: `💡 ${String(proposal.title || 'Propunere').slice(0, 240)}`, description: String(proposal.content || 'Fără detalii.').slice(0, 4096), color: 0xa855f7, fields: [
    { name: '👤 Propus de', value: String(proposal.author_name || proposal.author_discord_id), inline: true },
    { name: '📌 Status', value: statusLabel(String(proposal.status || 'new')), inline: true },
    { name: `✅ Susțin (${support.length})`, value: names(support), inline: false },
    { name: `❌ Contra (${against.length})`, value: names(against), inline: false },
    ...(proposal.decision_note ? [{ name: '📝 Notă', value: String(proposal.decision_note).slice(0, 1024), inline: false }] : []),
  ], footer: { text: `Panel Pro · Propunere ${audience === 'organization' ? 'organizație' : 'angajați'}` }, timestamp: new Date().toISOString() }], components: components(proposal, audience) };
}

async function botJson(db: any, method: string, url: string, body?: any) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) throw new Error('Tokenul botului Discord nu este configurat.');
  const response = await fetch(url, { method, headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Discord nu a acceptat actualizarea propunerii (HTTP ${response.status}).`);
  return data;
}

async function context(db: any, interaction: any, audience: string) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!id(guildId) || !id(discordId)) throw new Error('Propunerile pot fi folosite doar într-un server Discord.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații.');
  const { data: settings, error: settingsError } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routes = settings?.discord_channel_routes || {};
  const proposalRoute = routes?.proposals?.[target] || {};
  const logRoute = routes?.log_proposals?.[target] || {};
  if (!proposalRoute.channel_id && !logRoute.channel_id) throw new Error('Configurează canalul Propuneri sau Log propuneri pentru acest server.');
  if (channelId && channelId !== String(proposalRoute.channel_id || '') && channelId !== String(logRoute.channel_id || '')) throw new Error('Acest canal nu este configurat pentru propuneri.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, discordId, displayName, organizationId: String(guild.organization_id), target, settings, logRoute };
}

async function load(db: any, organizationId: string, proposalId: string) {
  const { data: proposal, error } = await db.from('discovery_proposals').select('*').eq('organization_id', organizationId).eq('id', proposalId).maybeSingle();
  if (error) throw error;
  if (!proposal) throw new Error('Propunerea nu mai există.');
  const { data: votes, error: votesError } = await db.from('discovery_proposal_votes').select('user_discord_id,display_name,vote').eq('proposal_id', proposalId).order('created_at', { ascending: true });
  if (votesError) throw votesError;
  return { proposal, votes: votes || [] };
}

async function updateMessages(db: any, proposal: any, votes: any[]) {
  const refs = Array.isArray(proposal.discord_message_ids) ? proposal.discord_message_ids : [];
  for (const ref of refs) {
    if (!ref?.channel_id || !ref?.message_id) continue;
    await botJson(db, 'PATCH', `${DISCORD_API}/channels/${ref.channel_id}/messages/${ref.message_id}`, proposalPayload(proposal, votes, proposal.audience)).catch((error) => console.error('[discovery-proposals] message update failed', error));
  }
}

export async function handleDiscoveryProposals(db: any, interaction: any, customId: string, isButton: boolean, isModalSubmit: boolean) {
  const parts = customId.split(':');
  const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : '';
  if (!audience) return message('Categoria propunerii nu este validă.');
  const ctx = await context(db, interaction, audience);
  if (isModalSubmit && parts[3] === 'submit') {
    const values: Record<string, string> = {};
    for (const row of interaction?.data?.components || []) for (const component of row?.components || []) values[String(component.custom_id)] = String(component.value || '').trim();
    const title = String(values.proposal_title || '').slice(0, 160).trim();
    const content = String(values.proposal_content || '').slice(0, 4000).trim();
    if (title.length < 2 || content.length < 2) return message('Completează titlul și descrierea propunerii.');
    const { data: proposal, error } = await db.from('discovery_proposals').insert({ organization_id: ctx.organizationId, guild_id: ctx.guildId, audience, title, content, author_discord_id: ctx.discordId, author_name: ctx.displayName }).select('*').single();
    if (error) throw error;
    // Un server poate avea și rută principală, și rută secundară. Pentru o
    // propunere trimisă de pe unul dintre ele folosim strict aceeași destinație;
    // altfel un singur răspuns ar ajunge în ambele servere.
    const routeSettings = { ...ctx.settings, discord_channel_routes: { ...(ctx.settings?.discord_channel_routes || {}), log_proposals: { [ctx.target]: ctx.settings?.discord_channel_routes?.log_proposals?.[ctx.target] || {} } } };
    const delivery = await deliverDiscordRoute(db, routeSettings, 'log_proposals', JSON.stringify(proposalPayload(proposal, [], audience)), { postOnly: true });
    const refs = (delivery.results || []).filter((row: any) => row?.id).map((row: any) => ({ target: row.target, channel_id: row.channel_id || ctx.logRoute?.channel_id, message_id: String(row.id) }));
    if (!refs.length) throw new Error(delivery.failures?.join(' | ') || 'Propunerea nu a putut fi trimisă în canalul de log.');
    await db.from('discovery_proposals').update({ discord_message_ids: refs, updated_at: new Date().toISOString() }).eq('id', proposal.id);
    return message(`Propunerea **${title}** a fost trimisă în canalul de log.`);
  }
  const proposalId = String(parts[4] || '').trim();
  if (!isButton || !uuid(proposalId)) return message('Propunerea selectată nu este validă.');
  const data = await load(db, ctx.organizationId, proposalId);
  if (data.proposal.guild_id !== ctx.guildId || data.proposal.audience !== audience) throw new Error('Propunerea nu aparține acestui server sau acestei categorii.');
  const action = parts[3];
  if (action === 'delete') {
    const manager = String(data.proposal.author_discord_id) === ctx.discordId || Boolean(interaction.member?.permissions && BigInt(String(interaction.member.permissions)) & 40n);
    if (!manager) return message('Doar autorul sau un administrator poate șterge propunerea.');
    const { error } = await db.from('discovery_proposals').delete().eq('id', proposalId).eq('organization_id', ctx.organizationId);
    if (error) throw error;
    for (const ref of Array.isArray(data.proposal.discord_message_ids) ? data.proposal.discord_message_ids : []) if (ref?.channel_id && ref?.message_id) await botJson(db, 'DELETE', `${DISCORD_API}/channels/${ref.channel_id}/messages/${ref.message_id}`).catch(() => null);
    return message('Propunerea a fost ștearsă.');
  }
  if (!['support', 'against'].includes(action)) return message('Acțiunea propunerii nu este validă.');
  const { error: voteError } = await db.from('discovery_proposal_votes').upsert({ proposal_id: proposalId, organization_id: ctx.organizationId, user_discord_id: ctx.discordId, display_name: ctx.displayName, vote: action, updated_at: new Date().toISOString() }, { onConflict: 'proposal_id,user_discord_id' });
  if (voteError) throw voteError;
  const updated = await load(db, ctx.organizationId, proposalId);
  await updateMessages(db, updated.proposal, updated.votes);
  return message(action === 'support' ? 'Votul „Susțin” a fost înregistrat, iar embedul a fost actualizat.' : 'Votul „Contra” a fost înregistrat, iar embedul a fost actualizat.');
}
