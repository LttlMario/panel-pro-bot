const RPC = require('discord-rpc');

const CLIENT_ID = '1531023771211792384';
const rpc = new RPC.Client({ transport: 'ipc' });
const startedAt = Date.now();
let heartbeat;
let connected = false;

function updateActivity() {
  if (!connected) return;

  rpc.setActivity({
    details: 'Panel Pro · Automatizează serverul Discord',
    state: 'Pontaj • învoiri • loguri • marketplace',
    startTimestamp: startedAt,
    largeImageKey: 'panel-pro',
    largeImageText: 'Panel Pro Bot',
    buttons: [
      { label: 'Intră pe Discord', url: 'https://discord.gg/nYUs5heDG' },
      { label: 'Vezi Panel Pro', url: 'https://bot.panel-pro.ro/' }
    ],
    instance: false
  }).catch((error) => {
    console.error('Rich Presence nu a acceptat actualizarea:', error.message || error);
  });
}

rpc.on('ready', () => {
  connected = true;
  updateActivity();
  clearInterval(heartbeat);
  heartbeat = setInterval(updateActivity, 2500);
  console.log('Panel Pro Rich Presence este activ, cu informații reale despre produs.');
});

rpc.on('disconnected', () => {
  connected = false;
  clearInterval(heartbeat);
  console.error('Discord Desktop s-a deconectat. Repornește aplicația pentru reconectare.');
});

rpc.login({ clientId: CLIENT_ID }).catch(() => {
  console.error('Nu s-a putut conecta la Discord Desktop. Deschide aplicația Discord și încearcă din nou.');
  process.exitCode = 1;
});
