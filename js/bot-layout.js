(() => {
  'use strict';

  const page = location.pathname.split('/').pop() || 'administrare-boturi-discord.html';
  const header = document.getElementById('bot-header');
  const sidebar = document.getElementById('bot-sidebar');
  const footer = document.getElementById('bot-footer');
  const token = () => sessionStorage.getItem('discovery_access_token') || sessionStorage.getItem('discord_bot_admin_token') || '';

  if (header) {
    header.innerHTML = '<a class="brand" href="administrare-boturi-discord.html"><img src="img/logo-192.png" alt="Panel Pro Bot"><span><small>Discord only</small>Panel Pro Bot</span></a><span class="header-status">Dashboard administrare bot</span>';
  }

  if (sidebar) {
    sidebar.innerHTML = `<p class="side-title">Panou de control</p><nav class="side-nav" aria-label="Navigație principală"><a class="${page === 'administrare-boturi-discord.html' ? 'active' : ''}" href="administrare-boturi-discord.html">📊 Dashboard</a><a class="${page === 'configurare-bot.html' ? 'active' : ''}" href="configurare-bot.html">⚙️ Configurare bot</a><a class="${page === 'discord-bot-reclama-demo.html' ? 'active' : ''}" href="discord-bot-reclama-demo.html">📘 Despre Panel Pro Bot</a></nav><div class="side-divider"></div><nav class="side-nav" aria-label="Linkuri utile"><a href="https://panel-pro.ro" target="_blank" rel="noopener">🌐 Panel Pro Web</a></nav><section class="bot-profile" aria-label="Profil utilizator"><div class="bot-profile-main"><div class="bot-avatar" id="bot-avatar">◉</div><div><strong id="bot-user-name">Cont Discord</strong><small id="bot-user-id">Conectat</small></div></div><button class="profile-action" id="bot-theme" type="button">☀️ Schimbă tema</button><button class="profile-action danger" id="bot-logout" type="button">↪ Deconectare</button></section>`;
    const theme = localStorage.getItem('panel-pro-bot-theme') || 'dark';
    document.documentElement.dataset.theme = theme;
    const style = document.createElement('style');
    style.textContent = `.bot-profile{margin-top:auto;padding:12px 10px;border:1px solid #203650;border-radius:14px;background:#0b1a2d}.bot-profile-main{display:flex;align-items:center;gap:9px;margin-bottom:10px}.bot-avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#5865f2,#22d3ee);color:white;font-size:12px;font-weight:900}.bot-profile strong{display:block;color:#e2e8f0;font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bot-profile small{display:block;color:#71859f;font-size:10px;margin-top:2px}.profile-action{display:block;width:100%;margin-top:6px;border:1px solid #294460;border-radius:8px;background:#10243a;color:#cbd5e1;padding:7px;text-align:left;font-size:10px;font-weight:800;cursor:pointer}.profile-action:hover{border-color:#67e8f9;color:#cffafe}.profile-action.danger{color:#fda4af}.app-shell[data-theme="light"],html[data-theme="light"] .app-shell{background:#eef4fb!important;color:#0f172a}html[data-theme="light"] .content .bot-admin-hero,html[data-theme="light"] .content .bot-card,html[data-theme="light"] .content .toolbar-card,html[data-theme="light"] .content .hero,html[data-theme="light"] .content .module{background:#fff!important;border-color:#bfd0e3!important;color:#0f172a}html[data-theme="light"] .content p,html[data-theme="light"] .content label,html[data-theme="light"] .content h1,html[data-theme="light"] .content h2{color:#0f172a}html[data-theme="light"] .sidebar{background:#fff;border-color:#bfd0e3}html[data-theme="light"] .app-header{background:#fff;border-color:#bfd0e3}html[data-theme="light"] .bot-profile{background:#f1f6fb;border-color:#bfd0e3}html[data-theme="light"] .bot-profile strong{color:#0f172a}`;
    document.head.appendChild(style);
    document.getElementById('bot-theme')?.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = next; localStorage.setItem('panel-pro-bot-theme', next); });
    document.getElementById('bot-logout')?.addEventListener('click', () => { sessionStorage.removeItem('discovery_access_token'); sessionStorage.removeItem('discord_bot_admin_token'); sessionStorage.removeItem('discord_access_token'); location.href = 'index.html'; });
    if (token()) fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token()}` } }).then((response) => response.ok ? response.json() : null).then((user) => { if (!user) return; const name = user.global_name || user.username || 'Cont Discord'; document.getElementById('bot-user-name').textContent = name; document.getElementById('bot-user-id').textContent = `ID: ${user.id}`; document.getElementById('bot-avatar').textContent = name.slice(0, 1).toUpperCase(); }).catch(() => {});
  }

  if (footer) {
    footer.innerHTML = '<span><strong>Panel Pro Bot</strong> · administrare Discord separată</span><span>© 2026 Panel Pro</span>';
  }
})();
