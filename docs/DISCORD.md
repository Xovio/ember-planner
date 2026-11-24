# Discord-Anbindung – Konzept

**Status:** Lesen, Ankündigen, Mitziehen und Absagen sind gebaut (24. November 2026). Der Platzhalter für die nächste Session folgt.
Einrichtung des Bots: [DISCORD-SETUP.md](DISCORD-SETUP.md).

## Ziel

1. **Lesen:** Die geplanten Events ausgewählter Discord-Server erscheinen im Kalender, z. B. die DnD-Runde, mit der Anzahl „Interessiert“.
2. **Ankündigen:** Aus einem Termin wird mit einem Klick ein Server-Event („In Discord ankündigen“).
3. **Mitziehen:** Verschiebst oder änderst du den Termin, wandert das Discord-Event mit. Löschst du ihn, wird das Event
   nach einer Warnung abgesagt.
4. **Nächste Session vormerken:** Eine Vorlage mit Rhythmus zeigt die nächste Session als ausgegrauten Platzhalter, den du
   mit einem eigenen Titel fertig machst und dann ankündigst.

Es geht nur um **eigene Server**: Du lädst den Bot selbst ein.

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

## Darstellung

- **Alle Events** der ausgewählten Server erscheinen, auch die anderer Mitglieder.
- Discord-Events sehen **erkennbar anders** aus: Discord-Symbol am Titel, gestrichelter linker Rand in der Server-Farbe und
  die Anzahl Interessierter als kleines Abzeichen („👥 12“). Nur die Anzahl, keine Namen.
- Ein angekündigter eigener Termin zeigt dasselbe Symbol und die Anzahl, behält aber das Aussehen seines Kalenders.
- Beendete Events verschwinden nicht, sie bleiben als vergangene Termine. Events anderer, die vor Beginn aus Discords Liste
  verschwinden (abgesagt oder gelöscht), verschwinden auch im Kalender. Eigene angekündigte Termine bleiben in jedem Fall im
  Kalender und werden als „abgesagt“ durchgestrichen, wenn das Event in Discord weg ist.
- Erinnerungen: Events anderer bekommen die Standard-Erinnerung des Server-Kalenders (einstellbar oder abschaltbar wie bei Google-Kalendern).

## Datenmodell

- **Ein Kalender pro ausgewähltem Server** im Abschnitt *Discord* der linken Leiste (wie *Google*), Farbe und Sichtbarkeit lokal.
  Events dort sind **schreibgeschützt**: Sie gehören den Leuten, die sie angelegt haben.
- **Angekündigte Termine bleiben in deinem Kalender** (lokal oder Google) und bekommen eine Verknüpfung:
  `discord?: { guildId, eventId, channelId?, userCount?, status? }` am `CalendarEvent`. Das Discord-Event wird im
  Server-Kalender dann ausgeblendet, damit es nicht doppelt erscheint.
- Der Abgleich nutzt das Fundament des Google-Syncs: Patches an die Oberfläche, eine Outbox für Änderungen, die noch hochgeladen
  werden müssen, Wiederholungen mit Fehlerzählung, Offline-Fall.
- In Vorschau und Details: „👥 12 interessiert“ und ein Link „In Discord öffnen“ (`https://discord.com/events/{guild}/{event}`).

## Ankündigen, Mitziehen, Absagen

- **Ankündigen:** In Vorschau, Details und Rechtsklick-Menü „In Discord ankündigen“ → kleiner Dialog: Server, Art
  (Sprachkanal mit Kanalauswahl oder Ort/Link), Beschreibung aus den Notizen. Erst „Ankündigen“ schickt das Event ab.
- **Mitziehen:** Titel, Beginn, Ende, Ort und Notizen gehen nach einer Änderung (wie bei Google nach ca. 2,5 Sekunden) zu Discord.
- **Änderungen in Discord** am angekündigten Event (z. B. du verschiebst es in Discord selbst) werden übernommen, mit Hinweis –
  auch zu Google, wenn der Termin in einem Google-Kalender liegt. Discord liefert keinen Änderungszeitpunkt; erkannt wird eine
  Änderung am Vergleich mit dem zuletzt abgeglichenen Stand (`synced`). Wurde dasselbe Event zwischen zwei Abgleichen auf beiden
  Seiten geändert, gilt die Änderung aus Ember Planner (sie ist die jüngere, weil sie nach 2,5 Sekunden hochgeladen wird).
- **Löschen:** Statt sofort zu löschen erscheint eine **Warnung** im Lösch-Hinweis: „Das Event wird auch in Discord abgesagt –
  alle Interessierten sehen die Absage.“ Erst die Bestätigung löscht den Termin und sagt das Event ab (`status: 4`).
  Das ist bewusst eine Ausnahme von „keine Rückfragen“, weil die Absage für andere sichtbar ist und sich nicht zurücknehmen lässt.
  `Strg+Z` oder der Papierkorb holen den Termin zurück; das Discord-Event muss dann neu angekündigt werden.
- **Verknüpfung lösen:** „Nicht mehr mit Discord abgleichen“ lässt das Event in Discord unverändert stehen.

## Nächste Session als Platzhalter

Du legst jede Session einzeln an, weil jede ihren eigenen Titel bekommt. Damit die nächste nicht vergessen wird:

- Eine **Termin-Vorlage** (gibt es seit 2.8) bekommt optional einen **Rhythmus** (z. B. wöchentlich, Freitag 19:00) und
  optional **Discord-Vorgaben** (Server, Sprachkanal oder Ort).
- Der Kalender zeigt dann die **nächste** Session nach der letzten echten als **ausgegrauten, gestrichelten Platzhalter**
  („DnD-Session – noch planen“). Es gibt immer nur einen Platzhalter je Vorlage, nicht eine ganze Serie.
- Klick auf den Platzhalter → Popup: **Titel** (leer, Pflicht), Uhrzeit anpassbar, Haken „In Discord ankündigen“
  (an, wenn die Vorlage einen Server hat) → **Fertig machen**. Daraus wird ein normaler Termin, und der Platzhalter springt eine
  Woche weiter.
- „Diese Woche fällt aus“ im Rechtsklick-Menü schiebt den Platzhalter ohne Termin weiter.
- Platzhalter sind keine Termine: kein Sync zu Google oder Discord, keine Erinnerung. Optional ein Hinweis in *Heute*,
  wenn die nächste Session in weniger als 3 Tagen ansteht und noch nicht fertig ist.
- Welcher Termin zu einer Vorlage gehört, merkt sich der Termin (`templateId`), damit „die letzte echte Session“ eindeutig ist.

## Grenzen (von Discord vorgegeben)

- **Serien:** Discord kann nur einfache Wiederholungen (wöchentlich auch alle 2 Wochen, täglich nur an festen Tagesgruppen,
  monatlich am n-ten Wochentag). Kein Ende per Datum oder Anzahl von außen. Vorschlag deshalb: **einzelne Termine** ankündigen (siehe Frage 3).
- **Abgesagt ist endgültig:** Ein abgesagtes Event lässt sich nicht wieder öffnen. Wird der Termin wiederhergestellt
  (Papierkorb, `Strg+Z` nach dem Hochladen), entsteht ein neues Discord-Event.
- **Kein Echtzeit-Abgleich** ohne Gateway: Änderungen anderer erscheinen beim nächsten Abruf (spätestens nach 5 Minuten).
- **Teilnahme:** „Interessiert“ kann nur jeder selbst in Discord anklicken, nicht der Bot.

## Entscheidungen (24. November 2026)

1. **Nur eigene Server.**
2. **Löschen** eines angekündigten Termins **sagt das Discord-Event ab** – mit Warnung und Bestätigung vorher.
3. **Serien:** Sessions werden einzeln angelegt; die nächste erscheint als **ausgegrauter Platzhalter** aus einer Vorlage mit Rhythmus.
4. **Änderungen in Discord:** die **neuere** Änderung gewinnt.
5. **Interessierte:** nur die **Anzahl**.
6. **Alle Events** der Server erscheinen, **äußerlich unterscheidbar**; Erinnerungen wie bei anderen Kalendern (Standard des Kalenders).

## Umsetzungsschritte

1. Optionen → Discord: Application ID + Token, verschlüsselt speichern, Verbindung prüfen, Einladungslink, Server auswählen
2. Lesen: Server-Kalender, Abruf, Darstellung (Symbol, gestrichelter Rand, „👥 12“), Erinnerungen
3. Ankündigen: Dialog (Server, Sprachkanal oder Ort), Verknüpfung am Termin
4. Mitziehen, Konflikte („neuere gewinnt“) und Absagen mit Warnung über die Outbox
5. Platzhalter: Rhythmus und Discord-Vorgaben an Vorlagen, Platzhalter im Kalender, „Fertig machen“, „fällt aus“
6. Tests mit nachgebautem Discord (wie `push.test.ts` für Google), Doku in FEATURES.md

Schritt 5 hängt nicht an Discord und kann auch zuerst kommen.
