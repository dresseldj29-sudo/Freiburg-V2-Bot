require('dotenv').config();
const {
 Client, GatewayIntentBits, Partials, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
 ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
 REST, Routes, PermissionFlagsBits, ChannelType
}=require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, NoSubscriberBehavior }=require('@discordjs/voice');
const CONFIG_URL=process.env.BOT_CONFIG_URL;
const CONFIG_SECRET=process.env.BOT_CONFIG_SECRET;
let remoteConfigBusy=false;
async function syncRemoteConfig(){if(!CONFIG_URL||!CONFIG_SECRET||remoteConfigBusy)return;remoteConfigBusy=true;try{const r=await fetch(CONFIG_URL,{headers:{'x-bot-config-secret':CONFIG_SECRET},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Dashboard-Konfiguration HTTP '+r.status);const incoming=await r.json();if(!incoming||typeof incoming!=='object')throw new Error('Ungültige Dashboard-Konfiguration');store.update(d=>{d.config={...d.config,...(incoming.config||{})};if(Array.isArray(incoming.ticketCategories))d.ticketCategories=incoming.ticketCategories.slice(0,25);});console.log('[Dashboard] Einstellungen synchronisiert.');}catch(e){console.error('[Dashboard] Synchronisierung fehlgeschlagen:',e.message);}finally{remoteConfigBusy=false;}}

async function sendHeartbeat(){if(!CONFIG_URL||!CONFIG_SECRET)return;try{const url=CONFIG_URL.replace(/\/api\/bot-config\/?$/,'/api/bot-heartbeat');const guild=client.guilds.cache.get(process.env.GUILD_ID);await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-bot-config-secret':CONFIG_SECRET},body:JSON.stringify({ping:client.ws.ping,guilds:client.guilds.cache.size,members:guild?.memberCount||0}),signal:AbortSignal.timeout(8000)});}catch(e){console.error('[Dashboard] Heartbeat fehlgeschlagen:',e.message);}}
const play=require('@iamtraction/play-dl');
const store=require('./store');
const commands=require('./commands');

if(!process.env.DISCORD_TOKEN||!process.env.CLIENT_ID||!process.env.GUILD_ID){
 console.error('Bitte DISCORD_TOKEN, CLIENT_ID und GUILD_ID in .env eintragen.');process.exit(1);
}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildVoiceStates],partials:[Partials.Channel]});
const RED=0xB3262D, GREEN=0x248046;
const musicQueues=new Map();
const voiceSupportConnections=new Map();
const RADIO_URL='https://www.youtube.com/watch?v=zaSZE194D4I&list=RDzaSZE194D4I&start_radio=1';
async function retryMusic(task,label,attempts=3){
 let last;
 for(let attempt=1;attempt<=attempts;attempt++){
  try{return await task();}
  catch(error){
   last=error;
   const message=String(error?.message||error);
   const transient=error?.name==='AbortError'||/aborted|timeout|timed out|fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(message);
   console.error(`Musik ${label} Versuch ${attempt}/${attempts} fehlgeschlagen:`,error?.stack||message);
   if(!transient||attempt===attempts)break;
   await new Promise(resolve=>setTimeout(resolve,700*attempt));
  }
 }
 throw last;
}
function getQueue(guildId){
 if(!musicQueues.has(guildId)){
  const player=createAudioPlayer({behaviors:{noSubscriber:NoSubscriberBehavior.Pause}});
  const q={songs:[],connection:null,player,volume:0.5,playing:false,radioLoading:false};
  player.on(AudioPlayerStatus.Idle,()=>{q.playing=false;if(!q.radioLoading)q.songs.shift();if(!q.radioLoading)playNext(guildId).catch(e=>console.error('Musik:',e));});
  player.on('error',e=>{console.error('Audio-Fehler:',e.message);q.playing=false;q.songs.shift();playNext(guildId).catch(console.error);});
  musicQueues.set(guildId,q);
 }
 return musicQueues.get(guildId);
}
async function playNext(guildId){
 const q=musicQueues.get(guildId);
 if(!q||!q.songs.length){if(q)q.playing=false;return false;}
 const song=q.songs[0];
 try{
  if(!/^https?:\/\//i.test(song.url))throw new Error('Ungültige Musikquelle');
  const stream=await retryMusic(()=>play.stream(song.url),'Audiostream');
  if(!stream?.stream)throw new Error('YouTube hat keinen Audiostream geliefert.');
  const resource=createAudioResource(stream.stream,{inputType:stream.type,inlineVolume:true});
  resource.volume.setVolume(q.volume);
  q.player.play(resource);q.playing=true;return true;
 }catch(e){
  console.error('Song konnte nicht abgespielt werden:',e.message);
  q.songs.shift();q.playing=false;
  if(q.songs.length)return playNext(guildId);
  return false;
 }
}
async function connectVoice(i){
 const vc=i.member?.voice?.channel;
 if(!vc)throw new Error('Du musst zuerst einem Voice-Channel beitreten.');
 const q=getQueue(i.guildId);
 if(q.connection&&q.connection.joinConfig.channelId!==vc.id){q.connection.destroy();q.connection=null;}
 if(!q.connection){
  const connection=joinVoiceChannel({channelId:vc.id,guildId:i.guildId,adapterCreator:i.guild.voiceAdapterCreator,selfDeaf:true,debug:true});
  q.connection=connection;
  connection.subscribe(q.player);
  connection.on('stateChange',(oldState,newState)=>console.log(`[Voice] ${oldState.status} -> ${newState.status} | Kanal ${vc.id}`));
  connection.on('debug',message=>{
   // Voice-Debug kann Sitzungsdaten enthalten: Tokens vor dem Loggen entfernen.
   const safe=String(message).replace(/("token"\s*:\s*")[^"]+(")/gi,'$1[REDACTED]$2').replace(/(token[=:]\s*)[^\s,}]+/gi,'$1[REDACTED]');
   console.log('[Voice Debug]',safe);
  });
  connection.on('error',error=>console.error('[Voice Error]',error?.stack||error));
  connection.on(VoiceConnectionStatus.Disconnected,async()=>{
   try{
    await Promise.race([
     entersState(connection,VoiceConnectionStatus.Signalling,5000),
     entersState(connection,VoiceConnectionStatus.Connecting,5000)
    ]);
   }catch(error){
    console.error('[Voice] Verbindung dauerhaft getrennt:',error?.message||error);
    connection.destroy();
    if(q.connection===connection)q.connection=null;
   }
  });
 }
 if(q.connection.state.status!==VoiceConnectionStatus.Ready){
  const connection=q.connection;
  try{
   await entersState(connection,VoiceConnectionStatus.Ready,30000);
  }catch(error){
   const state=connection.state?.status||'unbekannt';
   console.error(`[Voice] READY-Timeout; letzter Status: ${state}`,error?.stack||error);
   connection.destroy();
   if(q.connection===connection)q.connection=null;
   const failure=new Error(`DISCORD_VOICE_TIMEOUT: Discord-Sprachverbindung wurde nicht bereit (Status: ${state}). Bitte prüfe Voice-Berechtigungen und ob der Hosting-Anbieter UDP-Verbindungen zulässt.`);
   failure.code='DISCORD_VOICE_TIMEOUT';
   throw failure;
  }
 }
 return q;
}
const defaults={
 config:{serverName:'Freiburg V2 Roleplay',logChannelId:'',ticketParentId:'',supportRoleId:'',teamRoleId:'',welcomeChannelId:'',welcomeEnabled:false,goodbyeChannelId:'',goodbyeEnabled:false,goodbyeText:'{user} hat Freiburg V2 verlassen. Auf Wiedersehen!',autoRoleId:'',suggestionChannelId:'',reportChannelId:'',applicationChannelId:'',rulesChannelId:'',welcomeText:'Willkommen auf Freiburg V2, {user}!'},
 ticketCategories:[
  {id:'support',name:'Allgemeiner Support',emoji:'🎫',description:'Fragen und allgemeine Hilfe',parentId:''},
  {id:'bug',name:'Bug melden',emoji:'🐛',description:'Fehler oder technische Probleme melden',parentId:''},
  {id:'spieler',name:'Spieler melden',emoji:'🚨',description:'Eine Meldung vertraulich einreichen',parentId:''}
 ],
 tickets:[],whitelist:[],suggestions:[],reports:[],applications:[],ruleConfirmations:[],logs:[],staff:[],warnings:[],absences:[],giveawayEntries:[],giveawayState:{}
};
function db(){const saved=store.read();return {...defaults,...saved,config:{...defaults.config,...saved.config},ticketCategories:saved.ticketCategories?.length?saved.ticketCategories:defaults.ticketCategories};}
function update(fn){return store.update(d=>{for(const [k,v] of Object.entries(defaults))if(d[k]===undefined)d[k]=Array.isArray(v)?[]:(v&&typeof v==='object'?{...v}:v);d.config={...defaults.config,...d.config};if(!Array.isArray(d.ticketCategories)||d.ticketCategories.length===0)d.ticketCategories=defaults.ticketCategories.map(x=>({...x}));return fn(d);});}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isAdmin=i=>{const ids=db().config.dashboardAccessRoleIds||[];const cached=i.guild?.members?.cache?.get(i.user.id);const roles=i.member?.roles?.cache?[...i.member.roles.cache.keys()]:Array.isArray(i.member?.roles)?i.member.roles:(cached?[...cached.roles.cache.keys()]:[]);if(ids.length)return roles.some(id=>ids.includes(id))||i.memberPermissions?.has(PermissionFlagsBits.Administrator);return i.memberPermissions?.has(PermissionFlagsBits.Administrator);};
function log(type,description,user='System'){
 update(d=>{d.logs.unshift({id:Date.now().toString(36),type,description,user,at:new Date().toISOString()});d.logs=d.logs.slice(0,500);});
 const id=db().config.logChannelId;
 if(id)client.channels.fetch(id).then(ch=>ch?.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('Freiburg V2 • '+type).setDescription(esc(description).slice(0,4000)).addFields({name:'Ausgeführt von',value:esc(user)}).setTimestamp()]})).catch(e=>console.error('Logkanal:',e.message));
}
const teamRules=[
['§ 1 – Grundverständnis und Geltungsbereich','Diese Dienstordnung gilt ausnahmslos für alle Teammitglieder von Freiburg V2 – unabhängig von Rang, Abteilung, Dienstzeit oder persönlichem Status. Mit der Aufnahme in das Team wird die Kenntnisnahme und Einhaltung aller Bestimmungen vorausgesetzt. Unwissenheit schützt nicht vor Konsequenzen. Ergänzende Anweisungen der Teamleitung sind verbindlich, sofern sie diesen Regeln nicht widersprechen.'],
['§ 2 – Auftreten und respektvoller Umgang','Jedes Teammitglied repräsentiert Freiburg V2 innerhalb und außerhalb des Servers. Ein höflicher, sachlicher und respektvoller Umgang ist jederzeit Pflicht. Beleidigungen, Provokationen, Diskriminierung, Mobbing, Drohungen und absichtliches Bloßstellen werden nicht geduldet. Konflikte werden ruhig und intern geklärt. Persönliche Differenzen dürfen niemals die Behandlung von Spielern beeinflussen.'],
['§ 3 – Professionalität und Vorbildfunktion','Teammitglieder halten sich besonders sorgfältig an die Serverregeln. Sie nutzen keine Sonderstellung, um Vorteile zu erhalten, andere einzuschüchtern oder sich über Spieler zu stellen. Diskussionen über interne Entscheidungen gehören nicht in öffentliche Kanäle. Fehler werden offen angesprochen und korrigiert. Ein Teammitglied bleibt auch bei Provokationen ruhig und lösungsorientiert.'],
['§ 4 – Dienstpflicht und Erreichbarkeit','Während eines offiziell übernommenen Dienstes sind Teammitglieder aufmerksam, ansprechbar und arbeitsfähig. Supportanfragen dürfen nicht grundlos ignoriert oder unnötig verzögert werden. Kann ein Anliegen nicht sofort bearbeitet werden, ist dies transparent mitzuteilen. Pausen und Dienstende sind kenntlich zu machen. Abwesenheiten und längere Inaktivität sind frühzeitig bei der zuständigen Leitung zu melden.'],
['§ 5 – Support und Beschwerdebearbeitung','Jeder Supportfall wird neutral und ohne Vorverurteilung behandelt. Beide Seiten erhalten Gelegenheit zur Darstellung ihrer Sicht. Beweise wie Clips, Screenshots und Chatverläufe sind sachlich zu prüfen. Entscheidungen müssen nachvollziehbar und angemessen sein. Teammitglieder dürfen keine Fälle bearbeiten, in denen sie selbst beteiligt, befangen oder persönlich betroffen sind; der Fall ist weiterzugeben.'],
['§ 6 – Beweispflicht und Dokumentation','Relevante Supportentscheidungen, Verwarnungen, Sanktionen und besondere Vorfälle sind vollständig und wahrheitsgemäß zu dokumentieren. Beweise dürfen nicht manipuliert, aus dem Zusammenhang gerissen oder absichtlich zurückgehalten werden. Interne Notizen müssen sachlich, verständlich und frei von persönlichen Angriffen sein. Bei schwerwiegenden Maßnahmen ist die zuständige Leitung zu informieren.'],
['§ 7 – Rechte und Befehle','Administrative Rechte dürfen ausschließlich für legitime dienstliche Aufgaben eingesetzt werden. Teleport, Heal, Revive, Spectate, Freeze, Give- und ähnliche Befehle sind niemals für private Vorteile, Spaß auf Kosten anderer oder RP-Eingriffe ohne Berechtigung bestimmt. Jede missbräuchliche Nutzung kann zum sofortigen Entzug der Rechte führen.'],
['§ 8 – Sanktionen und Verhältnismäßigkeit','Maßnahmen müssen auf nachvollziehbaren Regelverstößen beruhen und verhältnismäßig sein. Verwarnungen, Kicks, temporäre Sperren und permanente Banns dürfen nicht aus Rache, Ärger oder persönlichen Gründen erfolgen. Bei Unsicherheit ist eine höhere Instanz hinzuzuziehen. Sonderbehandlungen von Freunden, Bekannten oder anderen Teammitgliedern sind untersagt.'],
['§ 9 – Datenschutz und Vertraulichkeit','Spielerdaten, private Nachrichten, Bewerbungen, Gesprächsnotizen, IP-bezogene Informationen und interne Vorgänge sind vertraulich zu behandeln. Eine Weitergabe an Unbefugte, Veröffentlichung oder private Nutzung ist untersagt. Zugangsdaten und Bot-Tokens dürfen niemals geteilt werden. Screenshots aus internen Bereichen dürfen nur mit ausdrücklicher Freigabe weitergegeben werden.'],
['§ 10 – Interessenkonflikte und Befangenheit','Eigene Freunde, Familienmitglieder, Konfliktpartner oder Personen, mit denen ein persönlicher Streit besteht, dürfen nicht bevorzugt oder benachteiligt werden. Bei möglicher Befangenheit wird der Fall an ein anderes Teammitglied übergeben. Teammitglieder dürfen keine Entscheidungen über eigene Beschwerden oder Sanktionen treffen.'],
['§ 11 – Kommunikation und interne Kanäle','Interne Kanäle sind ausschließlich für ihren vorgesehenen Zweck zu verwenden. Vertrauliche Diskussionen bleiben intern. Anweisungen der Leitung sind sachlich zu beantworten; Kritik ist erlaubt und soll respektvoll sowie über den vorgesehenen Weg geäußert werden. Spam, absichtliche Störungen und das Veröffentlichen interner Abstimmungen sind untersagt.'],
['§ 12 – Teamhierarchie und Weisungen','Die Teamstruktur dient der Koordination und klaren Zuständigkeit. Rang bedeutet Verantwortung und keine persönliche Überlegenheit. Weisungen müssen im Rahmen der Zuständigkeit erfolgen. Unstimmigkeiten werden zunächst intern angesprochen und bei Bedarf an die nächsthöhere Instanz weitergegeben. Eigenmächtige Änderungen an Teamabläufen oder Berechtigungen sind nicht gestattet.'],
['§ 13 – Aktivität, Urlaub und Austritt','Längere Abwesenheiten sind rechtzeitig zu melden. Eine Abwesenheitsmeldung enthält einen realistischen Zeitraum und eine Kontaktmöglichkeit, sofern erforderlich. Bei geplantem Austritt sind übertragene Aufgaben, offene Fälle und dienstliche Informationen geordnet zu übergeben. Teamrechte und interne Unterlagen dürfen nach dem Austritt nicht weiter genutzt oder verbreitet werden.'],
['§ 14 – Bewerbungen und Personalentscheidungen','Bewerbungen sind fair, vertraulich und nach einheitlichen Kriterien zu bearbeiten. Persönliche Sympathie, Freundschaften oder externe Einflüsse dürfen die Auswahl nicht bestimmen. Zusagen, Ablehnungen und Rangänderungen dürfen nur durch befugte Personen erfolgen. Bewerberdaten werden nur so lange und so umfangreich gespeichert, wie es für den Zweck erforderlich ist.'],
['§ 15 – Geschenke, Vorteile und Bestechung','Das Annehmen oder Fordern von Geld, Gegenständen, Ingame-Vorteilen oder sonstigen Gegenleistungen für Supportentscheidungen, Freischaltungen, Sanktionen oder Rangvergaben ist untersagt. Angebote dieser Art sind abzulehnen und der Leitung zu melden.'],
['§ 16 – Auftreten auf anderen Plattformen','Auch in Discord, Voice-Chats und sonstigen offiziellen FreiburgV2-Plattformen gelten diese Grundsätze. Teammitglieder dürfen ihre Rolle nicht nutzen, um andere Nutzer außerhalb des Servers zu bedrängen. Öffentliche Aussagen im Namen des Projekts dürfen nur von hierzu befugten Personen getroffen werden.'],
['§ 17 – Fehlerkultur und Zusammenarbeit','Fehler sind unverzüglich und ehrlich zu melden. Vertuschung, Beweisvernichtung oder gegenseitige Schuldzuweisung verschärfen einen Vorfall. Teammitglieder unterstützen einander, geben Wissen weiter und fragen bei Unsicherheit nach. Ziel ist ein einheitlicher, fairer und verlässlicher Teamstandard.'],
['§ 18 – Kontrolle und Konsequenzen','Verstöße werden abhängig von Schwere, Wiederholung, Absicht und Folgen geprüft. Mögliche Maßnahmen sind Hinweis, mündliche oder schriftliche Verwarnung, verpflichtendes Gespräch, vorübergehende Einschränkung von Rechten, Rangänderung oder Ausschluss aus dem Team. Schwere Verstöße können eine sofortige Suspendierung rechtfertigen. Betroffene erhalten – soweit möglich – Gelegenheit zur Stellungnahme.'],
['§ 19 – Änderungen und Inkrafttreten','Die Projektleitung kann dieses Regelwerk ergänzen oder aktualisieren. Änderungen werden in den offiziellen Teamkanälen bekannt gegeben. Teammitglieder sind verpflichtet, sich über neue Fassungen zu informieren. Die jeweils zuletzt veröffentlichte Fassung ist maßgeblich.'],
['Bestätigung','Mit der Bestätigung erklärst du, dass du das vollständige Teamregelwerk gelesen und verstanden hast und dich an sämtliche Bestimmungen hältst. Bei Fragen wendest du dich vor deiner Bestätigung an die Teamleitung.']
];
function rulesEmbeds(){
 const chunks=[];for(let i=0;i<teamRules.length;i+=5)chunks.push(new EmbedBuilder().setColor(RED).setTitle(i===0?'🛡️ FREIBURG V2 – VERBINDLICHES TEAMREGELWERK':`FREIBURG V2 | TEAMREGELWERK – FORTSETZUNG ${Math.floor(i/5)+1}`).setDescription(teamRules.slice(i,i+5).map(([n,v])=>`**${n}**\n${v}`).join('\n\n')).setFooter({text:`Freiburg V2 • Abschnitt ${Math.floor(i/5)+1}/${Math.ceil(teamRules.length/5)}`}));return chunks;
}
function ticketPanel(){
 const cats=db().ticketCategories.slice(0,25);
 const menu=new StringSelectMenuBuilder().setCustomId('ticket_category').setPlaceholder('Wähle eine Kategorie, um ein Ticket zu öffnen…').addOptions(cats.map(c=>({label:c.name.slice(0,100),value:c.id,description:(c.description||'Ticket eröffnen').slice(0,100),emoji:c.emoji||'🎫'})));
 const embed=new EmbedBuilder().setColor(RED).setTitle('🎫 Support-Ticket erstellen').setDescription('Wähle unten eine Kategorie aus, um direkt ein Ticket zu eröffnen. Unser Freiburg-V2-Team hilft dir schnellstmöglich weiter.');
 for(const c of cats){const opened=db().tickets.filter(t=>t.categoryId===c.id&&t.status==='open').length;const max=Math.max(1,Math.min(500,Number(c.maxTickets)||10));const pct=Math.min(100,Math.round(opened/max*100));embed.addFields({name:(c.emoji||'🎫')+' '+c.name,value:(opened>=max?'🔴 Ausgelastet':'🟢 Verfügbar')+'\n**'+opened+'/'+max+'** ('+pct+'%)',inline:true});}
 embed.addFields({name:'⭐ Bewertung',value:'Noch keine Bewertungen vorhanden',inline:true});
 const banner=cats.find(c=>/^https:\/\//i.test(c.imageUrl||''))?.imageUrl;if(banner)embed.setImage(banner);
 embed.setFooter({text:'Freiburg V2 • Support-Center'});
 return [embed,new ActionRowBuilder().addComponents(menu)];
}
async function openTicket(i,cat){
 const fields=Array.isArray(cat.formFields)?cat.formFields.filter(f=>f.label).slice(0,5):[];
 if(fields.length){const modal=new ModalBuilder().setCustomId('ticket_form:'+cat.id).setTitle(('Ticket: '+cat.name).slice(0,45));for(let n=0;n<fields.length;n++){const f=fields[n],input=new TextInputBuilder().setCustomId('answer_'+n).setLabel(f.label.slice(0,45)).setStyle(f.style==='paragraph'?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(f.required!==false).setMaxLength(1000);if(f.placeholder)input.setPlaceholder(f.placeholder.slice(0,100));modal.addComponents(new ActionRowBuilder().addComponents(input));}return i.showModal(modal);}
 return createTicket(i,cat,{});
}
async function createTicket(i,cat,answers={}){
 const guild=i.guild, user=i.user;
 const existing=db().tickets.find(t=>t.userId===user.id&&t.status==='open'&&t.categoryId===cat.id);
 if(existing&&existing.channelId){const ch=guild.channels.cache.get(existing.channelId)||await guild.channels.fetch(existing.channelId).catch(()=>null);if(ch)return i.reply({content:`Du hast in dieser Kategorie bereits ein offenes Ticket: ${ch}`,flags:MessageFlags.Ephemeral});}
 const parent=cat.parentId||db().config.ticketParentId||undefined;
 const overwrites=[{id:guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]}];
 if(db().config.supportRoleId)overwrites.push({id:db().config.supportRoleId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
 const channel=await guild.channels.create({name:`${cat.id}-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,90),type:ChannelType.GuildText,parent,permissionOverwrites:overwrites,reason:`FreiburgV2 Ticket von ${user.tag}`});
 const t={id:Date.now().toString(36),userId:user.id,username:user.tag,categoryId:cat.id,category:cat.name,status:'open',channelId:channel.id,createdAt:new Date().toISOString()};
 update(d=>d.tickets.unshift(t));
 const buttons=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_close:${t.id}`).setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId(`ticket_claim:${t.id}`).setLabel('Ticket übernehmen').setEmoji('🙋').setStyle(ButtonStyle.Primary));
 await channel.send({content:`<@${user.id}> ${db().config.supportRoleId?`<@&${db().config.supportRoleId}>`:''}`,embeds:[new EmbedBuilder().setColor(RED).setTitle(`${cat.emoji||'🎫'} ${cat.name}`).setDescription(`Hallo <@${user.id}>!\n\nDein Ticket wurde erstellt.\n\n**Ticket-ID:** ${t.id}\n**Kategorie:** ${cat.name}\n**Erstellt:** <t:${Math.floor(Date.now()/1000)}:F>\n\n${Object.entries(answers).map(([k,v])=>'**'+k+'**\n'+v).join('\n\n')||'Beschreibe dein Anliegen möglichst genau.'}`).setImage(/^https:\/\//i.test(cat.imageUrl||'')?cat.imageUrl:null).setFooter({text:'Freiburg V2 Support'})],components:[buttons]});
 log('Ticket erstellt',`${t.id} • ${cat.name} • ${user.tag}`,user.tag);
 return i.reply({content:`Dein Ticket wurde erstellt: ${channel}`,flags:MessageFlags.Ephemeral});
}
function giveawayEmbed(job,count,endsAt,finished=false,winners=[]){const desc=(job.description?job.description+'\n\n':'')+'**Preis:** '+job.prize+'\n**Gewinner:** '+job.winnerCount+'\n**'+(finished?'Beendet':'Endet')+'**: <t:'+Math.floor(endsAt/1000)+':F>\n**Teilnehmer:** '+count+(finished?'\n\n**Gewinner:** '+(winners.length?winners.map(id=>'<@'+id+'>').join(', '):'Keine Teilnehmer'):'');return new EmbedBuilder().setColor(finished?GREEN:RED).setTitle((finished?'🏁 ':'🎉 ')+job.title).setDescription(desc).setFooter({text:'Freiburg V2 • Giveaway'}).setTimestamp();}
let giveawayProcessing=false;
async function processGiveaways(){
 if(giveawayProcessing)return;giveawayProcessing=true;
 try{
  const jobs=db().config.giveawayJobs||[];
  for(const job of jobs){
   if(!job?.id||!job.channelId||!job.messageId)continue;
   let state=db().giveawayState[job.id]||{endsAt:Number(job.endsAt),messageId:job.messageId,completed:0};
   if(job.status==='cancelled'){
    if(!state.cancelled){const ch=await client.channels.fetch(job.channelId).catch(()=>null),m=ch&&await ch.messages.fetch(state.messageId||job.messageId).catch(()=>null);if(m)await m.edit({embeds:[giveawayEmbed(job,db().giveawayEntries.filter(x=>x.giveawayId===job.id).length,state.endsAt,true,[])],components:[]}).catch(()=>{});update(d=>{d.giveawayState[job.id]={...state,cancelled:true};});}
    continue;
   }
   if(state.cancelled||state.completedFinal)continue;
   if(state.repeatAt){if(Date.now()<state.repeatAt)continue;
    const ch=await client.channels.fetch(job.channelId).catch(()=>null);
    if(!ch?.isTextBased())continue;
    const endsAt=Date.now()+Math.max(1,Number(job.durationMinutes)||60)*60000;
    const msg=await ch.send({embeds:[giveawayEmbed(job,0,endsAt,false)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_join:'+job.id).setLabel('Teilnehmen').setEmoji('🎉').setStyle(ButtonStyle.Success))]}).catch(e=>{console.error('[Giveaway] Wiederholung fehlgeschlagen:',e.message);return null;});
    if(msg){update(d=>{d.giveawayState[job.id]={endsAt,messageId:msg.id,completed:state.completed,repeatAt:null};d.giveawayEntries=d.giveawayEntries.filter(x=>x.giveawayId!==job.id);});}
    continue;
   }
   if(Date.now()<state.endsAt)continue;
   const entries=db().giveawayEntries.filter(x=>x.giveawayId===job.id),pool=[];
   for(const entry of entries)for(let n=0;n<Math.min(101,1+(Number(entry.extraTickets)||0));n++)pool.push(entry.userId);
   const winners=[];while(pool.length&&winners.length<Math.min(Number(job.winnerCount)||1,new Set(entries.map(x=>x.userId)).size)){const pick=pool.splice(Math.floor(Math.random()*pool.length),1)[0];if(!winners.includes(pick))winners.push(pick);}
   const channel=await client.channels.fetch(job.channelId).catch(()=>null),message=channel&&await channel.messages.fetch(state.messageId||job.messageId).catch(()=>null);
   if(message)await message.edit({embeds:[giveawayEmbed(job,entries.length,state.endsAt,true,winners)],components:[]}).catch(e=>console.error('[Giveaway] Nachricht konnte nicht aktualisiert werden:',e.message));
   if(channel?.isTextBased())await channel.send({content:winners.length?'🎉 Glückwunsch '+winners.map(id=>'<@'+id+'>').join(', ')+'! Ihr habt **'+job.prize+'** gewonnen.':'🎉 Giveaway beendet – es gab keine Teilnehmer.',allowedMentions:{users:winners}}).catch(()=>{});
   const completed=(state.completed||0)+1,canRepeat=job.repeatInterval&&job.repeatInterval!=='none'&&completed<=Number(job.repeatCount||0);
   if(canRepeat){const interval=job.repeatInterval==='daily'?86400000:job.repeatInterval==='weekly'?604800000:2592000000;update(d=>{d.giveawayState[job.id]={...state,completed,repeatAt:Date.now()+interval};});}
   else update(d=>{d.giveawayState[job.id]={...state,completed,completedFinal:true};});
  }
 }finally{giveawayProcessing=false;}
}
setInterval(()=>processGiveaways().catch(e=>console.error('[Giveaway scheduler]:',e)),15000).unref();
async function register(){
 const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID),{body:commands});
 console.log(`✅ ${commands.length} Slash Commands registriert.`);
}
client.once('clientReady',async()=>{console.log(`🤖 Eingeloggt als ${client.user.tag}`);await syncRemoteConfig();await processGiveaways();await sendHeartbeat();setInterval(syncRemoteConfig,15000).unref();setInterval(sendHeartbeat,20000).unref();try{await register();}catch(e){console.error('Slash Commands:',e.message);}});
client.on('guildMemberAdd',async member=>{try{const c=db().config;if(c.welcomeEnabled&&c.welcomeChannelId){const ch=member.guild.channels.cache.get(c.welcomeChannelId)||await member.guild.channels.fetch(c.welcomeChannelId).catch(()=>null);if(ch?.isTextBased())await ch.send({embeds:[new EmbedBuilder().setColor(GREEN).setTitle('👋 Willkommen bei Freiburg V2!').setDescription(String(c.welcomeText||'Willkommen {user}!').replaceAll('{user}',`<@${member.id}>`).replaceAll('{server}',member.guild.name).replaceAll('{memberCount}',String(member.guild.memberCount))).setThumbnail(member.user.displayAvatarURL({size:256})).setImage(/^https:\/\//i.test(c.welcomeImageUrl||'')?c.welcomeImageUrl:null).setFooter({text:`Mitglied Nr. ${member.guild.memberCount}`}).setTimestamp()]});}if(c.autoRoleId){const role=member.guild.roles.cache.get(c.autoRoleId)||await member.guild.roles.fetch(c.autoRoleId).catch(()=>null);if(role)await member.roles.add(role,'Automatische Rolle bei Serverbeitritt');}}catch(e){console.error('[Willkommen/Rolle]:',e.message);}});
client.on('guildMemberRemove',async member=>{try{const c=db().config;if(!c.goodbyeEnabled||!c.goodbyeChannelId)return;const ch=member.guild.channels.cache.get(c.goodbyeChannelId)||await member.guild.channels.fetch(c.goodbyeChannelId).catch(()=>null);if(ch?.isTextBased())await ch.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('👋 Auf Wiedersehen!').setDescription(String(c.goodbyeText||'{user} hat den Server verlassen.').replaceAll('{user}',member.user?.tag||member.user?.username||'Ein Mitglied').replaceAll('{server}',member.guild.name).replaceAll('{memberCount}',String(member.guild.memberCount))).setThumbnail(member.user?.displayAvatarURL?.({size:256})||null).setTimestamp()]});}catch(e){console.error('[Verabschiedung]:',e.message);}});
client.on('voiceStateUpdate',async(oldState,newState)=>{try{const c=db().config;if(!c.voiceSupportEnabled||!c.voiceSupportLobbyId||newState.channelId!==c.voiceSupportLobbyId||oldState.channelId===newState.channelId||newState.member?.user?.bot)return;const guild=newState.guild,channel=newState.channel;if(!guild||!channel)return;const music=musicQueues.get(guild.id);if(music?.connection)return;let connection=voiceSupportConnections.get(guild.id);if(connection&&connection.joinConfig.channelId!==channel.id){connection.destroy();connection=null;voiceSupportConnections.delete(guild.id);}if(!connection){connection=joinVoiceChannel({channelId:channel.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true});voiceSupportConnections.set(guild.id,connection);connection.on('error',e=>console.error('[Voice-Support] Verbindung:',e.message));console.log('[Voice-Support] Bot ist dem Warteraum beigetreten:',channel.name);} }catch(e){console.error('[Voice-Support]:',e.message);}});
client.on('voiceStateUpdate',async(oldState,newState)=>{try{const c=db().config;if(!c.voiceSupportEnabled||!c.voiceSupportLobbyId||oldState.channelId!==c.voiceSupportLobbyId||newState.channelId===oldState.channelId)return;const channel=oldState.channel;if(channel&&!channel.members.some(m=>!m.user.bot)){const connection=voiceSupportConnections.get(oldState.guild.id);if(connection){connection.destroy();voiceSupportConnections.delete(oldState.guild.id);console.log('[Voice-Support] Warteraum leer, Bot hat ihn verlassen.');}}}catch(e){console.error('[Voice-Support Cleanup]:',e.message);}});
client.on('interactionCreate',async i=>{
 try{
  if(i.isChatInputCommand()){
   const cmd=i.commandName;
   if(cmd==='wartung'){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen Wartungsankündigungen vorbereiten.',flags:MessageFlags.Ephemeral});
    if(i.channelId!=='1571228234660450374')return i.reply({content:'Bitte führe /wartung nur im vorgesehenen Wartungs-Steuerkanal aus.',flags:MessageFlags.Ephemeral});
    const minutes=i.options.getInteger('minuten',true);
    const startAt=Math.floor(Date.now()/1000)+minutes*60;
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('wartung_publish:'+startAt).setLabel('Ankündigung jetzt veröffentlichen').setEmoji('📢').setStyle(ButtonStyle.Danger));
    const embed=new EmbedBuilder().setColor(RED).setTitle('🚧 Freiburg V2 • Wartung vorbereiten').setDescription(
      'Die Wartungsankündigung ist vorbereitet. Prüfe den geplanten Zeitpunkt und veröffentliche sie anschließend über den roten Button.\n\n'+
      '**Geplanter Wartungsbeginn:** <t:'+startAt+':F>\n'+
      '**Countdown:** <t:'+startAt+':R>\n\n'+
      '**Zielkanäle:**\n• <#1504257087608324157>\n• <#1504245602182238380>\n\n'+
      'Nach der Wartung müssen alle Mitglieder die aktuellen Serverregeln erneut lesen und bestätigen.'
    ).setFooter({text:'Freiburg V2 • Wartungssteuerung'});
    await i.channel.send({embeds:[embed],components:[row]});
    return i.reply({content:'✅ Vorschau erstellt. Geplanter Beginn: <t:'+startAt+':F> (<t:'+startAt+':R>).',flags:MessageFlags.Ephemeral});
   }
   if(cmd==='slowmode'){
    if(!isAdmin(i))return i.reply({content:'Du benötigst eine freigeschaltete Verwaltungsrolle.',flags:MessageFlags.Ephemeral});
    if(!i.channel?.isTextBased()||!i.channel.setRateLimitPerUser)return i.reply({content:'Slowmode ist in diesem Kanaltyp nicht verfügbar.',flags:MessageFlags.Ephemeral});
    const seconds=i.options.getInteger('sekunden',true),reason=i.options.getString('grund')||'Slowmode durch '+i.user.tag;
    await i.channel.setRateLimitPerUser(seconds,reason);
    log('Slowmode geändert',i.channel.name+': '+(seconds===0?'deaktiviert':seconds+' Sekunden')+' • '+reason,i.user.tag);
    return i.reply({content:seconds===0?'Slowmode wurde ausgeschaltet.':'Slowmode auf '+seconds+' Sekunden gesetzt.',flags:MessageFlags.Ephemeral});
   }
   if(cmd==='wartungbeendet'){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen die Wartung als beendet melden.',flags:MessageFlags.Ephemeral});
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const embed=new EmbedBuilder().setColor(GREEN).setTitle('WARTUNG BEENDET – FREIBURG V2 IST ZURÜCK!').setDescription(
      'Liebe Freiburg-V2-Community,\n\n'+
      'unsere Wartungsarbeiten sind abgeschlossen! Freiburg V2 ist wieder für euch da. Vielen Dank für eure Geduld.\n\n'+
      '**Das ist neu:**\n'+
      '• Überarbeitetes Control-Center zur Discord-Serververwaltung\n'+
      '• Willkommensbereich mit Bildern direkt vom PC\n'+
      '• Tickets mit eigenen Kategorien, Bildern und Formularen\n'+
      '• Slowmode zur besseren Moderation von Textkanälen\n'+
      '• Verbesserte Wartungs- und Statusmeldungen\n'+
      '• Technische Fehlerbehebungen und Optimierungen\n\n'+
      '**Bitte beachtet:** Lest die aktuellen Regeln und bestätigt sie erneut, falls Discord euch dazu auffordert.\n\n'+
      'Wir wünschen euch viel Spaß auf Freiburg V2!\n\n**Euer Freiburg V2 Team**').setFooter({text:'Freiburg V2 • Wartungsabschluss'}).setTimestamp();
    const targets=['1504257087608324157','1504245602182238380'],sent=[],failed=[];
    for(const id of targets){try{const ch=await client.channels.fetch(id);if(!ch?.isTextBased()||!ch.send)throw new Error('Kanal nicht verfügbar');await ch.send({embeds:[embed]});sent.push('<#'+id+'>');}catch(e){failed.push(id+': '+e.message);}}
    if(sent.length)log('Wartung beendet','Abschlussmeldung veröffentlicht: '+sent.join(', '),i.user.tag);
    return i.editReply(sent.length===targets.length?'Wartungsabschluss in beiden Kanälen veröffentlicht.':'Teilweise veröffentlicht. Erfolgreich: '+(sent.join(', ')||'keiner')+'. Fehler: '+failed.join(' | '));
   }
   if(cmd==='ping')return i.reply({content:`🏓 Pong! ${client.ws.ping} ms`,flags:MessageFlags.Ephemeral});
   if(cmd==='status')return i.reply({embeds:[new EmbedBuilder().setColor(GREEN).setTitle('Freiburg V2 • Botstatus').addFields({name:'Bot',value:'🟢 Online',inline:true},{name:'Ping',value:`${client.ws.ping} ms`,inline:true},{name:'Server',value:i.guild.name,inline:true},{name:'Laufzeit',value:`${Math.floor(process.uptime()/3600)} Stunden`,inline:true})],flags:MessageFlags.Ephemeral});
    if(cmd==='ply'||cmd==='play'||cmd==='radio'){
    await i.deferReply();
    try{
      const q=await connectVoice(i);
      if(cmd==='radio'){
       q.radioLoading=true;q.songs=[];q.player.stop(true);
       try{
        const playlist=await retryMusic(()=>play.playlist_info(RADIO_URL,{incomplete:true}),'Radio-Playlist');
        const videos=typeof playlist.all_videos==='function'?await retryMusic(()=>playlist.all_videos(),'Radio-Titelliste'):(playlist.videos||[]);
        const tracks=videos.filter(v=>v&&v.url).map(v=>({title:v.title||'Unbekannter Titel',url:v.url,duration:v.durationRaw||'unbekannt',requestedBy:i.user.id,source:'YouTube Radio'}));
        if(!tracks.length)throw new Error('YouTube hat aus diesem Radio-Mix keine Titel geliefert.');
        q.songs.push(...tracks);
       }finally{q.radioLoading=false;}
       const started=await playNext(i.guildId);
       if(!started)throw new Error('Der Radio-Mix wurde geladen, aber kein Titel konnte gestartet werden.');
       log('Radio gestartet',`${q.songs.length} Titel • von ${i.user.tag}`,i.user.tag);
       return i.editReply({embeds:[new EmbedBuilder().setColor(RED).setTitle('📻 Freiburg V2 Radio gestartet').setDescription(`YouTube Radio-Mix wird abgespielt.\n**${q.songs.length} Titel** wurden geladen.\n[Radio auf YouTube öffnen](${RADIO_URL})`).setFooter({text:'Freiburg V2 Music'})]});
      }
      const query=i.options.getString('song',true).trim();
     if(!query)throw new Error('Bitte gib einen Songtitel oder YouTube-Link ein.');
     let song;
     const isYouTubeUrl=/^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/)/i.test(query);
     if(isYouTubeUrl){
      song={title:query,url:query,duration:'unbekannt',requestedBy:i.user.id,source:'YouTube'};
     }else{
      // Freitext wie „Interpret - Titel“ wird über die YouTube-Suche aufgelöst.
      const results=await retryMusic(()=>play.search(query,{limit:20}),'Titelsuche');
      const videos=results.filter(video=>video.url&&/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(video.url));
      if(!videos.length)throw new Error('Kein passender Song gefunden. Versuche „Interpret - Titel“ oder einen YouTube-Link.');
      const words=query.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/[^a-z0-9]+/).filter(w=>w.length>1);
      const ranked=videos.map(video=>({video,score:words.reduce((n,w)=>n+(video.title||'').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(w)?1:0,0)})).sort((a,b)=>b.score-a.score);
      const best=ranked[0].video;
      song={title:best.title||query,url:best.url,duration:best.durationRaw||'unbekannt',requestedBy:i.user.id,source:'YouTube'};
     }
     q.songs.push(song);
     if(!q.playing&&q.songs.length===1){
      const started=await playNext(i.guildId);
      if(!started)throw new Error('Der Song wurde gefunden, aber YouTube hat keinen abspielbaren Audiostream geliefert. Bitte versuche einen anderen Treffer oder Link.');
     }
     log('Musik angefordert',`${song.title} • von ${i.user.tag}`,i.user.tag);
     return i.editReply({embeds:[new EmbedBuilder().setColor(RED).setTitle(q.songs.length===1?'▶️ Wiedergabe gestartet':'➕ Zur Warteschlange hinzugefügt').setDescription(`**${esc(song.title)}**\nDauer: ${esc(song.duration)}\nAngefordert von: ${i.user}`).setFooter({text:'Freiburg V2 Music'})]});
    }catch(e){console.error('Musikbefehl fehlgeschlagen:',e?.stack||e);const msg=e?.code==='DISCORD_VOICE_TIMEOUT'?e.message:(e?.name==='AbortError'||/operation was aborted|aborted/i.test(String(e?.message)))?'Eine Anfrage wurde abgebrochen. Prüfe die Railway-Logs für den betroffenen Schritt.':(e?.message||'Unbekannter Musikfehler');return i.editReply(`❌ ${msg}`);}
   }
   if(cmd==='skip'||cmd==='stop'||cmd==='pause'||cmd==='resume'||cmd==='queue'||cmd==='leave'||cmd==='volume'){
    const q=musicQueues.get(i.guildId);
    if(cmd==='queue'){
     if(!q||!q.songs.length)return i.reply({content:'🎵 Die Warteschlange ist leer.',flags:MessageFlags.Ephemeral});
     return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle('🎶 Freiburg V2 • Warteschlange').setDescription(q.songs.slice(0,15).map((x,n)=>`${n===0?'▶️':'**'+(n+1)+'.**'} ${esc(x.title)}${n===0?' *(jetzt)*':''}`).join('\n'))],flags:MessageFlags.Ephemeral});
    }
    if(!q||!q.connection)return i.reply({content:'Der Bot ist aktuell in keinem Voice-Channel.',flags:MessageFlags.Ephemeral});
    if(cmd==='skip'){q.player.stop(true);return i.reply('⏭️ Song übersprungen.');}
    if(cmd==='stop'){q.songs=[];q.player.stop(true);return i.reply('⏹️ Wiedergabe gestoppt und Warteschlange geleert.');}
    if(cmd==='pause'){q.player.pause();return i.reply('⏸️ Wiedergabe pausiert.');}
    if(cmd==='resume'){q.player.unpause();return i.reply('▶️ Wiedergabe fortgesetzt.');}
    if(cmd==='volume'){q.volume=i.options.getInteger('wert',true)/100;return i.reply(`🔊 Lautstärke auf ${Math.round(q.volume*100)} % gesetzt. Gilt ab dem nächsten Song.`);}
    if(cmd==='leave'){q.songs=[];q.player.stop(true);q.connection.destroy();musicQueues.delete(i.guildId);return i.reply('👋 Freiburg V2 Music hat den Voice-Channel verlassen.');}
   }
   if(cmd==='timeout'){
    if(!isAdmin(i))return i.reply({content:'Dir fehlt die freigeschaltete Verwaltungsrolle.',flags:MessageFlags.Ephemeral});
    const botMember=await i.guild.members.fetchMe();
    if(!botMember.permissions.has(PermissionFlagsBits.ModerateMembers))return i.reply({content:'Dem Bot fehlt „Mitglieder moderieren“. Aktiviere diese Berechtigung in der Bot-Rolle oder gib ihm Administratorrechte.',flags:MessageFlags.Ephemeral});
    const u=i.options.getUser('mitglied',true),mins=i.options.getInteger('minuten',true),reason=i.options.getString('grund')||'Kein Grund angegeben';
    if(u.id===i.user.id)return i.reply({content:'Du kannst dir selbst keinen Timeout geben.',flags:MessageFlags.Ephemeral});
    const m=await i.guild.members.fetch(u.id);
    if(!m.moderatable)return i.reply({content:'Der Bot kann dieses Mitglied nicht timeouten. Prüfe, ob das Mitglied eine höhere Rolle oder Administratorrechte hat. Die Bot-Rolle muss höher stehen.',flags:MessageFlags.Ephemeral});
    await m.timeout(mins*60000,reason);
    log('Timeout',`${u.tag} • ${mins} Minuten • ${reason}`,i.user.tag);return i.reply({content:`⏳ ${u.tag} erhielt einen Timeout für ${mins} Minuten. Grund: ${reason}`,flags:MessageFlags.Ephemeral});
   }
   if(cmd==='rulesstatus'){
    const entries=db().ruleConfirmations;
    if(!entries.length)return i.reply({content:'Noch keine Teamregelwerk-Bestätigungen vorhanden.',flags:MessageFlags.Ephemeral});
    const list=entries.slice(-25).reverse().map((x,n)=>`**${n+1}. ${esc(x.name)}** – ${esc(x.rank)}\n<@${x.userId}> • <t:${Math.floor(new Date(x.at).getTime()/1000)}:F>`).join('\n\n');
    return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle(`🛡️ Bestätigte Teamregeln (${entries.length})`).setDescription(list)],flags:MessageFlags.Ephemeral});
   }
   if(cmd==='serverinfo')return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle(db().config.serverName).setDescription('Willkommen auf Freiburg V2 Roleplay. Nutze die offiziellen Discord-Kanäle für Support, Bewerbungen und Informationen.').addFields({name:'Mitglieder',value:String(i.guild.memberCount),inline:true},{name:'Ticketkategorien',value:String(db().ticketCategories.length),inline:true})],flags:MessageFlags.Ephemeral});
   if(cmd==='setup'){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen die Bot-Einrichtung öffnen.',flags:MessageFlags.Ephemeral});
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup_channels_0').setLabel('Kanäle & Rollen (1/2)').setEmoji('⚙️').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('setup_channels_1').setLabel('Kanäle & Rollen (2/2)').setEmoji('🧩').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('setup_info').setLabel('Konfiguration anzeigen').setEmoji('📋').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('setup_welcome').setLabel('Begrüßungstext').setEmoji('👋').setStyle(ButtonStyle.Secondary));
    return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle('⚙️ Freiburg V2 • Bot-Verwaltung').setDescription('Hier kannst du die wichtigsten Funktionen direkt in Discord konfigurieren. Ticketkategorien verwaltest du mit `/ticketkategorie`. Alle Änderungen werden lokal gespeichert.')],components:[row],flags:MessageFlags.Ephemeral});
   }
   if(cmd==='ticketpanel'){
    if(!isAdmin(i))return i.reply({content:'Dafür benötigst du Administratorrechte.',flags:MessageFlags.Ephemeral});
    const [embed,row]=ticketPanel();return i.channel.send({embeds:[embed],components:[row]}).then(()=>i.reply({content:'✅ Ticketpanel veröffentlicht.',flags:MessageFlags.Ephemeral}));
   }
   if(cmd==='ticket'){
    const cats=db().ticketCategories;if(!cats.length)return i.reply({content:'Es sind noch keine Ticketkategorien eingerichtet. Bitte Admin informieren.',flags:MessageFlags.Ephemeral});
    const menu=new StringSelectMenuBuilder().setCustomId('ticket_category').setPlaceholder('Wähle dein Anliegen …').addOptions(cats.slice(0,25).map(c=>({label:c.name.slice(0,100),value:c.id,description:(c.description||'Ticket öffnen').slice(0,100),emoji:c.emoji||'🎫'})));
    return i.reply({content:'**Freiburg V2 – Ticket eröffnen**\nWähle bitte die passende Kategorie:',components:[new ActionRowBuilder().addComponents(menu)],flags:MessageFlags.Ephemeral});
   }
   if(cmd==='ticketkategorie'){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen Ticketkategorien verwalten.',flags:MessageFlags.Ephemeral});
    const sub=i.options.getSubcommand();
    if(sub==='list'){const cats=db().ticketCategories;return i.reply({content:cats.length?cats.map(c=>`• **${c.name}** (${c.id}) ${c.emoji||'🎫'} – ${c.description}`).join('\n'):'Keine Kategorien vorhanden.',flags:MessageFlags.Ephemeral});}
    if(sub==='add'){
     const name=i.options.getString('name',true),desc=i.options.getString('beschreibung',true),emoji=i.options.getString('emoji')||'🎫',id=(i.options.getString('kennung')||name.toLowerCase().replace(/[^a-z0-9]+/g,'-')).slice(0,40);
     if(db().ticketCategories.length>=25)return i.reply({content:'Maximal 25 Ticketkategorien sind möglich.',flags:MessageFlags.Ephemeral});
     if(db().ticketCategories.some(c=>c.id===id))return i.reply({content:'Diese Kennung existiert bereits. Wähle eine andere.',flags:MessageFlags.Ephemeral});
     update(d=>d.ticketCategories.push({id,name,description:desc,emoji,parentId:i.options.getChannel('kategorie')?.id||''}));
     log('Ticketkategorie erstellt',`${name} (${id})`,i.user.tag);return i.reply({content:`✅ Ticketkategorie **${name}** wurde erstellt.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='remove'){const id=i.options.getString('kennung',true);let removed;update(d=>{const n=d.ticketCategories.length;d.ticketCategories=d.ticketCategories.filter(c=>c.id!==id);removed=n!==d.ticketCategories.length;});return i.reply({content:removed?'✅ Kategorie gelöscht.':'Kategorie nicht gefunden.',flags:MessageFlags.Ephemeral});}
   }
   if(cmd==='teamregeln'){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen das Teamregelwerk veröffentlichen.',flags:MessageFlags.Ephemeral});
    const channel=i.options.getChannel('kanal')||i.channel;
    for(const e of rulesEmbeds())await channel.send({embeds:[e]});
    await channel.send({content:'Alle Teammitglieder müssen das vollständige Regelwerk bestätigen.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rules_confirm').setLabel('Teamregelwerk gelesen & akzeptiert').setEmoji('✅').setStyle(ButtonStyle.Success))]});
    return i.reply({content:`✅ Das ausführliche Teamregelwerk wurde in ${channel} veröffentlicht.`,flags:MessageFlags.Ephemeral});
   }
   if(cmd==='team')return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle('Freiburg V2 • Teamübersicht').setDescription(db().staff.length?db().staff.slice(0,30).map(s=>`**${esc(s.name)}** – ${esc(s.rank)} (${esc(s.department)})`).join('\n'):'Die Teamübersicht ist noch leer.')],flags:MessageFlags.Ephemeral});
   if(cmd==='whitelist'){
    const item={id:Date.now().toString(36),userId:i.user.id,username:i.user.tag,character:i.options.getString('charakter',true),age:i.options.getString('alter')||'',status:'offen',createdAt:new Date().toISOString()};
    update(d=>d.whitelist.unshift(item));const dest=db().config.applicationChannelId;if(dest)client.channels.fetch(dest).then(c=>c?.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('Neue Whitelist-Bewerbung').setDescription(`**Charakter:** ${esc(item.character)}\n**Discord:** <@${i.user.id}>\n**Alter:** ${esc(item.age||'Nicht angegeben')}\n**ID:** ${item.id}`)]})).catch(()=>{});
    log('Whitelist-Antrag',item.character,i.user.tag);return i.reply({content:`✅ Antrag eingereicht. Referenz: ${item.id}`,flags:MessageFlags.Ephemeral});
   }
   if(cmd==='vorschlag'){
    const s={id:Date.now().toString(36),userId:i.user.id,text:i.options.getString('text',true),createdAt:new Date().toISOString()};update(d=>d.suggestions.unshift(s));
    const dest=db().config.suggestionChannelId;if(dest)client.channels.fetch(dest).then(c=>c?.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('💡 Neuer Vorschlag').setDescription(esc(s.text)).setFooter({text:`Von ${i.user.tag}`})]})).catch(()=>{});
    log('Vorschlag',s.text,i.user.tag);return i.reply({content:'✅ Dein Vorschlag wurde übermittelt.',flags:MessageFlags.Ephemeral});
   }
   if(cmd==='report'){
    const r={id:Date.now().toString(36),userId:i.user.id,target:i.options.getString('spieler',true),reason:i.options.getString('grund',true),status:'offen',createdAt:new Date().toISOString()};update(d=>d.reports.unshift(r));
    const dest=db().config.reportChannelId||db().config.applicationChannelId;if(dest)client.channels.fetch(dest).then(c=>c?.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('🚨 Neue Spielermeldung').addFields({name:'Gemeldeter Spieler',value:esc(r.target)},{name:'Grund',value:esc(r.reason)},{name:'Meldende Person',value:`<@${i.user.id}>`},{name:'Referenz',value:r.id})]})).catch(()=>{});
    log('Spielermeldung',`${r.target}: ${r.reason}`,i.user.tag);return i.reply({content:`✅ Meldung aufgenommen. Referenz: ${r.id}`,flags:MessageFlags.Ephemeral});
   }
   if(cmd==='clear'){if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',flags:MessageFlags.Ephemeral});const n=i.options.getInteger('anzahl',true);await i.channel.bulkDelete(n,true);return i.reply({content:`🧹 ${n} Nachrichten gelöscht.`,flags:MessageFlags.Ephemeral});}
   if(cmd==='kick'||cmd==='ban'){
    const required=cmd==='kick'?PermissionFlagsBits.KickMembers:PermissionFlagsBits.BanMembers;
    if(!isAdmin(i))return i.reply({content:'Dir fehlt die freigeschaltete Verwaltungsrolle.',flags:MessageFlags.Ephemeral});
    const botMember=await i.guild.members.fetchMe();
    if(!botMember.permissions.has(required))return i.reply({content:`Dem Bot fehlt die Serverberechtigung ${cmd==='kick'?'Mitglieder kicken':'Mitglieder bannen'}. Gib ihm diese Berechtigung oder Administrator.`,flags:MessageFlags.Ephemeral});
    const u=i.options.getUser('mitglied',true),reason=i.options.getString('grund')||'Kein Grund angegeben',m=await i.guild.members.fetch(u.id);
    if(cmd==='kick'&&!m.kickable)return i.reply({content:'Der Bot kann dieses Mitglied nicht kicken. Prüfe die Rollen-Hierarchie: Die Bot-Rolle muss höher stehen.',flags:MessageFlags.Ephemeral});
    if(cmd==='ban'&&!m.bannable)return i.reply({content:'Der Bot kann dieses Mitglied nicht bannen. Prüfe die Rollen-Hierarchie: Die Bot-Rolle muss höher stehen.',flags:MessageFlags.Ephemeral});
    if(cmd==='kick')await m.kick(reason);else await m.ban({reason});log(cmd,`${u.tag}: ${reason}`,i.user.tag);return i.reply({content:`✅ ${u.tag} wurde ${cmd==='kick'?'gekickt':'gebannt'}.`,flags:MessageFlags.Ephemeral});
   }
   if(cmd==='verwarnen'){
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',flags:MessageFlags.Ephemeral});
    const u=i.options.getUser('mitglied',true),reason=i.options.getString('grund',true);update(d=>d.warnings.unshift({userId:u.id,reason,by:i.user.id,at:new Date().toISOString()}));log('Verwarnung',`${u.tag}: ${reason}`,i.user.tag);return i.reply({content:`⚠️ Verwarnung für ${u.tag} dokumentiert.`,flags:MessageFlags.Ephemeral});
   }
  }
  if(i.isButton()){if(i.customId.startsWith('giveaway_join:')){const id=i.customId.slice('giveaway_join:'.length),job=(db().config.giveawayJobs||[]).find(x=>x.id===id),state=db().giveawayState[id];if(!job||job.status!=='active'||state?.cancelled||state?.completedFinal)return i.reply({content:'Dieses Giveaway ist nicht mehr aktiv.',flags:MessageFlags.Ephemeral});const existing=db().giveawayEntries.find(x=>x.giveawayId===id&&x.userId===i.user.id);if(existing)return i.reply({content:'Du bist bereits eingetragen. Viel Glück! 🍀',flags:MessageFlags.Ephemeral});const member=await i.guild.members.fetch(i.user.id),extra=(job.roleTickets||[]).filter(r=>member.roles.cache.has(r.roleId)).reduce((n,r)=>n+Math.max(0,Math.min(100,Number(r.tickets)||0)),0);update(d=>d.giveawayEntries.push({giveawayId:id,userId:i.user.id,extraTickets:extra,joinedAt:new Date().toISOString()}));return i.reply({content:'🎉 Du nimmst teil! Deine Tickets: **'+(1+extra)+'**. Viel Glück!',flags:MessageFlags.Ephemeral});}if(i.customId==='freiburg_verify_member'){const c=db().config;if(!c.verificationEnabled||!c.verifiedRoleId)return i.reply({content:'Die Verifizierung ist derzeit nicht aktiviert.',flags:MessageFlags.Ephemeral});const role=i.guild.roles.cache.get(c.verifiedRoleId)||await i.guild.roles.fetch(c.verifiedRoleId).catch(()=>null);if(!role)return i.reply({content:'Die Verifizierungsrolle wurde nicht gefunden. Bitte melde dich beim Team.',flags:MessageFlags.Ephemeral});const member=await i.guild.members.fetch(i.user.id);if(member.roles.cache.has(role.id))return i.reply({content:'Du bist bereits verifiziert. Viel Spaß auf Freiburg V2!',flags:MessageFlags.Ephemeral});await member.roles.add(role,'Freiburg V2 Verifizierung über das Control Center');return i.reply({content:'✅ Du bist jetzt erfolgreich verifiziert. Willkommen auf Freiburg V2!',flags:MessageFlags.Ephemeral});}
   if(i.customId.startsWith('wartung_publish:')){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen die Wartungsankündigung veröffentlichen.',flags:MessageFlags.Ephemeral});
    if(i.channelId!=='1571228234660450374')return i.reply({content:'Dieser Button ist nur im Wartungs-Steuerkanal gültig.',flags:MessageFlags.Ephemeral});
    const startAt=Number(i.customId.split(':')[1]);
    if(!Number.isSafeInteger(startAt)||startAt<=Math.floor(Date.now()/1000))return i.reply({content:'Der Wartungsbeginn liegt bereits in der Vergangenheit. Bitte erstelle mit /wartung eine neue Ankündigung.',flags:MessageFlags.Ephemeral});
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const announcement=new EmbedBuilder().setColor(RED).setTitle('🚨 WICHTIGE ANKÜNDIGUNG – WARTUNGSARBEITEN BEI FREIBURG V2').setDescription(
      'Liebe Freiburg-V2-Community,\n\n'+
      'bei Freiburg V2 stehen umfangreiche Wartungs- und Optimierungsarbeiten an. Wir möchten unsere Technik verbessern, Fehler beheben und euch anschließend ein stabileres und zuverlässigeres Spielerlebnis bieten.\n\n'+
      '**🕒 Geplanter Wartungsbeginn**\n<t:'+startAt+':F>\n'+
      '**⏳ Verbleibende Zeit**\n<t:'+startAt+':R>\n\n'+
      '**🔧 Was wird überarbeitet?**\n'+
      '• Technische Systeme, Stabilität und Leistung\n'+
      '• Fehlerbehebungen und Sicherheitsoptimierungen\n'+
      '• Discord-Bot, Funktionen und Berechtigungen\n'+
      '• Support-Abläufe und Serverstruktur\n'+
      '• Feuerwehr- und Rettungsdienst-Funktionen\n\n'+
      '**📜 WICHTIG: Regeln nach der Wartung erneut bestätigen**\n'+
      'Nach Abschluss der Wartung müssen **alle Mitglieder die aktuellen Freiburg-V2-Regeln erneut vollständig lesen und bestätigen**. Bitte plant dafür einen kurzen Moment ein. Bestimmte Discord-Bereiche können erst nach erfolgreicher Bestätigung wieder freigeschaltet werden. Wo und wie ihr die Regeln bestätigt, teilen wir euch nach der Wartung mit.\n\n'+
      '**⚠️ Während der Wartung**\n'+
      'Der Server sowie einzelne Funktionen und Discord-Bereiche können vorübergehend eingeschränkt oder nicht erreichbar sein. Bitte habt während der Arbeiten etwas Geduld und wartet auf unsere Abschlussmeldung.\n\n'+
      'Vielen Dank für euer Verständnis und eure Unterstützung!\n\n**Euer Freiburg V2 Team** 🚒'
    ).setFooter({text:'Freiburg V2 • Offizielle Wartungsinformation'}).setTimestamp();
    const targets=['1504257087608324157','1504245602182238380'];
    const sent=[],failed=[];
    for(const id of targets){
      try{
        const channel=await client.channels.fetch(id);
        if(!channel||!channel.isTextBased()||!channel.send)throw new Error('Kanal nicht gefunden oder kein Textkanal');
        await channel.send({content:'@everyone',embeds:[announcement],allowedMentions:{parse:['everyone']}});
        sent.push('<#'+id+'>');
      }catch(error){failed.push(id+': '+(error?.message||'Unbekannter Fehler'));console.error('Wartungsankündigung '+id+':',error);}
    }
    if(sent.length===targets.length){
      await i.message.edit({components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('wartung_published').setLabel('Ankündigung veröffentlicht').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(true))]}).catch(()=>{});
      log('Wartungsankündigung veröffentlicht','Beginn: '+new Date(startAt*1000).toISOString()+' • Kanäle: '+targets.join(', '),i.user.tag);
      return i.editReply('✅ In beiden Kanälen veröffentlicht. Discord aktualisiert den Live-Countdown automatisch.');
    }
    return i.editReply('⚠️ Teilweise veröffentlicht. Erfolgreich: '+(sent.join(', ')||'keiner')+'. Fehler: '+(failed.join(' | ')||'keine'));
   }
   if(i.customId.startsWith('setup_channels_')||i.customId==='setup_welcome'){
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',flags:MessageFlags.Ephemeral});
    const c=db().config,modal=new ModalBuilder().setCustomId(i.customId.startsWith('setup_channels_')?'setup_channels_modal_'+i.customId.split('_').pop():'setup_welcome_modal').setTitle(i.customId.startsWith('setup_channels_')?'Kanäle und Rollen konfigurieren':'Begrüßung konfigurieren');
    if(i.customId.startsWith('setup_channels_')){
     const fields=[['logChannelId','Log-Kanal-ID',c.logChannelId],['ticketParentId','Ticket-Kategorie-ID',c.ticketParentId],['supportRoleId','Support-Rollen-ID',c.supportRoleId],['teamRoleId','Team-Rollen-ID',c.teamRoleId],['welcomeChannelId','Willkommens-Kanal-ID',c.welcomeChannelId],['suggestionChannelId','Vorschlags-Kanal-ID',c.suggestionChannelId],['reportChannelId','Meldungs-Kanal-ID',c.reportChannelId],['applicationChannelId','Bewerbungs-Kanal-ID',c.applicationChannelId],['rulesChannelId','Regel-Kanal-ID',c.rulesChannelId]];
     // Discord modals permit five fields; two pages are provided.
     const page=Number(i.customId.split('_').pop());
     const selected=fields.slice(page*5,page*5+5);
     modal.setCustomId(`setup_channels_modal_${page}`);
     for(const [key,label,val] of selected)modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(key).setLabel(label).setStyle(TextInputStyle.Short).setRequired(false).setValue(val||'').setMaxLength(25)));
    }else modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('welcomeText').setLabel('Text ({user} und {server} möglich)').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(c.welcomeText).setMaxLength(1000)));
    return i.showModal(modal);
   }
   if(i.customId==='setup_info'){
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',flags:MessageFlags.Ephemeral});const c=db().config;
    return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle('Aktuelle Bot-Konfiguration').setDescription(Object.entries(c).map(([k,v])=>`**${k}:** ${v||'Nicht gesetzt'}`).join('\n')).addFields({name:'Ticketkategorien',value:String(db().ticketCategories.length)})],flags:MessageFlags.Ephemeral});
   }
   if(i.customId==='rules_confirm'){
    if(db().ruleConfirmations.some(x=>x.userId===i.user.id))return i.reply({content:'Du hast das Regelwerk bereits bestätigt.',flags:MessageFlags.Ephemeral});
    const m=new ModalBuilder().setCustomId('rules_modal').setTitle('Teamregelwerk bestätigen');
    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Vollständiger Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rank').setLabel('Teamrang').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)));
    return i.showModal(m);
   }
   if(i.customId.startsWith('ticket_close:')){
    const id=i.customId.split(':')[1],t=db().tickets.find(x=>x.id===id);
    if(!t)return i.reply({content:'Ticket nicht gefunden.',flags:MessageFlags.Ephemeral});
    if(t.userId!==i.user.id&&!isAdmin(i))return i.reply({content:'Nur Ticket-Ersteller oder freigeschaltetes Team dürfen schließen.',flags:MessageFlags.Ephemeral});
    update(d=>{const x=d.tickets.find(v=>v.id===id);if(x){x.status='closed';x.closedAt=new Date().toISOString();x.closedBy=i.user.id;}});
    log('Ticket geschlossen',`${id} durch ${i.user.tag}`,i.user.tag);
    await i.reply({content:'🔒 Ticket wird in 5 Sekunden geschlossen.',flags:MessageFlags.Ephemeral});setTimeout(()=>i.channel?.delete().catch(()=>{}),5000);return;
   }
   if(i.customId.startsWith('ticket_claim:')){
    if(!isAdmin(i))return i.reply({content:'Nur das freigeschaltete Supportteam darf Tickets übernehmen.',flags:MessageFlags.Ephemeral});
    const id=i.customId.split(':')[1];update(d=>{const t=d.tickets.find(x=>x.id===id);if(t)t.claimedBy=i.user.id;});log('Ticket übernommen',id,i.user.tag);return i.reply({content:`🙋 Ticket übernommen von ${i.user}.`});
   }
  }
  if(i.isStringSelectMenu()&&i.customId==='ticket_category'){
   const cat=db().ticketCategories.find(c=>c.id===i.values[0]);if(!cat)return i.reply({content:'Diese Kategorie gibt es nicht mehr.',flags:MessageFlags.Ephemeral});return openTicket(i,cat);
  }
  if(i.isModalSubmit()){
   if(i.customId.startsWith('ticket_form:')){const id=i.customId.slice('ticket_form:'.length),cat=db().ticketCategories.find(c=>c.id===id);if(!cat)return i.reply({content:'Diese Ticketkategorie existiert nicht mehr.',flags:MessageFlags.Ephemeral});const fields=(cat.formFields||[]).filter(f=>f.label).slice(0,5),answers={};fields.forEach((f,n)=>{answers[f.label]=i.fields.getTextInputValue('answer_'+n);});return createTicket(i,cat,answers);}
   if(i.customId.startsWith('setup_channels_modal_')){
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',flags:MessageFlags.Ephemeral});
    const keys=['logChannelId','ticketParentId','supportRoleId','teamRoleId','welcomeChannelId','suggestionChannelId','reportChannelId','applicationChannelId','rulesChannelId'];
    const page=Number(i.customId.split('_').pop()),selected=keys.slice(page*5,page*5+5);
    update(d=>{for(const k of selected)d.config[k]=i.fields.getTextInputValue(k).trim();});
    return i.reply({content:'✅ Konfiguration gespeichert. Leere Felder deaktivieren die jeweilige Funktion.',flags:MessageFlags.Ephemeral});
   }
   if(i.customId==='setup_welcome_modal'){update(d=>d.config.welcomeText=i.fields.getTextInputValue('welcomeText'));return i.reply({content:'✅ Begrüßungstext gespeichert.',flags:MessageFlags.Ephemeral});}
   if(i.customId==='rules_modal'){
    const entry={userId:i.user.id,username:i.user.tag,name:i.fields.getTextInputValue('name'),rank:i.fields.getTextInputValue('rank'),at:new Date().toISOString()};update(d=>d.ruleConfirmations.push(entry));
    const logId=db().config.logChannelId;
    if(logId)client.channels.fetch(logId).then(ch=>ch?.send({embeds:[new EmbedBuilder().setColor(GREEN).setTitle('✅ Teamregelwerk bestätigt').setDescription('Eine verbindliche Bestätigung wurde gespeichert.').addFields({name:'Name',value:esc(entry.name),inline:true},{name:'Teamrang',value:esc(entry.rank),inline:true},{name:'Discord-Mitglied',value:`<@${entry.userId}>`,inline:true},{name:'Discord-ID',value:entry.userId},{name:'Bestätigt am',value:`<t:${Math.floor(new Date(entry.at).getTime()/1000)}:F>`}).setFooter({text:'Freiburg V2 • Teamverwaltung'}).setTimestamp()]})).catch(e=>console.error('Bestätigungs-Log:',e.message));
    return i.reply({content:'✅ Deine Bestätigung wurde gespeichert und im Team-Log protokolliert.',flags:MessageFlags.Ephemeral});
   }
  }
 }catch(e){console.error('Interaction-Fehler:',e);if(i.isRepliable()&&!i.replied&&!i.deferred)await i.reply({content:'❌ Fehler. Prüfe die Bot-Konsole und Berechtigungen.',flags:MessageFlags.Ephemeral}).catch(()=>{});}
});
client.login(process.env.DISCORD_TOKEN).catch(e=>{console.error('Discord Login fehlgeschlagen:',e.message);process.exit(1);});
process.on('unhandledRejection',e=>console.error('Unhandled rejection:',e));
