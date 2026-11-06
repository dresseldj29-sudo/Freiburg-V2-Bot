# Freiburg V2 RP Control Center – Bot + Webpanel

## Voraussetzungen
- Node.js 20 oder neuer
- Discord-Bot im Discord Developer Portal
- Discord-Server-ID und Application-ID

## Installation
1. ZIP entpacken.
2. `.env.example` kopieren und als `.env` speichern.
3. Discord-Token, Application-ID, Server-ID und ein eigenes starkes Panel-Passwort eintragen.
4. PowerShell im Projektordner öffnen.
5. `npm install`
6. `npm start`
7. Im Browser `http://localhost:3000` öffnen.
8. Mit `PANEL_USER` und `PANEL_PASSWORD` aus der `.env` anmelden.

Der Bot registriert beim Start die Slash Commands automatisch. Der Bot-Prozess und das Webpanel laufen gemeinsam; das PowerShell-Fenster muss offen bleiben.

## Discord-Einrichtung
OAuth2 Scopes: `bot`, `applications.commands`.
Bot-Rechte je nach genutzten Modulen: View Channels, Send Messages, Embed Links, Read Message History, Manage Channels, Kick Members, Ban Members, Manage Messages.
Für Mitgliederbeitritte muss im Developer Portal der Server Members Intent aktiviert sein, falls die Begrüßungs-/Mitgliedsfunktionen später erweitert werden.

## .env
Pflicht:
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `PANEL_PASSWORD` (langes eigenes Passwort)
- `SESSION_SECRET` (langer zufälliger Geheimwert)

Optional:
- `PORT=3000`
- `PANEL_USER=admin`
- `LOG_CHANNEL_ID`
- `TICKET_CATEGORY_ID`
- `SUPPORT_ROLE_ID`
- `TEAM_ROLE_ID`
- `PUBLIC_PANEL_URL`
- `FIVEM_SERVER_URL` (nur vorbereitet, noch keine Live-Anbindung)

## Funktionen
Discord-Bot:
- `/teamregeln` mit Name-/Rang-Bestätigung
- `/ticket thema:...`
- `/whitelist charakter:...`
- `/vorschlag text:...`
- `/report spieler:... grund:...`
- `/serverinfo`, `/status`, `/team`, `/clear`, `/kick`, `/ban`, `/ping`

Webpanel:
- Übersicht und Systemstatus
- Tickets einsehen und schließen
- Whitelist-Anträge annehmen/ablehnen
- Spielermeldungen, Vorschläge und Aktivitätsprotokoll
- Personalverwaltung: Teammitglieder eintragen/entfernen
- Verwarnungen erfassen
- Dienstübersicht (Daten aus dem JSON-Speicher, sofern vorhanden)
- Rechnungen erstellen und als bezahlt markieren
- Abwesenheiten eintragen, genehmigen und ablehnen
- Bewerbungen ansehen

## Datenspeicherung
Alle Daten werden in `daten/db.json` gespeichert. Vor Updates Bot stoppen und diese Datei sichern. JSON ist für kleinere bis mittlere Communities gedacht.

## Sicherheit
- Bot-Token und `.env` niemals veröffentlichen.
- Nutze ein starkes `PANEL_PASSWORD` und `SESSION_SECRET`.
- Panel nur über HTTPS öffentlich betreiben; hinter einem Reverse Proxy `NODE_ENV=production` setzen.
- Discord-Bot-Rolle muss oberhalb der Rollen stehen, die der Bot verwalten soll.
- Rechnungen sind ein internes Register, keine Zahlungsabwicklung.
- FiveM-/ESX-Live-Verbindung ist noch nicht implementiert; `FIVEM_SERVER_URL` ist nur vorbereitet.
