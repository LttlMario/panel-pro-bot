const RPC = require('discord-rpc');
const CLIENT_ID = '1531023771211792384';
const rpc = new RPC.Client({ transport: 'ipc' });
const startedAt = Date.now();

function updateActivity() {
  rpc.setActivity({
    details: 'Administrează-ți comunitatea Discord',
    state: 'Pontaj · Contracte · Stash · Loguri',
    startTimestamp: startedAt,
    largeImageKey: 'panel-pro',
    largeImageText: 'Panel Pro Bot',
    buttons: [
      { label: 'Join Discord', url: 'https://discord.gg/nYUs5heDG' },
      { label: 'Open website', url: 'https://bot.panel-pro.ro/' }
    ],
    instance: false
  }).then(() => console.log('Rich Presence actualizat cu butoane.')).catch((error) => console.error('Rich Presence nu a acceptat butoanele:', error.message || error));
}

rpc.on('ready', () => {
  updateActivity();
  setInterval(updateActivity, 15000);
  console.log('Panel Pro Rich Presence este activ. Poți închide fereastra pentru a opri statusul.');
});
rpc.login({ clientId: CLIENT_ID }).catch(() => {
  console.error('Nu s-a putut conecta la Discord Desktop. Deschide aplicația Discord și încearcă din nou.');
  process.exitCode = 1;
});
