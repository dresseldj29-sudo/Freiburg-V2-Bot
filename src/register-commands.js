require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("hilfe")
    .setDescription("Zeigt die Befehlsübersicht"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Prüft die Bot-Verbindung"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Zeigt den Freiburg-V2-Serverstatus"),

  new SlashCommandBuilder()
    .setName("spieler")
    .setDescription("Zeigt die verbundenen FiveM-Spieler"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Zeigt Informationen zum FiveM-Server"),

  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Erstellt das Support-Ticket-Panel")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Sendet eine Server-Ankündigung")
    .addStringOption(option =>
      option
        .setName("text")
        .setDescription("Text der Ankündigung")
        .setRequired(true)
        .setMaxLength(1500)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Löscht Discord-Nachrichten")
    .addIntegerOption(option =>
      option
        .setName("anzahl")
        .setDescription("Anzahl von 1 bis 100")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Entfernt ein Mitglied aus Discord")
    .addUserOption(option =>
      option
        .setName("mitglied")
        .setDescription("Discord-Mitglied")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("grund")
        .setDescription("Grund für den Kick")
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannt ein Discord-Mitglied")
    .addUserOption(option =>
      option
        .setName("mitglied")
        .setDescription("Discord-Mitglied")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("grund")
        .setDescription("Grund für den Bann")
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    )
].map(command => command.toJSON());

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error(
      "DISCORD_TOKEN, CLIENT_ID und GUILD_ID fehlen in .env"
    );
  }

  const rest = new REST({ version: "10" })
    .setToken(DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Freiburg-V2-Slash-Befehle registriert.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
