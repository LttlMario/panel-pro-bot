import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';

const headersFor = (request: Request) => { const origin = String(request.headers.get('origin') || ''); const allowed = /^https?:\/\/(?:[a-z0-9-]+\.)*localhost(:\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) || origin === 'https://panel-pro.ro' || origin === 'https://bot.panel-pro.ro' ? origin : 'https://bot.panel-pro.ro'; return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', Vary: 'Origin' }; };
const reply = (request: Request, data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: headersFor(request) });
const routeChoices = [
  ['Anunțuri organizație', 'organization'], ['Anunțuri angajați', 'departments'], ['Pontaj', 'pontaj'], ['Log pontaj', 'log_pontaj'],
  ['Învoiri organizație', 'requests_organization'], ['Învoiri angajați', 'requests_departments'], ['Log învoiri organizație', 'log_requests_organization'], ['Log învoiri angajați', 'log_requests_departments'],
  ['Contracte', 'contracts'], ['Log contracte', 'log_contracts'], ['Marketplace', 'discovery_marketplace'], ['Log Marketplace', 'log_marketplace'], ['Marketplace ilegal', 'illegal_marketplace'], ['Log Marketplace ilegal', 'log_illegal_marketplace'], ['Acțiuni organizație', 'actions_organization'], ['Log acțiuni organizație', 'log_actions_organization'], ['Evenimente și remindere', 'event_reminders'], ['Raport săptămânal contracte', 'contract_identity_weekly'], ['Status live', 'status_live'],
  ['Stash', 'stash'], ['Log Stash', 'log_stash'], ['Cereri Stash', 'stash_requests'], ['Log cereri Stash', 'log_stash_requests'], ['Donații Stash', 'stash_donations'], ['Log donații Stash', 'log_stash_donations'],
].map(([name, value]) => ({ name, value }));
const commands = [{
  name: 'panel', description: 'Manage Panel Pro server tools', options: [
    { type: 1, name: 'status', description: 'Verifică toate canalele configurate' },
    { type: 1, name: 'ajutor', description: 'Ghid pentru configurarea embedurilor și butoanelor' },
    { type: 1, name: 'activitate', description: 'Pornește Panel Pro Activity în canal' },
    { type: 1, name: 'ticket', description: 'Deschide un ticket privat pentru suport' },
    { type: 1, name: 'publica', description: 'Publică un embed cu butoane', options: [{ type: 3, name: 'modul', description: 'Embedul de publicat', required: true, choices: [['Anunțuri organizație', 'organization'], ['Anunțuri angajați', 'departments'], ['Pontaj', 'pontaj'], ['Învoiri organizație', 'requests_organization'], ['Învoiri angajați', 'requests_departments'], ['Contracte', 'contracts'], ['Marketplace', 'discovery_marketplace'], ['Marketplace ilegal', 'illegal_marketplace'], ['Evenimente și remindere', 'event_reminders'], ['Raport săptămânal pontaj', 'weekly_reports'], ['Raport săptămânal contracte', 'contract_identity_weekly'], ['Status live', 'status_live'], ['Stash', 'stash'], ['Cereri Stash', 'stash_requests'], ['Donații Stash', 'stash_donations']].map(([name, value]) => ({ name, value })) }] },
    { type: 1, name: 'config', description: 'Configurează embedul și canalul de log', options: [{ type: 3, name: 'modul', description: 'Modulul pentru canal', required: true, choices: routeChoices }, { type: 7, name: 'canal', description: 'Canalul pentru embedul cu butoane', required: true, channel_types: [0] }, { type: 7, name: 'canal_log', description: 'Canalul pentru rezultate și loguri', required: false, channel_types: [0] }] },
  ],
}];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(request) });
  if (request.method !== 'POST') return reply(request, { error: 'Metodă invalidă.' }, 405);
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));
    let session: any = null;
    try { session = await requirePanelSession(db, request, 0, true); } catch (_) {}
    if (!session && body.access_token) { const response = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${String(body.access_token).slice(0, 500)}` } }); const user = response.ok ? await response.json().catch(() => ({})) : null; if (user?.id) session = { discord_id: String(user.id), organization_id: null }; }
    if (!session || !(await isPlatformAdminAccount(db, session.discord_id))) return reply(request, { error: 'Acces permis doar administratorului platformei.' }, 403);
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) return reply(request, { error: 'Tokenul botului Discord nu este configurat.' }, 409);
    // Discovery are Application ID separat de botul Panel Pro. Nu alegem
    // primul client_id din organizații, deoarece poate aparține celuilalt bot.
    let applicationId = String(Deno.env.get('DISCORD_DISCOVERY_APPLICATION_ID') || Deno.env.get('DISCORD_APPLICATION_ID') || '1531023771211792384').trim();
    // Folosim aplicația asociată tokenului botului; Discord respinge comenzile dacă ID-ul nu corespunde tokenului.
    const botIdentityResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: Bot  } });
    const botIdentity = botIdentityResponse.ok ? await botIdentityResponse.json().catch(() => ({})) : {};
    if (/^\\d{15,22}$/.test(String(botIdentity?.id || ''))) applicationId = String(botIdentity.id);
