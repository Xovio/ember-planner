# Discord-Anbindung – Konzept

**Status: Entwurf zur Abstimmung.** Gebaut wird erst, wenn die offenen Fragen unten geklärt sind.
Einrichtung des Bots: [DISCORD-SETUP.md](DISCORD-SETUP.md).

## Ziel

1. **Lesen:** Die geplanten Events ausgewählter Discord-Server erscheinen im Kalender, z. B. die DnD-Runde, mit der Anzahl „Interessiert“.
2. **Ankündigen:** Aus einem Termin wird mit einem Klick ein Server-Event („In Discord ankündigen“).
3. **Mitziehen:** Verschiebst oder änderst du den Termin, wandert das Discord-Event mit. Löschst du ihn, wird das Event abgesagt.

## Zugang: eigener Bot

- Discord bietet für Server-Events keinen Zugriff über den normalen Login (OAuth2). Den eigenen Account-Token zu nutzen
  („Self-Bot“) verstößt gegen die Nutzungsbedingungen. Deshalb ein **eigener Bot pro Nutzer**, angelegt im Developer Portal.
- Kein Bot-Server, kein Gateway, keine Intents: Ember Planner ruft nur die REST-API (`/api/v10`) mit `Authorization: Bot <token>` auf,
  solange die App läuft. Der Bot liest keine Nachrichten.
- Token und Application ID liegen verschlüsselt (Electron `safeStorage`) im Main-Prozess, wie die Google-Tokens. Die Oberfläche sieht den Token nie.
- Rechte (Einladungslink): **Kanäle ansehen** (1 << 10), **Verbinden** (1 << 20), **Events erstellen** (1 << 44).
  Optional **Events verwalten** (1 << 33), um auch Events anderer zu ändern.

## Was die App mit Discord macht

| Aktion | API | Hinweise |
|---|---|---|
| Server des Bots auflisten | `GET /users/@me/guilds` | zur Auswahl unter Optionen |
| Sprachkanäle eines Servers | `GET /guilds/{id}/channels` (Typ 2 = Sprache, 13 = Stage) | für „Event im Sprachkanal“ |
| Events lesen | `GET /guilds/{id}/scheduled-events?with_user_count=true` | alle 5 Minuten, beim Zurückkehren ins Fenster, auf Knopfdruck |
| Interessierte | `GET /guilds/{id}/scheduled-events/{event}/users` | nur auf Klick in den Details (bis 100 pro Abruf) |
| Ankündigen | `POST /guilds/{id}/scheduled-events` | `privacy_level: 2` |
| Ändern | `PATCH …/scheduled-events/{event}` | nur Felder, die sich geändert haben |
| Absagen | `PATCH … { status: 4 }` | abgesagt lässt sich nicht wieder öffnen |

**Art des Events beim Ankündigen**
- **Sprachkanal** (`entity_type: 2`): Kanal wählen; Ende optional. Discord startet es nicht von selbst, und ein Event, das
  einige Stunden nach Beginn nicht gestartet wurde, sagt Discord automatisch ab.
- **Ort oder Link** (`entity_type: 3`): `entity_metadata.location` (bis 100 Zeichen) aus dem Ort des Termins; Ende ist Pflicht.
  Discord setzt es zum Beginn selbst auf „läuft“ und zum Ende auf „beendet“.

**Felder:** Titel → `name` (bis 100 Zeichen), Notizen → `description` (bis 1000), Beginn/Ende → `scheduled_start_time`/`scheduled_end_time`.
Ein Server hat höchstens 100 geplante oder laufende Events gleichzeitig.

## Datenmodell

- **Ein Kalender pro ausgewähltem Server** im Abschnitt *Discord* der linken Leiste (wie *Google*), Farbe und Sichtbarkeit lokal.
  Events dort sind **schreibgeschützt**: Sie gehören den Leuten, die sie angelegt haben.
- **Angekündigte Termine bleiben in deinem Kalender** (lokal oder Google) und bekommen eine Verknüpfung:
  `discord?: { guildId, eventId, channelId?, userCount?, status? }` am `CalendarEvent`. Das Discord-Event wird im
  Server-Kalender dann ausgeblendet, damit es nicht doppelt erscheint.
- Der Abgleich nutzt das Fundament des Google-Syncs: Patches an die Oberfläche, eine Outbox für Änderungen, die noch hochgeladen
  werden müssen, Wiederholungen mit Fehlerzählung, Offline-Fall.
- Anzeigen: In Vorschau und Details steht „👥 12 interessiert“ und ein Link „In Discord öffnen“ (`https://discord.com/events/{guild}/{event}`).

## Grenzen (von Discord vorgegeben)

- **Serien:** Discord kann nur einfache Wiederholungen (wöchentlich auch alle 2 Wochen, täglich nur an festen Tagesgruppen,
  monatlich am n-ten Wochentag). Kein Ende per Datum oder Anzahl von außen. Vorschlag deshalb: **einzelne Termine** ankündigen (siehe Frage 3).
- **Abgesagt ist endgültig:** Ein abgesagtes Event lässt sich nicht wieder öffnen. Wird der Termin wiederhergestellt
  (Papierkorb, `Strg+Z` nach dem Hochladen), entsteht ein neues Discord-Event.
- **Kein Echtzeit-Abgleich** ohne Gateway: Änderungen anderer erscheinen beim nächsten Abruf (spätestens nach 5 Minuten).
- **Teilnahme:** „Interessiert“ kann nur jeder selbst in Discord anklicken, nicht der Bot.

## Offene Fragen

1. **Welche Server?** Nur deine eigenen, oder auch fremde (dann lädt das Admin-Team den Bot ein)?
2. **Löschen eines angekündigten Termins:** das Discord-Event **absagen** (Vorschlag: Mitglieder sehen die Absage) oder ganz **löschen**?
3. **Serien (z. B. wöchentliche Session):** jeden Termin einzeln ankündigen, oder automatisch immer den **nächsten** Termin einer
   Serie ankündigen, sobald der vorige vorbei ist?
4. **Änderungen in Discord** an deinem angekündigten Event (jemand aus dem Admin-Team verschiebt es): in deinen Kalender übernehmen
   (Vorschlag, wie bei Google: die neuere Änderung gewinnt, mit Hinweis) oder ignorieren?
5. **Interessierte:** nur die Anzahl, oder auf Klick auch die Namen?
6. **Erinnerungen** für Events anderer auf dem Server: wie normale Termine (Standard-Erinnerung des Kalenders) oder keine?

## Umsetzungsschritte (nach Abstimmung)

1. Optionen → Discord: Application ID + Token, verschlüsselt speichern, Verbindung prüfen, Einladungslink, Server auswählen
2. Lesen: Server-Kalender, Abruf, Anzeige mit Interessierten-Anzahl
3. Ankündigen: Dialog (Server, Sprachkanal oder Ort), Verknüpfung am Termin
4. Mitziehen und Absagen über die Outbox; Konfliktregel nach Frage 4
5. Tests mit nachgebautem Discord (wie `push.test.ts` für Google), Doku in FEATURES.md
