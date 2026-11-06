
require('dotenv').config();
const express=require('express');
const session=require('express-session');
const path=require('node:path');
const crypto=require('node:crypto');
const {Client,GatewayIntentBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,REST,Routes,PermissionFlagsBits}=require('discord.js');
const commands=require('./commands');
const store=require('./store');

const required=['DISCORD_TOKEN','CLIENT_ID','GUILD_ID','PANEL_PASSWORD','SESSION_SECRET'];
for(const k of required) if(!process.env[k]) { console.error(`FEHLER: ${k} fehlt in .env`); process.exit(1); }
for(const k of ['CLIENT_ID','GUILD_ID']) if(!/^\d{17,20}$/.test(process.env[k])) {console.error(`FEHLER: ${k} ist keine gültige Discord-ID`);process.exit(1);}
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({extended:false,limit:'30kb'}));
app.use(session({name:'fvr.sid',secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}}));
const publicDir=path.join(__dirname,'..','public');
const auth=(req,res,next)=>req.session?.authenticated?next():res.status(401).json({error:'Nicht angemeldet'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function log(type,description,user='System'){
 store.update(db=>{db.logs.unshift({id:crypto.randomUUID(),type,description,user,createdAt:new Date().toISOString()});db.logs=db.logs.slice(0,500);});
 const id=process.env.LOG_CHANNEL_ID;
 if(id) client.channels.fetch(id).then(ch=>ch?.send({embeds:[new EmbedBuilder().setColor(0xB3262D).setTitle('Freiburg V2 • '+type).setDescription(esc(description)).addFields({name:'Von',value:esc(user)}).setTimestamp()] })).catch(e=>console.error('Logkanal:',e.message));
}
function ticketEmbed(t){return new EmbedBuilder().setColor(0xB3262D).setTitle('🎫 Freiburg V2 Support').setDescription(`**Thema:** ${esc(t.topic)}\n**Erstellt von:** <@${t.userId}>\n**Ticket-ID:** ${t.id}\n\nDas Team wird sich zeitnah melden.`).setFooter({text:'Freiburg V2 Support'});}
function rulesEmbed(){return new EmbedBuilder().setColor(0xB3262D).setTitle('🛡️ FREIBURG V2 | TEAMREGELWERK').setDescription('Jedes Teammitglied muss die Regeln lesen und bestätigen.').addFields(
{name:'§1 Verhalten',value:'Respektvoll, fair und diskriminierungsfrei handeln.'},
{name:'§2 Dienst',value:'Professionell auftreten und Spieleranfragen zuverlässig bearbeiten.'},
{name:'§3 Rechte',value:'Adminrechte ausschließlich dienstlich und verantwortungsvoll verwenden.'},
{name:'§4 Support',value:'Neutral bleiben, beide Seiten anhören und Entscheidungen begründen.'},
{name:'§5 Datenschutz',value:'Interne Informationen und Spielerdaten vertraulich behandeln.'},
{name:'§6 Aktivität',value:'Abwesenheiten bei der Teamleitung melden.'},
{name:'§7 Konsequenzen',value:'Verwarnung, Teamgespräch, Rechteentzug oder Ausschluss.'},
{name:'Bestätigung',value:'Mit dem Button bestätigst du, dass du das Regelwerk gelesen hast.'}
).setFooter({text:'Freiburg V2 • Teamverwaltung'}).setTimestamp();}
async function registerCommands(){
 const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID),{body:commands});
 console.log(`Slash Commands registriert: ${commands.length}`);
}
client.once('ready',async()=>{
 console.log(`Discord-Bot online: ${client.user.tag}`);
 try {await registerCommands();} catch(e){console.error('Command-Registrierung:',e);}
});
client.on('interactionCreate',async i=>{
 try{
  if(i.isChatInputCommand()){
   const db=store.read();
   if(i.commandName==='ping') return i.reply({content:`Pong! ${client.ws.ping} ms`,ephemeral:true});
   if(i.commandName==='status') return i.reply({embeds:[new EmbedBuilder().setColor(0x248046).setTitle('Freiburg V2 • Status').addFields({name:'Bot',value:'🟢 Online',inline:true},{name:'Ping',value:`${client.ws.ping} ms`,inline:true},{name:'Discord',value:i.guild?.name||'Unbekannt',inline:true})],ephemeral:true});
   if(i.commandName==='serverinfo') return i.reply({embeds:[new EmbedBuilder().setColor(0xB3262D).setTitle('FREIBURG V2 ROLEPLAY').setDescription('Willkommen auf Freiburg V2!').addFields({name:'Community',value:'Discord • Support • Whitelist'},{name:'Webpanel',value:process.env.PUBLIC_PANEL_URL||'Webpanel-Adresse nach Hosting eintragen'})],ephemeral:true});
   if(i.commandName==='team') return i.reply({content:`Teamrollen werden über Discord-Rollen verwaltet. Mitglieder: ${i.guild.memberCount}`,ephemeral:true});
   if(i.commandName==='teamregeln'){
    return i.channel.send({embeds:[rulesEmbed()],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rules_confirm').setLabel('Regelwerk bestätigen').setEmoji('✅').setStyle(ButtonStyle.Success))]}).then(()=>i.reply({content:'Teamregelwerk veröffentlicht.',ephemeral:true}));
   }
   if(i.commandName==='ticket'){
    const topic=i.options.getString('thema',true).slice(0,500);
    const t={id:crypto.randomUUID().slice(0,8),userId:i.user.id,username:i.user.tag,topic,status:'open',createdAt:new Date().toISOString(),channelId:null};
    const category=process.env.TICKET_CATEGORY_ID;
    const channel=await i.guild.channels.create({name:`ticket-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,80),type:0,parent:category||undefined,permissionOverwrites:[{id:i.guild.id,deny:['ViewChannel']},{id:i.user.id,allow:['ViewChannel','SendMessages','ReadMessageHistory']},...(process.env.SUPPORT_ROLE_ID?[{id:process.env.SUPPORT_ROLE_ID,allow:['ViewChannel','SendMessages','ReadMessageHistory']}]:[])]});
    t.channelId=channel.id;store.update(d=>d.tickets.unshift(t));await channel.send({embeds:[ticketEmbed(t)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_close:${t.id}`).setLabel('Ticket schließen').setStyle(ButtonStyle.Danger))]});
    log('Ticket erstellt',`${t.id}: ${topic}`,i.user.tag);
    return i.reply({content:`Dein Ticket wurde erstellt: ${channel}`,ephemeral:true});
   }
   if(i.commandName==='whitelist'){
    const item={id:crypto.randomUUID().slice(0,8),userId:i.user.id,username:i.user.tag,character:i.options.getString('charakter',true).slice(0,80),age:i.options.getString('alter')||'',status:'pending',createdAt:new Date().toISOString()};
    store.update(d=>d.whitelist.unshift(item));log('Whitelist-Antrag',`${item.character} (${item.id})`,i.user.tag);
    return i.reply({content:`✅ Dein Whitelist-Antrag wurde eingereicht. ID: ${item.id}`,ephemeral:true});
   }
   if(i.commandName==='vorschlag'){
    const s={id:crypto.randomUUID().slice(0,8),userId:i.user.id,username:i.user.tag,text:i.options.getString('text',true).slice(0,1500),createdAt:new Date().toISOString()};
    store.update(d=>d.suggestions.unshift(s));log('Vorschlag',s.text,i.user.tag);
    return i.reply({content:'✅ Dein Vorschlag wurde an die Serververwaltung übermittelt.',ephemeral:true});
   }
   if(i.commandName==='report'){
    const r={id:crypto.randomUUID().slice(0,8),userId:i.user.id,username:i.user.tag,target:i.options.getString('spieler',true).slice(0,100),reason:i.options.getString('grund',true).slice(0,1000),status:'open',createdAt:new Date().toISOString()};
    store.update(d=>d.reports.unshift(r));log('Spielermeldung',`${r.target}: ${r.reason}`,i.user.tag);
    return i.reply({content:`✅ Meldung eingegangen. Referenz: ${r.id}`,ephemeral:true});
   }
   if(i.commandName==='clear'){const n=i.options.getInteger('anzahl',true);await i.channel.bulkDelete(n,true);return i.reply({content:`${n} Nachrichten gelöscht.`,ephemeral:true});}
   if(i.commandName==='kick'||i.commandName==='ban'){
    const user=i.options.getUser('mitglied',true),reason=i.options.getString('grund')||'Kein Grund angegeben';
    const member=await i.guild.members.fetch(user.id);
    if(i.commandName==='kick') await member.kick(reason); else await member.ban({reason});
    log(i.commandName==='kick'?'Kick':'Ban',`${user.tag}: ${reason}`,i.user.tag);
    return i.reply({content:`${user.tag} wurde ${i.commandName==='kick'?'gekickt':'gebannt'}.`,ephemeral:true});
   }
  }
  if(i.isButton()&&i.customId==='rules_confirm'){
   const db=store.read();if(db.ruleConfirmations.some(x=>x.userId===i.user.id))return i.reply({content:'Du hast bereits bestätigt.',ephemeral:true});
   const modal=new ModalBuilder().setCustomId('rules_modal').setTitle('Teamregelwerk bestätigen');
   const name=new TextInputBuilder().setCustomId('name').setLabel('Vollständiger Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
   const rank=new TextInputBuilder().setCustomId('rank').setLabel('Teamrang').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
   modal.addComponents(new ActionRowBuilder().addComponents(name),new ActionRowBuilder().addComponents(rank));return i.showModal(modal);
  }
  if(i.isModalSubmit()&&i.customId==='rules_modal'){
   const entry={userId:i.user.id,username:i.user.tag,name:i.fields.getTextInputValue('name'),rank:i.fields.getTextInputValue('rank'),createdAt:new Date().toISOString()};
   store.update(d=>d.ruleConfirmations.push(entry));log('Regelwerk bestätigt',`${entry.name} • ${entry.rank}`,i.user.tag);
   return i.reply({content:'✅ Teamregelwerk erfolgreich bestätigt.',ephemeral:true});
  }
  if(i.isButton()&&i.customId.startsWith('ticket_close:')){
   const id=i.customId.split(':')[1];const t=store.read().tickets.find(x=>x.id===id);
   if(!i.memberPermissions?.has(PermissionFlagsBits.ManageChannels)&&t?.userId!==i.user.id)return i.reply({content:'Keine Berechtigung.',ephemeral:true});
   store.update(d=>{const x=d.tickets.find(t=>t.id===id);if(x){x.status='closed';x.closedAt=new Date().toISOString();}});
   log('Ticket geschlossen',id,i.user.tag);await i.reply({content:'Ticket wird geschlossen.',ephemeral:true});setTimeout(()=>i.channel?.delete().catch(()=>{}),3000);
  }
 }catch(e){console.error('Interaction:',e);if(i.isRepliable()&&!i.replied&&!i.deferred)await i.reply({content:'Es ist ein Fehler aufgetreten. Bitte Teamleitung informieren.',ephemeral:true}).catch(()=>{});}
});
app.get('/api/health',(req,res)=>res.json({ok:true,bot:client.isReady(),uptime:process.uptime()}));
app.post('/api/login',(req,res)=>{
 const user=String(req.body.username||''),pass=String(req.body.password||'');
 const expectedUser=process.env.PANEL_USER||'admin';
 const a=Buffer.from(pass),b=Buffer.from(process.env.PANEL_PASSWORD);
 if(user!==expectedUser||a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Login fehlgeschlagen'});
 req.session.authenticated=true;req.session.user=user;res.json({ok:true,user});
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',auth,(req,res)=>res.json({user:req.session.user}));
app.get('/api/data',auth,(req,res)=>{
 const d=store.read();
 res.json({bot:client.isReady(),guild:client.isReady()?client.guilds.cache.get(process.env.GUILD_ID)?.name:'Nicht verbunden',uptime:Math.floor(process.uptime()),counts:{tickets:d.tickets.length,openTickets:d.tickets.filter(x=>x.status==='open').length,whitelist:d.whitelist.length,pendingWhitelist:d.whitelist.filter(x=>x.status==='pending').length,reports:d.reports.filter(x=>x.status==='open').length,suggestions:d.suggestions.length,staff:d.staff.length,invoices:d.invoices.length,absences:d.absences.length},tickets:d.tickets.slice(0,50),whitelist:d.whitelist.slice(0,50),reports:d.reports.slice(0,50),suggestions:d.suggestions.slice(0,50),logs:d.logs.slice(0,30)});
});
app.patch('/api/whitelist/:id',auth,(req,res)=>{
 const status=['approved','rejected','pending'].includes(req.body.status)?req.body.status:null;if(!status)return res.status(400).json({error:'Ungültiger Status'});
 let found=false;store.update(d=>{const x=d.whitelist.find(x=>x.id===req.params.id);if(x){x.status=status;x.updatedAt=new Date().toISOString();found=true;}});
 if(!found)return res.status(404).json({error:'Antrag nicht gefunden'});log('Whitelist aktualisiert',`${req.params.id}: ${status}`,req.session.user);res.json({ok:true});
});
app.patch('/api/tickets/:id',auth,(req,res)=>{
 const status=req.body.status==='closed'?'closed':'open';let found=false;store.update(d=>{const x=d.tickets.find(x=>x.id===req.params.id);if(x){x.status=status;found=true;}});
 if(!found)return res.status(404).json({error:'Ticket nicht gefunden'});log('Ticketstatus',`${req.params.id}: ${status}`,req.session.user);res.json({ok:true});
});

// Erweiterte Verwaltungsmodule: Team, Dienst, Verwarnungen, Rechnungen und Abwesenheiten.
app.get('/api/management',auth,(req,res)=>{
 const d=store.read();
 res.json({
  staff:d.staff.slice(-200).reverse(),shifts:d.shifts.slice(-200).reverse(),
  warnings:d.warnings.slice(-200).reverse(),invoices:d.invoices.slice(-200).reverse(),
  absences:d.absences.slice(-200).reverse(),confirmations:d.ruleConfirmations.slice(-200).reverse(),
  applications:d.applications.slice(-100).reverse()
 });
});
app.post('/api/staff',auth,(req,res)=>{
 const name=String(req.body.name||'').trim(),discordId=String(req.body.discordId||'').trim(),rank=String(req.body.rank||'').trim(),department=String(req.body.department||'Allgemein').trim();
 if(!name||!rank||!/^\\d{17,20}$/.test(discordId))return res.status(400).json({error:'Name, Rang und gültige Discord-ID werden benötigt.'});
 let item;
 store.update(d=>{item={id:crypto.randomUUID(),name,discordId,rank,department,createdAt:new Date().toISOString(),createdBy:req.session.user};d.staff.unshift(item);});
 log('Teammitglied eingetragen',`${name} · ${rank} · ${department}`,req.session.user);res.json({ok:true,item});
});
app.delete('/api/staff/:id',auth,(req,res)=>{
 let found=false;store.update(d=>{const n=d.staff.length;d.staff=d.staff.filter(x=>x.id!==req.params.id);found=d.staff.length!==n;});
 if(!found)return res.status(404).json({error:'Teammitglied nicht gefunden'});log('Teammitglied entfernt',req.params.id,req.session.user);res.json({ok:true});
});
app.post('/api/warnings',auth,(req,res)=>{
 const discordId=String(req.body.discordId||'').trim(),reason=String(req.body.reason||'').trim();
 if(!/^\\d{17,20}$/.test(discordId)||!reason)return res.status(400).json({error:'Gültige Discord-ID und Grund erforderlich.'});
 let item;store.update(d=>{item={id:crypto.randomUUID(),discordId,reason,createdAt:new Date().toISOString(),createdBy:req.session.user};d.warnings.unshift(item);});
 log('Verwarnung gespeichert',`${discordId}: ${reason}`,req.session.user);res.json({ok:true,item});
});
app.post('/api/invoices',auth,(req,res)=>{
 const customer=String(req.body.customer||'').trim(),reason=String(req.body.reason||'').trim(),amount=Number(req.body.amount);
 if(!customer||!reason||!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'Empfänger, Grund und positiver Betrag erforderlich.'});
 let item;store.update(d=>{item={id:'FV2-'+Date.now(),customer,amount,reason,status:'offen',createdAt:new Date().toISOString(),createdBy:req.session.user};d.invoices.unshift(item);});
 log('Rechnung erstellt',`${item.id} · ${customer} · ${amount.toFixed(2)} €`,req.session.user);res.json({ok:true,item});
});
app.patch('/api/invoices/:id',auth,(req,res)=>{
 const status=['offen','bezahlt','storniert'].includes(req.body.status)?req.body.status:null;if(!status)return res.status(400).json({error:'Ungültiger Rechnungsstatus'});
 let found=false;store.update(d=>{const x=d.invoices.find(v=>v.id===req.params.id);if(x){x.status=status;x.updatedAt=new Date().toISOString();found=true;}});
 if(!found)return res.status(404).json({error:'Rechnung nicht gefunden'});log('Rechnungsstatus geändert',`${req.params.id}: ${status}`,req.session.user);res.json({ok:true});
});
app.post('/api/absences',auth,(req,res)=>{
 const person=String(req.body.person||'').trim(),from=String(req.body.from||'').trim(),to=String(req.body.to||'').trim(),reason=String(req.body.reason||'').trim();
 if(!person||!from||!to||!reason)return res.status(400).json({error:'Alle Felder sind erforderlich.'});
 let item;store.update(d=>{item={id:crypto.randomUUID(),person,from,to,reason,status:'gemeldet',createdAt:new Date().toISOString(),createdBy:req.session.user};d.absences.unshift(item);});
 log('Abwesenheit eingetragen',`${person} · ${from} bis ${to}`,req.session.user);res.json({ok:true,item});
});
app.patch('/api/absences/:id',auth,(req,res)=>{
 const status=['gemeldet','genehmigt','abgelehnt'].includes(req.body.status)?req.body.status:null;if(!status)return res.status(400).json({error:'Ungültiger Status'});
 let found=false;store.update(d=>{const x=d.absences.find(v=>v.id===req.params.id);if(x){x.status=status;found=true;}});
 if(!found)return res.status(404).json({error:'Abwesenheit nicht gefunden'});log('Abwesenheit aktualisiert',`${req.params.id}: ${status}`,req.session.user);res.json({ok:true});
});

app.use(express.static(publicDir));
app.get(/.*/,(req,res)=>res.sendFile(path.join(publicDir,'index.html')));
const port=Number(process.env.PORT)||3000;
app.listen(port,()=>console.log(`Freiburg V2 Webpanel läuft auf Port ${port}`));
client.login(process.env.DISCORD_TOKEN).catch(e=>{console.error('Discord Login fehlgeschlagen:',e.message);process.exit(1);});
process.on('unhandledRejection',e=>console.error('Unhandled rejection:',e));
