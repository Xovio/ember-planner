# Ember Planner

Kalender-, ToDo- und Planungs-App für den PC (Electron + React + TypeScript).
Konzept, Recherche und Roadmap: [docs/DESIGN.md](docs/DESIGN.md)

## Starten

```powershell
npm run dev        # Desktop-App mit Hot-Reload
npm run build      # Produktions-Bundle nach out/
npm run start      # gebautes Bundle starten
npm run web        # nur die Oberfläche im Browser (http://localhost:5199, Daten in localStorage)
npm run typecheck
```

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/main` | Hauptprozess: Fenster, Tray, JSON-Datenspeicher, Erinnerungs-Scheduler |
| `src/preload` | sichere IPC-Brücke (`window.api`) |
| `src/shared` | Datentypen und Wiederholungslogik (von Main und UI genutzt) |
| `src/renderer` | React-Oberfläche: Seiten, Kalenderansichten, Widgets, Themes |

Die Daten liegen in `%APPDATA%\Ember Planner\data.json`.
Neue Themes: weiteren `[data-theme="…"]`-Block in `src/renderer/src/styles/themes.css` anlegen und in `src/renderer/src/lib/theme.ts` eintragen.

## ToDo-Schnelleingabe

`Karte zeichnen bis Freitag ~Mittwoch #dnd @kampagnen !! 2h`

| Eingabe | Bedeutung |
|---|---|
| `bis Freitag`, `morgen`, `3.12.`, `in 2 Wochen` | harte Deadline (📅) |
| `~Mittwoch`, `ca. 1.12.`, `etwa morgen` | weiche Deadline (⏳) |
| `#name` | Kategorie (wird angelegt, falls neu) |
| `@liste` | Liste (Anfang des Namens reicht) |
| `!` / `!!` / `!!!` | Priorität niedrig / mittel / hoch |
| `30m`, `90min`, `2h`, `1,5h` | Zeitschätzung (= Blocklänge beim Einplanen) |
| `📅 2026-11-30 ⏳ 2026-11-27 ⏫` | Obsidian-Tasks-Syntax geht auch |

ToDos aus der rechten Spalte im Kalender ins Wochen-/Tagesraster ziehen → Zeitblock wird angelegt und verknüpft.

## Tastenkürzel

| Kürzel | Aktion |
|---|---|
| `N` / `Strg+Leertaste` | Neu anlegen (mit Uhrzeit → Termin, sonst ToDo; `Tab` wechselt) |
| `Strg+K` / `/` | Suchen & Befehle |
| `Strg+Z` / `Strg+Y` | Rückgängig / Wiederholen |
| `T` · `D` `W` `M` `A` · `←` `→` | Heute · Ansicht · blättern |
| `H` · `B` | Seitenspalte „Heute“ · Seitenspalte ein/aus |
| `Entf` | Ausgewählten Termin / ToDo löschen (rückgängig machbar) |
| `Esc` | Auswahl / Popup schließen |
| ToDo-Seite: `↑` `↓` (`j` `k`), `Leertaste`, `0`–`3` | wählen, abhaken, Priorität · Strg/Shift+Klick = Mehrfachauswahl |

Maus: Klick ins Raster → Schnell-Anlegen · Klick auf Termin → Vorschau · Doppelklick → Details · Rechtsklick → Menü · ToDo in den Monat oder die Ganztags-Zeile ziehen → Wunschtag · Deadline-Markierung ziehen → Deadline verschieben · ToDo auf eine Liste ziehen → verschieben
