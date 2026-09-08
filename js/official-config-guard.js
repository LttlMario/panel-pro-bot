(()=>{
  'use strict';
  const API='https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/manage-discord-bot';
  const KEY='sb_publishable_LfngX7pwFruPw35_ZUdO4Q_MGAHoeW0';
  const APP='1531023771211792384';
  const token=()=>sessionStorage.getItem('discovery_access_token')||sessionStorage.getItem('discord_bot_admin_token')||'';
  const hide=()=>['provision-official-server','sync-official-roles','announce-existing-community'].forEach(id=>document.getElementById(id)?.remove());
  const verify=async()=>{
    const button=document.getElementById('provision-official-server');
    if(!button)return;
    button.style.visibility='hidden';
    try{
      const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({action:'custom_modules',access_token:token(),application_id:APP})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.platform_admin!==true){hide();return;}
      button.style.visibility='visible';
    }catch(_){hide();}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',verify);else verify();
})();
