# Ember Planner

**Kalender, ToDos und Tagesplanung in einer Desktop-App – warm, schnell, tastaturfreundlich.**

Ember Planner verbindet einen vollwertigen Kalender mit ToDo-Listen, die **harte und weiche Deadlines** kennen.
ToDos zieht man direkt in den Kalender, um Zeit dafür zu blocken; alles lässt sich rückgängig machen,
und fast jede Aktion geht auch ohne Maus. Die ToDos verwenden das Format des Obsidian-Plugins „Tasks“,
damit eine spätere Obsidian-Anbindung nahtlos passt.

![Planen – Wochenansicht mit ToDo-Spalte](docs/screenshots/planen-woche.png)

> Status: **frühe Version (0.1)** für Windows. Läuft lokal, Daten bleiben auf dem eigenen Rechner.
> Google-Kalender-Sync und Obsidian-Anbindung sind geplant – siehe [Roadmap](docs/ROADMAP.md).

## Highlights

- **Eine Arbeitsfläche** – Kalender in der Mitte, Filter links, rechts eine Spalte mit *ToDos*, *Heute* und *Details*
- **Kalender** – Tag, Woche, Monat, Agenda · Wiederholungen · mehrere Erinnerungen mit Windows-Benachrichtigung und Gong · Tray
- **ToDos** – Listen, Kategorien, Prioritäten, Unteraufgaben, Zeitschätzung, harte 📅 und weiche ⏳ Deadlines, sortiert nach der frühesten Deadline · wiederkehrend · Archiv und Papierkorb
- **Einplanen per Drag & Drop** – ToDo ins Raster ziehen = Zeitblock in Länge der Schätzung · in den Monat ziehen = Wunschtag
- **Eine Eingabe für alles** (`N`) – „Zahnarzt Do 14 Uhr 1h“ wird ein Termin, „Karte zeichnen bis Fr ~Mi #dnd !! 2h“ ein ToDo
- **Befehlspalette** (`Strg+K`) – Termine, ToDos und Befehle durchsuchen
- **Rückgängig statt Rückfragen** – `Strg+Z` / `Strg+Y` für alles, keine „Wirklich löschen?“-Dialoge
- **Übersicht** – Wochenauslastung, Deadline-Radar, Kategorien und Aktivitäts-Heatmap
- **Themes** – „Ember“ (dunkel) und „Rosé“ (hell), weitere Styles folgen
- **Daten in eigener Hand** – tägliche Sicherung, Export als JSON / ICS / Markdown, Import mit Rückgängig, Feiertage nach Bundesland

Alle Funktionen im Detail: **[docs/FEATURES.md](docs/FEATURES.md)**

## Screenshots

| | |
|---|---|
| ![Schnelleingabe](docs/screenshots/schnelleingabe.png) **Schnelleingabe** – erkennt Termin oder ToDo, Deadlines, Kategorie, Priorität | ![Details](docs/screenshots/todo-details.png) **Details in der Seitenspalte** – Änderungen werden sofort gespeichert |
| ![Monat](docs/screenshots/planen-monat.png) **Monatsansicht** mit Deadline-Markierungen und „Heute“-Spalte | ![ToDos](docs/screenshots/todos.png) **ToDo-Seite** – gruppiert nach Dringlichkeit, Mehrfachauswahl |
| ![Übersicht](docs/screenshots/uebersicht.png) **Übersicht** mit Widgets | ![Befehlspalette](docs/screenshots/befehlspalette.png) **Befehlspalette** (`Strg+K`) |
| ![Rosé](docs/screenshots/theme-rose.png) **Theme „Rosé“** | |

## Installation (aus dem Quellcode)

Voraussetzungen: [Node.js](https://nodejs.org) 22 oder neuer, Git, Windows 10/11.

```powershell
git clone https://github.com/Xovio/ember-planner.git
cd ember-planner
npm install
npm run dev
```

| Befehl | Zweck |
|---|---|
| `npm run dev` | Desktop-App mit Hot-Reload |
| `npm run build` / `npm run start` | Produktions-Bundle bauen / starten |
| `npm run web` | Nur die Oberfläche im Browser (http://localhost:5199) – mit `?demo` und Beispieldaten |
| `npm run typecheck` | TypeScript prüfen |
| `npm test` | Automatisierte Tests (Vitest) |

<details>
<summary>Electron startet nicht („Electron failed to install correctly“)?</summary>

Neuere npm-Versionen führen Install-Skripte erst nach Freigabe aus:

```powershell
npm install-scripts approve electron esbuild
npm rebuild electron esbuild
```

Falls `node_modules\electron\dist\electron.exe` danach immer noch fehlt, das heruntergeladene Zip aus
`%LOCALAPPDATA%\electron\Cache` nach `node_modules\electron\dist` entpacken und in
`node_modules\electron\path.txt` den Text `electron.exe` eintragen.
</details>

Die Daten liegen in `%APPDATA%\Ember Planner\data.json`, tägliche Sicherungen in `%APPDATA%\Ember Planner\Backups`.
Export, Import und Wiederherstellen: *Optionen → Daten*.

## Bedienung in Kürze

| Kürzel | Aktion |
|---|---|
| `N` / `Strg+Leertaste` | Neu anlegen (mit Uhrzeit → Termin, sonst ToDo; `Tab` wechselt) |
| `Strg+K` / `/` | Suchen & Befehle |
| `Strg+Z` / `Strg+Y` | Rückgängig / Wiederholen |
| `T` · `D` `W` `M` `A` · `←` `→` | Heute · Ansicht · blättern |
| `H` · `B` | Seitenspalte „Heute“ · Seitenspalte ein/aus |
| `Entf` | Ausgewählten Termin löschen / ToDo in den Papierkorb |
| `?` | Alle Tastenkürzel anzeigen |
| ToDo-Seite: `↑` `↓`, `Leertaste`, `0`–`3` | wählen, abhaken, Priorität · Strg/Shift+Klick = Mehrfachauswahl |

**Maus:** Klick ins Raster → Schnell-Anlegen · Klick auf Termin → Vorschau · Doppelklick → Details · Rechtsklick → Menü ·
ToDo ins Raster ziehen → einplanen · Deadline-Markierung ziehen → Deadline verschieben · ToDo auf eine Liste ziehen → verschieben

### Schnelleingabe für ToDos

| Eingabe | Bedeutung |
|---|---|
| `bis Freitag`, `bis Fr`, `morgen`, `3.12.`, `in 2 Wochen` | harte Deadline (📅) |
| `~Mittwoch`, `~Mi`, `ca. 1.12.` | weiche Deadline (⏳) |
| `#name` · `@liste` | Kategorie (wird angelegt, falls neu) · Liste |
| `!` / `!!` / `!!!` | Priorität niedrig / mittel / hoch |
| `30m`, `90min`, `2h` | Zeitschätzung |
| `täglich`, `jede Woche`, `alle 2 Wochen`, `monatlich`, `jeden Mo` | wiederkehrendes ToDo |
| `📅 2026-11-30 ⏳ 2026-11-27 ⏫` | Obsidian-Tasks-Syntax geht auch |

## Technik

Electron · React 19 · TypeScript · Vite (electron-vite) · Zustand · date-fns · lucide-react.
Daten als JSON-Datei hinter einer Repository-Schicht (später SQLite möglich). Aufbau und Designentscheidungen:
[docs/DESIGN.md](docs/DESIGN.md).

| Ordner | Inhalt |
|---|---|
| `src/main` | Hauptprozess: Fenster, Tray, Datenspeicher, Erinnerungs-Scheduler |
| `src/preload` | sichere IPC-Brücke (`window.api`) |
| `src/shared` | Datentypen, Wiederholungen, ToDo-/Tasks-Format-Logik |
| `src/renderer` | Oberfläche: Seiten, Kalenderansichten, Details, Widgets, Themes |
| `scripts/screenshots.ps1` | erzeugt die README-Screenshots aus dem Demo-Modus |

## Dokumentation

- [Funktionen & Umfang](docs/FEATURES.md)
- [Roadmap, Ideen & Ziele](docs/ROADMAP.md)
- [Designkonzept & Recherche](docs/DESIGN.md)

## Lizenz

[MIT](LICENSE) © 2026 Xovio
