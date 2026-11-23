# Funktionen & Umfang

Stand: Version 0.1 (November 2026). Was die App heute kann, wo ihre Grenzen liegen und was bewusst noch fehlt.
Ausblick und Ideen stehen in der [Roadmap](ROADMAP.md).

## Aufbau der Oberfläche

| Bereich | Inhalt |
|---|---|
| **Planen** (Startseite) | Kalender in der Mitte · links Mini-Monat, Kalender, ToDo-Ansichten, Listen, Kategorien · rechts Seitenspalte mit den Reitern *ToDos*, *Heute*, *Details* |
| **ToDos** | Alle ToDos zum Organisieren, gruppiert nach Dringlichkeit, mit Tastatursteuerung und Mehrfachauswahl |
| **Übersicht** | Dashboard mit Kennzahlen und Diagrammen |
| **Optionen** | Theme, Standards für Termine und Erinnerungen, System-Einstellungen |

Die linke Leiste filtert die ToDo-Spalte: Ein Klick auf eine Liste oder Kategorie zeigt rechts nur deren ToDos.

## Kalender

- **Ansichten:** Tag, Woche, Monat, Agenda (6 Wochen) · Montag als Wochenstart · 24-h-Format · Kalenderwoche · Jetzt-Linie
- **Anlegen:** Klick ins Raster → kleines Popup am Slot (Titel, Uhrzeit, Kalender) · Ziehen im Raster = Zeitraum ·
  Doppelklick in die Ganztags-Zeile = ganztägiger Termin · Klick in eine Monatszelle = ganztägiger Termin
- **Bearbeiten:** Klick → Vorschau mit Schnellaktionen · Doppelklick → Details in der Seitenspalte ·
  Verschieben per Drag & Drop · Dauer an der Unterkante ziehen · Rechtsklick-Menü (Bearbeiten, Duplizieren, Kalender, Löschen)
- **Felder:** Titel, Kalender, ganztägig, Beginn/Ende (auch mehrtägig), Wiederholung, Erinnerungen, Ort, Notizen
- **Wiederholung:** täglich, wöchentlich (mit Wochentagen), monatlich, jährlich · Intervall · Ende nie / am Datum / nach N Terminen ·
  einzelne Termine einer Serie löschbar
- **Mehrere Kalender** mit Farben aus einer farbschwächegeprüften Palette, ein-/ausblendbar
- **Feiertage** (Deutschland, wahlweise mit Bundesland) einblendbar in Monat, Woche, Mini-Monat und Agenda –
  nur berechnet und angezeigt, es entstehen keine Termine
- **Überlappende Termine** werden nebeneinander angeordnet

## Erinnerungen

- Beliebig viele pro Termin (zum Beginn bis 1 Woche vorher), Standard für neue Termine einstellbar
- Windows-Benachrichtigung + eigener Gong + Hinweis in der App; Klick öffnet den Termin
- **Deadline-Erinnerungen:** am Vortag und am Tag einer harten Deadline zur eingestellten Uhrzeit
- App läuft beim Schließen im Tray weiter, damit Erinnerungen auch ohne offenes Fenster kommen
- Verpasste Erinnerungen der letzten 10 Minuten werden beim Start nachgeholt

## ToDos

- **Felder:** Titel, Liste, Kategorie, Priorität (keine/niedrig/mittel/hoch), harte Deadline 📅, weiche Deadline ⏳ (Wunschtag),
  Zeitschätzung, Unteraufgaben, Notizen, verknüpfter Zeitblock
- **Wiederkehrende ToDos:** täglich, wöchentlich (auch an bestimmten Wochentagen), monatlich, jährlich, mit Intervall.
  Beim Abhaken entsteht das nächste ToDo; beide Deadlines rücken mit gleichem Abstand weiter, auch wenn man spät dran war.
  Ohne Deadline wird der nächste Termin zum Wunschtag. Ein Schritt `Strg+Z` nimmt beides zurück
- **Sortierung:** nach der frühesten Deadline; bei gleichem Tag zuerst die harte, dann Priorität
- **Gruppen:** harte Deadline verpasst · weiche verpasst · heute · nächste 3 Tage · später · ohne Deadline · erledigt
- **Ansichten:** alle offenen, heute fällig, nächste 7 Tage, überfällig, ohne Deadline, erledigt · eigene Listen · Kategorie-Filter
- **Archiv:** ToDos, die seit mehr als 14 Tagen erledigt sind, verschwinden aus Listen und „Erledigt“ und stehen im Archiv
- **Papierkorb:** Löschen legt ToDos 30 Tage in den Papierkorb; dort einzeln oder alle wiederherstellen, endgültig löschen
  oder leeren (alles mit `Strg+Z` rückgängig). Gelöschte ToDos tauchen in keiner Ansicht, keinem Widget und keiner Erinnerung auf
- **Schnellaktionen beim Darüberfahren:** Wunschtag heute / morgen / nächste Woche, weitere Aktionen im „…“-Menü
- **Rechtsklick-Menü:** erledigt, Wunschtag, harte Deadline, jetzt einplanen, Priorität, Kategorie, Liste, löschen
- **Mehrfachauswahl** (Strg/Shift+Klick) mit Aktionsleiste
- **Tastatur:** `↑` `↓` / `j` `k` wählen, `Leertaste` abhaken, `Entf` in den Papierkorb, `0`–`3` Priorität
- **Obsidian-Tasks-Format:** jede Aufgabe zeigt ihre Zeile im Tasks-Format (zum Kopieren, mit `🔁 every week …` für
  Wiederholungen); die Schnelleingabe versteht die Syntax

## Kalender ⇄ ToDos

- ToDo aus der Seitenspalte **ins Wochen-/Tagesraster ziehen** → verknüpfter Zeitblock in Länge der Zeitschätzung
- ToDo **in den Monat oder die Ganztags-Zeile ziehen** → Wunschtag (weiche Deadline)
- **Deadline-Markierungen** im Kalender (hart: Fahne, weich: Sanduhr); ziehen = Deadline verschieben
- Zeitblöcke sind schraffiert, zeigen ein Häkchen-Symbol und lassen das ToDo direkt abhaken
- ToDo auf eine Liste in der linken Leiste ziehen → in die Liste verschieben

## Eingabe & Navigation

- **Universelle Schnelleingabe** (`N`, `Strg+Leertaste`): mit Uhrzeit → Termin, sonst → ToDo; Live-Vorschau des Erkannten
  - Termine: Datum (`Do`, `morgen`, `28.11.`), Uhrzeit (`14 Uhr`, `14:30`, `19-23 Uhr`), Dauer (`1h`), Kalender (`#dnd`), `ganztägig`
  - ToDos: `bis Fr` (hart), `~Mi` (weich), `#kategorie`, `@liste`, `!`–`!!!`, `2h`,
    Wiederholung (`täglich`, `jede Woche`, `alle 2 Wochen`, `monatlich`, `jeden Mo`)
- **Befehlspalette** (`Strg+K`): Volltextsuche über Termine und ToDos, Navigation, Ansichten, Themes, Rückgängig
- **Datumsauswahl** mit Texteingabe (`fr`, `3.12.`, `in 2 wochen`), Schnellwahl und Monatsraster
- **Rückgängig/Wiederholen** für alle Datenänderungen (100 Schritte); Tippen wird zu einem Schritt zusammengefasst
- **Tastenkürzel-Übersicht** (`?` oder Befehlspalette): alle Kürzel und Mausgesten auf einen Blick

## Übersicht (Widgets)

| Widget | Zeigt |
|---|---|
| Kennzahlen | offene und überfällige ToDos, diese Woche erledigt (+ 7-Tage-Verlauf) |
| Tagesplan | heutige Termine mit Jetzt-Markierung |
| Als Nächstes | nächster Termin mit Countdown |
| Wochenauslastung | verplante Stunden pro Tag |
| Fokus | überfällig und in den nächsten 2 Tagen fällig |
| Kategorien | offene ToDos je Kategorie |
| Deadline-Radar | 14 Tage, Korridor zwischen weicher und harter Deadline |
| Aktivität | Heatmap über 12 Monate – Termine oder erledigte ToDos |

## Darstellung

- Themes **Ember** (dunkel, Karminrot) und **Rosé** (hell); alle Farben sind CSS-Variablen
- Kalender- und Diagrammfarben mit einem Validator auf Farbschwäche und Kontrast geprüft
- Status (überfällig, verpasst) immer mit Symbol + Text, nie nur über Farbe
- Schrift Inter, lokal eingebunden (offline)

## Daten & Technik

- Lokale JSON-Datei `%APPDATA%\Ember Planner\data.json`, atomar geschrieben; defekte Dateien werden gesichert statt überschrieben
- **Automatische Sicherung:** einmal täglich eine Kopie nach `%APPDATA%\Ember Planner\Backups`, die letzten 14 bleiben.
  In den Optionen unter *Daten*: jetzt sichern, Ordner öffnen, eine Sicherung wiederherstellen (rückgängig machbar)
- **Export:** alles als JSON · Termine als `.ics` (mit Wiederholungen, Ausnahmen und Erinnerungen, z. B. für Google/Outlook) ·
  ToDos als Markdown im Obsidian-Tasks-Format, nach Listen gegliedert
- **Import:** JSON-Sicherung (ersetzt alle Daten) · Markdown mit Tasks-Zeilen (fügt ToDos samt Unteraufgaben zum Eingang hinzu) –
  beides mit `Strg+Z` rückgängig
- **Automatisierte Tests** (`npm test`, Vitest): Wiederholungen, Schnelleingabe, Tasks-Format, Feiertage, Export/Import
- Datenmodell bereits vorbereitet für Google-IDs (Sync) und Obsidian-Quellen (Datei + Zeile)
- Web-Build (`npm run web`) mit Demo-Modus `?demo` – Grundlage für eine spätere Mobil-/Web-Version

## Grenzen der aktuellen Version

- Nur **Windows** getestet; kein Installer, Start aus dem Quellcode
- **Keine Synchronisation** – weder Google Kalender noch andere Geräte
- **Keine Obsidian-Anbindung** (nur das Format ist vorbereitet)
- Wiederkehrende Termine: Änderungen gelten immer für die ganze Serie; einzelne Termine lassen sich nur löschen, nicht verschieben
- Mehrtägige Termine mit Uhrzeit erscheinen pro Tag als eigenes Stück
- Keine Zeitzonen-Auswahl (es gilt die Systemzeitzone)
- Kein ICS-*Import* (kommt mit dem Google-Sync); Sicherungen gibt es nur in der Desktop-App, nicht im Web-Build
- Papierkorb nur für ToDos; gelöschte Termine lassen sich nur per `Strg+Z` in derselben Sitzung zurückholen
- Feiertage, die nur in einzelnen Gemeinden gelten (z. B. Mariä Himmelfahrt in Teilen Bayerns), fehlen
