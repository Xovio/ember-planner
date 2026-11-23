# Roadmap, Ideen & Ziele

Wohin sich Ember Planner entwickeln soll. Was schon da ist: [Funktionen & Umfang](FEATURES.md).

## Ziele

1. **Ein Ort für Zeit und Aufgaben.** Termine und ToDos gehören zusammen; Planen heißt, Aufgaben in den Kalender zu ziehen.
2. **Deadlines ernst nehmen, aber realistisch.** Harte Deadlines dürfen nicht übersehen werden, weiche helfen beim Takten –
   die App macht Druck sichtbar, bevor es knapp wird.
3. **Schnell und fehlertolerant.** Jede Aktion in wenigen Tasten, alles rückgängig machbar, keine Rückfragen-Dialoge.
4. **Offen für die eigenen Werkzeuge.** Obsidian-Notizen und Google Kalender sollen mitspielen, ohne dass Daten eingesperrt werden.
5. **Vorschläge statt Automatik.** Die App darf vorschlagen, wann etwas eingeplant wird – aber nie ungefragt den Kalender umbauen.
6. **Schön und angenehm.** Warmes, ruhiges Design, wählbare Styles, gut lesbar auch bei Farbschwäche.

## Phasen

| Phase | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Kalender, Erinnerungen, Tray, Themes, Übersicht | ✅ fertig |
| 2 | ToDos mit harten/weichen Deadlines, Listen, Kategorien, Einplanen per Drag & Drop, Deadline-Widgets | ✅ fertig |
| 2.5 | UX-Überarbeitung: eine Arbeitsfläche, Popups, Detailspalte, Schnelleingabe, Befehlspalette, Undo, Kontextmenüs | ✅ fertig |
| 3 | Google-Kalender-Sync (2-Wege, OAuth) | geplant |
| 4 | Obsidian-Anbindung & Claude-Integration | geplant – Konzept vorher gemeinsam festlegen |
| 5 | Verteilung: Installer, Auto-Update | geplant |
| 6 | Mobile-Version | geplant |

## Phase 3 – Google Kalender

- Anmeldung per OAuth (eigenes Google-Cloud-Projekt, Anleitung in der App)
- Kalenderliste aus Google übernehmen, pro Kalender Sync an/aus
- 2-Wege-Sync mit `syncToken` und ETags; Konflikte: neuere Änderung gewinnt, Hinweis bei Kollision
- Wiederholungen (RRULE) und Ausnahmen korrekt abbilden
- Offline-Änderungen sammeln und später übertragen
- Optional: einmaliger Import per ICS-Datei / iCal-Adresse

## Phase 4 – Obsidian & Claude

Offene Fragen, die wir vorher klären: Welche Vaults? Welche Notizen werden durchsucht? Sollen ToDos aus der App in eine
bestimmte Notiz geschrieben werden? Wie wird mit Konflikten umgegangen, wenn in beiden Welten gleichzeitig editiert wird?

Ideen:

- **Vault-Anbindung:** ToDo-Zeilen im Tasks-Format (`- [ ] … 📅 … ⏳ …`) aus ausgewählten Vaults lesen; Abhaken in der App schreibt `- [x] … ✅ Datum` zurück
- **Quelle anzeigen:** ToDo zeigt Vault, Notiz und Zeile; Klick öffnet die Notiz in Obsidian (`obsidian://`-Link)
- **Dataview-freundlich:** Tags und Felder so wählen, dass bestehende Dataview-Abfragen funktionieren
- **DnD-Kampagnen:** Session-Notizen mit Datum werden zu Terminen; Prep-ToDos einer Session hängen am Termin;
  Countdown-Widget „Tage bis zur nächsten Session“ mit offenen Prep-Aufgaben
- **Claude-Anbindung (MCP-Server):** Claude kann Termine und ToDos lesen, anlegen und abhaken – z. B. „plane mir die
  Session-Vorbereitung bis Freitag ein“ oder ToDos aus einer Projektnotiz ableiten (immer mit Bestätigung)

## Phase 5 – Verteilung

- Installer (electron-builder, NSIS) mit App-Icon, Startmenü-Eintrag und „Mit Windows starten“
- Auto-Update über GitHub Releases
- Optional: macOS-/Linux-Builds

## Phase 6 – Mobile

- Gleiche Oberfläche per Capacitor (Android zuerst)
- Touch-Gesten: langes Drücken zum Verschieben, Wischen für „erledigt“ / „morgen“
- Sync über Google Kalender bzw. eine eigene Sync-Lösung für ToDos

## Ideen-Sammlung

**Planung**
- Eisenhower-Matrix (dringend × wichtig) als Widget und Ansicht
- „Vorschlag einplanen“: freie Lücken vor der Deadline anhand der Zeitschätzung vorschlagen – nur auf Klick
- Tagesritual: morgendliche Planung („Was schaffe ich heute?“) und Tagesabschluss („Was schiebe ich?“)
- Wiederkehrende ToDos (z. B. wöchentlich Wohnung aufräumen)
- Gewohnheiten-Tracker mit Serien
- Pufferzeiten und Arbeitszeiten pro Wochentag; Warnung bei überbuchten Tagen
- Fokus-Modus / Pomodoro für einen Zeitblock

**Kalender**
- Einzelne Termine einer Serie verschieben/bearbeiten („nur dieser“)
- Mehrtägige Termine als durchgehende Balken in Woche und Monat
- Zeitzonen und zweite Zeitzone in der Wochenansicht
- Jahresansicht und Mehr-Wochen-Ansicht
- Feiertage (Deutschland/Bundesland) als einblendbarer Kalender
- Termin-Vorlagen (z. B. „DnD-Session“ mit Dauer, Ort, Erinnerung)

**ToDos**
- Projekte mit Unter-Listen und Fortschritt
- Abhängigkeiten („erst nach …“)
- Anhänge und Links
- Archiv und Papierkorb mit Wiederherstellen
- Filter speichern (z. B. „DnD, nächste 14 Tage, Priorität hoch“)

**Oberfläche**
- Weitere Styles (z. B. „Glut“, „Pergament“ für die Kampagnen-Stimmung, hoher Kontrast)
- Frei anordenbares Dashboard (Widgets ziehen, ein-/ausblenden)
- Kompakt- und Komfort-Dichte
- Tastenkürzel-Übersicht (`?`) und anpassbare Kürzel
- Englische Übersetzung

**Technik**
- Automatisierte Tests (Wiederholungslogik, Schnelleingabe-Parser, Tasks-Format)
- SQLite statt JSON für große Datenmengen
- Export/Import (JSON, ICS, Markdown im Tasks-Format) und automatische Backups
- Verschlüsselte Sicherung in der Cloud (optional)

## Mitmachen

Ideen, Fehler und Wünsche gern als GitHub-Issue. Bei größeren Änderungen vorher kurz abstimmen.
