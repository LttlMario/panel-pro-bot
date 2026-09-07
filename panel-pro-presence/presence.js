const RPC = require('discord-rpc');
const CLIENT_ID = '1531023771211792384';
const rpc = new RPC.Client({ transport: 'ipc' });
const startedAt = Date.now();

function updateActivity() {
  rpc.setActivity({
    details: 'Configurează serverul Discord',
    state: 'Panel Pro Bot · bot.panel-pro.ro',
    startTimestamp: startedAt,
    largeImageKey: 'panel-pro',
    largeImageText: 'Panel Pro Bot',
    buttons: [
      { label: 'Deschide dashboardul', url: 'https://bot.panel-pro.ro' },
      { label: 'Intră în comunitate', url: 'https://discord.com/channels/1544703486384537603' }
    ],
    instance: false
  }).catch(() => {});
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
