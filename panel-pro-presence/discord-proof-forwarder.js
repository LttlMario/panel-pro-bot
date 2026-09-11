const { Client, GatewayIntentBits, Partials, Events, EmbedBuilder } = require('discord.js');

const token = String(process.env.DISCORD_BOT_TOKEN || '').trim();
const targetChannelId = String(process.env.DISCORD_PAYMENT_PROOF_CHANNEL_ID || '1547891455006085170').trim();
const adminId = '247012210021236738';
if (!token) throw new Error('Setează DISCORD_BOT_TOKEN înainte de pornire.');

const client = new Client({
  intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, (ready) => console.log(`Forwarder dovezi activ: ${ready.user.tag} → canalul ${targetChannelId}`));
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.channel.type !== 1) return;
  try {
    const target = await client.channels.fetch(targetChannelId);
    if (!target?.isTextBased()) throw new Error('Canalul de dovezi nu este accesibil.');
    const content = message.content?.trim() || 'Fără text';
    const attachments = [...message.attachments.values()].map((file) => file.url).join('\n');
    const embed = new EmbedBuilder()
      .setTitle('💳 Dovadă plată Panel Pro')
      .setColor(0x22d3ee)
      .setDescription(content.slice(0, 4000))
      .addFields(
        { name: 'Trimis de', value: `<@${message.author.id}> (${message.author.id})`, inline: false },
        { name: 'Mesaj original', value: `[Deschide mesajul](https://discord.com/channels/@me/${message.channel.id}/${message.id})`, inline: false },
      )
      .setTimestamp();
    if (attachments) embed.addFields({ name: 'Atașamente', value: attachments.slice(0, 1024), inline: false });
    await target.send({ content: `<@${adminId}>`, embeds: [embed], allowedMentions: { users: [adminId] } });
    await message.reply('Dovada a fost trimisă administratorului. Licența va fi activată după verificare.');
  } catch (error) {
    console.error('[proof-forwarder]', error);
    await message.reply('Dovada nu a putut fi transmisă momentan. Încearcă din nou peste câteva secunde.').catch(() => {});
  }
});

client.login(token);
