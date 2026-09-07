const fs=require('fs');
const provision=fs.readFileSync('supabase/functions/manage-discord-bot/index.ts','utf8');
const interactions=fs.readFileSync('supabase/functions/discord-interactions/index.ts','utf8');
const sync=fs.readFileSync('supabase/functions/sync-official-roles/index.ts','utf8');
for(const x of ['Administrator','Staff','Support','Moderator','Premium','Member','📌 START AICI','📚 DOCUMENTAȚIE','🛠️ SUPORT','💎 PREMIUM','🎫・deschide-ticket','bot.panel-pro.ro','termeni-si-conditii','preturi-si-premium','existingMessages','permission_overwrites']) if(!provision.includes(x)) throw Error('Official server missing: '+x);
for(const x of ['panel:ticket:open','panel:ticket:submit','panel:ticket:claim:','panel:ticket:close:','discovery_support_ticket_events','transcript']) if(!interactions.includes(x)) throw Error('Ticket flow missing: '+x);
for(const x of ['1544703486384537603','premium_active','method:\'DELETE\'','discovery_lifecycle_events']) if(!sync.includes(x)) throw Error('Role automation missing: '+x);
console.log('Official server audit: OK');
