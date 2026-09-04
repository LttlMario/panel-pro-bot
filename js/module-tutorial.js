(() => {
  'use strict';
  const API = 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/manage-discord-bot';
  const KEY = 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0';
  const token = () => sessionStorage.getItem('discovery_access_token') || sessionStorage.getItem('discord_bot_admin_token') || '';
  const status = document.getElementById('tutorial-status');
  const content = document.getElementById('tutorial-content');
  const verify = async () => {
    try {
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ action: 'custom_modules', access_token: token(), application_id: '1531023771211792384' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Accesul nu a putut fi verificat.');
      if (data.platform_admin !== true) throw new Error('Acces permis doar administratorului global.');
      sessionStorage.setItem('discovery_platform_admin', 'true');
      const nav = document.querySelector('#bot-sidebar .side-nav');
      if (nav && !nav.querySelector('a[href="administrare-module-tutorial.html"]')) nav.insertAdjacentHTML('beforeend', '<a href="administrare-module-tutorial.html" class="active">📘 Tutorial module</a>');
      content.hidden = false;
      status.textContent = 'Tutorial disponibil pentru administratorul global.';
      status.className = 'status ok';
    } catch (error) {
      status.textContent = error.message;
      status.className = 'status error';
      content.hidden = true;
      setTimeout(() => { location.replace('administrare-globala.html'); }, 1200);
    }
  };
  verify();
})();
