
const {SlashCommandBuilder,PermissionFlagsBits}=require('discord.js');
const commands=[
 new SlashCommandBuilder().setName('teamregeln').setDescription('Veröffentlicht das Freiburg V2 Teamregelwerk').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 new SlashCommandBuilder().setName('ticket').setDescription('Erstellt ein Support-Ticket').addStringOption(o=>o.setName('thema').setDescription('Worum geht es?').setRequired(true)),
 new SlashCommandBuilder().setName('whitelist').setDescription('Stellt einen Whitelist-Antrag').addStringOption(o=>o.setName('charakter').setDescription('Name deines RP-Charakters').setRequired(true)).addStringOption(o=>o.setName('alter').setDescription('Dein Alter (optional)').setRequired(false)),
 new SlashCommandBuilder().setName('vorschlag').setDescription('Sendet einen Servervorschlag').addStringOption(o=>o.setName('text').setDescription('Dein Vorschlag').setRequired(true)),
 new SlashCommandBuilder().setName('report').setDescription('Meldet einen Regelverstoß').addStringOption(o=>o.setName('spieler').setDescription('Gemeldeter Spieler').setRequired(true)).addStringOption(o=>o.setName('grund').setDescription('Grund der Meldung').setRequired(true)),
 new SlashCommandBuilder().setName('serverinfo').setDescription('Zeigt Informationen über Freiburg V2'),
 new SlashCommandBuilder().setName('status').setDescription('Zeigt den Bot- und Discord-Status'),
 new SlashCommandBuilder().setName('team').setDescription('Zeigt die Teamübersicht'),
 new SlashCommandBuilder().setName('clear').setDescription('Löscht Nachrichten im Kanal').addIntegerOption(o=>o.setName('anzahl').setDescription('1 bis 100').setMinValue(1).setMaxValue(100).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
 new SlashCommandBuilder().setName('kick').setDescription('Kickt ein Mitglied').addUserOption(o=>o.setName('mitglied').setDescription('Mitglied').setRequired(true)).addStringOption(o=>o.setName('grund').setDescription('Grund').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
 new SlashCommandBuilder().setName('ban').setDescription('Bannt ein Mitglied').addUserOption(o=>o.setName('mitglied').setDescription('Mitglied').setRequired(true)).addStringOption(o=>o.setName('grund').setDescription('Grund').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
 new SlashCommandBuilder().setName('ping').setDescription('Prüft die Bot-Latenz')
];
module.exports=commands.map(c=>c.toJSON());
