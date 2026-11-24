# Funktionen & Umfang

Stand: Version 0.2 (24. November 2026: Auto-Update, Google-Sync, Schnelle Gewinne 2.6, Ideen-Boards 2.7, Windows-Installer). Was die App heute kann, wo ihre Grenzen liegen und was bewusst noch fehlt.
Ausblick und Ideen stehen in der [Roadmap](ROADMAP.md).

## Aufbau der Oberfläche

| Bereich | Inhalt |
|---|---|
| **Planen** (Startseite) | Kalender in der Mitte · links Mini-Monat, Kalender, ToDo-Ansichten, Listen, Kategorien · rechts Seitenspalte mit den Reitern *ToDos*, *Heute*, *Details* |
| **ToDos** | Alle ToDos zum Organisieren, gruppiert nach Dringlichkeit, mit Tastatursteuerung und Mehrfachauswahl |
| **Übersicht** | Dashboard mit Kennzahlen und Diagrammen |
| **Ideen** | Brainstorm-Boards: freie Fläche mit Zetteln, Rahmen und Pfeilen; Zusammenfassen und Export nach Obsidian |
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

## Ideen (Brainstorm-Boards)

Eine freie Fläche zum Sammeln und Ordnen – in der Art von Miro, aber bewusst schlicht.

- **Boards** in der linken Spalte: anlegen (`+`), umbenennen (Titel in der Werkzeugleiste), löschen per Rechtsklick (`Strg+Z` holt es zurück)
- **Zettel** in den acht App-Farben: Doppelklick auf die Fläche (oder `N`) legt einen an, Doppelklick auf einen Zettel bearbeitet ihn.
  Beim Schreiben: `Enter` = fertig + **verbundener** Zettel rechts daneben, `Tab` = fertig + Zettel **darunter** (am selben Elternzettel),
  `Shift+Enter` = Zeilenumbruch, `Esc` = fertig. So entsteht schnell eine Mindmap
- **Rahmen** gruppieren Zettel: `G` fasst die Auswahl in einen Rahmen (ohne Auswahl: leerer Rahmen). Zettel gehören zu dem Rahmen,
  in dem ihre Oberkante liegt; zieht man den Rahmen am Titel, wandert der Inhalt mit. Ecke unten rechts = Größe ändern
- **Pfeile:** den Punkt am rechten Rand eines Zettels auf einen anderen ziehen · ins Leere ziehen = neuer verbundener Zettel dort
- **Punkte vergeben** (`+` am Zettel, Klick auf die Punkte entfernt einen) – bestimmen die Reihenfolge in der Zusammenfassung
- **Nächster Schritt** (Rechtsklick) markiert Zettel als Aufgabe; **Als ToDo übernehmen** legt ein ToDo im Eingang an und verknüpft es
  (Häkchen am Zettel öffnet das ToDo) · **Als Termin planen** öffnet die Schnelleingabe mit dem Zetteltext
- **Bedienung:** Fläche ziehen = verschieben · Mausrad = scrollen · `Strg+Mausrad` = zoomen · `0` = alles zeigen ·
  `Shift+Ziehen` = Auswahlrahmen · Pfeiltasten = Auswahl verschieben · `Strg+D` = duplizieren · `Entf` = löschen · alles mit `Strg+Z`

**Zusammenfassen & Export** (Knopf rechts in der Werkzeugleiste):

- **Fazit:** eigenes Textfeld für die Kernaussage – steht oben in der Notiz
- **Gliederung ohne KI, aus dem Aufbau des Boards:** Rahmen → Überschriften (oben links zuerst), Pfeile im selben Rahmen →
  Einrückung, Punkte → Reihenfolge, Zettel außerhalb von Rahmen → „Weitere Ideen“, nächste Schritte → `- [ ]` im Tasks-Format
  (verknüpfte ToDos mit ihren Deadlines und Erledigt-Status)
- **Vorschau** des Markdowns, vor dem Speichern frei anpassbar („Neu erzeugen“ verwirft die Anpassung)
- **Als Notiz speichern:** `.md` mit Frontmatter (`title`, `date`, `tags: brainstorm`); mit Fazit wandern die Ideen in einen
  eingeklappten Callout `> [!note]- Alle Ideen`. Optional landet daneben eine **`.canvas`-Datei** (offenes JSON-Canvas-Format), die
  Obsidian als Board öffnet und die in der Notiz eingebettet wird (`![[… .canvas]]`) · außerdem: Markdown kopieren, nur `.canvas` speichern

## Darstellung

- Themes **Ember** (dunkel, Karminrot) und **Rosé** (hell); alle Farben sind CSS-Variablen
- Kalender- und Diagrammfarben mit einem Validator auf Farbschwäche und Kontrast geprüft
- Status (überfällig, verpasst) immer mit Symbol + Text, nie nur über Farbe
- Schrift Inter, lokal eingebunden (offline)

## Google Kalender (2-Wege-Sync)

- **Verbinden** unter *Optionen → Google Kalender* mit eigener Client-ID (einmalig, kostenlos, Anleitung:
  [GOOGLE-SETUP.md](GOOGLE-SETUP.md)); Anmeldung im Browser, Token verschlüsselt gespeichert
- **Kalender auswählen**: Google-Kalender erscheinen links im Abschnitt *Google*; Name, Farbe und Sichtbarkeit lassen sich lokal anpassen
- **Abgleich** beim Start, alle 5 Minuten, beim Zurückkehren ins Fenster und auf Knopfdruck (↻ neben *Google*); nach einer
  Änderung in der App wird nach ca. 2,5 Sekunden hochgeladen
- **In beide Richtungen**: anlegen, bearbeiten, verschieben (auch per Drag & Drop und zwischen Kalendern), löschen
- **Serien** inkl. einzeln verschobener oder abgesagter Termine; Regeln wie „jeden 2. Dienstag“ werden angezeigt und bleiben erhalten
- **Erinnerungen** aus Google lösen Windows-Benachrichtigungen aus; geänderte Erinnerungen gehen zurück zu Google
- **Konflikte**: die neuere Änderung gewinnt, mit Hinweis · **Offline**: Änderungen warten und werden später übertragen
- **Sicher**: Kalender ausschalten oder trennen löscht nie etwas bei Google; Felder, die Ember Planner nicht kennt
  (Teilnehmer, Videokonferenz), bleiben unangetastet
- **Schreibgeschützt** sind Kalender, in denen du bei Google nur Leserechte hast (z. B. Feiertage) – mit „Kopieren“ in einen eigenen Kalender übernehmen
- Zeitblöcke aus ToDos werden mitsynchronisiert, wenn der ToDo-Kalender ein Google-Kalender ist

Technik und Entscheidungen: [GOOGLE-SYNC.md](GOOGLE-SYNC.md)

## Daten & Technik

- Lokale JSON-Datei `%APPDATA%\Ember Planner\data.json`, atomar geschrieben; defekte Dateien werden gesichert statt überschrieben
- **Automatische Sicherung:** einmal täglich eine Kopie nach `%APPDATA%\Ember Planner\Backups`, die letzten 14 bleiben.
  In den Optionen unter *Daten*: jetzt sichern, Ordner öffnen, eine Sicherung wiederherstellen (rückgängig machbar).
  Ist Google verbunden, gelten wiederhergestellte Termine als lokale Änderung und werden zu Google übertragen
- **Export:** alles als JSON · Termine als `.ics` (mit Wiederholungen, Ausnahmen und Erinnerungen, z. B. für Google/Outlook) ·
  ToDos als Markdown im Obsidian-Tasks-Format, nach Listen gegliedert
- **Import:** JSON-Sicherung (ersetzt alle Daten) · Markdown mit Tasks-Zeilen (fügt ToDos samt Unteraufgaben zum Eingang hinzu) –
  beides mit `Strg+Z` rückgängig
- Google-Anmeldung (`google-auth.bin`, verschlüsselt) und Sync-Zustand (`google-sync.json`) liegen getrennt von `data.json`
- Datenmodell vorbereitet für Obsidian-Quellen (Datei + Zeile)
- **Automatisierte Tests** (`npm test`, Vitest): Wiederholungen, iCalendar-Regeln, Google-Mapping, Sync und Hochladen,
  Schnelleingabe, Tasks-Format, Feiertage, Export/Import, Board-Gliederung, Markdown- und Canvas-Export
- **Windows-Installer** (`npm run dist`, electron-builder/NSIS): pro Benutzer ohne Adminrechte, Startmenü- und
  Desktop-Verknüpfung, eigenes App-Icon; die installierte App lässt sich an die Taskleiste anheften und nutzt dieselben Daten
  wie der Entwicklungsstart
- **Auto-Update** über GitHub Releases (electron-updater): Suche beim Start und alle 6 Stunden, Download im Hintergrund,
  Installation beim Beenden oder per *Jetzt neu starten*; Hinweis „Update bereit“ in der Titelleiste; Veröffentlichen per
  Tag `vX.Y.Z` und GitHub Action
- Web-Build (`npm run web`) mit Demo-Modus `?demo` – Grundlage für eine spätere Mobil-/Web-Version

## Grenzen der aktuellen Version

- Nur **Windows** getestet; Installer ist nicht signiert (SmartScreen fragt beim ersten Installieren nach)
- **Sync nur mit Google Kalender** – ToDos werden nicht zwischen Geräten abgeglichen
- Google-Serien in einer anderen Zeitzone als der des PCs können rund um die Zeitumstellung um eine Stunde abweichen; `RDATE` wird nicht unterstützt
- Einzelne Termine einer Serie lassen sich in der App weiterhin nur löschen, nicht einzeln verschieben (in Google geänderte werden korrekt angezeigt)
- **Keine Obsidian-Anbindung** (nur das Format ist vorbereitet)
- Wiederkehrende Termine: Änderungen gelten immer für die ganze Serie; einzelne Termine lassen sich nur löschen, nicht verschieben
- Mehrtägige Termine mit Uhrzeit erscheinen pro Tag als eigenes Stück
- Keine Zeitzonen-Auswahl (es gilt die Systemzeitzone)
- Kein Import von `.ics`-Dateien; Sicherungen gibt es nur in der Desktop-App, nicht im Web-Build
- Papierkorb nur für ToDos; gelöschte Termine lassen sich nur per `Strg+Z` in derselben Sitzung zurückholen
- Ideen-Boards: keine Bilder, kein Freihandzeichnen, Zettel mit fester Breite; die Zusammenfassung ordnet nur, sie formuliert
  nichts neu (das ist für die Claude-Anbindung in Phase 4 vorgesehen); kein Import von `.canvas`-Dateien
- Feiertage, die nur in einzelnen Gemeinden gelten (z. B. Mariä Himmelfahrt in Teilen Bayerns), fehlen
