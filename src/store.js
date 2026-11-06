const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','daten','db.json');
const initial={
 tickets:[],whitelist:[],suggestions:[],reports:[],applications:[],
 ruleConfirmations:[],logs:[],staff:[],shifts:[],warnings:[],invoices:[],absences:[]
};
function read(){
 if(!fs.existsSync(file)){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(initial,null,2));}
 try{return {...initial,...JSON.parse(fs.readFileSync(file,'utf8'))};}
 catch(e){console.error('Datenbankfehler:',e.message);throw new Error('daten/db.json ist beschädigt. Bitte Backup prüfen.');}
}
function write(data){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file);}
function update(fn){const db=read();const result=fn(db);write(db);return result;}
module.exports={read,write,update};
