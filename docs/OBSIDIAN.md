# Obsidian-Anbindung – Konzept

**Status:** Konzept (26. November 2026), noch nicht gebaut.

## Ausgangslage

Ursprünglich war die Anbindung als Sync von ToDos im Tasks-Format gedacht (`- [ ] … 📅 … ⏳ …`). Ein Blick in die
Vaults zeigt aber: Dort steht keine einzige Checkbox, und das Tasks-Plugin ist nicht installiert. Die Vaults sind
Weltenbau- und Kampagnen-Sammlungen. Allein „Two Realities“ hat 58 Notizen zu Biomen, Dimensionen, NPCs, Städten,
Fraktionen und Regeln, jeweils mit Frontmatter (`Type:`, `tags:`) und Templater-Vorlagen.

Deshalb verbindet Stufe 1 **Notizen**, nicht ToDos: Termine, ToDos und Projekte bekommen Links auf Vault-Notizen, und
die App hilft, die richtige Notiz schnell zu finden und zu öffnen. Der Tasks-Sync bleibt als spätere Stufe möglich.
Parser und Writer dafür gibt es schon in `shared/todo.ts`.

## Grundsätze

- **Nur lesen.** Die App schreibt in Stufe 1 nie in einen Vault. Die Vaults werden über Remotely Save synchronisiert,
  und Schreibzugriffe von zwei Seiten wären die größte Fehlerquelle.
- **Nur gewählte Vaults.** Die App schlägt die Vaults vor, die Obsidian selbst kennt (`%APPDATA%\obsidian\obsidian.json`).
  Gelesen wird nur, was in den Optionen eingeschaltet ist.
- **Geringe Reibung.** Eine Notiz verknüpfen dauert zwei Tasten: Suchfeld öffnen, Name tippen, Enter.
- **Nichts geht verloren.** Wird eine Notiz umbenannt oder verschoben, findet die App sie über den Dateinamen wieder.
  Ist sie wirklich weg, bleibt der Link als „nicht gefunden“ sichtbar, statt still zu verschwinden.

## Datenmodell

```ts
/** link to a note in an Obsidian vault */
interface NoteLink {
  vault: string          // vault name as Obsidian shows it, e.g. "Two Realities"
  path: string           // vault-relative, forward slashes, e.g. "Two Realities/NPCs/Mira.md"
  title: string          // file name without .md, kept for display and for finding a moved note again
}
```

- `noteLinks?: NoteLink[]` an `CalendarEvent`, `Todo`, `TodoList` (also auch an Projekten) und `EventTemplate`
- Über die Vorlage hängen Notizen automatisch an jedem neuen Termin, z. B. die Kampagnen-Übersicht an jeder „Two Realities“-Session.
- Für Google und Discord bleibt es lokal: Links werden nicht in die Beschreibung gesynct, sonst stünden fremde Pfade im Google-Kalender.
- Optionen: `obsidian: { vaults: { name: string; path: string; enabled: boolean }[] }`
- Das alte Feld `Todo.source` bleibt für den späteren Tasks-Sync reserviert.

## Vault-Index (Hauptprozess)

- `src/main/obsidian/` liest die eingeschalteten Vaults rekursiv ein und überspringt dabei `.obsidian/`, `.trash/` und
  Anhänge ohne `.md`.
- Pro Notiz werden gespeichert: Pfad, Titel, Ordner, Frontmatter `Type`, `tags` und `aliases`, Änderungsdatum.
  Der Inhalt wird erst beim Öffnen der Vorschau gelesen.
- Ein Dateiwächter (`fs.watch`, entprellt) hält den Index aktuell, auch wenn Remotely Save Dateien austauscht.
- Die Logik zum Suchen, Ranken und Wiederfinden steckt testbar in `src/shared/notes.ts`.
- Die Suche ist unscharf (Titel > Aliase > Ordner > Tags) und filterbar nach `Type` (NPC, Stadt, Biom …).

## Oberfläche

1. **Notizen in der Detailspalte:** Termine, ToDos und Projekte bekommen einen Abschnitt „Notizen“ mit Chips
   (Typ-Symbol, Titel, Vault in Grau). „+ Notiz“ öffnet die Schnellsuche, ein Klick auf den Chip öffnet die Notiz.
2. **Öffnen:** `obsidian://open?vault=…&file=…` über den vorhandenen Launcher. Optional springt es direkt zur Überschrift.
3. **Vorschau in der App:** Ein Klick mit gedrückter Strg-Taste oder der Knopf „Vorschau“ zeigt die Notiz lesbar im
   Popup: Frontmatter als kleine Tabelle, Überschriften, Listen, Tabellen und Bilder aus dem Vault. Praktisch am Spieltisch,
   ohne zwischen Fenstern zu wechseln. `[[Wikilinks]]` darin sind klickbar und öffnen die nächste Vorschau.
4. **Befehlspalette:** „Notiz öffnen …“ durchsucht alle Vaults, auch ohne Verknüpfung.
5. **Termin-Popup und Begleiter-Widget „Nächste Session“:** Die verknüpften Notizen stehen direkt dabei.
6. **Optionen:** Abschnitt „Obsidian“ mit den erkannten Vaults (Schalter je Vault), einem Knopf „Vault hinzufügen“ für
   Ordner, die Obsidian nicht kennt, und der Anzahl gefundener Notizen.

## Stufen

| Stufe | Inhalt |
|---|---|
| 1 | Vaults wählen, Index und Suche, Notizen an Terminen, ToDos, Projekten und Vorlagen verknüpfen, in Obsidian öffnen, Befehlspalette |
| 1b | Vorschau in der App (Markdown lesbar darstellen, Wikilinks, Bilder) |
| 2 | `[[` in Titel- und Notizfeldern schlägt Vault-Notizen vor und legt den Link an |
| 3 | Aus einer Notiz ToDos ableiten (mit der Claude-Anbindung, immer als Entwurf mit Bestätigung) |
| später | Session-Notizen mit Datum → Termine; Tasks-Sync, falls ToDos künftig in Obsidian entstehen; Boards direkt in einen Vault exportieren |

## Entscheidungen (26. November 2026)

- **Erster PR ohne Vorschau:** Vaults wählen, suchen, verknüpfen, in Obsidian öffnen und die Befehlspalette.
  Die Vorschau (1b) folgt als eigener PR.
- **Projektnotizen vererben:** Jedes ToDo eines Projekts zeigt dessen Notizen grau mit „vom Projekt“ an, zusätzlich zu
  den eigenen. Sie werden nicht kopiert, ein Klick führt zur Notiz.
- **Vorauswahl der Vaults:** Beim ersten Einrichten sind die Vaults vorausgewählt, die im häufigsten gemeinsamen Ordner
  liegen (hier `D:\Obisidan-Books`). Alle anderen, z. B. `D:\FoundryClaude\design\army-module`, stehen ausgeschaltet in der Liste.
