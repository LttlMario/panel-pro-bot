(() => {
  'use strict';
  const API = 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/manage-discord-bot';
  const KEY = 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0';
  const APPLICATION_ID = '1531023771211792384';
  const state = { guilds: [], busy: false, platformAdmin: false };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const token = () => sessionStorage.getItem('discovery_access_token') || sessionStorage.getItem('discord_bot_admin_token') || '';
  const status = (message, kind = '') => { $('status').textContent = message; $('status').className = `status ${kind}`; };
  const call = async (body) => {
    const accessToken = token();
    if (!accessToken) throw new Error('Sesiunea Discord lipsește. Intră din nou prin login cu Discord.');
    const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ ...body, access_token: accessToken, application_id: APPLICATION_ID }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Serverele Discovery nu au putut fi încărcate.');
    return result;
  };
  const plan = (guild) => guild.plan === 'premium' ? 'Premium activ' : guild.plan === 'trial' ? 'Trial activ · 30 zile' : 'Free · Pontaj și învoiri';
  const render = () => {
    const query = String($('search').value || '').trim().toLowerCase();
    const rows = state.guilds.filter((g) => [g.name, g.id, g.owner ? 'owner' : '', g.plan].join(' ').toLowerCase().includes(query));
    $('list').innerHTML = rows.length ? rows.map((g) => `<article class="bot-card"><p class="eyebrow">Panel Pro Bot · Supabase separat</p><h2>${esc(g.name || 'Server Discord')}</h2><p class="meta">Guild ID: <code>${esc(g.id)}</code><br>${state.platformAdmin ? 'Administrator global' : g.owner ? 'Owner server' : 'Server administrabil'} · ${esc(plan(g))}</p><div class="badges"><span class="badge live">Instalat</span><span class="badge">${esc(plan(g))}</span></div><div class="card-actions"><a class="button cyan" href="discord-bot-discovery.html?guild_id=${encodeURIComponent(g.id)}">⚙️ Configurează botul</a>${state.platformAdmin ? `<button class="button" type="button" data-global="rename" data-guild="${esc(g.id)}">✏️ Redenumește</button><button class="button" type="button" data-global="trial" data-guild="${esc(g.id)}">⏱ +30 zile Trial</button><button class="button" type="button" data-global="premium" data-guild="${esc(g.id)}">⭐ Acordă Premium</button><button class="button" type="button" data-global="remove" data-guild="${esc(g.id)}">🗑️ Elimină instalarea</button>` : ''}</div></article>`).join('') : '<div class="empty">Nu există servere Panel Pro Bot eligibile pentru această sesiune Discord.</div>';
    document.querySelectorAll('[data-global]').forEach((button) => button.addEventListener('click', () => runGlobal(button.dataset.global, button.dataset.guild)));
  };
  const runGlobal = async (action, guildId) => {
    const guild = state.guilds.find((item) => item.id === guildId);
    if (!guild) return;
    if (action === 'rename') {
      const name = window.prompt('Numele nou al serverului:', guild.name || '');
      if (!name?.trim()) return;
      await performGlobal({ action: 'rename_guild', guild_id: guildId, name: name.trim() }, 'Numele serverului a fost actualizat.');
    } else if (action === 'trial') {
      if (!window.confirm(`Prelungești Trial-ul pentru ${guild.name} cu 30 de zile?`)) return;
      await performGlobal({ action: 'extend_trial', guild_id: guildId, days: 30 }, 'Trial-ul a fost prelungit cu 30 de zile.');
    } else if (action === 'premium') {
      const value = window.prompt('Număr de zile Premium (0 = fără expirare):', '30');
      if (value === null) return;
      const days = Number(value);
      if (!Number.isInteger(days) || days < 0) return status('Numărul de zile nu este valid.', 'error');
      await performGlobal({ action: 'grant_premium', guild_id: guildId, days }, 'Premium-ul a fost acordat.');
    } else if (action === 'remove') {
      if (!window.confirm(`Elimini instalarea botului din registru pentru ${guild.name}?`)) return;
      await performGlobal({ action: 'remove_installation', guild_id: guildId }, 'Instalarea a fost eliminată din registru.');
    }
  };
  const performGlobal = async (body, message) => { try { status('Se aplică operațiunea globală…'); await call(body); status(message, 'ok'); await load(); } catch (error) { status(error.message, 'error'); } };
  const load = async () => {
    if (state.busy) return;
    state.busy = true; status('Se verifică serverele în Discovery…');
    try {
      const result = await call({ action: 'bootstrap' });
      state.guilds = result.guilds || [];
      state.platformAdmin = result.platform_admin === true;
      $('global-admin').classList.toggle('hidden', !state.platformAdmin);
      render();
      const diagnostics = result.diagnostics || {};
      const failures = Array.isArray(diagnostics.bot_check_failures) ? diagnostics.bot_check_failures : [];
      const botIdentity = diagnostics.bot_identity?.id ? ` Botul Discovery detectat: ${diagnostics.bot_identity.username || diagnostics.bot_identity.id}.` : ` Tokenul botului răspunde cu HTTP ${diagnostics.bot_identity?.http_status || 0}.`;
      const detail = state.guilds.length ? botIdentity : ` Discord vede ${diagnostics.oauth_guild_count || 0} servere, dintre care ${diagnostics.owner_guild_count || 0} sunt cu owner. Botul a verificat ${diagnostics.bot_check_count || 0};${failures.length ? ` nu este instalat sau nu are acces în: ${failures.map((item) => item.guild_name || item.guild_id).join(', ')}.` : ' nu a găsit niciun server eligibil.'}${botIdentity}`;
      status(`Au fost găsite ${state.guilds.length} servere eligibile pentru botul Panel Pro Bot.${detail}`, state.guilds.length ? 'ok' : 'error');
    }
    catch (error) {
      const loginLink = !token() ? ' <a class="button cyan" href="index.html">Conectează-te cu Discord</a>' : '';
      $('list').innerHTML = `<div class="empty">${esc(error.message)}${loginLink}</div>`;
      status(error.message, 'error');
    }
    finally { state.busy = false; }
  };
  $('search').addEventListener('input', render); $('refresh').addEventListener('click', load); load();
})();
