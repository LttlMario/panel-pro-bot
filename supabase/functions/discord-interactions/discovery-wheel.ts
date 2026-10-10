const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());
const silent = 64;
const message = (content: string) => ({ type: 4, data: { content, flags: silent } });

function remaining(dueAt: string) {
  const seconds = Math.max(0, Math.ceil((Date.parse(dueAt) - Date.now()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

export const wheelPayload = () => ({ allowed_mentions: { parse: [] }, embeds: [{ title: '🎡 Roată · timer personal', description: 'Apasă butonul de mai jos după ce ai dat la roată. Timerul este individual și durează 6 ore.', color: 0x06b6d4, footer: { text: 'Panel Pro · timer personal' } }], components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Am dat la roată', custom_id: 'panel:wheel:start' }] }] });

async function context(db: any, interaction: any) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!id(guildId) || !id(discordId)) throw new Error('Timerul poate fi folosit doar într-un server Discord.');
  const { data: guild, error: guildError } = await db.from('discovery_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații.');
  const { data: settings, error } = await db.from('discovery_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (error) throw error;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const route = settings?.discord_channel_routes?.wheel_timer?.[target] || {};
  if (!route.channel_id || String(route.channel_id) !== channelId) throw new Error('Acest canal nu este configurat pentru timerul Roată.');
  return { guildId, discordId, organizationId: String(guild.organization_id), target };
}

export async function handleWheel(db: any, interaction: any) {
  const ctx = await context(db, interaction);
  const { data: active, error } = await db.from('discovery_wheel_reminders').select('id,started_at,due_at,status').eq('organization_id', ctx.organizationId).eq('guild_id', ctx.guildId).eq('discord_id', ctx.discordId).in('status', ['pending', 'sending']).order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (active && Date.parse(String(active.due_at || '')) > Date.now()) return message(`⏳ **Timerul tău este activ**\n\nTimp rămas: **${remaining(String(active.due_at))}**\nDisponibil la: <t:${Math.floor(Date.parse(String(active.due_at)) / 1000)}:F>`);
  if (active) await db.from('discovery_wheel_reminders').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', active.id).in('status', ['pending', 'sending']);
  const now = new Date();
  const dueAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const { data: created, error: insertError } = await db.from('discovery_wheel_reminders').insert({ organization_id: ctx.organizationId, guild_id: ctx.guildId, discord_id: ctx.discordId, started_at: now.toISOString(), due_at: dueAt.toISOString(), status: 'pending', updated_at: now.toISOString() }).select('due_at').single();
  if (insertError) {
    if (String(insertError.code || '') === '23505') return message('Ai deja un timer activ pentru acest server.');
    throw insertError;
  }
  return message(`✅ Timerul a fost pornit.\n\nTimp rămas: **${remaining(String(created.due_at))}**\nDisponibil la: <t:${Math.floor(Date.parse(String(created.due_at)) / 1000)}:F>`);
}
