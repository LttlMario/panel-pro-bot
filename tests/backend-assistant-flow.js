const fs=require('fs'); const s=fs.readFileSync('supabase/functions/discord-interactions/index.ts','utf8');
for(const x of ['customRejectionModal','panel:custom_reason:','review_note','response_flow']) if(!s.includes(x)) throw new Error('Missing '+x);
const m=fs.readFileSync('supabase/functions/manage-discord-bot/index.ts','utf8'); if(m.includes("if (action === 'assistant_catalog', 'assistant_schema_check')")) throw new Error('Catalog routing regression'); if(!m.includes("action === 'assistant_catalog' || action === 'assistant_schema_check'")) throw new Error('Schema route missing');
console.log('Backend assistant flow checks: OK');
