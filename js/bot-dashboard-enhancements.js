(() => {
  'use strict';
  const API = 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/manage-discord-bot';
  const KEY = 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0';
  const APP = '1531023771211792384';
  const token = () => sessionStorage.getItem('discovery_access_token') || sessionStorage.getItem('discord_bot_admin_token') || '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const call = async (body) => {
    const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ ...body, view_scope: 'personal', access_token: token(), application_id: APP }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Dashboardul nu a putut încărca detaliile serverului.');
    return data;
  };
  const style = document.createElement('style');
  style.textContent = '.server-overview{margin-top:14px;padding:13px;border:1px solid #263b58;border-radius:14px;background:#081426}.server-overview-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.server-overview-stat{padding:8px;border:1px solid #263b58;border-radius:9px;background:#0b1729;font-size:10px}.server-overview-stat strong{display:block;color:#e2e8f0;font-size:12px}.server-overview-list{margin:10px 0 0;padding:0;list-style:none;font-size:10px;color:#9fb0c5}.server-overview-list li{padding:4px 0;border-bottom:1px solid #1e3552}.server-overview-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.server-overview .button{padding:7px 9px;font-size:10px}@media(max-width:700px){.server-overview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.appendChild(style);
  const badge = (ok, yes = 'OK', no = 'Lipsește') => `<span style="color:${ok ? '#6ee7b7' : '#fda4af'}">${ok ? '✓' : '⚠'} ${yes === 'OK' && !ok ? no : yes}</span>`;
  const render = (card, data) => {
    const plan = data.subscription?.plan === 'premium' ? 'Premium' : data.subscription?.plan === 'trial' ? 'Trial activ' : 'Free';
    const missing = data.bot?.missing_permissions || [];
    const modules = (data.modules || []).slice(0, 8).map((module) => `<li>${module.active ? '✅' : '⏸️'} ${esc(module.label)} · ${module.premium && plan === 'Free' ? '<span style="color:#fbbf24">Premium</span>' : badge(module.embed_configured && (module.key === 'status_live' || module.log_configured), 'configurat', 'neconfigurat')}</li>`).join('') || '<li>Nu există module disponibile.</li>';
    const activity = (data.activity || []).slice(0, 5).map((item) => `<li>📝 ${esc(item.subject || item.module_key)} · ${esc(item.status)} · ${esc(new Date(item.created_at).toLocaleString('ro-RO'))}</li>`).join('') || '<li>Nu există activitate recentă.</li>';
    const permissions = missing.length ? `⚠️ Permisiuni lipsă: ${missing.map(esc).join(', ')}` : '✅ Permisiunile de bază sunt disponibile';
    const node = card.querySelector('.server-overview');
    if (!node) return;
    node.innerHTML = `<div class="server-overview-grid"><div class="server-overview-stat"><strong>${data.bot?.online ? '🟢 Online' : '🔴 Offline'}</strong>Bot Discord</div><div class="server-overview-stat"><strong>${esc(plan)}</strong>${data.subscription?.premium_ends_at ? `Expiră ${esc(new Date(data.subscription.premium_ends_at).toLocaleDateString('ro-RO'))}` : data.subscription?.trial_ends_at ? `Trial până la ${esc(new Date(data.subscription.trial_ends_at).toLocaleDateString('ro-RO'))}` : 'Acces de bază'}</div><div class="server-overview-stat"><strong>${data.modules?.filter((item) => item.embed_configured).length || 0}/${data.modules?.length || 0}</strong>Embeduri configurate</div><div class="server-overview-stat"><strong>${data.channels?.total || 0}</strong>Canale disponibile</div></div><p class="meta" style="margin:9px 0 0">${permissions}</p><details style="margin-top:9px"><summary style="cursor:pointer;font-size:11px;color:#cbd5e1">Module și activitate</summary><strong style="display:block;margin-top:8px;font-size:11px">Module</strong><ul class="server-overview-list">${modules}</ul><strong style="display:block;margin-top:8px;font-size:11px">Activitate recentă</strong><ul class="server-overview-list">${activity}</ul></details><div class="server-overview-actions"><button class="button cyan" data-repair-server type="button">🛠️ Repară configurația</button><a class="button" href="configurare-server.html?guild_id=${encodeURIComponent(card.dataset.guildId)}">⚙️ Configurează serverul</a></div>`;
    node.querySelector('[data-repair-server]')?.addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; button.textContent = 'Se repară…'; try { const repaired = await call({ action: 'repair_guild', guild_id: card.dataset.guildId }); render(card, repaired); } catch (error) { button.disabled = false; button.textContent = '🛠️ Repară configurația'; node.querySelector('.meta').textContent = error.message; } });
  };
  const hydrate = async (card) => { if (card.dataset.dashboardLoaded) return; const link = card.querySelector('a[href*="configurare-server.html?guild_id="]'); if (!link) return; const match = link.href.match(/[?&]guild_id=([^&]+)/); if (!match) return; card.dataset.guildId = decodeURIComponent(match[1]); card.dataset.dashboardLoaded = 'loading'; const node = document.createElement('section'); node.className = 'server-overview'; node.innerHTML = '<p class="meta">Se verifică statusul botului și configurația…</p>'; card.appendChild(node); try { render(card, await call({ action: 'dashboard_overview', guild_id: card.dataset.guildId })); card.dataset.dashboardLoaded = 'true'; } catch (error) { node.innerHTML = `<p class="meta" style="color:#fda4af">${esc(error.message)}</p>`; card.dataset.dashboardLoaded = 'error'; } };
  const scan = () => document.querySelectorAll('#list .bot-card').forEach(hydrate);
  const observer = new MutationObserver(scan); observer.observe(document.getElementById('list') || document.body, { childList: true, subtree: true });
  scan(); setInterval(scan, 1200);
})();

// Ownerul poate acorda acces la dashboard prin roluri Discord de pe server.
(() => {
  const API = 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/manage-discord-bot';
  const KEY = 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0';
  const APP = '1531023771211792384';
  const token = () => sessionStorage.getItem('discovery_access_token') || sessionStorage.getItem('discord_bot_admin_token') || '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  async function call(body) {
    const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ ...body, view_scope: 'personal', access_token: token(), application_id: APP }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Accesul nu a putut fi încărcat.');
    return data;
  }
  const addAccess = async (card) => {
    const overview = card.querySelector('.server-overview');
    const actions = overview?.querySelector('.server-overview-actions');
    if (!overview || !actions || actions.dataset.accessReady) return;
    actions.dataset.accessReady = 'loading';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'button'; button.textContent = '👥 Gestionează accesul';
    actions.appendChild(button);
    button.addEventListener('click', async () => {
      button.disabled = true; button.textContent = 'Se încarcă rolurile…';
      try {
        const data = await call({ action: 'admin_roles', guild_id: card.dataset.guildId });
        const selected = new Set((data.role_ids || []).map(String));
        const panel = document.createElement('div'); panel.className = 'server-access-panel';
        panel.innerHTML = `<strong>Acces dashboard prin roluri Discord</strong><p class="meta">Selectează rolurile ai căror membri pot configura botul pe acest server.</p><div class="server-access-roles">${(data.roles || []).map((role) => `<label><input type="checkbox" value="${esc(role.id)}" ${selected.has(String(role.id)) ? 'checked' : ''}> ${esc(role.name)}</label>`).join('') || '<span class="meta">Nu există roluri disponibile.</span>'}</div><hr><strong>Acces individual, fără rol</strong><p class="meta">Introdu Discord User ID-ul persoanei. Persoana trebuie să fie membră pe server.</p><div class="server-access-member-add"><input data-member-input placeholder="Discord User ID" inputmode="numeric"><button type="button" class="button" data-add-member>＋ Adaugă</button></div><div data-member-list class="server-access-members"></div><div class="server-overview-actions"><button type="button" class="button cyan" data-save-access>💾 Salvează rolurile</button><button type="button" class="button cyan" data-save-members>💾 Salvează persoanele</button><button type="button" class="button" data-close-access>Închide</button><span class="meta" data-access-status></span></div>`;
        overview.appendChild(panel);
        const memberIds = new Set((data.member_ids || []).map(String));
        const memberList = panel.querySelector('[data-member-list]');
        const renderMembers = () => { memberList.innerHTML = [...memberIds].map((memberId) => `<span class="server-access-member">${esc(memberId)} <button type="button" data-remove-member="${esc(memberId)}">×</button></span>`).join('') || '<span class="meta">Nu există acces individual acordat.</span>'; memberList.querySelectorAll('[data-remove-member]').forEach((remove) => { remove.onclick = () => { memberIds.delete(remove.dataset.removeMember); renderMembers(); }; }); };
        renderMembers();
        panel.querySelector('[data-add-member]').onclick = () => { const input = panel.querySelector('[data-member-input]'); const value = String(input.value || '').trim(); if (!/^\d{15,22}$/.test(value)) { panel.querySelector('[data-access-status]').textContent = 'Introdu un Discord User ID valid.'; return; } memberIds.add(value); input.value = ''; renderMembers(); };
        panel.querySelector('[data-close-access]').onclick = () => panel.remove();
        panel.querySelector('[data-save-access]').onclick = async (event) => {
          const save = event.currentTarget; save.disabled = true;
          const status = panel.querySelector('[data-access-status]');
          try {
            const role_ids = [...panel.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
            await call({ action: 'save_admin_roles', guild_id: card.dataset.guildId, role_ids });
            if (status) status.textContent = 'Accesul a fost salvat.';
          } catch (error) { if (status) status.textContent = error.message; save.disabled = false; }
        };
        panel.querySelector('[data-save-members]').onclick = async (event) => { const save = event.currentTarget; save.disabled = true; const status = panel.querySelector('[data-access-status]'); try { await call({ action: 'save_admin_members', guild_id: card.dataset.guildId, member_ids: [...memberIds] }); if (status) status.textContent = 'Accesul individual a fost salvat.'; } catch (error) { if (status) status.textContent = error.message; save.disabled = false; } };
        button.textContent = '👥 Gestionează accesul';
      } catch (error) { button.textContent = error.message; }
      button.disabled = false;
    });
    actions.dataset.accessReady = 'ready';
  };
  const scan = () => document.querySelectorAll('#list .bot-card').forEach(addAccess);
  const style = document.createElement('style');
  style.textContent = '.server-access-panel{margin-top:10px;padding:11px;border:1px solid #263b58;border-radius:10px;background:#0b1729;font-size:11px}.server-access-panel p{margin:5px 0}.server-access-panel hr{border:0;border-top:1px solid #263b58;margin:12px 0}.server-access-roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.server-access-roles label{padding:6px;border:1px solid #263b58;border-radius:7px;color:#cbd5e1}.server-access-roles input{accent-color:#22d3ee}.server-access-member-add{display:flex;gap:7px;margin-top:8px}.server-access-member-add input{min-width:0;flex:1;border:1px solid #334155;border-radius:8px;background:#07101f;color:#e2e8f0;padding:7px}.server-access-members{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.server-access-member{padding:5px 7px;border:1px solid #36516f;border-radius:7px;color:#cbd5e1}.server-access-member button{border:0;background:transparent;color:#fda4af;cursor:pointer}@media(max-width:700px){.server-access-roles{grid-template-columns:1fr}.server-access-member-add{flex-direction:column}}';
  document.head.appendChild(style);
  new MutationObserver(scan).observe(document.getElementById('list') || document.body, { childList: true, subtree: true });
  setInterval(scan, 1500);
})();

// Modulele pot fi activate/dezactivate direct din dashboardul serverului.
(() => {
  const API = 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/manage-discord-bot';
  const KEY = 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0';
  const APP = '1531023771211792384';
  const token = () => sessionStorage.getItem('discovery_access_token') || sessionStorage.getItem('discord_bot_admin_token') || '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  async function load(guildId, body = {}) {
    const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ action: 'dashboard_overview', guild_id: guildId, ...body, view_scope: 'personal', access_token: token(), application_id: APP }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Nu s-a putut salva modulul.');
    return data;
  }
  const decorate = async (card) => {
    const overview = card.querySelector('.server-overview');
    if (!overview || overview.dataset.moduleToggles) return;
    overview.dataset.moduleToggles = 'loading';
    try {
      const data = await load(card.dataset.guildId);
      const list = overview.querySelector('.server-overview-list');
      if (!list) return;
      const plan = data.subscription?.plan || 'free';
      list.innerHTML = (data.modules || []).map((module) => {
        const locked = module.premium && plan === 'free';
        const configured = module.embed_configured && (module.key === 'status_live' || module.log_configured);
        const checked = module.enabled !== false && module.active !== false && configured;
        return `<li><label style="display:flex;align-items:center;gap:7px;flex:1"><input type="checkbox" data-dashboard-module="${esc(module.key)}" ${checked ? 'checked' : ''} ${!configured || locked ? 'disabled' : ''}><span>${esc(module.label)}</span></label><span>${locked ? '🔒 Premium' : configured ? (checked ? '✅ Activ' : '⏸️ Inactiv') : '⚠️ Configurează canalul'}</span></li>`;
      }).join('') || '<li>Nu există module disponibile.</li>';
      list.querySelectorAll('[data-dashboard-module]').forEach((toggle) => toggle.addEventListener('change', async () => {
        const previous = !toggle.checked;
        toggle.disabled = true;
        try {
          await load(card.dataset.guildId, { action: 'set_module_enabled', module_key: toggle.dataset.dashboardModule, enabled: toggle.checked });
          toggle.closest('li').querySelector('span:last-child').textContent = toggle.checked ? '✅ Activ' : '⏸️ Inactiv';
        } catch (error) {
          toggle.checked = previous;
          toggle.closest('li').querySelector('span:last-child').textContent = error.message;
        } finally { toggle.disabled = false; }
      }));
      overview.dataset.moduleToggles = 'ready';
    } catch (_) { overview.dataset.moduleToggles = 'error'; }
  };
  const scan = () => document.querySelectorAll('#list .bot-card').forEach((card) => decorate(card));
  new MutationObserver(scan).observe(document.getElementById('list') || document.body, { childList: true, subtree: true });
  setInterval(scan, 1500);
})();
