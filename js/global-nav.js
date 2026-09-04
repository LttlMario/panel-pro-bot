(()=>{
  'use strict';
  const add=()=>{if(!location.pathname.endsWith('administrare-globala.html'))return;const nav=document.querySelector('#bot-sidebar .side-nav');if(nav&&!nav.querySelector('a[href="administrare-module.html"]'))nav.insertAdjacentHTML('beforeend','<a href="administrare-module.html">🧩 Constructor module</a>');};
  document.addEventListener('DOMContentLoaded',add,{once:true});
  const timer=setInterval(add,100);
  setTimeout(()=>clearInterval(timer),5000);
})();
