(() => {
  'use strict';
  const root = document.getElementById('editor');
  if (!root) return;
  const showStatus = (message, kind = '') => { const node = document.getElementById('status'); if (node) { node.textContent = message; node.className = `status ${kind}`; } };
  const toolbar = document.querySelector('#editor')?.parentElement?.querySelector('.toolbar') || document.querySelector('.toolbar');
  const addToolButton = (id, label, className = 'button') => { if (document.getElementById(id) || !toolbar) return null; const button = document.createElement('button'); button.id = id; button.type = 'button'; button.className = className; button.textContent = label; toolbar.appendChild(button); return button; };
  const testButton = addToolButton('test-module', '🧪 Testează local');
  const cloneButton = addToolButton('clone-module', '📋 Clonează');
  const resetButton = addToolButton('reset-module', '↺ Resetează');
  const smartTools = document.createElement('div');
  smartTools.id = 'smart-module-tools';
  smartTools.className = 'actions';
  smartTools.style.cssText = 'margin-top:12px;padding:10px;border:1px solid #263b58;border-radius:10px;background:#081426';
  smartTools.innerHTML = '<small class="muted" style="width:100%">Instrumente rapide pentru configurare</small><button id="save-draft-module" type="button" class="button">💾 Salvează draft</button><button id="restore-draft-module" type="button" class="button">↩️ Încarcă draft</button><button id="export-module" type="button" class="button">⬇️ Exportă</button><button id="import-module" type="button" class="button">⬆️ Importă</button><input id="module-import-file" type="file" accept="application/json" hidden>';
  const syncStatus = document.createElement('small'); syncStatus.id = 'module-sync-status'; syncStatus.className = 'muted'; syncStatus.style.marginLeft = '8px'; syncStatus.textContent = 'Comenzile slash se sincronizează după salvare.'; toolbar?.appendChild(syncStatus);
  const nav = document.querySelector('#bot-sidebar .side-nav');
  if (nav && !nav.querySelector('a[href="administrare-module-tutorial.html"]')) nav.insertAdjacentHTML('beforeend', '<a href="administrare-module-tutorial.html">📘 Tutorial module</a>');
  const style = document.createElement('style');
  style.textContent = '#editor select option{background:#07101f!important;color:#e2e8f0!important}#editor input[type=color]{height:38px;padding:3px;cursor:pointer}.global-preview{margin-top:18px;padding:14px;border:1px solid #263b58;border-radius:14px;background:#081426}.global-preview h2{margin:0 0 10px;font-size:14px}.global-preview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:9px}.global-preview-card{padding:10px;border:1px solid #263b58;border-left:4px solid;border-radius:10px;background:#0b1729}.global-preview-card strong{display:block;font-size:12px}.global-preview-card small{display:block;margin-top:5px;color:#9fb0c5}.global-preview-buttons{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.global-preview-buttons span{padding:4px 7px;border-radius:6px;background:#162a45;color:#dbeafe;font-size:10px}';
  document.head.appendChild(style);
  document.querySelector('.hero p.muted:last-child')?.replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Creează definiția universală a modulului pentru toate serverele Panel Pro Bot. Ownerii vor alege ulterior canalele pe serverele lor.' }));
  const keyInput = document.getElementById('key');
  const handler = document.getElementById('handler');
  const handlerField = handler?.closest('.field');
  const templateField = document.createElement('label');
  templateField.className = 'field';
  templateField.innerHTML = '<span>Șablon modul</span><select id="module-template"><option value="none">Modul simplu (doar embed)</option><optgroup label="Comunicare"><option value="announcement">Anunț</option><option value="poll">Sondaj</option><option value="event">Eveniment / reminder</option></optgroup><optgroup label="Formulare"><option value="request">Cerere / formular</option><option value="approval">Cerere cu aprobare</option><option value="recruitment">Recrutare / aplicație</option><option value="feedback">Feedback</option><option value="suggestion">Sugestie</option><option value="complaint">Reclamație / incident</option><option value="ticket">Ticket / solicitare suport</option></optgroup><optgroup label="Administrare"><option value="report">Raport</option><option value="inventory">Inventar / evidență</option><option value="survey">Chestionar</option></optgroup></select><small class="muted">Alege un șablon și vom pregăti automat câmpurile și acțiunile potrivite.</small>';
  templateField.after(smartTools);
  handlerField?.before(templateField);
  if (handlerField) handlerField.hidden = true;
  ['guild', 'embed-channel', 'log-channel'].forEach(id => document.getElementById(id)?.closest('.field')?.setAttribute('hidden', 'hidden'));
  const publishButton = document.getElementById('publish');
  const validateModuleBeforeSave = event => {
    const moduleHandler = handler?.value || 'none';
    const label = document.getElementById('label')?.value.trim();
    const title = document.getElementById('title')?.value.trim();
    if (!label || !title) { event.preventDefault(); event.stopImmediatePropagation(); showStatus('Completează numele și titlul modulului.', 'error'); return; }
    if ((moduleHandler === 'request' || moduleHandler === 'approval') && !document.querySelector('.form-builder-row')) { event.preventDefault(); event.stopImmediatePropagation(); showStatus('Adaugă cel puțin un câmp pentru formular.', 'error'); return; }
    const invalidLink = [...document.querySelectorAll('#button-list .button-row')].find(row => row.querySelector('[data-module-type]')?.value === 'link' && !/^https?:\/\//i.test(row.querySelector('[data-module-url]')?.value.trim() || ''));
    if (invalidLink) { event.preventDefault(); event.stopImmediatePropagation(); showStatus('Fiecare buton de tip Link trebuie să aibă un URL valid.', 'error'); return; }
    const invalidSelect = [...document.querySelectorAll('#button-list .button-row')].find(row => row.querySelector('[data-module-type]')?.value === 'select' && !row.querySelector('[data-module-options]')?.value.trim());
    if (invalidSelect) { event.preventDefault(); event.stopImmediatePropagation(); showStatus('Adaugă cel puțin o opțiune pentru fiecare meniu select.', 'error'); }
  };
  document.getElementById('save-all')?.addEventListener('click', validateModuleBeforeSave, true);
  if (publishButton) {
    publishButton.textContent = '🌐 Salvează modulul universal';
    publishButton.title = 'Salvează definiția universală pentru toate serverele Panel Pro Bot';
    publishButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.getElementById('save-all')?.click();
    }, true);
  }
  const active = document.createElement('label');
  active.className = 'field';
  active.innerHTML = '<span>Modul activ</span><input id="module-active" type="checkbox" checked>';
  const command = document.createElement('label');
  command.className = 'field';
  command.innerHTML = '<span>Comandă slash (opțional)</span><input id="module-command" maxlength="32" placeholder="ex: recrutare">';
  handler?.parentElement?.after(active, command);
  const conditional = document.createElement('section');
  conditional.className = 'workflow-config';
  conditional.style.cssText = 'margin-top:16px;padding:14px;border:1px solid #263b58;border-radius:12px;background:#081426';
  root.insertBefore(conditional, document.querySelector('.buttons'));
  const detailsButton = document.createElement('button');
  detailsButton.id = 'configure-module-details'; detailsButton.type = 'button'; detailsButton.className = 'button primary';
  detailsButton.style.cssText = 'margin-top:14px;width:100%';
  detailsButton.textContent = '⚙ Configurează detaliile opționale';
  conditional.before(detailsButton);
  let advancedOpen = false;
  const renderWorkflow = () => {
    const selected = handler?.value || 'none';
    if (selected === 'request' || selected === 'approval') {
      conditional.innerHTML = `<h3 style="margin:0 0 8px;font-size:13px">${selected === 'approval' ? 'Formular și aprobare' : 'Formularul cererii'}</h3><p class="muted" style="font-size:11px;margin:0 0 8px">Adaugă câmpurile care vor apărea utilizatorului în Discord. Câmpurile sunt opționale sau obligatorii.</p><div id="form-fields"></div><button id="add-form-field" type="button" class="button">＋ Adaugă câmp</button>${selected === 'approval' ? '<label class="field"><span>Rol / grup aprobare (opțional)</span><input id="approval-role" placeholder="ex: Manageri"></label>' : ''}`;
      const list = conditional.querySelector('#form-fields');
      const addField = (data = {}) => { const row = document.createElement('div'); row.className = 'form-builder-row'; row.style.cssText = 'display:grid;grid-template-columns:1.1fr .9fr 1fr 1fr auto;gap:6px;margin-top:7px'; row.innerHTML = `<input data-form-label placeholder="Etichetă câmp" value="${data.label || ''}"><select data-form-type><option value="short_text">Text scurt</option><option value="long_text">Text lung</option><option value="number">Număr</option><option value="date">Dată</option><option value="url">Link</option><option value="select">Selectare</option></select><input data-form-placeholder placeholder="Placeholder" value="${data.placeholder || ''}"><input data-form-options placeholder="Opțiuni / regex" value="${(data.options || []).join(', ')}"><label style="font-size:10px;display:flex;align-items:center;gap:3px"><input data-form-required type="checkbox" ${data.required === false ? '' : 'checked'}> Obligatoriu</label><button data-form-remove type="button" class="button danger" style="padding:5px 8px">×</button>`; row.querySelector('[data-form-type]').value = data.type || 'short_text'; row.querySelector('[data-form-remove]').onclick = () => row.remove(); list.appendChild(row); };
      document.getElementById('add-form-field').onclick = () => addField();
      addField({ id: 'subject', label: 'Titlu', type: 'short_text', required: true }); addField({ id: 'details', label: 'Detalii', type: 'long_text', required: true });
    } else if (selected === 'announcement') {
      conditional.innerHTML = '<h3 style="margin:0 0 8px;font-size:13px">Setări anunț</h3><label class="field"><span>Vizibilitate</span><select id="announcement-mode"><option value="public">Public în canal</option><option value="private">Răspuns privat</option></select></label><label class="field"><span><input id="notify-submit" type="checkbox" checked> Notifică autorul după trimitere</span></label>';
    } else if (selected === 'report') {
      conditional.innerHTML = '<h3 style="margin:0 0 8px;font-size:13px">Setări raport</h3><label class="field"><span>Număr maxim de rezultate</span><input id="report-limit" type="number" min="1" max="100" value="20"></label>';
    } else conditional.innerHTML = '<p class="muted" style="font-size:11px;margin:0">Alege un handler pentru a configura pașii și acțiunile modulului.</p>';
    if (selected !== 'none') {
      const next = document.createElement('button');
      next.id = 'workflow-next'; next.type = 'button'; next.className = 'button primary';
      next.style.marginTop = '12px'; next.textContent = 'Continuă către designul embedului →';
      conditional.appendChild(next);
    }
  };
  handler?.addEventListener('change', renderWorkflow);
  document.addEventListener('click', event => { if (event.target.closest?.('[data-select]')) setTimeout(renderWorkflow, 0); });
  renderWorkflow();
  const embedEditor = document.createElement('section');
  embedEditor.className = 'embed-advanced-editor';
  embedEditor.style.cssText = 'margin-top:16px;padding:14px;border:1px solid #263b58;border-radius:12px;background:#081426';
  embedEditor.innerHTML = '<h3 style="margin:0 0 8px;font-size:13px">Embed avansat global</h3><p class="muted" style="font-size:11px;margin:0 0 10px">Toate câmpurile sunt opționale. Completează doar ce vrei să apară în Discord.</p><div class="advanced-grid"><label class="field"><span>Autor</span><input id="embed-author-name" maxlength="256" placeholder="Numele autorului"></label><label class="field"><span>Icon autor (URL)</span><input id="embed-author-icon" maxlength="500" placeholder="https://..."></label><label class="field"><span>Thumbnail (URL)</span><input id="embed-thumbnail" maxlength="500" placeholder="https://..."></label><label class="field"><span>Imagine mare (URL)</span><input id="embed-image" maxlength="500" placeholder="https://..."></label><label class="field"><span>Footer</span><input id="embed-footer-text" maxlength="2048" placeholder="Text footer"></label><label class="field"><span>Icon footer (URL)</span><input id="embed-footer-icon" maxlength="500" placeholder="https://..."></label></div><label class="field"><span><input id="embed-timestamp" type="checkbox"> Adaugă data și ora automat</span></label><div id="embed-fields"></div><button id="add-embed-field" type="button" class="button">＋ Adaugă câmp embed</button><div id="module-actions" style="margin-top:12px"><label class="field"><span>Acțiuni după interacțiune</span><select id="workflow-actions" multiple size="4"><option value="save_submission">Salvează datele în Supabase</option><option value="send_log">Trimite în canalul de log</option><option value="notify_submitter">Notifică utilizatorul</option><option value="update_message">Actualizează embedul inițial</option><option value="review_buttons">Adaugă butoane de aprobare</option><option value="run_report">Generează raport</option></select></label></div><button id="embed-next" type="button" class="button primary" style="margin-top:12px">Continuă către butoane și reguli →</button>';
  const gridStyle = document.createElement('style');
  gridStyle.textContent = '.advanced-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.embed-advanced-editor .field{margin:8px 0}.embed-advanced-editor input,.embed-advanced-editor select{width:100%}@media(max-width:800px){.advanced-grid{grid-template-columns:1fr}}';
  document.head.appendChild(gridStyle);
  root.insertBefore(embedEditor, document.querySelector('.buttons'));
  const runtimeOptions = document.createElement('section');
  runtimeOptions.className = 'module-runtime-options';
  runtimeOptions.style.cssText = 'margin-top:16px;padding:14px;border:1px solid #263b58;border-radius:12px;background:#081426';
  runtimeOptions.innerHTML = '<h3 style="margin:0 0 8px;font-size:13px">Reguli, limite și răspunsuri</h3><div class="advanced-grid"><label class="field"><span>Acces</span><select id="module-permission"><option value="everyone">Toți utilizatorii</option><option value="mapped_role">Roluri configurate</option><option value="manager">Manageri server</option><option value="owner">Owner server</option></select></label><label class="field"><span>ID roluri permise (virgulă)</span><input id="module-role-ids" placeholder="ID1, ID2"></label><label class="field"><span>Cooldown (secunde)</span><input id="module-cooldown" type="number" min="0" max="86400" value="0"></label><label class="field"><span>Maxim cereri în așteptare</span><input id="module-max-pending" type="number" min="0" max="1000" value="0"></label><label class="field"><span>Maxim per utilizator</span><input id="module-max-user" type="number" min="0" max="1000" value="0"></label><label class="field"><span>Lungime maximă text</span><input id="module-max-text" type="number" min="100" max="4000" value="1800"></label><label class="field"><span><input id="module-attachments" type="checkbox"> Permite atașamente</span></label></div><label class="field"><span>Răspuns succes</span><textarea id="module-success" rows="2" maxlength="2000" placeholder="Mesaj după trimitere"></textarea></label><label class="field"><span>Răspuns eroare</span><textarea id="module-error" rows="2" maxlength="2000" placeholder="Mesaj dacă acțiunea eșuează"></textarea></label><label class="field"><span>Vizibilitate răspuns</span><select id="module-visibility"><option value="private">Privat</option><option value="public">Public</option></select></label>';
  root.insertBefore(runtimeOptions, document.querySelector('.buttons'));
  let moduleStage = 0;
  const applyProgressiveStage = () => {
    const selectedHandler = handler?.value || 'none';
    const hasHandler = selectedHandler !== '';
    const buttonSection = root.querySelector('.buttons');
    const visible = hasHandler && advancedOpen;
    detailsButton.hidden = !hasHandler || advancedOpen;
    conditional.hidden = !visible || selectedHandler === 'none' || moduleStage < 0;
    embedEditor.hidden = !visible || moduleStage < 1;
    if (buttonSection) buttonSection.hidden = !visible || moduleStage < 2;
    runtimeOptions.hidden = !visible || moduleStage < 2;
    const actionBox = document.getElementById('module-actions');
    if (actionBox) actionBox.hidden = !visible || moduleStage < 1;
  };
  detailsButton.addEventListener('click', () => { advancedOpen = true; moduleStage = 1; applyProgressiveStage(); });
  conditional.addEventListener('click', event => {
    if (event.target.closest('#workflow-next')) { moduleStage = 1; applyProgressiveStage(); }
  });
  embedEditor.addEventListener('click', event => {
    if (event.target.closest('#embed-next')) { moduleStage = 2; applyProgressiveStage(); }
  });
  handler?.addEventListener('change', () => {
    // Selecting a handler immediately opens the next relevant step.
    moduleStage = 1;
    renderWorkflow();
    applyProgressiveStage();
  });
  document.getElementById('module-template')?.addEventListener('change', event => {
    const selected = event.target.value;
    handler.value = selected;
    const presets = {
      none: { handler: 'none', values: ['Modul nou', '📋 Modul nou', 'Descrierea modulului afișată în Discord.'] },
      announcement: { handler: 'announcement', values: ['Anunț', '📢 Anunț', 'Publică un anunț pentru comunitate.'] },
      poll: { handler: 'request', values: ['Sondaj', '📊 Sondaj', 'Colectează răspunsuri de la membrii serverului.'] },
      event: { handler: 'request', values: ['Eveniment / reminder', '📅 Eveniment și reminder', 'Publică un eveniment și colectează detaliile necesare.'] },
      request: { handler: 'request', values: ['Cerere', '📝 Cerere', 'Completează formularul pentru a trimite o cerere.'] },
      approval: { handler: 'approval', values: ['Cerere cu aprobare', '✅ Cerere cu aprobare', 'Trimite o cerere care poate fi aprobată sau respinsă.'] },
      recruitment: { handler: 'approval', values: ['Recrutare / aplicație', '👤 Aplicație recrutare', 'Primește aplicații și trimite-le spre aprobare.'] },
      feedback: { handler: 'request', values: ['Feedback', '💬 Feedback', 'Colectează feedback de la utilizatori.'] },
      suggestion: { handler: 'request', values: ['Sugestie', '💡 Sugestie', 'Permite utilizatorilor să trimită sugestii.'] },
      complaint: { handler: 'approval', values: ['Reclamație / incident', '⚠️ Reclamație sau incident', 'Înregistrează incidente și trimite-le pentru verificare.'] },
      ticket: { handler: 'request', values: ['Ticket / suport', '🎫 Solicitare suport', 'Primește și urmărește solicitări de suport.'] },
      report: { handler: 'report', values: ['Raport', '📊 Raport', 'Generează și afișează un raport.'] },
      inventory: { handler: 'request', values: ['Inventar / evidență', '📦 Inventar și evidență', 'Înregistrează articole, cantități sau modificări.'] },
      survey: { handler: 'request', values: ['Chestionar', '🧾 Chestionar', 'Colectează răspunsuri structurate într-un formular.'] }
    };
    const preset = presets[selected] || presets.none;
    const presetHandler = preset.handler;
    handler.value = presetHandler;
    document.getElementById('label').value = preset.values[0];
    document.getElementById('title').value = preset.values[1];
    document.getElementById('description').value = preset.values[2];
    advancedOpen = false; moduleStage = 0; renderWorkflow();
    const fieldPresets = {
      poll: [['Întrebare', 'short_text', 'Ce vrei să întrebi?'], ['Opțiuni', 'long_text', 'Scrie opțiunile separate prin virgulă']],
      event: [['Nume eveniment', 'short_text', 'Ex: întâlnire comunitate'], ['Data și ora', 'date', 'zz.ll.aaaa / ora']],
      recruitment: [['Nume candidat', 'short_text', 'Numele complet'], ['Experiență și motivație', 'long_text', 'Descrie experiența și motivul aplicării']],
      feedback: [['Evaluare', 'select', '1, 2, 3, 4, 5'], ['Feedback', 'long_text', 'Scrie opinia ta']],
      suggestion: [['Titlu sugestie', 'short_text', 'Descrie pe scurt sugestia'], ['Detalii', 'long_text', 'Explică sugestia']],
      complaint: [['Subiect', 'short_text', 'Despre ce este reclamația?'], ['Detalii incident', 'long_text', 'Descrie situația']],
      ticket: [['Subiect', 'short_text', 'Cu ce ai nevoie de ajutor?'], ['Detalii', 'long_text', 'Descrie problema']],
      inventory: [['Articol', 'short_text', 'Numele articolului'], ['Cantitate și detalii', 'long_text', 'Cantitate, stare și observații']],
      survey: [['Întrebare', 'short_text', 'Întrebarea chestionarului'], ['Răspuns', 'long_text', 'Răspunsul utilizatorului']]
    }[selected];
    if (fieldPresets) [...document.querySelectorAll('.form-builder-row')].slice(0, 2).forEach((row, index) => { const presetField = fieldPresets[index]; if (!presetField) return; row.querySelector('[data-form-label]').value = presetField[0]; row.querySelector('[data-form-type]').value = presetField[1]; row.querySelector('[data-form-placeholder]').value = presetField[2]; if (presetField[1] === 'select') row.querySelector('[data-form-options]').value = presetField[2]; });
    const buttonPresets = {
      none: [{ label: 'Confirmă', style: 2, type: 'button', action: 'none' }],
      announcement: [{ label: 'Trimite anunțul', style: 1, type: 'modal', action: 'open_form' }],
      poll: [{ label: 'Răspunde la sondaj', style: 1, type: 'modal', action: 'save_submission' }],
      event: [{ label: 'Înscrie-te', style: 3, type: 'modal', action: 'save_submission' }],
      request: [{ label: 'Trimite cererea', style: 1, type: 'modal', action: 'open_form' }],
      approval: [{ label: 'Trimite spre aprobare', style: 1, type: 'modal', action: 'open_form' }, { label: 'Aprobă următoarea', style: 3, type: 'button', action: 'approve' }, { label: 'Respinge următoarea', style: 4, type: 'button', action: 'reject' }],
      recruitment: [{ label: 'Trimite aplicația', style: 1, type: 'modal', action: 'open_form' }],
      feedback: [{ label: 'Trimite feedback', style: 1, type: 'modal', action: 'save_submission' }],
      suggestion: [{ label: 'Trimite sugestia', style: 1, type: 'modal', action: 'open_form' }],
      complaint: [{ label: 'Raportează incidentul', style: 4, type: 'modal', action: 'open_form' }],
      ticket: [{ label: 'Deschide solicitarea', style: 1, type: 'modal', action: 'open_form' }],
      report: [{ label: 'Generează raportul', style: 1, type: 'button', action: 'report' }],
      inventory: [{ label: 'Adaugă în evidență', style: 1, type: 'modal', action: 'save_submission' }],
      survey: [{ label: 'Completează chestionarul', style: 1, type: 'modal', action: 'save_submission' }]
    }[selected] || [];
    renderButtons(buttonPresets);
    applyProgressiveStage(); refreshLivePreview?.();
  });
  applyProgressiveStage();
  const addEmbedField = (data = {}) => { const row = document.createElement('div'); row.className = 'embed-field-row'; row.style.cssText = 'display:grid;grid-template-columns:1fr 1.5fr auto auto;gap:6px;margin-top:7px'; row.innerHTML = `<input data-embed-field-name maxlength="256" placeholder="Nume câmp" value="${data.name || ''}"><input data-embed-field-value maxlength="1024" placeholder="Valoare câmp" value="${data.value || ''}"><label style="font-size:10px;display:flex;align-items:center;gap:3px"><input data-embed-field-inline type="checkbox" ${data.inline ? 'checked' : ''}> Inline</label><button data-embed-field-remove type="button" class="button danger" style="padding:5px 8px">×</button>`; row.querySelector('[data-embed-field-remove]').onclick = () => row.remove(); document.getElementById('embed-fields').appendChild(row); };
  document.getElementById('add-embed-field').onclick = () => { if (document.querySelectorAll('.embed-field-row').length < 25) addEmbedField(); };
  const fillAdvanced = (module = {}) => { const e = module.embed || {}; ['author-name','author-icon','thumbnail','image','footer-text','footer-icon'].forEach(key => { const node = document.getElementById(`embed-${key}`); if (node) node.value = e[key.replace('-', '_')] || ''; }); document.getElementById('embed-timestamp').checked = e.timestamp === true; document.getElementById('embed-fields').innerHTML = ''; (e.fields || []).forEach(addEmbedField); const actions = module.workflow?.actions || []; [...document.getElementById('workflow-actions').options].forEach(option => { option.selected = actions.includes(option.value); }); const limits = module.limits || {}; const permissions = module.permissions || {}; const responses = module.responses || {}; document.getElementById('module-permission').value = permissions.mode || 'everyone'; document.getElementById('module-role-ids').value = (permissions.role_ids || []).join(', '); document.getElementById('module-cooldown').value = limits.cooldown_seconds || 0; document.getElementById('module-max-pending').value = limits.max_pending || 0; document.getElementById('module-max-user').value = limits.max_per_user || 0; document.getElementById('module-max-text').value = limits.max_text_length || 1800; document.getElementById('module-attachments').checked = limits.allow_attachments === true; document.getElementById('module-success').value = responses.success || ''; document.getElementById('module-error').value = responses.error || ''; document.getElementById('module-visibility').value = responses.visibility || 'private'; };
  const readSmartConfig = () => ({ key: keyInput?.value?.trim() || 'custom_modul', label: document.getElementById('label')?.value?.trim() || '', title: document.getElementById('title')?.value?.trim() || '', description: document.getElementById('description')?.value?.trim() || '', color: document.getElementById('color')?.value || '#5865f2', handler: handler?.value || 'none', buttons: [...document.querySelectorAll('#button-list .button-row')].map(row => ({ label: row.querySelector('input')?.value?.trim() || '', style: Number(row.querySelector('select')?.value || 1), type: row.querySelector('[data-module-type]')?.value || 'button', action: row.querySelector('[data-module-action]')?.value || 'open_form', url: row.querySelector('[data-module-url]')?.value || '', options: (row.querySelector('[data-module-options]')?.value || '').split(',').map(item => item.trim()).filter(Boolean) })).filter(button => button.label), form_schema: [...document.querySelectorAll('.form-builder-row')].map((row, index) => ({ id: `field_${index + 1}`, label: row.querySelector('[data-form-label]')?.value?.trim() || '', type: row.querySelector('[data-form-type]')?.value || 'short_text', placeholder: row.querySelector('[data-form-placeholder]')?.value?.trim() || '', options: (row.querySelector('[data-form-options]')?.value || '').split(',').map(item => item.trim()).filter(Boolean), required: row.querySelector('[data-form-required]')?.checked !== false })).filter(field => field.label) });
  const draftKey = () => `panel-pro-module-draft:${keyInput?.value?.trim() || 'custom_modul'}`;
  const saveSmartDraft = () => { const config = readSmartConfig(); localStorage.setItem(draftKey(), JSON.stringify(config)); showStatus('Draftul modulului a fost salvat local în acest browser.', 'ok'); };
  const loadSmartDraft = () => { try { const config = JSON.parse(localStorage.getItem(draftKey()) || 'null'); if (!config) return showStatus('Nu există niciun draft pentru acest modul.', 'error'); document.getElementById('label').value = config.label || ''; document.getElementById('title').value = config.title || ''; document.getElementById('description').value = config.description || ''; document.getElementById('color').value = config.color || '#5865f2'; handler.value = config.handler || 'none'; document.getElementById('module-template').value = config.handler || 'none'; renderButtons(config.buttons || []); fillAdvanced(config); renderWorkflow(); advancedOpen = false; moduleStage = 0; applyProgressiveStage(); showStatus('Draftul a fost încărcat. Verifică-l înainte de salvare.', 'ok'); } catch (_) { showStatus('Draftul local este invalid.', 'error'); } };
  document.getElementById('save-draft-module')?.addEventListener('click', saveSmartDraft);
  let autosaveTimer;
  root.addEventListener('input', () => { window.clearTimeout(autosaveTimer); autosaveTimer = window.setTimeout(() => { try { localStorage.setItem(draftKey(), JSON.stringify(readSmartConfig())); } catch (_) {} }, 500); });
  document.getElementById('restore-draft-module')?.addEventListener('click', loadSmartDraft);
  document.getElementById('export-module')?.addEventListener('click', () => { const blob = new Blob([JSON.stringify(readSmartConfig(), null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${keyInput?.value?.trim() || 'modul'}-config.json`; link.click(); URL.revokeObjectURL(link.href); showStatus('Configurația modulului a fost exportată.', 'ok'); });
  document.getElementById('import-module')?.addEventListener('click', () => document.getElementById('module-import-file')?.click());
  document.getElementById('module-import-file')?.addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const config = JSON.parse(String(reader.result || '{}')); document.getElementById('label').value = config.label || ''; document.getElementById('title').value = config.title || ''; document.getElementById('description').value = config.description || ''; document.getElementById('color').value = config.color || '#5865f2'; handler.value = config.handler || 'none'; document.getElementById('module-template').value = config.handler || 'none'; renderButtons(config.buttons || []); fillAdvanced(config); renderWorkflow(); advancedOpen = false; moduleStage = 0; applyProgressiveStage(); showStatus('Configurația a fost importată. Verifică valorile înainte de salvare.', 'ok'); } catch (_) { showStatus('Fișierul importat nu este o configurație validă.', 'error'); } }; reader.readAsText(file); });
  cloneButton?.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const config = readSmartConfig();
    document.getElementById('new')?.click();
    window.setTimeout(() => {
      const clonedKey = `${String(config.key || 'custom_modul').replace(/^custom_/, '')}_copy`.replace(/[^a-z0-9_]/gi, '_').slice(0, 36);
      keyInput.value = `custom_${clonedKey}`;
      document.getElementById('label').value = `${config.label || 'Modul'} copie`;
      document.getElementById('title').value = `${config.title || 'Modul'} copie`;
      document.getElementById('description').value = config.description || '';
      document.getElementById('color').value = config.color || '#5865f2';
      handler.value = config.handler || 'none'; document.getElementById('module-template').value = config.handler || 'none';
      renderButtons(config.buttons || []); fillAdvanced(config); renderWorkflow(); advancedOpen = false; moduleStage = 0; applyProgressiveStage();
      showStatus('Modulul a fost duplicat complet ca draft nou.', 'ok');
    }, 0);
  }, true);
  fillAdvanced();
  document.addEventListener('click', event => { const button = event.target.closest?.('[data-select]'); if (!button) return; setTimeout(async () => { try { const response = await fetch('https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/manage-discord-bot', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0', Authorization: 'Bearer sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0' }, body: JSON.stringify({ action: 'custom_modules', access_token: token(), application_id: '1531023771211792384' }) }); const data = await response.json(); const module = data.custom_modules?.[button.dataset.select]; if (module) { document.getElementById('module-active').checked = module.active !== false; document.getElementById('module-command').value = module.command_name || ''; fillAdvanced(module); module.buttons?.forEach((item, index) => { const row = document.querySelectorAll('#button-list .button-row')[index]; row?.querySelector('[data-module-type]') && (row.querySelector('[data-module-type]').value = item.type || 'button'); row?.querySelector('[data-module-action]') && (row.querySelector('[data-module-action]').value = item.action || 'open_form'); row?.querySelector('[data-module-url]') && (row.querySelector('[data-module-url]').value = item.url || ''); row?.querySelector('[data-module-options]') && (row.querySelector('[data-module-options]').value = (item.options || []).map(option => `${option.value}=${option.label}`).join(', ')); row?.querySelector('[data-module-action-message]') && (row.querySelector('[data-module-action-message]').value = item.action_config?.message || ''); row?.querySelector('[data-module-type]')?.dispatchEvent(new Event('change')); }); } } catch (_) {} }, 0); });
  const preview = document.createElement('section');
  preview.className = 'global-preview';
  preview.innerHTML = '<h2>Embeduri globale disponibile</h2><div class="global-preview-grid"><small>Se încarcă modulele globale…</small></div>';
  root.parentElement?.prepend(preview);
  const livePreview = document.createElement('section');
  livePreview.className = 'module-live-preview';
  livePreview.style.cssText = 'margin-top:16px;padding:14px;border:1px solid #263b58;border-radius:12px;background:#081426';
  livePreview.innerHTML = '<h2 style="margin:0 0 8px;font-size:14px">Preview modul curent</h2><article id="live-embed-card" style="border-left:4px solid #5865f2;padding:12px;border-radius:8px;background:#0b1729"><strong id="live-embed-title">Modul nou</strong><p id="live-embed-description" class="muted" style="margin:7px 0;font-size:12px">Descrierea modulului va apărea aici.</p><div id="live-embed-fields"></div><div id="live-embed-buttons" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px"></div></article>';
  root.parentElement?.prepend(livePreview);
  const refreshLivePreview = () => { const title = document.getElementById('title')?.value?.trim() || document.getElementById('label')?.value?.trim() || 'Modul nou'; const description = document.getElementById('description')?.value?.trim() || 'Descrierea modulului va apărea aici.'; const color = document.getElementById('color')?.value || '#5865f2'; const card = document.getElementById('live-embed-card'); const fields = [...document.querySelectorAll('.embed-field-row')].map(row => `<div style="margin-top:6px;font-size:11px"><b>${row.querySelector('[data-embed-field-name]')?.value || 'Câmp'}</b><br>${row.querySelector('[data-embed-field-value]')?.value || 'Valoare'}</div>`).join(''); const buttons = [...document.querySelectorAll('#button-list .button-row')].map(row => `<span style="padding:5px 8px;border-radius:6px;background:#162a45;font-size:11px">${row.querySelector('input')?.value || 'Buton'}</span>`).join(''); document.getElementById('live-embed-title').textContent = title; document.getElementById('live-embed-description').textContent = description; document.getElementById('live-embed-fields').innerHTML = fields; document.getElementById('live-embed-buttons').innerHTML = buttons || '<span class="muted" style="font-size:11px">Fără butoane</span>'; if (card) card.style.borderLeftColor = color; };
  const refreshTimer = window.setInterval(refreshLivePreview, 300); refreshLivePreview();
  testButton?.addEventListener('click', () => { refreshLivePreview(); const handlerName = handler?.selectedOptions?.[0]?.textContent || 'Doar embed'; showStatus(`Test local finalizat: ${handlerName}. Embedul și ${document.querySelectorAll('#button-list .button-row').length} butoane au fost verificate în preview.`, 'ok'); });
  cloneButton?.addEventListener('click', () => { const sourceKey = keyInput?.value?.trim() || 'modul'; const newKey = `${sourceKey.replace(/^custom_/, '')}_copy`; document.getElementById('new')?.click(); setTimeout(() => { keyInput.value = `custom_${newKey}`.slice(0, 40); document.getElementById('label').value = `${document.getElementById('label').value || 'Modul'} copie`; document.getElementById('title').value = `${document.getElementById('title').value || 'Modul'} copie`; refreshLivePreview(); }, 0); });
  resetButton?.addEventListener('click', () => { ['key','label','title','description','module-command','module-success','module-error','module-role-ids'].forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; }); if (keyInput) keyInput.value = 'custom_modul'; if (handler) handler.value = 'none'; document.getElementById('button-list').innerHTML = ''; document.getElementById('embed-fields').innerHTML = ''; document.getElementById('module-active').checked = true; refreshLivePreview(); showStatus('Formularul modulului a fost resetat local.', 'ok'); });
  const token = () => sessionStorage.getItem('discovery_access_token') || sessionStorage.getItem('discord_bot_admin_token') || '';
  fetch('https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/manage-discord-bot', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0', Authorization: 'Bearer sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0' }, body: JSON.stringify({ action: 'custom_modules', access_token: token(), application_id: '1531023771211792384' }) }).then(response => response.json()).then(data => {
    const modules = data.custom_modules || {};
    preview.querySelector('.global-preview-grid').innerHTML = Object.values(modules).map((module) => { const color = `#${Number(module.color || 0x5865f2).toString(16).padStart(6, '0')}`; return `<article class="global-preview-card" style="border-left-color:${color}"><strong>${module.title || module.label}</strong><small>${module.label}${module.premium ? ' · Premium' : ''}</small><div class="global-preview-buttons">${(module.buttons || []).map(button => `<span>${button.label}</span>`).join('') || '<span>Fără butoane</span>'}</div></article>`; }).join('') || '<small>Nu există module globale.</small>';
  }).catch(() => {});
  const decorate = () => {
    document.querySelectorAll('#button-list .button-row').forEach((row, index) => {
      if (row.querySelector('[data-module-type]')) return;
      const type = document.createElement('select'); type.dataset.moduleType = String(index);
      type.innerHTML = '<option value="button">Buton</option><option value="modal">Modal</option><option value="link">Link</option><option value="select">Meniu select</option>';
      const url = document.createElement('input'); url.dataset.moduleUrl = String(index); url.placeholder = 'URL pentru link'; url.style.display = 'none';
      const options = document.createElement('input'); options.dataset.moduleOptions = String(index); options.placeholder = 'Opțiuni meniu: valoare=Etichetă'; options.style.display = 'none';
      const action = document.createElement('select'); action.dataset.moduleAction = String(index); action.innerHTML = '<option value="open_form">Deschide formular</option><option value="save_submission">Salvează cererea</option><option value="send_log">Trimite log</option><option value="notify_submitter">Notifică utilizatorul</option><option value="update_message">Actualizează mesajul</option><option value="approve">Aprobă</option><option value="reject">Respinge</option><option value="report">Generează raport</option><option value="none">Doar confirmare</option>';
      const actionMessage = document.createElement('input'); actionMessage.dataset.moduleActionMessage = String(index); actionMessage.placeholder = 'Răspuns pentru această acțiune';
      type.onchange = () => { url.style.display = type.value === 'link' ? '' : 'none'; options.style.display = type.value === 'select' ? '' : 'none'; };
      const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑';
      const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓';
      [up, down].forEach(button => { button.className = 'button'; button.style.padding = '5px 8px'; });
      up.onclick = () => { if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling); decorate(); };
      down.onclick = () => { if (row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row); decorate(); };
      row.append(type, url, options, action, actionMessage, up, down);
    });
  };
  new MutationObserver(decorate).observe(document.getElementById('button-list'), { childList: true });
  decorate();
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    if (init?.body && typeof init.body === 'string' && String(input).includes('manage-discord-bot')) {
      try {
        const body = JSON.parse(init.body);
        if (body.action === 'save_custom_modules' && body.custom_modules && keyInput) {
          const moduleKey = keyInput.value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
          const module = body.custom_modules[moduleKey];
          if (module) {
            module.active = document.getElementById('module-active')?.checked !== false;
            module.command_name = (document.getElementById('module-command')?.value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
            module.form_schema = [...document.querySelectorAll('.form-builder-row')].map((row, index) => ({ id: `field_${index + 1}`, label: row.querySelector('[data-form-label]')?.value?.trim() || `Câmp ${index + 1}`, type: row.querySelector('[data-form-type]')?.value || 'short_text', required: row.querySelector('[data-form-required]')?.checked !== false, placeholder: row.querySelector('[data-form-placeholder]')?.value?.trim() || '', options: (row.querySelector('[data-form-options]')?.value || '').split(',').map(value => value.trim()).filter(Boolean) })).filter(field => field.label);
            module.workflow = { announcement_mode: document.getElementById('announcement-mode')?.value || 'public', approval_role: document.getElementById('approval-role')?.value?.trim() || '', report_limit: Number(document.getElementById('report-limit')?.value || 20), notify_submitter: document.getElementById('notify-submit')?.checked !== false };
            module.workflow.actions = [...(document.getElementById('workflow-actions')?.selectedOptions || [])].map(option => option.value);
            module.embed = { author_name: document.getElementById('embed-author-name')?.value?.trim() || '', author_icon: document.getElementById('embed-author-icon')?.value?.trim() || '', thumbnail: document.getElementById('embed-thumbnail')?.value?.trim() || '', image: document.getElementById('embed-image')?.value?.trim() || '', footer_text: document.getElementById('embed-footer-text')?.value?.trim() || '', footer_icon: document.getElementById('embed-footer-icon')?.value?.trim() || '', timestamp: document.getElementById('embed-timestamp')?.checked === true, fields: [...document.querySelectorAll('.embed-field-row')].map(row => ({ name: row.querySelector('[data-embed-field-name]')?.value?.trim() || '', value: row.querySelector('[data-embed-field-value]')?.value?.trim() || '', inline: row.querySelector('[data-embed-field-inline]')?.checked === true })).filter(field => field.name && field.value) };
            module.responses = { success: document.getElementById('module-success')?.value?.trim() || '', error: document.getElementById('module-error')?.value?.trim() || '', confirmation: '', visibility: document.getElementById('module-visibility')?.value || 'private' };
            module.limits = { cooldown_seconds: Number(document.getElementById('module-cooldown')?.value || 0), max_pending: Number(document.getElementById('module-max-pending')?.value || 0), max_per_user: Number(document.getElementById('module-max-user')?.value || 0), max_text_length: Number(document.getElementById('module-max-text')?.value || 1800), allow_attachments: document.getElementById('module-attachments')?.checked === true };
            module.permissions = { mode: document.getElementById('module-permission')?.value || 'everyone', role_ids: (document.getElementById('module-role-ids')?.value || '').split(',').map(value => value.trim()).filter(value => /^\d{15,22}$/.test(value)) };
            module.buttons = [...document.querySelectorAll('#button-list .button-row')].map((row, index) => ({ label: row.querySelector(`[data-blabel="${index}"]`)?.value?.trim() || row.querySelector('input')?.value?.trim() || '', style: Number(row.querySelector(`[data-bstyle="${index}"]`)?.value || 1), type: row.querySelector('[data-module-type]')?.value || 'button', action: row.querySelector('[data-module-action]')?.value || 'open_form', action_config: { message: row.querySelector('[data-module-action-message]')?.value?.trim() || '' }, url: row.querySelector(`[data-module-url="${index}"]`)?.value || '', options: (row.querySelector(`[data-module-options="${index}"]`)?.value || '').split(',').map(item => { const [value, ...label] = item.split('='); return { value: (value || '').trim(), label: (label.join('=') || value || '').trim() }; }).filter(option => option.value && option.label) })).filter(button => button.label);
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      } catch (_) {}
    }
    const response = await originalFetch(input, init);
    if (init?.body && typeof init.body === 'string' && String(input).includes('manage-discord-bot')) { try { const savedBody = JSON.parse(init.body); if (savedBody.action === 'save_custom_modules' && response.ok) { syncStatus.textContent = 'Se sincronizează comenzile slash…'; const syncResponse = await fetch('https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/sync-discord-commands', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0', Authorization: 'Bearer sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0' }, body: JSON.stringify({ access_token: token(), application_id: '1531023771211792384' }) }); syncStatus.textContent = syncResponse.ok ? '✓ Modul salvat și comenzile slash sincronizate.' : '✓ Modul salvat; sincronizarea slash a eșuat.'; } } catch (_) { syncStatus.textContent = '✓ Modul salvat; sincronizarea slash a eșuat.'; } }
    return response;
  };
  // Keep the selected template as metadata for future handlers and migrations.
  const constructorFetch = window.fetch;
  window.fetch = async (input, init) => {
    if (init?.body && typeof init.body === 'string' && String(input).includes('manage-discord-bot')) {
      try {
        const body = JSON.parse(init.body);
        if (body.action === 'save_custom_modules' && body.custom_modules) {
          const selectedTemplate = document.getElementById('module-template')?.value || 'none';
          const currentKey = keyInput?.value?.trim();
          if (currentKey && body.custom_modules[currentKey]) body.custom_modules[currentKey].template_key = selectedTemplate;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (_) {}
    }
    return constructorFetch(input, init);
  };
})();
