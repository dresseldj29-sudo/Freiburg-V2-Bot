# Freiburg V2 Discord Bot – Version 5.0

Moderner Discord-Community-Bot für Freiburg V2 mit Tickets, Teamregelwerk, Bestätigungsprotokoll, Moderation und Voice-Musik.

## Voraussetzungen
- Node.js 20 oder neuer
- Discord-Bot-Anwendung
- Bot-Scopes: `bot` und `applications.commands`
- Bot-Rechte: View Channels, Send Messages, Embed Links, Read Message History, Manage Channels, Manage Messages, Kick Members, Ban Members, Moderate Members, Connect, Speak
- Developer Portal → Bot → **Server Members Intent** aktivieren (für Begrüßungen)

## Installation
1. ZIP entpacken.
2. `.env.example` in `.env` umbenennen.
3. `DISCORD_TOKEN`, `CLIENT_ID` und `GUILD_ID` eintragen.
4. Im Projektordner `npm install` ausführen.
5. `npm start` starten.
6. In Discord `/setup` öffnen und Log-/Support-/Willkommenskanäle konfigurieren.

Der Bot registriert die Guild-Slash-Commands beim Start neu. Bei einem Neustart werden die JSON-Daten in `daten/db.json` weiterverwendet. Diese Datei regelmäßig sichern. `.env` niemals teilen oder hochladen.

## Musik / Voice-Support
Der Bot muss Connect- und Speak-Rechte im gewünschten Voice-Channel haben. Nutzer müssen vor `/ply` selbst einem Voice-Channel beitreten.

- `/ply song:<Songtitel oder YouTube-Link>` – sucht auf YouTube und spielt ein passendes YouTube-Video ab bzw. reiht es ein
- `/skip` – nächster Song
- `/stop` – stoppt und leert die Warteschlange
- `/pause` und `/resume` – Wiedergabe steuern
- `/queue` – Warteschlange anzeigen
- `/volume wert:<0-100>` – Lautstärke für folgende Songs einstellen
- `/leave` – Bot verlässt den Voice-Channel

**Wichtige Hinweise:** Die Suche/Wiedergabe verwendet YouTube-Suchergebnisse über die Bibliothek `@iamtraction/play-dl`. Die Bibliothek streamt die Audiospur technisch aus dem Video; das ist nicht dasselbe wie die offizielle YouTube-Einbettung und kann mit den YouTube-Nutzungsbedingungen kollidieren. Nutze diese Funktion nur, wenn du die erforderlichen Rechte hast und die geltenden Plattformbedingungen einhältst. Es werden keine DRM- oder Paywall-Sperren umgangen. Spotify-Links sind keine direkt abspielbaren Audioquellen; verwende einen Songtitel oder einen YouTube-Link. Der Bot streamt keine urheberrechtlich geschützte Musik aus nicht autorisierten Quellen. Für einen öffentlichen Server solltest du nur Inhalte verwenden, für die du die nötigen Rechte hast. Bei Änderungen an YouTube/Audioquellen kann ein Anbieter seine Schnittstelle ändern; dann muss die Musikabhängigkeit aktualisiert werden.

## Teamregelwerk
`/teamregeln` veröffentlicht die Abschnitte und den Bestätigungsbutton. Nach dem Bestätigen:
- Name, Rang, Discord-ID und Zeitstempel werden gespeichert.
- Eine eigene grüne Bestätigungsnachricht wird im konfigurierten Log-Kanal veröffentlicht.
- `/rulesstatus` zeigt Admins die gespeicherten Bestätigungen.

## Tickets und Community
- `/ticketpanel` – Ticket-Auswahlpanel veröffentlichen
- `/ticket` – Ticket privat eröffnen
- `/ticketkategorie add|list|remove` – Kategorien verwalten
- `/whitelist` – Antrag erfassen
- `/vorschlag` – Vorschlag erfassen
- `/report` – Spielermeldung erfassen
- `/team` – Teamübersicht

## Moderation und Verwaltung
- `/setup` – Bot-Einrichtung
- `/clear` – Nachrichten löschen
- `/kick`, `/ban`, `/timeout`, `/verwarnen` – Moderation
- `/serverinfo`, `/status`, `/ping` – Informationen

## Fehlerbehebung
- Slash-Commands fehlen: Bot neu starten, `CLIENT_ID` und `GUILD_ID` prüfen und sicherstellen, dass `applications.commands` eingeladen wurde.
- Musik startet nicht: Node.js 20+, `npm install`, Connect/Speak-Rechte und Voice-Channel-Mitgliedschaft prüfen. Hosting muss ausgehende Verbindungen zulassen.
- Logs fehlen: `/setup` → Kanäle & Rollen; korrekte Log-Kanal-ID eintragen und Bot-Rechte prüfen.
- Daten sichern: Bot stoppen und `daten/db.json` kopieren.

## Ehrlicher Funktionsumfang
Der Bot ist Discord-basiert. Eine Live-FiveM-/ESX-Anbindung, Web-Dashboard, Spotify-Premium-Wiedergabe oder automatische Whitelist-Rollenvergabe sind nicht enthalten. Discord-Voice benötigt einen dauerhaft laufenden Node-Prozess.
