const { Client, GatewayIntentBits, Events } = require('discord.js');

const token = String(process.env.DISCORD_BOT_TOKEN || '').trim();
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const fallbackChannelIds = String(process.env.DISCORD_PREFIX_CHANNEL_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => /^\d{15,22}$/.test(value));

if (!token) throw new Error('Setează DISCORD_BOT_TOKEN înainte de pornire.');
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Setează SUPABASE_URL și SUPABASE_SERVICE_ROLE_KEY înainte de pornire.');
}

const validId = (value) => /^\d{15,22}$/.test(String(value || '').trim());
let monitoredChannels = new Set(fallbackChannelIds);

async function refreshChannels() {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/organization_settings?select=discord_message_prefix_channels`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);

  const rows = await response.json();
  const next = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const item of Array.isArray(row?.discord_message_prefix_channels)
      ? row.discord_message_prefix_channels
      : []) {
      const channelId = String(item?.channel_id || '').trim();
      const guildId = String(item?.guild_id || '').trim();
      if (validId(channelId) && validId(guildId) && item?.enabled !== false) next.add(channelId);
    }
  }
  monitoredChannels = next;
  console.log(`[prefix] ${next.size} canal${next.size === 1 ? '' : 'e'} selectat${next.size === 1 ? '' : 'e'}.`);
}

function authorName(message) {
  return String(
    message.member?.displayName ||
    message.author.globalName ||
    message.author.username ||
    message.author.id
  ).trim().slice(0, 120) || 'Utilizator';
}

async function prefixMessage(message) {
  if (message.author.bot || !monitoredChannels.has(String(message.channelId))) return;
  if (!message.channel?.isTextBased()) return;

  const text = String(message.content || '').trim();
  const files = [...message.attachments.values()].map((file) => file.url).filter(Boolean);
  const body = [text, ...files].filter(Boolean).join('\n');
  if (!body) return;

  const prefix = `${authorName(message)}: `;
  await message.channel.send({
    content: `${prefix}${body.slice(0, Math.max(1, 2000 - prefix.length))}`,
    allowedMentions: { parse: [] }
  });

  if (String(process.env.DISCORD_PREFIX_KEEP_ORIGINAL || '').trim() !== '1') {
    await message.delete().catch((error) => {
      console.error('[prefix] Copia a fost trimisă, dar mesajul original nu a putut fi șters:', error.message);
    });
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, async (ready) => {
  console.log(`Panel Pro direct bot conectat ca ${ready.user.tag}.`);
  try { await refreshChannels(); } catch (error) { console.error('[prefix] Configurația nu a putut fi citită:', error.message); }
  const timer = setInterval(() => refreshChannels().catch((error) => console.error('[prefix] Reîmprospătare eșuată:', error.message)), 60_000);
  timer.unref?.();
});

client.on(Events.MessageCreate, (message) => {
  prefixMessage(message).catch((error) => console.error('[prefix] Mesajul nu a putut fi prefixat:', error.message));
});

client.login(token);
