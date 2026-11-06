require('dotenv').config();
const {
 Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
 ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
 REST, Routes, PermissionFlagsBits, ChannelType
}=require('discord.js');
const store=require('./store');
const commands=require('./commands');

if(!process.env.DISCORD_TOKEN||!process.env.CLIENT_ID||!process.env.GUILD_ID){
 console.error('Bitte DISCORD_TOKEN, CLIENT_ID und GUILD_ID in .env eintragen.');process.exit(1);
}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers],partials:[Partials.Channel]});
const RED=0xB3262D, GREEN=0x248046;
const defaults={
 config:{serverName:'Freiburg V2 Roleplay',logChannelId:'',ticketParentId:'',supportRoleId:'',teamRoleId:'',welcomeChannelId:'',suggestionChannelId:'',reportChannelId:'',applicationChannelId:'',rulesChannelId:'',welcomeText:'Willkommen auf Freiburg V2, {user}!'},
 ticketCategories:[
  {id:'support',name:'Allgemeiner Support',emoji:'🎫',description:'Fragen und allgemeine Hilfe',parentId:''},
  {id:'bug',name:'Bug melden',emoji:'🐛',description:'Fehler oder technische Probleme melden',parentId:''},
  {id:'spieler',name:'Spieler melden',emoji:'🚨',description:'Eine Meldung vertraulich einreichen',parentId:''}
 ],
 tickets:[],whitelist:[],suggestions:[],reports:[],applications:[],ruleConfirmations:[],logs:[],staff:[],warnings:[],absences:[]
};
function db(){const saved=store.read();return {...defaults,...saved,config:{...defaults.config,...saved.config},ticketCategories:saved.ticketCategories?.length?saved.ticketCategories:defaults.ticketCategories};}
function update(fn){return store.update(d=>{for(const [k,v] of Object.entries(defaults))if(d[k]===undefined)d[k]=Array.isArray(v)?[]:(v&&typeof v==='object'?{...v}:v);d.config={...defaults.config,...d.config};if(!Array.isArray(d.ticketCategories)||d.ticketCategories.length===0)d.ticketCategories=defaults.ticketCategories.map(x=>({...x}));return fn(d);});}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isAdmin=i=>i.memberPermissions?.has(PermissionFlagsBits.Administrator);
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
 const cats=db().ticketCategories;
 const menu=new StringSelectMenuBuilder().setCustomId('ticket_category').setPlaceholder('Wähle eine Ticketkategorie …').addOptions(cats.slice(0,25).map(c=>({label:c.name.slice(0,100),value:c.id,description:(c.description||'Ticket eröffnen').slice(0,100),emoji:c.emoji||'🎫'})));
 return [new EmbedBuilder().setColor(RED).setTitle('🎫 Freiburg V2 • Ticketsystem').setDescription('Wähle unten dein Anliegen aus. Für jede Anfrage wird ein privater Kanal erstellt. Bitte eröffne nur ein Ticket pro Anliegen und bleibe respektvoll.') ,new ActionRowBuilder().addComponents(menu)];
}
async function openTicket(i,cat){
 const guild=i.guild, user=i.user;
 const existing=db().tickets.find(t=>t.userId===user.id&&t.status==='open'&&t.categoryId===cat.id);
 if(existing&&existing.channelId){const ch=guild.channels.cache.get(existing.channelId)||await guild.channels.fetch(existing.channelId).catch(()=>null);if(ch)return i.reply({content:`Du hast in dieser Kategorie bereits ein offenes Ticket: ${ch}`,ephemeral:true});}
 const parent=cat.parentId||db().config.ticketParentId||undefined;
 const overwrites=[{id:guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]}];
 if(db().config.supportRoleId)overwrites.push({id:db().config.supportRoleId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
 const channel=await guild.channels.create({name:`${cat.id}-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,90),type:ChannelType.GuildText,parent,permissionOverwrites:overwrites,reason:`FreiburgV2 Ticket von ${user.tag}`});
 const t={id:Date.now().toString(36),userId:user.id,username:user.tag,categoryId:cat.id,category:cat.name,status:'open',channelId:channel.id,createdAt:new Date().toISOString()};
 update(d=>d.tickets.unshift(t));
 const buttons=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_close:${t.id}`).setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId(`ticket_claim:${t.id}`).setLabel('Ticket übernehmen').setEmoji('🙋').setStyle(ButtonStyle.Primary));
 await channel.send({content:`<@${user.id}> ${db().config.supportRoleId?`<@&${db().config.supportRoleId}>`:''}`,embeds:[new EmbedBuilder().setColor(RED).setTitle(`${cat.emoji||'🎫'} ${cat.name}`).setDescription(`Hallo <@${user.id}>!\n\nDein Ticket wurde erstellt. Beschreibe dein Anliegen möglichst genau und füge relevante Belege hinzu.\n\n**Ticket-ID:** ${t.id}\n**Kategorie:** ${cat.name}\n**Erstellt:** <t:${Math.floor(Date.now()/1000)}:F>`).setFooter({text:'Freiburg V2 Support'})],components:[buttons]});
 log('Ticket erstellt',`${t.id} • ${cat.name} • ${user.tag}`,user.tag);
 return i.reply({content:`Dein Ticket wurde erstellt: ${channel}`,ephemeral:true});
}
async function register(){
 const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID),{body:commands});
 console.log(`✅ ${commands.length} Slash Commands registriert.`);
}
client.once('ready',async()=>{console.log(`🤖 Eingeloggt als ${client.user.tag}`);try{await register();}catch(e){console.error('Slash Commands:',e.message);}});
client.on('guildMemberAdd',async member=>{
 const c=db().config.welcomeChannelId;if(!c)return;
 const ch=member.guild.channels.cache.get(c)||await member.guild.channels.fetch(c).catch(()=>null);
 if(ch)ch.send({embeds:[new EmbedBuilder().setColor(GREEN).setTitle('👋 Willkommen bei Freiburg V2!').setDescription(db().config.welcomeText.replaceAll('{user}',`<@${member.id}>`).replaceAll('{server}',member.guild.name)).setThumbnail(member.user.displayAvatarURL()).setTimestamp()]});
});
client.on('interactionCreate',async i=>{
 try{
  if(i.isChatInputCommand()){
   const cmd=i.commandName;
   if(cmd==='ping')return i.reply({content:`🏓 Pong! ${client.ws.ping} ms`,ephemeral:true});
   if(cmd==='status')return i.reply({embeds:[new EmbedBuilder().setColor(GREEN).setTitle('Freiburg V2 • Botstatus').addFields({name:'Bot',value:'🟢 Online',inline:true},{name:'Ping',value:`${client.ws.ping} ms`,inline:true},{name:'Server',value:i.guild.name,inline:true},{name:'Laufzeit',value:`${Math.floor(process.uptime()/3600)} Stunden`,inline:true})],ephemeral:true});
   if(cmd==='serverinfo')return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle(db().config.serverName).setDescription('Willkommen auf Freiburg V2 Roleplay. Nutze die offiziellen Discord-Kanäle für Support, Bewerbungen und Informationen.').addFields({name:'Mitglieder',value:String(i.guild.memberCount),inline:true},{name:'Ticketkategorien',value:String(db().ticketCategories.length),inline:true})],ephemeral:true});
   if(cmd==='setup'){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen die Bot-Einrichtung öffnen.',ephemeral:true});
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup_channels_0').setLabel('Kanäle & Rollen (1/2)').setEmoji('⚙️').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('setup_channels_1').setLabel('Kanäle & Rollen (2/2)').setEmoji('🧩').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('setup_info').setLabel('Konfiguration anzeigen').setEmoji('📋').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('setup_welcome').setLabel('Begrüßungstext').setEmoji('👋').setStyle(ButtonStyle.Secondary));
    return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle('⚙️ Freiburg V2 • Bot-Verwaltung').setDescription('Hier kannst du die wichtigsten Funktionen direkt in Discord konfigurieren. Ticketkategorien verwaltest du mit `/ticketkategorie`. Alle Änderungen werden lokal gespeichert.')],components:[row],ephemeral:true});
   }
   if(cmd==='ticketpanel'){
    if(!isAdmin(i))return i.reply({content:'Dafür benötigst du Administratorrechte.',ephemeral:true});
    const [embed,row]=ticketPanel();return i.channel.send({embeds:[embed],components:[row]}).then(()=>i.reply({content:'✅ Ticketpanel veröffentlicht.',ephemeral:true}));
   }
   if(cmd==='ticket'){
    const cats=db().ticketCategories;if(!cats.length)return i.reply({content:'Es sind noch keine Ticketkategorien eingerichtet. Bitte Admin informieren.',ephemeral:true});
    const menu=new StringSelectMenuBuilder().setCustomId('ticket_category').setPlaceholder('Wähle dein Anliegen …').addOptions(cats.slice(0,25).map(c=>({label:c.name.slice(0,100),value:c.id,description:(c.description||'Ticket öffnen').slice(0,100),emoji:c.emoji||'🎫'})));
    return i.reply({content:'**Freiburg V2 – Ticket eröffnen**\nWähle bitte die passende Kategorie:',components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true});
   }
   if(cmd==='ticketkategorie'){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen Ticketkategorien verwalten.',ephemeral:true});
    const sub=i.options.getSubcommand();
    if(sub==='list'){const cats=db().ticketCategories;return i.reply({content:cats.length?cats.map(c=>`• **${c.name}** (${c.id}) ${c.emoji||'🎫'} – ${c.description}`).join('\n'):'Keine Kategorien vorhanden.',ephemeral:true});}
    if(sub==='add'){
     const name=i.options.getString('name',true),desc=i.options.getString('beschreibung',true),emoji=i.options.getString('emoji')||'🎫',id=(i.options.getString('kennung')||name.toLowerCase().replace(/[^a-z0-9]+/g,'-')).slice(0,40);
     if(db().ticketCategories.length>=25)return i.reply({content:'Maximal 25 Ticketkategorien sind möglich.',ephemeral:true});
     if(db().ticketCategories.some(c=>c.id===id))return i.reply({content:'Diese Kennung existiert bereits. Wähle eine andere.',ephemeral:true});
     update(d=>d.ticketCategories.push({id,name,description:desc,emoji,parentId:i.options.getChannel('kategorie')?.id||''}));
     log('Ticketkategorie erstellt',`${name} (${id})`,i.user.tag);return i.reply({content:`✅ Ticketkategorie **${name}** wurde erstellt.`,ephemeral:true});
    }
    if(sub==='remove'){const id=i.options.getString('kennung',true);let removed;update(d=>{const n=d.ticketCategories.length;d.ticketCategories=d.ticketCategories.filter(c=>c.id!==id);removed=n!==d.ticketCategories.length;});return i.reply({content:removed?'✅ Kategorie gelöscht.':'Kategorie nicht gefunden.',ephemeral:true});}
   }
   if(cmd==='teamregeln'){
    if(!isAdmin(i))return i.reply({content:'Nur Administratoren dürfen das Teamregelwerk veröffentlichen.',ephemeral:true});
    const channel=i.options.getChannel('kanal')||i.channel;
    for(const e of rulesEmbeds())await channel.send({embeds:[e]});
    await channel.send({content:'Alle Teammitglieder müssen das vollständige Regelwerk bestätigen.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rules_confirm').setLabel('Teamregelwerk gelesen & akzeptiert').setEmoji('✅').setStyle(ButtonStyle.Success))]});
    return i.reply({content:`✅ Das ausführliche Teamregelwerk wurde in ${channel} veröffentlicht.`,ephemeral:true});
   }
   if(cmd==='team')return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle('Freiburg V2 • Teamübersicht').setDescription(db().staff.length?db().staff.slice(0,30).map(s=>`**${esc(s.name)}** – ${esc(s.rank)} (${esc(s.department)})`).join('\n'):'Die Teamübersicht ist noch leer.')],ephemeral:true});
   if(cmd==='whitelist'){
    const item={id:Date.now().toString(36),userId:i.user.id,username:i.user.tag,character:i.options.getString('charakter',true),age:i.options.getString('alter')||'',status:'offen',createdAt:new Date().toISOString()};
    update(d=>d.whitelist.unshift(item));const dest=db().config.applicationChannelId;if(dest)client.channels.fetch(dest).then(c=>c?.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('Neue Whitelist-Bewerbung').setDescription(`**Charakter:** ${esc(item.character)}\n**Discord:** <@${i.user.id}>\n**Alter:** ${esc(item.age||'Nicht angegeben')}\n**ID:** ${item.id}`)]})).catch(()=>{});
    log('Whitelist-Antrag',item.character,i.user.tag);return i.reply({content:`✅ Antrag eingereicht. Referenz: ${item.id}`,ephemeral:true});
   }
   if(cmd==='vorschlag'){
    const s={id:Date.now().toString(36),userId:i.user.id,text:i.options.getString('text',true),createdAt:new Date().toISOString()};update(d=>d.suggestions.unshift(s));
    const dest=db().config.suggestionChannelId;if(dest)client.channels.fetch(dest).then(c=>c?.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('💡 Neuer Vorschlag').setDescription(esc(s.text)).setFooter({text:`Von ${i.user.tag}`})]})).catch(()=>{});
    log('Vorschlag',s.text,i.user.tag);return i.reply({content:'✅ Dein Vorschlag wurde übermittelt.',ephemeral:true});
   }
   if(cmd==='report'){
    const r={id:Date.now().toString(36),userId:i.user.id,target:i.options.getString('spieler',true),reason:i.options.getString('grund',true),status:'offen',createdAt:new Date().toISOString()};update(d=>d.reports.unshift(r));
    const dest=db().config.reportChannelId||db().config.applicationChannelId;if(dest)client.channels.fetch(dest).then(c=>c?.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('🚨 Neue Spielermeldung').addFields({name:'Gemeldeter Spieler',value:esc(r.target)},{name:'Grund',value:esc(r.reason)},{name:'Meldende Person',value:`<@${i.user.id}>`},{name:'Referenz',value:r.id})]})).catch(()=>{});
    log('Spielermeldung',`${r.target}: ${r.reason}`,i.user.tag);return i.reply({content:`✅ Meldung aufgenommen. Referenz: ${r.id}`,ephemeral:true});
   }
   if(cmd==='clear'){if(!i.memberPermissions.has(PermissionFlagsBits.ManageMessages))return i.reply({content:'Keine Berechtigung.',ephemeral:true});const n=i.options.getInteger('anzahl',true);await i.channel.bulkDelete(n,true);return i.reply({content:`🧹 ${n} Nachrichten gelöscht.`,ephemeral:true});}
   if(cmd==='kick'||cmd==='ban'){
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',ephemeral:true});
    const u=i.options.getUser('mitglied',true),reason=i.options.getString('grund')||'Kein Grund angegeben',m=await i.guild.members.fetch(u.id);
    if(cmd==='kick')await m.kick(reason);else await m.ban({reason});log(cmd,`${u.tag}: ${reason}`,i.user.tag);return i.reply({content:`✅ ${u.tag} wurde ${cmd==='kick'?'gekickt':'gebannt'}.`,ephemeral:true});
   }
   if(cmd==='verwarnen'){
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',ephemeral:true});
    const u=i.options.getUser('mitglied',true),reason=i.options.getString('grund',true);update(d=>d.warnings.unshift({userId:u.id,reason,by:i.user.id,at:new Date().toISOString()}));log('Verwarnung',`${u.tag}: ${reason}`,i.user.tag);return i.reply({content:`⚠️ Verwarnung für ${u.tag} dokumentiert.`,ephemeral:true});
   }
  }
  if(i.isButton()){
   if(i.customId.startsWith('setup_channels_')||i.customId==='setup_welcome'){
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',ephemeral:true});
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
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',ephemeral:true});const c=db().config;
    return i.reply({embeds:[new EmbedBuilder().setColor(RED).setTitle('Aktuelle Bot-Konfiguration').setDescription(Object.entries(c).map(([k,v])=>`**${k}:** ${v||'Nicht gesetzt'}`).join('\n')).addFields({name:'Ticketkategorien',value:String(db().ticketCategories.length)})],ephemeral:true});
   }
   if(i.customId==='rules_confirm'){
    if(db().ruleConfirmations.some(x=>x.userId===i.user.id))return i.reply({content:'Du hast das Regelwerk bereits bestätigt.',ephemeral:true});
    const m=new ModalBuilder().setCustomId('rules_modal').setTitle('Teamregelwerk bestätigen');
    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Vollständiger Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rank').setLabel('Teamrang').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)));
    return i.showModal(m);
   }
   if(i.customId.startsWith('ticket_close:')){
    const id=i.customId.split(':')[1],t=db().tickets.find(x=>x.id===id);
    if(!t)return i.reply({content:'Ticket nicht gefunden.',ephemeral:true});
    if(t.userId!==i.user.id&&!i.memberPermissions.has(PermissionFlagsBits.ManageChannels))return i.reply({content:'Nur Ticket-Ersteller oder berechtigtes Team dürfen schließen.',ephemeral:true});
    update(d=>{const x=d.tickets.find(v=>v.id===id);if(x){x.status='closed';x.closedAt=new Date().toISOString();x.closedBy=i.user.id;}});
    log('Ticket geschlossen',`${id} durch ${i.user.tag}`,i.user.tag);
    await i.reply({content:'🔒 Ticket wird in 5 Sekunden geschlossen.',ephemeral:true});setTimeout(()=>i.channel?.delete().catch(()=>{}),5000);return;
   }
   if(i.customId.startsWith('ticket_claim:')){
    if(!i.memberPermissions.has(PermissionFlagsBits.ManageChannels))return i.reply({content:'Nur das Supportteam darf Tickets übernehmen.',ephemeral:true});
    const id=i.customId.split(':')[1];update(d=>{const t=d.tickets.find(x=>x.id===id);if(t)t.claimedBy=i.user.id;});log('Ticket übernommen',id,i.user.tag);return i.reply({content:`🙋 Ticket übernommen von ${i.user}.`});
   }
  }
  if(i.isStringSelectMenu()&&i.customId==='ticket_category'){
   const cat=db().ticketCategories.find(c=>c.id===i.values[0]);if(!cat)return i.reply({content:'Diese Kategorie gibt es nicht mehr.',ephemeral:true});return openTicket(i,cat);
  }
  if(i.isModalSubmit()){
   if(i.customId.startsWith('setup_channels_modal_')){
    if(!isAdmin(i))return i.reply({content:'Keine Berechtigung.',ephemeral:true});
    const keys=['logChannelId','ticketParentId','supportRoleId','teamRoleId','welcomeChannelId','suggestionChannelId','reportChannelId','applicationChannelId','rulesChannelId'];
    const page=Number(i.customId.split('_').pop()),selected=keys.slice(page*5,page*5+5);
    update(d=>{for(const k of selected)d.config[k]=i.fields.getTextInputValue(k).trim();});
    return i.reply({content:'✅ Konfiguration gespeichert. Leere Felder deaktivieren die jeweilige Funktion.',ephemeral:true});
   }
   if(i.customId==='setup_welcome_modal'){update(d=>d.config.welcomeText=i.fields.getTextInputValue('welcomeText'));return i.reply({content:'✅ Begrüßungstext gespeichert.',ephemeral:true});}
   if(i.customId==='rules_modal'){
    const entry={userId:i.user.id,username:i.user.tag,name:i.fields.getTextInputValue('name'),rank:i.fields.getTextInputValue('rank'),at:new Date().toISOString()};update(d=>d.ruleConfirmations.push(entry));log('Teamregelwerk bestätigt',`${entry.name} • ${entry.rank}`,i.user.tag);return i.reply({content:'✅ Deine Bestätigung wurde gespeichert.',ephemeral:true});
   }
  }
 }catch(e){console.error('Interaction-Fehler:',e);if(i.isRepliable()&&!i.replied&&!i.deferred)await i.reply({content:'❌ Fehler. Prüfe die Bot-Konsole und Berechtigungen.',ephemeral:true}).catch(()=>{});}
});
client.login(process.env.DISCORD_TOKEN).catch(e=>{console.error('Discord Login fehlgeschlagen:',e.message);process.exit(1);});
process.on('unhandledRejection',e=>console.error('Unhandled rejection:',e));
