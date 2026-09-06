const fs=require('fs'); const cp=require('child_process');
const files=['js/module-chat-flow.js','js/module-flow-preview.js','js/module-chat-commands.js','js/assistant-intelligence.js','js/assistant-backend-bridge.js','js/existing-module-picker.js','js/direct-module-editor.js','js/module-chat-assistant.js'];
for(const f of files){if(!fs.existsSync(f)) throw new Error('Lipsește '+f); cp.execFileSync(process.execPath,['--check',f],{stdio:'inherit'});}
const html=fs.readFileSync('administrare-module.html','utf8'); const all=html+'\n'+files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
for(const id of ['chat-input','chat-send','chat-log','module-template-static','module-wizard-apply','module-premium','response-flow-enabled']) if(!all.includes(id)) throw new Error('Lipsește elementul '+id);
for(const marker of ['module-chat-flow.js','module-flow-preview.js','assistant-backend-bridge.js','existing-module-picker.js']) if(!html.includes(marker)) throw new Error('Lipsește scriptul '+marker);
console.log('Module assistant smoke tests: OK');
