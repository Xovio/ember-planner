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
| 2.6 | Schnelle Gewinne: wiederkehrende ToDos, Feiertage, Tastenkürzel-Übersicht, Export/Import, automatische Backups, Archiv & Papierkorb, automatisierte Tests | ✅ fertig |
| 2.7 | Ideen-Boards: Brainstorm-Fläche mit Zetteln, Rahmen, Pfeilen und Punkten · Zusammenfassen · Export als Obsidian-Notiz und `.canvas` | ✅ fertig |
| 2.8 | Kleine Lücken: Serientermine einzeln bearbeiten, Serienende für ToDos, mehrtägige Balken, Papierkorb für Termine, Termin-Vorlagen | ✅ fertig |
| 3 | Google-Kalender-Sync (2-Wege, OAuth) | ✅ fertig |
| 3.5 | Discord: Server-Events im Kalender, Termine ankündigen, mitziehen und absagen ([Konzept](DISCORD.md)) | ✅ fertig (inkl. Platzhalter für die nächste Session) |
| 4 | Obsidian-Anbindung & Claude-Integration | Notizen verknüpfen ✅ (Stufe 1); Vorschau, `[[`-Vorschläge, Claude folgen ([OBSIDIAN.md](OBSIDIAN.md)) |
| 5 | Verteilung: Installer ✅ (NSIS, `npm run dist`), Auto-Update ✅ (GitHub Releases), Code-Signatur | fast fertig |
| 6 | Mobile-Version | geplant |

## Phase 3 – Google Kalender ✅

Umgesetzt – Details in [GOOGLE-SYNC.md](GOOGLE-SYNC.md), Einrichtung in [GOOGLE-SETUP.md](GOOGLE-SETUP.md).
Offen geblieben:

- Lokalen Kalender zu Google hochladen („Kalender zu Google hochladen“)
- ~~Einzelne Termine einer Serie in der App verschieben/bearbeiten („nur dieser“)~~ ✅ 2.8
- Serien in fremden Zeitzonen exakt expandieren, `RDATE` unterstützen
- Optional: einmaliger Import per ICS-Datei / iCal-Adresse

## Phase 4 – Obsidian & Claude

Offene Fragen, die wir vorher klären: Welche Vaults? Welche Notizen werden durchsucht? Sollen ToDos aus der App in eine
bestimmte Notiz geschrieben werden? Wie wird mit Konflikten umgegangen, wenn in beiden Welten gleichzeitig editiert wird?

Ideen:

- **Vault-Anbindung:** ToDo-Zeilen im Tasks-Format (`- [ ] … 📅 … ⏳ …`) aus ausgewählten Vaults lesen; Abhaken in der App schreibt `- [x] … ✅ Datum` zurück
- **Quelle anzeigen:** ToDo zeigt Vault, Notiz und Zeile; Klick öffnet die Notiz in Obsidian (`obsidian://`-Link)
- **Dataview-freundlich:** Tags und Felder so wählen, dass bestehende Dataview-Abfragen funktionieren
- **DnD-Kampagnen:** Session-Notizen mit Datum werden zu Terminen; Prep-ToDos einer Session hängen am Termin;
  ~~Countdown-Widget „Tage bis zur nächsten Session“ mit offenen Prep-Aufgaben~~ ✅ (Widget „Nächste Session“, erster Test der Widget-API)
- **Discord-Events:** über einen eigenen Bot die geplanten Events ausgewählter Server (z. B. DnD-Runde) als Kalender
  einblenden – inkl. Anzahl „Interessiert“ – und Sessions aus dem Kalender per „In Discord ankündigen“ als Server-Event
  anlegen; verschiebt man die Session, wandert das Discord-Event mit. Baut auf dem Sync-Fundament aus Phase 3 auf
  (Patches, Outbox, verschlüsselter Token-Speicher). Konzept: [DISCORD.md](DISCORD.md), Bot-Einrichtung: [DISCORD-SETUP.md](DISCORD-SETUP.md)
- **Claude-Anbindung (MCP-Server):** Claude kann Termine und ToDos lesen, anlegen und abhaken – z. B. „plane mir die
  Session-Vorbereitung bis Freitag ein“ oder ToDos aus einer Projektnotiz ableiten (immer mit Bestätigung)
- **Board zusammenfassen lassen:** Knopf im Zusammenfassen-Panel – Claude schlägt Kernaussagen, offene Fragen und nächste
  Schritte als *Entwurf* vor; übernommen wird erst nach Bestätigung (die Gliederung ohne KI gibt es schon seit 2.7)
- **Boards im Vault:** Export direkt in einen gewählten Vault-Ordner statt über den Speichern-Dialog

## Phase 5 – Verteilung

- ~~Installer (electron-builder, NSIS) mit App-Icon, Startmenü-Eintrag und „Mit Windows starten“~~ ✅ – pro Benutzer, ohne Adminrechte
- Code-Signatur, damit SmartScreen nicht nachfragt
- ~~Auto-Update über GitHub Releases~~ ✅ – Tag `vX.Y.Z` pushen, die Action baut und veröffentlicht
- Optional: macOS-/Linux-Builds

## Phase 6 – Mobile

- Gleiche Oberfläche per Capacitor (Android zuerst)
- Touch-Gesten: langes Drücken zum Verschieben, Wischen für „erledigt“ / „morgen“
- Sync über Google Kalender bzw. eine eigene Sync-Lösung für ToDos

## ADHS-freundlich & Motivation ⭐

Ember Planner soll besonders Menschen mit ADHS gut tun: wenig Reibung, sichtbarer Fortschritt, Belohnung statt Schuldgefühl.
Hintergründe und Quellen sammeln wir in einer eigenen Recherche-Notiz (`docs/ADHS.md`, folgt).

- ~~**Wochenziele als Bausteine**~~ ✅ (mit festen Zeiten und Nachfrage „Hat’s geklappt?“): z. B. „3× Gym“, auch wiederkehrend jede Woche. Angelegt bei den ToDos; jeder Baustein
  wird in den Kalender der Woche gezogen und gilt dann als geplant, danach abhakbar. Optional ein Standard-Zeitbereich
  (z. B. Mo–Fr 17–20 Uhr), in dem die Bausteine stattfinden sollen – dort werden sie beim Ziehen hervorgehoben
- ~~**Gamification:** Punkte fürs Abhaken (Ziele, ToDos, Sessions, Prep-Stunden), Wochenfortschritt, Level~~ ✅
- **Avatar** ⭐ – Stufe 1 (Charakter, Attribute, Coins, Shop) ✅, Stufe 2 (isometrisches Zimmer, Möbel-Shop, Einrichten) ✅, Konzept in [AVATAR.md](AVATAR.md); weiter mit Zimmer-Erweiterungen und Abenteuer: ein kleiner Charakter, der mit den Punkten levelt; Coins für Kleidung und ein Haus zum
  Einrichten; Attribute (z. B. Fitness, Ausdauer, Köpfchen), denen ToDo-Kategorien zugeordnet sind – Schwierigkeit und Dauer
  geben Bonus auf das Attribut. Konzept folgt
- **Plugin-/Widget-System** nach dem Vorbild von Obsidian; die linke Leiste als Andockpunkt in drei Stufen: interne Widget-API → Plugins aus einem Ordner (abgeschottet, mit Rechten) → Katalog.
  Konzept: [PLUGINS.md](PLUGINS.md)

## Ideen-Sammlung

**Planung**
- Eisenhower-Matrix (dringend × wichtig) als Widget und Ansicht
- „Vorschlag einplanen“: freie Lücken vor der Deadline anhand der Zeitschätzung vorschlagen – nur auf Klick
- Tagesritual: morgendliche Planung („Was schaffe ich heute?“) und Tagesabschluss („Was schiebe ich?“)
- ~~Wiederkehrende ToDos (z. B. wöchentlich Wohnung aufräumen)~~ ✅ 2.6
- Gewohnheiten-Tracker mit Serien
- Pufferzeiten; Warnung bei überbuchten Tagen (Arbeitszeiten bewusst nicht)
- Fokus-Modus / Pomodoro für einen Zeitblock

**Kalender**
- ~~Einzelne Termine einer Serie verschieben/bearbeiten („nur dieser“, „diesen und folgende“)~~ ✅ 2.8
- ~~Mehrtägige Termine als durchgehende Balken in Woche und Monat~~ ✅ 2.8
- Zeitzonen und zweite Zeitzone in der Wochenansicht
- Jahresansicht und Mehr-Wochen-Ansicht
- ~~Feiertage (Deutschland/Bundesland) als einblendbarer Kalender~~ ✅ 2.6
- ~~Termin-Vorlagen (z. B. „DnD-Session“ mit Dauer, Ort, Erinnerung)~~ ✅ 2.8

**ToDos**
- ~~**Projekte** mit Unter-Listen und Fortschritt~~ ✅ – später mit Obsidian-Projektnotizen verbunden ⭐
- Abhängigkeiten („erst nach …“)
- Anhänge und Links
- ~~Archiv und Papierkorb mit Wiederherstellen~~ ✅ 2.6 (für ToDos)
- ~~Papierkorb auch für Termine~~ ✅ 2.8
- **Filter speichern** (z. B. „DnD, nächste 14 Tage, Priorität hoch“) ⭐

**Oberfläche**
- Weitere Styles (z. B. „Glut“, „Pergament“ für die Kampagnen-Stimmung, hoher Kontrast)
- Frei anordenbares Dashboard (Widgets ziehen, ein-/ausblenden)
- Kompakt- und Komfort-Dichte
- ~~Tastenkürzel-Übersicht (`?`)~~ ✅ 2.6 · anpassbare Kürzel
- Englische Übersetzung

**Charakter & Zimmer**
- **Termine spiegeln:** die Figur macht, was gerade im Kalender steht (Gym → Hanteln), und eine Weile danach – Plan in [AVATAR.md](AVATAR.md#termine-spiegeln-geplant)
- ~~**D&D-Tisch** als Möbel fürs Zimmer~~ ✅ (dazu Gitarre, Küche, Laufband, Fernseher)
- ~~**Figur als Begleiter** im Kalender und anderen Ansichten, mit kleinen Animationen (schreiben, Bizeps-Curls …), per Schalter~~ ✅ (spiegelt laufende Termine; im Zimmer noch offen)

**Ideen-Boards** (Grundversion ✅ 2.7)
- Bilder und Links als Karten, Zettelbreite anpassbar
- `.canvas`-Dateien aus Obsidian importieren
- Board-Vorlagen (z. B. „Session-Rückblick“, „Pro & Contra“, „Arc-Planung“)
- Board mit einem Termin verknüpfen (z. B. Brainstorm zur nächsten Session)

**Technik**
- ~~Automatisierte Tests (Wiederholungslogik, Schnelleingabe-Parser, Tasks-Format)~~ ✅ 2.6 · Oberflächen-Tests (z. B. Playwright) fehlen noch
- SQLite statt JSON für große Datenmengen
- ~~Export/Import (JSON, ICS, Markdown im Tasks-Format) und automatische Backups~~ ✅ 2.6 · ICS-Datei-Import siehe Phase 3 (optional)
- ~~Wiederkehrende ToDos: Ende der Serie (am Datum / nach N) in der Oberfläche einstellbar~~ ✅ 2.8
- **Cloud-Anbindung:** verschlüsselte Sicherung und Sync der ToDos über Geräte (auch Grundlage für Mobile) ⭐

## Mitmachen

Ideen, Fehler und Wünsche gern als GitHub-Issue. Bei größeren Änderungen vorher kurz abstimmen.
