require("dotenv").config();

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const required = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "GUILD_ID",
  "ADMIN_PASSWORD",
  "ADMIN_API_KEY"
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Konfiguration fehlt: ${key}`);
    process.exit(1);
  }
}

const app = express();
const port = Number(process.env.PORT || 3000);
const serverName = process.env.SERVER_NAME || "Freiburg V2";
const fivemHost = process.env.FIVEM_HOST || "127.0.0.1";
const fivemPort = process.env.FIVEM_PORT || "30120";
const fivemUrl = `http://${fivemHost}:${fivemPort}`;

const dataDir = path.join(__dirname, "..", "data");
const teamFile = path.join(dataDir, "team.json");

fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(teamFile)) {
  fs.writeFileSync(teamFile, "[]", "utf8");
}

function readTeam() {
  try {
    const value = JSON.parse(fs.readFileSync(teamFile, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeTeam(team) {
  fs.writeFileSync(teamFile, JSON.stringify(team, null, 2), "utf8");
}

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

const allowedOrigin = process.env.WEBSITE_ORIGIN || "";

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Freiburg V2 API" });
});

async function fetchJson(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${fivemUrl}${endpoint}`, {
      signal: controller.signal
    });

    if (!response.ok) throw new Error("FiveM HTTP-Fehler");

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getStatus() {
  try {
    const [info, dynamic] = await Promise.all([
      fetchJson("/info.json"),
      fetchJson("/dynamic.json")
    ]);

    return {
      online: true,
      name: dynamic.hostname || info.vars?.sv_projectName || serverName,
      players: Number(dynamic.clients) || 0,
      maxPlayers: Number(dynamic.sv_maxclients || info.vars?.sv_maxclients) || 0,
      gameType: dynamic.gametype || "FiveM",
      map: dynamic.mapname || "Los Santos",
      checkedAt: new Date().toISOString()
    };
  } catch {
    return {
      online: false,
      name: serverName,
      players: 0,
      maxPlayers: 0,
      gameType: "—",
      map: "—",
      checkedAt: new Date().toISOString()
    };
  }
}

async function getPlayers() {
  const result = await fetchJson("/players.json");

  if (!Array.isArray(result)) {
    throw new Error("Ungültige Spielerliste");
  }

  // Keine IP-Adressen oder Identifikatoren an die Webseite weitergeben.
  return result.map(player => ({
    id: Number(player.id),
    name: String(player.name || "Unbekannt").slice(0, 80),
    ping: Number(player.ping) || 0
  }));
}

app.get("/api/status", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await getStatus());
});

app.get("/api/players", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ online: true, players: await getPlayers() });
  } catch {
    res.status(503).json({
      online: false,
      players: [],
      error: "FiveM-Spielerliste nicht erreichbar"
    });
  }
});

// Einfacher Schutz gegen häufige Loginversuche.
// Für öffentliche Produktivsysteme zusätzlich einen persistenten
// Rate-Limiter und eine richtige Benutzerverwaltung einsetzen.
const loginAttempts = new Map();

app.post("/api/admin/login", (req, res) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, start: now };

  if (now - attempts.start > 10 * 60 * 1000) {
    attempts.count = 0;
    attempts.start = now;
  }

  if (attempts.count >= 5) {
    return res.status(429).json({
      error: "Zu viele Versuche. Bitte später erneut versuchen."
    });
  }

  if (!sameSecret(req.body?.password, process.env.ADMIN_PASSWORD)) {
    attempts.count++;
    loginAttempts.set(ip, attempts);
    return res.status(401).json({ error: "Anmeldung fehlgeschlagen" });
  }

  loginAttempts.delete(ip);

  // Das API-Geheimnis wird nur nach erfolgreicher Anmeldung ausgegeben.
  // Der Browser hält es nur in der aktuellen Sitzung.
  res.json({ token: process.env.ADMIN_API_KEY });
});

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!sameSecret(token, process.env.ADMIN_API_KEY)) {
    return res.status(401).json({ error: "Nicht autorisiert" });
  }

  next();
}

app.get("/api/admin/team", requireAdmin, (_req, res) => {
  res.json({ team: readTeam() });
});

app.post("/api/admin/team", requireAdmin, (req, res) => {
  const name = String(req.body?.name || "").trim();
  const role = String(req.body?.role || "").trim();

  if (!name || !role || name.length > 60 || role.length > 60) {
    return res.status(400).json({
      error: "Name und Rolle sind erforderlich (max. 60 Zeichen)."
    });
  }

  const team = readTeam();
  const member = {
    id: crypto.randomUUID(),
    name,
    role,
    createdAt: new Date().toISOString()
  };

  team.push(member);
  writeTeam(team);

  res.status(201).json({ member });
});

app.delete("/api/admin/team/:id", requireAdmin, (req, res) => {
  const team = readTeam();
  const next = team.filter(member => member.id !== req.params.id);

  if (next.length === team.length) {
    return res.status(404).json({ error: "Teammitglied nicht gefunden" });
  }

  writeTeam(next);
  res.json({ ok: true });
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

async function sendLog(guild, message) {
  const channelId = process.env.LOG_CHANNEL_ID;
  if (!channelId) return;

  const channel = await guild.channels.fetch(channelId).catch(() => null);

  if (channel?.isTextBased()) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(message.slice(0, 4000))
          .setTimestamp()
      ]
    }).catch(console.error);
  }
}

client.once("ready", () => {
  console.log(`Freiburg V2 Bot online: ${client.user.tag}`);
  client.user.setActivity("Freiburg V2 | /status");
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === "fvv2_ticket_create") {
        const ticketName = `ticket-${interaction.user.id}`;

        const existing = interaction.guild.channels.cache.find(
          channel => channel.name === ticketName
        );

        if (existing) {
          return interaction.reply({
            content: `Du hast bereits ein Ticket: ${existing}`,
            ephemeral: true
          });
        }

        const channel = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels
              ]
            }
          ]
        });

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("fvv2_ticket_close")
            .setLabel("Ticket schließen")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
          content: `${interaction.user} Willkommen beim Freiburg-V2-Support. Beschreibe bitte dein Anliegen.`,
          components: [closeRow]
        });

        await sendLog(
          interaction.guild,
          `Support-Ticket erstellt: ${channel.name}`
        );

        return interaction.reply({
          content: `Dein Ticket wurde erstellt: ${channel}`,
          ephemeral: true
        });
      }

      if (interaction.customId === "fvv2_ticket_close") {
        if (!interaction.channel?.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "Dieser Kanal ist kein Ticket.",
            ephemeral: true
          });
        }

        const canClose = interaction.channel.permissionOverwrites.cache
          .has(interaction.user.id) ||
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

        if (!canClose) {
          return interaction.reply({
            content: "Du darfst dieses Ticket nicht schließen.",
            ephemeral: true
          });
        }

        await interaction.reply("Ticket wird geschlossen.");
        const channel = interaction.channel;

        setTimeout(() => {
          channel.delete("Freiburg V2 Ticket geschlossen").catch(console.error);
        }, 3000);

        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.commandName;

    if (command === "ping") {
      return interaction.reply({
        content: `Pong! ${client.ws.ping} ms`,
        ephemeral: true
      });
    }

    if (command === "hilfe") {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle("Freiburg V2 – Bot-Befehle")
            .setColor(0x5865f2)
            .setDescription(
              [
                "`/status` – Serverstatus",
                "`/spieler` – Spielerübersicht",
                "`/serverinfo` – Serverinformationen",
                "`/ping` – Verbindung prüfen",
                "`/ticket-panel` – Support-Panel",
                "`/announce` – Ankündigung",
                "`/clear` – Nachrichten löschen",
                "`/kick` – Discord-Mitglied entfernen",
                "`/ban` – Discord-Mitglied bannen"
              ].join("\n")
            )
        ]
      });
    }

    if (["status", "serverinfo"].includes(command)) {
      const status = await getStatus();

      const embed = new EmbedBuilder()
        .setTitle(status.name)
        .setColor(status.online ? 0x2ecc71 : 0xe74c3c)
        .setDescription(status.online ? "🟢 Server erreichbar" : "🔴 Server nicht erreichbar")
        .addFields(
          {
            name: "Spieler",
            value: `${status.players}/${status.maxPlayers || "?"}`,
            inline: true
          },
          { name: "Modus", value: status.gameType, inline: true },
          { name: "Karte", value: status.map, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (command === "spieler") {
      try {
        const players = await getPlayers();
        const lines = players.slice(0, 40).map(
          p => `**${p.id}** · ${p.name.replace(/[\r\n]/g, "")} · ${p.ping} ms`
        );

        const embed = new EmbedBuilder()
          .setTitle(`Freiburg V2 – Spieler (${players.length})`)
          .setColor(0x3498db)
          .setDescription(lines.join("\n") || "Keine Spieler online.");

        if (players.length > 40) {
          embed.setFooter({ text: `Es werden die ersten 40 von ${players.length} Spielern angezeigt.` });
        }

        return interaction.reply({ embeds: [embed] });
      } catch {
        return interaction.reply({
          content: "Spielerliste nicht erreichbar. Prüfe die Serveradresse und den HTTP-Port.",
          ephemeral: true
        });
      }
    }

    if (command === "ticket-panel") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("fvv2_ticket_create")
          .setLabel("Support-Ticket erstellen")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Freiburg V2 Support")
            .setDescription("Drücke auf den Button, um ein privates Support-Ticket zu öffnen.")
            .setColor(0x5865f2)
        ],
        components: [row]
      });
    }

    if (command === "announce") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: "Du benötigst die Berechtigung Server verwalten.",
          ephemeral: true
        });
      }

      const text = interaction.options.getString("text", true);

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("Freiburg V2 – Ankündigung")
            .setDescription(text)
            .setColor(0x5865f2)
            .setTimestamp()
        ]
      });

      await sendLog(interaction.guild, `Ankündigung durch ${interaction.user.tag}`);
      return interaction.reply({
        content: "Ankündigung gesendet.",
        ephemeral: true
      });
    }

    if (command === "clear") {
      if (!interaction.channel?.isTextBased() ||
          !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
          content: "Du benötigst die Berechtigung Nachrichten verwalten.",
          ephemeral: true
        });
      }

      const amount = interaction.options.getInteger("anzahl", true);
      const deleted = await interaction.channel.bulkDelete(amount, true);

      await sendLog(
        interaction.guild,
        `${interaction.user.tag} löschte ${deleted.size} Nachrichten.`
      );

      return interaction.reply({
        content: `${deleted.size} Nachrichten gelöscht. Ältere Nachrichten können nicht gesammelt gelöscht werden.`,
        ephemeral: true
      });
    }

    if (command === "kick" || command === "ban") {
      const user = interaction.options.getUser("mitglied", true);
      const reason = interaction.options.getString("grund") || "Kein Grund angegeben";

      if (user.id === interaction.user.id || user.id === client.user.id) {
        return interaction.reply({
          content: "Diese Aktion ist für dieses Konto nicht erlaubt.",
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "Mitglied nicht gefunden.",
          ephemeral: true
        });
      }

      if (command === "kick") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
          return interaction.reply({ content: "Keine Kick-Berechtigung.", ephemeral: true });
        }
        await member.kick(reason);
      } else {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
          return interaction.reply({ content: "Keine Ban-Berechtigung.", ephemeral: true });
        }
        await member.ban({ reason });
      }

      await sendLog(
        interaction.guild,
        `${command.toUpperCase()}: ${user.tag} durch ${interaction.user.tag}. Grund: ${reason}`
      );

      return interaction.reply({
        content: `${user.tag} wurde ${command === "kick" ? "gekickt" : "gebannt"}.`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(error);

    if (interaction.isRepliable()) {
      const reply = {
        content: "Fehler. Prüfe die Bot-Berechtigungen und die Server-Logs.",
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  }
});

const httpServer = app.listen(port, "0.0.0.0", () => {
  console.log(`Freiburg V2 API läuft auf Port ${port}`);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("Discord-Login fehlgeschlagen:", error.message);
  process.exit(1);
});

function shutdown() {
  httpServer.close();
  client.destroy();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
