import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
const API='https://discord.com/api/v10'; const GUILD='1544703486384537603';
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async (request)=>{
  if(request.method!=='POST') return json({error:'Metoda nu este permisă.'},405);
  const secret=Deno.env.get('CRON_SECRET')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const supplied=request.headers.get('x-cron-secret')||request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!secret || (supplied!==secret && supplied!==Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) return json({error:'Neautorizat.'},401);
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default; const db=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey); const token=await getPlatformSecret(db,'discord_bot_token');
  if(!token) return json({error:'Token Discord lipsă.'},500); const headers={Authorization:`Bot ${token}`,'Content-Type':'application/json'};
  const get=async(path:string)=>{const r=await fetch(API+path,{headers});const body=await r.json().catch(()=>({}));if(!r.ok)throw Error(String(body?.message||`Discord HTTP ${r.status}`));return body;};
  try{
    const roles=await get(`/guilds/${GUILD}/roles`); const map:any=Object.fromEntries((Array.isArray(roles)?roles:[]).map((r:any)=>[String(r.name||'').toLowerCase(),String(r.id)]));
    const createStatuses:any[]=[]; for (const required of [{ name: 'Member', color: 0x334155, hoist: false }, { name: 'Premium', color: 0xf59e0b, hoist: true }]) if (!map[required.name.toLowerCase()]) { const created=await fetch(`${API}/guilds/${GUILD}/roles`,{method:'POST',headers,body:JSON.stringify({name: required.name,permissions:'0',color: required.color,hoist: required.hoist,mentionable:true})}); const role=await created.json().catch(()=>({})); createStatuses.push({name:required.name,status:created.status,message:role?.message||null}); if(created.ok&&role.id) map[required.name.toLowerCase()]=String(role.id); }
    if(!map.member||!map.premium) return json({error:'Rolurile Member și Premium nu pot fi create.',create_statuses:createStatuses},409);
    const {data:guild,error:ge}=await db.from('discovery_guilds').select('organization_id').eq('guild_id',GUILD).eq('enabled',true).maybeSingle(); if(ge)throw ge;if(!guild?.organization_id)return json({error:'Server neasociat.'},404);
    const [{data:ent,error:ee},{data:trial,error:te}]=await Promise.all([db.from('discovery_guild_entitlements').select('ends_at').eq('guild_id',GUILD).eq('organization_id',guild.organization_id).eq('active',true).order('updated_at',{ascending:false}).limit(1).maybeSingle(),db.from('discovery_app_settings').select('value').eq('organization_id',guild.organization_id).eq('key','discord_trial').maybeSingle()]);if(ee)throw ee;if(te)throw te;
    const premium=Boolean(ent&&(!ent.ends_at||Date.parse(String(ent.ends_at))>Date.now()))||Date.parse(String(trial?.value?.ends_at||''))>Date.now(); const members:any[]=[];let after='';
    for(let page=0;page<20;page++){const batch=await get(`/guilds/${GUILD}/members?limit=1000${after?`&after=${after}`:''}`);if(!Array.isArray(batch)||!batch.length)break;members.push(...batch);if(batch.length<1000)break;after=String(batch[batch.length-1].user?.id||'');if(!after)break;}
    let assigned=0,removed=0; for(const m of members){const uid=String(m.user?.id||'');if(!/^\d{15,22}$/.test(uid))continue;const current=new Set((m.roles||[]).map(String));if(!current.has(map.member)){const r=await fetch(`${API}/guilds/${GUILD}/members/${uid}/roles/${map.member}`,{method:'PUT',headers});if(r.ok)assigned++;}if(current.has(map.premium)){const r=await fetch(`${API}/guilds/${GUILD}/members/${uid}/roles/${map.premium}`,{method:'DELETE',headers});if(r.ok)removed++;}}
    const result={ok:true,guild_id:GUILD,members:members.length,premium_active:premium,assigned,removed}; await db.from('discovery_lifecycle_events').insert({organization_id:guild.organization_id,event_type:'official_roles_synced',actor_discord_id:null,details:result});
    return json(result);
  }catch(error){console.error('[sync-official-roles]',error);return json({error:error instanceof Error?error.message:'Sincronizarea a eșuat.'},500);}
});
