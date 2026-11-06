
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'daten', 'db.json');
const initial = {tickets:[], whitelist:[], suggestions:[], reports:[], applications:[], ruleConfirmations:[], logs:[]};
function read() {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial,null,2));
    const data = JSON.parse(fs.readFileSync(file,'utf8'));
    return {...initial,...data};
  } catch (e) { console.error('Datenbankfehler:',e); return structuredClone(initial); }
}
function write(data) {
  const tmp=file+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(data,null,2));
  fs.renameSync(tmp,file);
}
function update(fn) { const db=read(); const result=fn(db); write(db); return result; }
module.exports={read,write,update};
