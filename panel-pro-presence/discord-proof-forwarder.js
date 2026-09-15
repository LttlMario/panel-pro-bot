const {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    EmbedBuilder,
    ActivityType
} = require('discord.js');


const token = String(
    process.env.DISCORD_BOT_TOKEN || ''
).trim();

const targetChannelId = String(
    process.env.DISCORD_PAYMENT_PROOF_CHANNEL_ID ||
    '1547891455006085170'
).trim();

const adminId = '247012210021236738';

const supabaseUrl = String(
    process.env.SUPABASE_URL || ''
).trim().replace(/\/$/, '');

const supabaseServiceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
).trim();

const prefixChannelIdsFromEnvironment = String(
    process.env.DISCORD_PREFIX_CHANNEL_IDS || ''
)
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d{15,22}$/.test(value));

let messagePrefixChannels = new Map(
    prefixChannelIdsFromEnvironment.map((channelId) => [channelId, { channelId }])
);

const validDiscordId = (value) => /^\d{15,22}$/.test(String(value || '').trim());

async function refreshMessagePrefixChannels() {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        return;
    }

    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/organization_settings?select=discord_message_prefix_channels`,
            {
                headers: {
                    apikey: supabaseServiceRoleKey,
                    Authorization: `Bearer ${supabaseServiceRoleKey}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Supabase HTTP ${response.status}`);
        }

        const settingsRows = await response.json();
        const next = new Map();

        for (const row of Array.isArray(settingsRows) ? settingsRows : []) {
            for (const channel of Array.isArray(row?.discord_message_prefix_channels)
                ? row.discord_message_prefix_channels
                : []) {
                const channelId = String(channel?.channel_id || '').trim();
                const guildId = String(channel?.guild_id || '').trim();
                if (!validDiscordId(channelId) || !validDiscordId(guildId) || channel?.enabled === false) {
                    continue;
                }
                next.set(channelId, {
                    channelId,
                    guildId,
                    channelName: String(channel?.channel_name || channelId).trim(),
                    guildName: String(channel?.guild_name || guildId).trim()
                });
            }
        }

        messagePrefixChannels = next;
        console.log(`[prefix] ${next.size} canal${next.size === 1 ? '' : 'e'} monitorizat${next.size === 1 ? '' : 'e'}.`);
    } catch (error) {
        console.error('[prefix] Configurația canalelor nu a putut fi actualizată:', error.message);
    }
}

function displayNameFor(message) {
    return String(
        message.member?.displayName ||
        message.author.globalName ||
        message.author.username ||
        message.author.id
    ).trim().slice(0, 120) || 'Utilizator';
}

async function prefixMessage(message) {
    const channelConfig = messagePrefixChannels.get(String(message.channelId));
    if (!channelConfig || !message.channel?.isTextBased()) return;

    const text = String(message.content || '').trim();
    const attachments = [...message.attachments.values()]
        .map((attachment) => attachment.url)
        .filter(Boolean);
    const body = [text, ...attachments].filter(Boolean).join('\n');
    if (!body) return;

    const prefix = `${displayNameFor(message)}: `;
    const available = Math.max(1, 2000 - prefix.length);
    const formatted = `${prefix}${body.slice(0, available)}`;

    await message.channel.send({
        content: formatted,
        allowedMentions: { parse: [] }
    });

    if (String(process.env.DISCORD_PREFIX_DELETE_ORIGINAL || '').trim() === '1') {
        await message.delete().catch(() => {});
    }
}


if (!token) {
    throw new Error(
        'Setează DISCORD_BOT_TOKEN înainte de pornire.'
    );
}


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],

    partials: [
        Partials.Channel,
        Partials.Message
    ]
});


/* =========================================================
   STATUS BOT - NUMĂR SERVERE DISCORD
   ========================================================= */

function updateBotStatus() {

    if (!client.user) return;

    const serverCount = client.guilds.cache.size;

    client.user.setPresence({
        status: 'online',

        activities: [
            {
                name: `${serverCount} servere Discord`,
                type: ActivityType.Watching
            }
        ]
    });

    console.log(
        `[status] Panel Pro Bot urmărește ${serverCount} servere Discord`
    );
}


/* =========================================================
   BOT READY
   ========================================================= */

client.once(Events.ClientReady, async (ready) => {

    console.log(
        `Forwarder dovezi activ: ${ready.user.tag} → canalul ${targetChannelId}`
    );

    updateBotStatus();

    await refreshMessagePrefixChannels();
    const refreshTimer = setInterval(refreshMessagePrefixChannels, 60_000);
    refreshTimer.unref?.();

});


/* =========================================================
   ACTUALIZARE STATUS CÂND BOTUL INTRĂ PE UN SERVER NOU
   ========================================================= */

client.on(Events.GuildCreate, (guild) => {

    console.log(
        `[guildCreate] Bot instalat pe: ${guild.name} (${guild.id})`
    );

    updateBotStatus();

});


/* =========================================================
   ACTUALIZARE STATUS CÂND BOTUL ESTE SCOS DE PE UN SERVER
   ========================================================= */

client.on(Events.GuildDelete, (guild) => {

    console.log(
        `[guildDelete] Bot eliminat de pe: ${guild.name} (${guild.id})`
    );

    updateBotStatus();

});


/* =========================================================
   FORWARD DOVEZI PLATĂ DIN DM
   ========================================================= */

client.on(Events.MessageCreate, async (message) => {

    if (
        !message.author.bot &&
        message.channel.type !== 1 &&
        messagePrefixChannels.has(String(message.channelId))
    ) {
        try {
            await prefixMessage(message);
        } catch (error) {
            console.error('[prefix]', error);
        }
        return;
    }

    if (
        message.author.bot ||
        message.channel.type !== 1
    ) {
        return;
    }

    try {

        const target = await client.channels.fetch(
            targetChannelId
        );

        if (!target?.isTextBased()) {
            throw new Error(
                'Canalul de dovezi nu este accesibil.'
            );
        }


        const content =
            message.content?.trim() ||
            'Fără text';


        const attachments = [
            ...message.attachments.values()
        ]
            .map((file) => file.url)
            .join('\n');


        const embed = new EmbedBuilder()
            .setTitle(
                '💳 Dovadă plată Panel Pro'
            )

            .setColor(
                0x22d3ee
            )

            .setDescription(
                content.slice(0, 4000)
            )

            .addFields(

                {
                    name: 'Trimis de',

                    value:
                        `<@${message.author.id}> (${message.author.id})`,

                    inline: false
                },

                {
                    name: 'Mesaj original',

                    value:
                        `[Deschide mesajul](https://discord.com/channels/@me/${message.channel.id}/${message.id})`,

                    inline: false
                }

            )

            .setTimestamp();


        if (attachments) {

            embed.addFields({
                name: 'Atașamente',

                value:
                    attachments.slice(
                        0,
                        1024
                    ),

                inline: false
            });

        }


        await target.send({

            content:
                `<@${adminId}>`,

            embeds: [
                embed
            ],

            allowedMentions: {
                users: [
                    adminId
                ]
            }

        });


        await message.reply(
            'Dovada a fost trimisă administratorului. Licența va fi activată după verificare.'
        );

    }

    catch (error) {

        console.error(
            '[proof-forwarder]',
            error
        );


        await message.reply(
            'Dovada nu a putut fi transmisă momentan. Încearcă din nou peste câteva secunde.'
        )
            .catch(() => {});

    }

});


/* =========================================================
   PORNIRE BOT
   ========================================================= */

client.login(token);
