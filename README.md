# Freiburg V2 – RP Bot & Webpanel

Eigenständiger Discord-Bot mit Web-Control-Center. Node.js 20+, Discord.js 14 und Express.

## Enthalten
- Slash Commands: `/ticket`, `/whitelist`, `/vorschlag`, `/report`, `/serverinfo`, `/status`, `/team`, `/teamregeln`, `/ping`, `/clear`, `/kick`, `/ban`
- Ticket-Kanäle mit Berechtigungen und Schließen-Button
- Whitelist-Anträge mit Statusprüfung im Webpanel
- Community-Vorschläge und Spielermeldungen
- Teamregelwerk mit Bestätigungsformular
- Protokollierung im JSON-Datenspeicher und optionalem Discord-Logkanal
- Geschütztes Webpanel mit Login, Übersicht, Tickets, Whitelist, Meldungen, Vorschlägen und Logs

## Installation
1. Node.js 20 oder neuer installieren.
2. ZIP entpacken.
3. `.env.example` in `.env` umbenennen.
4. Im Discord Developer Portal einen Bot erstellen und den Token eintragen. Application ID und Server-ID eintragen.
5. In `.env` ein eigenes langes `PANEL_PASSWORD` und einen zufälligen `SESSION_SECRET` setzen.
6. Bot mit den benötigten Berechtigungen auf den Discord-Server einladen. OAuth2 Scopes: `bot` und `applications.commands`. Benötigte Bot-Rechte: View Channels, Send Messages, Embed Links, Manage Channels, Read Message History, Manage Messages, Kick Members, Ban Members. Für Server-Mitgliederlisten ggf. Server Members Intent aktivieren.
7. Im Projektordner ausführen:
   ```bash
   npm install
   npm start
   ```
8. Webpanel öffnen: `http://localhost:3000`.

## Hosting
Auf einem Node-Hosting als Startbefehl `npm start` verwenden. Umgebungsvariablen aus `.env` im Hosting-Dashboard eintragen. `PORT` wird vom Hoster meist automatisch gesetzt. Für öffentlichen Betrieb HTTPS verwenden und `NODE_ENV=production` setzen.

## Sicherheit
- `.env` niemals teilen oder hochladen.
- Falls ein echter Bot-Token versehentlich veröffentlicht wurde: im Developer Portal zurücksetzen.
- Webpanel-Passwort ändern und `SESSION_SECRET` zufällig setzen.
- JSON-Dateien regelmäßig sichern.
- Der Login ist ein lokaler Administrator-Login; Discord-OAuth und Mehrbenutzerrollen sind noch nicht eingebaut.

## Wichtige Grenzen
Die FiveM-Live-Status-/Spielerabfrage und Aktionen im Spiel benötigen eine konfigurierte FiveM-Serveradresse sowie eine gesicherte serverseitige API bzw. ein passendes FiveM-Resource. Das ist in diesem Grundpaket noch nicht aktiv. Es gibt auch keine automatische Whitelist-Übertragung in ESX. Das Webpanel verwaltet die Anträge, die endgültige Integration braucht die Server-Resource.
