(() => {
  const login = document.getElementById('login');
  if (!login) return;
  setTimeout(() => {
    login.onclick = () => {
      sessionStorage.removeItem('discovery_access_token');
      sessionStorage.removeItem('discord_bot_admin_token');
      const state = crypto.randomUUID();
      sessionStorage.setItem('discovery_oauth_state', state);
      const query = new URLSearchParams({
        client_id: '1531023771211792384',
        redirect_uri: location.origin + location.pathname,
        response_type: 'token',
        scope: 'identify guilds guilds.members.read',
        state,
        prompt: 'consent',
      });
      location.href = `https://discord.com/oauth2/authorize?${query}`;
    };
  }, 0);
})();
