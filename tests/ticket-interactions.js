const fs=require('fs');
const s=fs.readFileSync('supabase/functions/discord-interactions/index.ts','utf8');
for(const x of ['panel:ticket:open','panel:ticket:submit','panel:ticket:claim:','panel:ticket:close:','discovery_support_tickets','permission_overwrites','transcript']) if(!s.includes(x)) throw Error('Missing ticket interaction: '+x);
const commands=fs.readFileSync('supabase/functions/sync-discord-commands/index.ts','utf8'); if(!commands.includes("name: 'ticket'")) throw Error('Missing ticket slash command');
console.log('Ticket interaction checks: OK');
