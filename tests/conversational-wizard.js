const fs=require('fs'); const s=fs.readFileSync('js/module-chat-flow.js','utf8');
for(const x of ['state.fields','state.buttons','response-flow-reason','memoryKey','resetare','schimbă|schimba']) if(!s.includes(x)) throw new Error('Wizard feature missing: '+x);
const p=fs.readFileSync('js/module-pro-tools.js','utf8'); for(const x of ['deploy-module','audit','Backup','stage-open']) if(!p.includes(x)) throw new Error('Tool missing: '+x);
console.log('Conversational wizard behavior checks: OK');
