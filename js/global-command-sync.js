(() => {
  'use strict';
  const mount = () => {
    if (sessionStorage.getItem('discovery_platform_admin') !== 'true') return false;
    const actions = document.querySelector('.grid > .panel:first-child .actions');
    if (!actions || document.getElementById('global-command-sync')) return true;
    const button = document.createElement('button');
    button.id = 'global-command-sync';
    button.type = 'button';
    button.className = 'button cyan';
    button.textContent = '🔄 Sincronizează comenzile Discord';
    actions.appendChild(button);
    button.onclick = async () => {
    button.disabled = true;
    button.textContent = '⏳ Se sincronizează…';
    try {
      const response = await fetch('https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/sync-discord-commands', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0' }, body: JSON.stringify({ access_token: sessionStorage.getItem('discovery_access_token') || sessionStorage.getItem('discord_bot_admin_token') || '', application_id: '1531023771211792384' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Comenzile Discord nu au putut fi sincronizate.');
      button.textContent = `✅ Comenzi sincronizate${data.guild_count ? ` · ${data.guild_count} servere` : ''}`;
    } catch (error) {
      button.disabled = false;
      button.textContent = '🔄 Sincronizează comenzile Discord';
      const status = document.getElementById('status');
      if (status) { status.textContent = error.message; status.className = 'status error'; }
    }
    };
    return true;
  };
  if (!mount()) {
    let attempts = 0;
    const timer = setInterval(() => { if (mount() || ++attempts >= 30) clearInterval(timer); }, 500);
  }
})();
