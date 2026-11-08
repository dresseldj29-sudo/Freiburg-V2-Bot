const {SlashCommandBuilder,PermissionFlagsBits,ChannelType}=require('discord.js');
const admin=PermissionFlagsBits.Administrator;
const commands=[
 new SlashCommandBuilder().setName('setup').setDescription('Öffnet die komplette Discord-Bot-Verwaltung').setDefaultMemberPermissions(admin),
 new SlashCommandBuilder().setName('ticketpanel').setDescription('Veröffentlicht das Ticket-Auswahlpanel').setDefaultMemberPermissions(admin),
 new SlashCommandBuilder().setName('ticket').setDescription('Eröffnet ein Ticket über die Kategorieauswahl'),
 new SlashCommandBuilder().setName('ticketkategorie').setDescription('Ticketkategorien verwalten').setDefaultMemberPermissions(admin)
  .addSubcommand(s=>s.setName('add').setDescription('Neue Ticketkategorie erstellen').addStringOption(o=>o.setName('name').setDescription('Anzeigename').setRequired(true)).addStringOption(o=>o.setName('beschreibung').setDescription('Beschreibung').setRequired(true)).addStringOption(o=>o.setName('emoji').setDescription('Emoji').setRequired(false)).addStringOption(o=>o.setName('kennung').setDescription('Eindeutige Kennung, z. B. technik').setRequired(false)).addChannelOption(o=>o.setName('kategorie').setDescription('Discord-Kategorie für diese Tickets').addChannelTypes(ChannelType.GuildCategory).setRequired(false)))
  .addSubcommand(s=>s.setName('list').setDescription('Alle Ticketkategorien anzeigen'))
  .addSubcommand(s=>s.setName('remove').setDescription('Ticketkategorie löschen').addStringOption(o=>o.setName('kennung').setDescription('Kennung der Kategorie').setRequired(true))),
 new SlashCommandBuilder().setName('teamregeln').setDescription('Veröffentlicht das ausführliche Teamregelwerk').setDefaultMemberPermissions(admin).addChannelOption(o=>o.setName('kanal').setDescription('Zielkanal').setRequired(false)),
 new SlashCommandBuilder().setName('whitelist').setDescription('Stellt einen Whitelist-Antrag').addStringOption(o=>o.setName('charakter').setDescription('Name deines RP-Charakters').setRequired(true)).addStringOption(o=>o.setName('alter').setDescription('Optional').setRequired(false)),
 new SlashCommandBuilder().setName('vorschlag').setDescription('Sendet einen Servervorschlag').addStringOption(o=>o.setName('text').setDescription('Dein Vorschlag').setRequired(true)),
 new SlashCommandBuilder().setName('report').setDescription('Meldet einen Regelverstoß').addStringOption(o=>o.setName('spieler').setDescription('Gemeldeter Spieler').setRequired(true)).addStringOption(o=>o.setName('grund').setDescription('Grund der Meldung').setRequired(true)),
 new SlashCommandBuilder().setName('serverinfo').setDescription('Zeigt Informationen über Freiburg V2'),
 new SlashCommandBuilder().setName('status').setDescription('Zeigt den Botstatus'),
 new SlashCommandBuilder().setName('team').setDescription('Zeigt die Teamübersicht'),
 new SlashCommandBuilder().setName('clear').setDescription('Löscht Nachrichten').addIntegerOption(o=>o.setName('anzahl').setDescription('1 bis 100').setMinValue(1).setMaxValue(100).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
 new SlashCommandBuilder().setName('kick').setDescription('Kickt ein Mitglied').addUserOption(o=>o.setName('mitglied').setDescription('Mitglied').setRequired(true)).addStringOption(o=>o.setName('grund').setDescription('Grund').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
 new SlashCommandBuilder().setName('ban').setDescription('Bannt ein Mitglied').addUserOption(o=>o.setName('mitglied').setDescription('Mitglied').setRequired(true)).addStringOption(o=>o.setName('grund').setDescription('Grund').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
 new SlashCommandBuilder().setName('verwarnen').setDescription('Dokumentiert eine Verwarnung').addUserOption(o=>o.setName('mitglied').setDescription('Mitglied').setRequired(true)).addStringOption(o=>o.setName('grund').setDescription('Grund').setRequired(true)).setDefaultMemberPermissions(admin),

 new SlashCommandBuilder().setName('ply').setDescription('Spielt einen Song im verbundenen Voice-Channel ab').addStringOption(o=>o.setName('song').setDescription('Songtitel oder unterstützter Musiklink').setRequired(true)),
 new SlashCommandBuilder().setName('skip').setDescription('Überspringt den aktuellen Song'),
 new SlashCommandBuilder().setName('stop').setDescription('Stoppt die Musik und leert die Warteschlange'),
 new SlashCommandBuilder().setName('pause').setDescription('Pausiert die Wiedergabe'),
 new SlashCommandBuilder().setName('resume').setDescription('Setzt die Wiedergabe fort'),
 new SlashCommandBuilder().setName('queue').setDescription('Zeigt die Musikwarteschlange'),
 new SlashCommandBuilder().setName('leave').setDescription('Lässt den Bot den Voice-Channel verlassen'),
 new SlashCommandBuilder().setName('volume').setDescription('Ändert die Lautstärke').addIntegerOption(o=>o.setName('wert').setDescription('0 bis 100').setMinValue(0).setMaxValue(100).setRequired(true)),
 new SlashCommandBuilder().setName('rulesstatus').setDescription('Zeigt bestätigte Teamregelwerke').setDefaultMemberPermissions(admin),
 new SlashCommandBuilder().setName('timeout').setDescription('Gibt einem Mitglied eine Auszeit').addUserOption(o=>o.setName('mitglied').setDescription('Mitglied').setRequired(true)).addIntegerOption(o=>o.setName('minuten').setDescription('Dauer in Minuten').setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(o=>o.setName('grund').setDescription('Grund').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
 new SlashCommandBuilder().setName('ping').setDescription('Prüft die Bot-Latenz')
];
module.exports=commands.map(c=>c.toJSON());
