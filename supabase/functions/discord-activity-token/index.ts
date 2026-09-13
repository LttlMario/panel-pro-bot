import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const clientId = '1531023771211792384';
const cors = { 'Access-Control-Allow-Origin': 'https://bot.panel-pro.ro', 'Access-Control-Allow-Headers': 'content-type,apikey', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) return reply({ error: 'Cheia Supabase lipsește.' }, 500);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const secret = await getPlatformSecret(db, 'discord_client_secret');
    if (!secret) return reply({ error: 'DISCORD_CLIENT_SECRET nu este configurat pentru autentificarea Activity.' }, 503);
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    if (!code || code.length > 500) return reply({ error: 'Codul Discord lipsește sau este invalid.' }, 400);
    const form = new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: 'authorization_code', code, redirect_uri: 'https://127.0.0.1' });
    const response = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) return reply({ error: 'Discord nu a putut autentifica Activity.', details: payload }, 400);
    return reply({ access_token: payload.access_token, token_type: payload.token_type, expires_in: payload.expires_in });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500); }
});
