# FreiburgV2 Discord Bot – Version 4.0

**Discord-only:** Das Webpanel, die Website, Express und das Login-System wurden vollständig entfernt. Einrichtung und Bedienung erfolgen direkt in Discord.

## Voraussetzungen
- Node.js 20 oder neuer
- Discord-Bot-Anwendung im Discord Developer Portal
- Bot mit den Scopes `bot` und `applications.commands`
- Bot-Rechte: View Channels, Send Messages, Embed Links, Read Message History, Manage Channels, Manage Messages, Kick Members, Ban Members. Für Begrüßungen `Server Members Intent` im Developer Portal aktivieren.

## Installation unter Windows
1. ZIP entpacken.
2. `.env.example` in `.env` umbenennen.
3. `DISCORD_TOKEN`, `CLIENT_ID` und `GUILD_ID` eintragen.
4. Im Projektordner PowerShell öffnen.
5. `npm install`
6. `npm start`
7. In Discord `/setup` ausführen.

Der Bot registriert seine Slash Commands beim Start automatisch. Das Konsolenfenster muss geöffnet bleiben.

## Discord-Einrichtung
- `/setup` – öffnet das Admin-Verwaltungsmenü.
- `/setup` → **Kanäle & Rollen** – IDs für Logs, Ticket-Elternkategorie, Supportrolle, Teamrolle, Begrüßung, Vorschläge, Meldungen, Bewerbungen und Regelkanal eintragen.
- `/setup` → **Begrüßungstext** – Text mit `{user}` und `{server}` anpassen.
- `/setup` → **Konfiguration anzeigen** – gespeicherte Einstellungen prüfen.

Leere IDs deaktivieren die entsprechende Funktion. Für die Kanal-/Rollen-IDs: Discord Entwicklermodus aktivieren → Rechtsklick auf Kanal/Rolle → ID kopieren.

## Tickets
- `/ticketpanel` – veröffentlicht ein dauerhaftes Ticket-Auswahlmenü in einem Kanal.
- `/ticket` – öffnet die Ticket-Auswahl privat.
- `/ticketkategorie add` – neue Kategorie erstellen; Name und Beschreibung sind Pflicht, Emoji/Kennung/Discord-Kategorie optional.
- `/ticketkategorie list` – Kategorien anzeigen.
- `/ticketkategorie remove` – Kategorie über ihre Kennung löschen.
- Pro Nutzer und Kategorie wird nur ein offenes Ticket zugelassen.
- Ticketkanäle sind privat. Supportrolle wird automatisch freigeschaltet, wenn konfiguriert.
- Team kann ein Ticket übernehmen; Ersteller oder Team mit Kanalverwaltungsrecht kann schließen.

Maximal 25 Kategorien (Discord-Auswahlmenü-Limit). Für eine Kategorie kann beim Anlegen eine Discord-Kategorie als Zielordner ausgewählt werden; ansonsten gilt die globale Ticket-Elternkategorie aus `/setup`.

## Teamregelwerk
`/teamregeln` veröffentlicht ein ausführliches Regelwerk mit 19 Abschnitten und einer Bestätigungsschaltfläche. Bestätigungen werden mit Discord-ID, Name, Rang und Zeitstempel gespeichert.

## Weitere Befehle
- `/whitelist` – Whitelist-Antrag
- `/vorschlag` – Vorschlag erfassen und optional im eingerichteten Kanal veröffentlichen
- `/report` – Spielermeldung erfassen und optional im Meldekanal veröffentlichen
- `/team` – gespeicherte Teamübersicht
- `/verwarnen` – Verwarnung dokumentieren
- `/clear`, `/kick`, `/ban` – Moderation mit Discord-Berechtigungsprüfung
- `/serverinfo`, `/status`, `/ping` – Informationen und Status

## Datenspeicherung und Sicherheit
Daten liegen in `daten/db.json`. Vor Updates den Bot stoppen und diese Datei sichern. `.env` niemals weitergeben oder hochladen. Den Bot-Token bei Verdacht im Developer Portal zurücksetzen. Der Bot braucht nur die Berechtigungen, die seine Funktionen erfordern.

## Hinweis zum Funktionsumfang
Der Bot hat keine Website, kein Browser-Dashboard und keinen externen Webserver. Team-/Ticket-/Whitelist-Daten werden lokal in JSON gespeichert. Eine echte FiveM-/ESX-Live-Verbindung oder automatische Rollenvergabe für Whitelist-Entscheidungen ist nicht enthalten.
