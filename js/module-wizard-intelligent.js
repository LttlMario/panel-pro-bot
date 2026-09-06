(() => {
  'use strict';
  const wizard = document.getElementById('module-wizard-static');
  if (!wizard) return;
  const select = document.getElementById('module-template-static');
  const help = document.getElementById('module-wizard-help');
  const apply = document.getElementById('module-wizard-apply');
  if (!select || !apply) return;
  const presets = {
    announcement:{label:'Anunț / comunicare',title:'📢 Anunț',description:'Publică un anunț clar pentru comunitate.',handler:'announcement',fields:[],buttons:[['Publică anunț','modal','open_form']],tip:'Pentru informări, reguli și comunicări publice.'},
    request:{label:'Cerere / formular',title:'📝 Cerere',description:'Primește cereri completate de membri și trimite-le în fluxul de lucru.',handler:'request',fields:[['Subiect','short_text','Titlul cererii'],['Detalii','long_text','Descrie cererea']],buttons:[['Trimite cererea','modal','open_form']],tip:'Pentru solicitări, înscrieri și formulare simple.'},
    approval:{label:'Cerere cu aprobare',title:'✅ Cerere cu aprobare',description:'Trimite solicitări către staff pentru aprobare sau respingere.',handler:'approval',fields:[['Subiect','short_text','Titlul solicitării'],['Detalii','long_text','Descrie solicitarea']],buttons:[['Trimite spre aprobare','modal','open_form'],['Aprobă','button','approve'],['Respinge','button','reject']],tip:'Include formular, status și acțiuni de aprobare.'},
    recruitment:{label:'Recrutare / aplicație',title:'👤 Aplicație recrutare',description:'Colectează aplicații și trimite-le spre evaluarea staffului.',handler:'approval',fields:[['Nume candidat','short_text','Numele complet'],['Experiență și motivație','long_text','Descrie experiența']],buttons:[['Trimite aplicația','modal','open_form'],['Aprobă','button','approve'],['Respinge','button','reject']],tip:'Potrivit pentru aplicații cu evaluare administrativă.'},
    poll:{label:'Sondaj / vot',title:'📊 Sondaj',description:'Colectează răspunsuri și păstrează rezultatele.',handler:'request',fields:[['Întrebarea','short_text','Întrebarea sondajului'],['Opțiuni','select','Opțiuni separate prin virgulă']],buttons:[['Votează','modal','save_submission'],['Vezi rezultate','button','report']],tip:'Creează automat formular și raport de rezultate.'},
    event:{label:'Eveniment / reminder',title:'🗓️ Eveniment',description:'Înregistrează evenimente și participanți.',handler:'request',fields:[['Nume eveniment','short_text','Numele evenimentului'],['Data și detalii','long_text','Data și informații']],buttons:[['Înscrie-te','modal','save_submission']],tip:'Pentru evenimente, programări și remindere.'},
    ticket:{label:'Ticket / suport',title:'🎫 Ticket suport',description:'Primește și urmărește solicitări de suport.',handler:'request',fields:[['Subiect','short_text','Cu ce ai nevoie de ajutor?'],['Descriere','long_text','Descrie problema']],buttons:[['Deschide ticket','modal','open_form']],tip:'Flux simplu pentru suport și sesizări.'},
    report:{label:'Raport / statistici',title:'📈 Raport',description:'Afișează rapoarte din înregistrările modulului.',handler:'report',fields:[],buttons:[['Generează raport','button','report']],tip:'Folosește datele salvate pentru un raport rapid.'},
    inventory:{label:'Inventar / evidență',title:'📦 Inventar',description:'Înregistrează articole, cantități și modificări.',handler:'request',fields:[['Articol','short_text','Numele articolului'],['Cantitate și locație','long_text','Cantitate și locație']],buttons:[['Adaugă articol','modal','save_submission'],['Vezi inventarul','button','report']],tip:'Pentru stocuri, locații și evidențe interne.'},
    marketplace:{label:'Marketplace',title:'🛒 Marketplace',description:'Primește anunțuri cu produse și servicii.',handler:'announcement',fields:[['Titlu anunț','short_text','Ce oferi?'],['Detalii și preț','long_text','Descrierea anunțului']],buttons:[['Publică anunț','modal','open_form']],tip:'Modul de publicare pentru produse și servicii.'},
    feedback:{label:'Feedback / sugestii',title:'💬 Feedback',description:'Colectează opinii și sugestii de la membri.',handler:'request',fields:[['Subiect','short_text','Subiectul feedbackului'],['Feedback','long_text','Scrie opinia ta']],buttons:[['Trimite feedback','modal','save_submission']],tip:'Pentru feedback, idei și îmbunătățiri.'},
    moderation:{label:'Incident / moderare',title:'🛡️ Incident',description:'Înregistrează incidente pentru verificarea staffului.',handler:'approval',fields:[['Tip incident','short_text','Tipul incidentului'],['Detalii','long_text','Descrie situația']],buttons:[['Raportează incidentul','modal','open_form'],['Rezolvă','button','approve']],tip:'Pentru raportări care necesită intervenția staffului.'},
    custom:{label:'Modul personalizat',title:'⚙️ Modul personalizat',description:'Pornește de la zero și configurează manual fiecare detaliu.',handler:'none',fields:[],buttons:[['Buton nou','button','none']],tip:'Ai control complet asupra tuturor setărilor.'}
  };
  const key = id => document.getElementById(id);
  const slug = value => String(value || 'modul').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,28) || 'modul';
  const esc = value => String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const renderFormFields = fields => {
    const list = key('form-fields');
    if (!list) return;
    list.innerHTML = '';
    fields.forEach((f,i) => { const row=document.createElement('div'); row.className='form-builder-row'; row.style.cssText='display:grid;grid-template-columns:1.1fr .9fr 1fr 1fr auto;gap:6px;margin-top:7px'; row.innerHTML=`<input data-form-label placeholder="Etichetă câmp" value="${esc(f[0])}"><select data-form-type><option value="short_text">Text scurt</option><option value="long_text">Text lung</option><option value="number">Număr</option><option value="date">Dată</option><option value="url">Link</option><option value="select">Selectare</option></select><input data-form-placeholder placeholder="Placeholder" value="${esc(f[2])}"><input data-form-options placeholder="Opțiuni / regex" value="${f[1]==='select'?'Da, Nu':''}"><label style="font-size:10px;display:flex;align-items:center;gap:3px"><input data-form-required type="checkbox" checked> Obligatoriu</label><button data-form-remove type="button" class="button danger" style="padding:5px 8px">×</button>`; row.querySelector('[data-form-type]').value=f[1]; row.querySelector('[data-form-remove]').onclick=()=>row.remove(); list.appendChild(row); });
  };
  const updateHint = () => { const p=presets[select.value]; help.textContent=p ? `${p.tip} Se vor crea ${p.fields.length} câmpuri și ${p.buttons.length} buton${p.buttons.length===1?'':'e'}.` : 'Alege un tip pentru a vedea configurația recomandată.'; };
  select.addEventListener('change', updateHint);
  apply.onclick = () => {
    const type=select.value, p=presets[type]; if(!p){help.textContent='Selectează mai întâi un tip de modul.';return;}
    const keyInput=key('key'); if(keyInput && !keyInput.value.trim()) keyInput.value=`custom_${slug(type)}_${Date.now().toString().slice(-4)}`;
    key('label').value=p.label; key('title').value=p.title; key('description').value=p.description; key('handler').value=p.handler; key('handler').dispatchEvent(new Event('change'));
    const list=key('button-list'); list.innerHTML=p.buttons.map((b,i)=>`<div class="button-row"><input data-blabel="${i}" value="${esc(b[0])}" placeholder="Numele butonului"><select data-bstyle="${i}"><option value="1">Albastru</option><option value="2">Gri</option><option value="3">Verde</option><option value="4">Roșu</option></select></div>`).join('');
    window.setTimeout(()=>renderFormFields(p.fields),80);
    help.textContent='Configurație creată. Verifică pașii de mai jos, apoi salvează modulul.';
    const status=key('status'); if(status){status.textContent=`Wizard: ${p.label} configurat automat.`;status.className='status ok';}
  };
  updateHint();
})();
(() => {
  const wizard=document.getElementById('module-wizard-static'); if(!wizard||document.getElementById('module-intent')) return;
  const wrap=document.createElement('div'); wrap.id='module-intent'; wrap.style.cssText='margin-top:12px;padding:12px;border:1px solid #36516f;border-radius:10px;background:#0b2034';
  wrap.innerHTML='<label class="field" style="margin-top:0"><span>Descrie modulul în cuvintele tale</span><textarea id="module-intent-text" rows="3" placeholder="Ex.: Vreau un sistem în care membrii trimit cereri, stafful le aprobă, iar rezultatul se salvează în log."></textarea></label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"><button id="module-intent-analyze" type="button" class="button cyan">🧠 Analizează cerința</button><span id="module-intent-result" class="muted" style="font-size:11px;align-self:center"></span></div>';
  wizard.appendChild(wrap);
  const text=document.getElementById('module-intent-text'), result=document.getElementById('module-intent-result');
  const choose=(s)=>{s=s.toLowerCase(); if(/apro(b|)are|respinge|staff|manager|verific/.test(s)) return 'approval'; if(/recrut|aplica/.test(s)) return 'recruitment'; if(/sondaj|vot|poll/.test(s)) return 'poll'; if(/eveniment|program|reminder|înscr/.test(s)) return 'event'; if(/ticket|suport|ajutor/.test(s)) return 'ticket'; if(/inventar|stoc|articol|cantitat/.test(s)) return 'inventory'; if(/raport|statistic|export/.test(s)) return 'report'; if(/market|produs|vânz|servici/.test(s)) return 'marketplace'; if(/feedback|sugest|opin/.test(s)) return 'feedback'; if(/incident|reclama|moder/.test(s)) return 'moderation'; if(/anunț|anunt|comunicat|inform/.test(s)) return 'announcement'; return 'request';};
  document.getElementById('module-intent-analyze').onclick=()=>{const raw=text.value.trim(); if(!raw){result.textContent='Scrie mai întâi cerința modulului.';return;} const type=choose(raw); const sel=document.getElementById('module-template-static'); sel.value=type; sel.dispatchEvent(new Event('change')); document.getElementById('module-wizard-apply').click(); const lower=raw.toLowerCase(); if(/ataș|atas|fișier|fisier|imagin/.test(lower)){const a=document.getElementById('module-attachments'); if(a)a.checked=true;} if(/log|istoric|salve/.test(lower)){const acts=document.getElementById('workflow-actions'); if(acts)[...acts.options].filter(o=>o.value==='send_log'||o.value==='save_submission').forEach(o=>o.selected=true);} if(/public|canal/.test(lower)){const vis=document.getElementById('module-visibility'); if(vis)vis.value='public';} result.textContent=`Am identificat: ${sel.options[sel.selectedIndex].text}. Verifică presetul și ajustează detaliile.`;};
})();
