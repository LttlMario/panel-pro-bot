(() => {
  'use strict';

  const page = location.pathname.split('/').pop() || 'administrare-boturi-discord.html';
  const header = document.getElementById('bot-header');
  const sidebar = document.getElementById('bot-sidebar');
  const footer = document.getElementById('bot-footer');

  if (header) {
    header.innerHTML = '<a class="brand" href="administrare-boturi-discord.html"><img src="img/logo-192.png" alt="Panel Pro Bot"><span><small>Discord only</small>Panel Pro Bot</span></a><span class="header-status">Dashboard administrare bot</span>';
  }

  if (sidebar) {
    sidebar.innerHTML = `<p class="side-title">Panou de control</p><nav class="side-nav" aria-label="Navigație principală"><a class="${page === 'administrare-boturi-discord.html' ? 'active' : ''}" href="administrare-boturi-discord.html">📊 Dashboard</a><a class="${page === 'configurare-bot.html' ? 'active' : ''}" href="configurare-bot.html">⚙️ Configurare bot</a><a class="${page === 'discord-bot-reclama-demo.html' ? 'active' : ''}" href="discord-bot-reclama-demo.html">📘 Despre Panel Pro Bot</a></nav><div class="side-divider"></div><nav class="side-nav" aria-label="Linkuri utile"><a href="index.html">↪ Schimbă contul Discord</a><a href="https://panel-pro.ro" target="_blank" rel="noopener">🌐 Panel Pro Web</a></nav>`;
  }

  if (footer) {
    footer.innerHTML = '<span><strong>Panel Pro Bot</strong> · administrare Discord separată</span><span>© 2026 Panel Pro</span>';
  }
})();
