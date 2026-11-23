# Ember Planner – Designkonzept

Stand: 2026-11-23 · Grundlage: Recherche zu Google Calendar, Notion Calendar, Amie, Fantastical,
Akiflow, Sunsama, Motion, Morgen, TickTick, Todoist, ClickUp und dem Obsidian-Plugin „Time Blocks“.

## 1. Was die anderen gut machen (und was wir übernehmen)

| Vorbild | Stärke | Übernahme bei uns |
|---|---|---|
| Notion Calendar | Minimalistisch, aber nie leer; linke Leiste mit Mini-Monat; Command-Menü + Shortcuts | Linke Leiste mit Mini-Monat und Kalenderliste, `Strg+K` Befehlspalette (Phase 2) |
| Amie | Todo-Spalte direkt neben der Woche, Todos per Drag in die Woche ziehen | Rechte, einklappbare Spalte „Offene ToDos“ (Phase 2: Drag & Drop → Zeitblock) |
| Fantastical | Termine in Alltagssprache eingeben („Morgen 15 Uhr Session-Prep“), viele Tastenkürzel | Schnelleingabe auf Deutsch (Phase 2), Tastenkürzel ab Phase 1 |
| Akiflow / Sunsama | Inbox + Tagesplanung als Ritual, Tastatur zuerst | Ansicht „Heute“ als Startseite mit Agenda + fälligen ToDos |
| Todoist / ClickUp | Beim Ablegen eines Tasks im Kalender werden Datum, Zeit und Dauer gesetzt; Dauer aus Zeitschätzung | ToDos bekommen optionale Zeitschätzung → Blocklänge beim Einplanen |
| TickTick | Eisenhower-Matrix, Gewohnheiten, Kalender und Tasks in einer App | Eisenhower-Widget (Phase 2), Gewohnheiten (später) |
| Motion / Morgen | Automatisches Einplanen nach Deadline | Später: „Vorschlag einplanen“ – nur als Vorschlag, nie ungefragt (Kritikpunkt an Sunsama: Tasks werden ohne Vorschau verschoben) |

**Abgrenzung:** Keine KI-Automatik, die den Kalender heimlich umbaut. Alles, was die App vorschlägt, muss bestätigt werden.

## 2. Aufbau der Oberfläche

```
┌────┬──────────────┬───────────────────────────────────────┬──────────────┐
│Nav │ Mini-Monat   │  Kopfzeile: ◀ ▶ Heute · Nov 2026 ·    │ Offene ToDos │
│    │              │  [Tag|Woche|Monat|Agenda]  + Neu      │ nach frühes- │
│ ☀  │ Meine Kalen- │───────────────────────────────────────│ ter Deadline │
│ 📅 │ der (an/aus, │                                       │ (Phase 2)    │
│ ☑  │ Farben)      │   Kalenderraster                      │              │
│ ⚙  │              │   (Jetzt-Linie, Ganztags-Zeile)       │              │
└────┴──────────────┴───────────────────────────────────────┴──────────────┘
```

- **Navigationsleiste (links, schmal):** Heute · Kalender · ToDos · (Obsidian, später) · Einstellungen
- **Kalenderansichten:** Tag, Woche, Monat, Agenda. Montag als Wochenstart, 24-h-Format, deutsche Lokalisierung.
- **Termineditor als Seitendialog:** Titel, Ganztägig, Start/Ende, Kalender, Ort, Notizen, Wiederholung, mehrere Erinnerungen.
- **Tastenkürzel:** `T` Heute · `D/W/M/A` Ansicht · `←/→` blättern · `N` neuer Termin · `Esc` schließen.

## 3. Visualisierungs-Widgets

Für die Startseite „Heute“ und später ein frei anordenbares Dashboard:

| Widget | Zeigt | Phase |
|---|---|---|
| **Tagesagenda** | Heutige Termine als Zeitstrahl mit Jetzt-Markierung, nächster Termin als Countdown | 1 |
| **Wochenauslastung** | Gebuchte Stunden pro Wochentag (Balken) | 1 |
| **Aktivitäts-Heatmap** | Jahresraster wie bei GitHub: Termine bzw. erledigte ToDos pro Tag | 1 (Termine), 2 (ToDos) |
| **Deadline-Radar** | Zeitleiste der nächsten 14 Tage, harte Deadlines (📅) als Marker, weiche (⏳) als Korridor | 2 |
| **Gefährdet / überfällig** | ToDos, deren weiche Deadline vorbei ist oder deren harte bald kommt | 2 |
| **Kategorien-Verteilung** | Offene ToDos je Kategorie | 2 |
| **Eisenhower-Matrix** | Dringend × wichtig, abgeleitet aus Deadline + Priorität | 2 |
| **Fortschrittsring / Streak** | Erledigt heute/Woche, Tage in Folge | 2 |
| **Kampagnen-Countdown** | Tage bis zur nächsten DnD-Session + offene Prep-ToDos dafür | 4 (Obsidian) |

## 4. Look & Theme

- **Standard-Theme „Ember“ (dunkel):** fast schwarze, leicht warme Flächen, Akzent Karminrot/Koralle.
- **Zweites Theme „Rosé“ (hell):** warmes Off-White, gleicher Rot-Akzent.
- Alle Farben, Radien und Abstände sind **CSS-Variablen** (`src/renderer/src/styles/themes.css`).
  Ein neues Theme ist ein weiterer Block `[data-theme="name"]` – Grundlage für die späteren Styles zur Auswahl.
- Kalenderfarben: Palette aus warmen Tönen (Rot, Koralle, Bernstein, Rosa, Pflaume) plus zwei kühle Kontrastfarben,
  damit sich Kalender auch im roten Theme unterscheiden lassen.
- Schrift: Inter (lokal eingebunden, offline-fähig), Tabellenziffern für Uhrzeiten.

## 5. Datenmodell (vorbereitet für Google und Obsidian)

- `CalendarEvent`: id, calendarId, title, start, end, allDay, location, notes, recurrence, reminders[],
  `external` (z. B. Google-Event-ID + etag für die 2-Wege-Sync).
- `Todo` (Phase 2): id, title, listId, category, priority, hardDeadline (📅), softDeadline (⏳), estimateMin,
  linkedEventId, done, `source` (z. B. Obsidian-Datei + Zeile, wenn wir die Vault-Anbindung bauen).
- Speicherung: lokale JSON-Datei im Benutzerordner der App, hinter einer Repository-Schicht, damit später SQLite möglich ist.

## 6. Phasen

> Aktueller Stand und weitere Ideen: [ROADMAP.md](ROADMAP.md) · Funktionsumfang: [FEATURES.md](FEATURES.md)


1. Grundgerüst, Theme, Kalender (Tag/Woche/Monat/Agenda), Termine, Wiederholung, Erinnerungen, Tray, Heute-Ansicht mit ersten Widgets
2. ✅ ToDos (Listen, Kategorien, harte/weiche Deadlines, Unteraufgaben, Zeitschätzung), Seitenleiste im Kalender, Drag & Drop, Schnelleingabe, Deadline-Widgets, Deadline-Erinnerungen · offen: Befehlspalette, Eisenhower-Matrix
3. Google-Kalender 2-Wege-Sync
4. Obsidian- und Claude-Anbindung (nach Absprache)
5. Mobile (Capacitor)
