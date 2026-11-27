# Geräte-Sync über das Google-Konto – Konzept

**Status:** Konzept (27. November 2026). Noch nichts gebaut, erst gemeinsam durchgehen.

## Ziel

Desktop-App und Handy-App zeigen dieselben Termine, ToDos, Projekte, Punkte und denselben Charakter. Dafür braucht es
**keinen eigenen Server**: Wir nutzen das Google-Konto, mit dem man sich für den Kalender-Sync ohnehin anmeldet.

- **Termine in Google-Kalendern** laufen wie heute über die Calendar API ([GOOGLE-SYNC.md](GOOGLE-SYNC.md)).
  Die Handy-App macht dasselbe, Google ist die gemeinsame Quelle.
- **Alles andere** liegt als JSON im versteckten App-Ordner des Nutzers in Google Drive (`appDataFolder`).
- Ein Google-Konto gibt es auch auf dem iPhone. Android ist nur der naheliegendste Fall, nicht die Grenze.

## Grundsätze

- **Nichts geht still verloren.** Abgeglichen wird pro Eintrag, nicht pro Datei. Gelöschtes bleibt als Löschmarkierung stehen.
- **Offline zuerst.** Jedes Gerät arbeitet mit seinen lokalen Daten weiter und gleicht ab, sobald Netz da ist.
- **Keine Schreibkollisionen.** Jedes Gerät schreibt nur seine **eigene** Datei im Drive-Ordner und liest die der anderen.
- **Freiwillig.** Ohne Einschalten ändert sich nichts. Wer kein Google nutzt, verliert nichts.
- **Wenig Reibung.** Einschalten ist ein Schalter und eine Google-Freigabe. Danach läuft es im Hintergrund.

## Was wohin gehört

| Daten | Wo | Bemerkung |
|---|---|---|
| Termine in Google-Kalendern | Google Calendar | wie heute |
| Kleine Verweise am Termin (`todoId`, `goalId`, `templateId`) | `extendedProperties.private` am Google-Termin | `emberTodoId` gibt es schon (`src/main/google/write.ts`) |
| Größere Zusatzangaben am Google-Termin (Obsidian-Links, Tätigkeiten) | Drive, unter der Google-Termin-ID | Google erlaubt pro Feld nur 1024 Zeichen |
| Termine in lokalen Kalendern | Drive | |
| ToDos, Papierkorb, Projekte/Listen, Kategorien | Drive | |
| Termin- und ToDo-Vorlagen, Boards, Wochenziele | Drive | |
| Punkte | Drive | `PointsLedger.entries` ist schon eine Sammlung einzelner Einträge, ideal zum Zusammenführen |
| Charakter, Kleidung, Zimmer | Drive | pro Feld abgleichen, siehe unten |
| Gemeinsame Einstellungen (Design, Schrift, Standardansicht, Erinnerungen) | Drive | |
| Geräte-Einstellungen (Autostart, Tray, Widget-Anordnung, Vault-Pfade) | nur lokal | Pfade und Fenster gelten nur für das eine Gerät |
| Discord-Bot, Obsidian-Vaults lesen | nur Desktop | Das Handy zeigt die Verknüpfungen an, öffnet aber keinen Vault |
| Zugangsdaten (Google, Discord) | nur lokal, verschlüsselt | werden nie hochgeladen |

## Ablage im Drive

```
appDataFolder/
  ember-sync.json            Formatversion, Erstellzeit
  devices/
    <deviceId>.json          Stand dieses Geräts: alle Einträge mit Zeitstempel
```

- Jedes Gerät bekommt beim ersten Einschalten eine zufällige `deviceId` und einen Namen („Desktop“, „Pixel 8“).
- Ein Gerät schreibt **nur** seine eigene Datei. So können zwei Geräte nie gleichzeitig dieselbe Datei überschreiben,
  und Drive muss keine Sperren können.
- Beim Abgleich liest das Gerät alle Gerätedateien, führt sie mit dem lokalen Stand zusammen und lädt danach die eigene Datei neu hoch.
- Datenmenge: einige hundert KB pro Gerät. Das passt locker in den Gratis-Speicher.
- Geräte, die seit über 90 Tagen nichts geschrieben haben, zeigt die App als „inaktiv“ an. Ihre Datei kann man in den Optionen entfernen.

## Zusammenführen

Kern ist eine reine Funktion `mergeData(local, ...remotes)` in `src/shared/merge.ts`, vollständig mit Tests abgedeckt.

1. **Sammlungen mit IDs** (ToDos, Listen, Termine, Vorlagen, Boards, Ziele, Kategorien): pro `id` gewinnt die Version
   mit dem neueren `updatedAt`. Bei Gleichstand entscheidet die `deviceId`, damit alle Geräte dasselbe Ergebnis haben.
2. **Löschen:** Ein Eintrag wird nicht entfernt, sondern bekommt `deletedAt`. Eine Löschung ist eine Änderung wie jede andere.
   Löschmarkierungen bleiben **90 Tage** stehen, länger als der Papierkorb (30 Tage), damit auch ein länger offline
   liegendes Handy die Löschung noch mitbekommt.
3. **Punkte:** Einträge werden vereinigt. Ein Punkteeintrag ändert sich nie, deshalb gibt es hier keine Konflikte.
   Die Summe wird immer neu berechnet und nie gespeichert.
4. **Charakter:** pro Feldgruppe (`look`, `outfit`, `room`, `outfits` …) mit eigenem Zeitstempel. Wer auf dem Handy die
   Frisur ändert und am PC ein Möbelstück verschiebt, behält beides. `owned` (gekaufte Teile) wird vereinigt, `spent` als
   Liste von Käufen geführt, damit Münzen nicht doppelt oder gar nicht abgezogen werden.
5. **Wiederholbare ToDos:** `repeatable.completions` wird vereinigt, sonst geht ein Abhaken auf einem Gerät verloren.
6. **Unteraufgaben** zählen zum ToDo. Wer auf zwei Geräten verschiedene Unteraufgaben abhakt, bekommt die neuere Fassung.
   Das ist selten genug, um es so zu lassen. Ein Hinweis zeigt es an, wie bei Google-Kollisionen.

Uhren: Handys und PCs stellen ihre Uhr über das Internet. Für den Fall, dass eine Uhr falsch geht, nimmt ein Gerät nie
einen Zeitstempel, der älter ist als der höchste, den es schon gesehen hat (einfache „hybride Uhr“).

Das Zusammenführen läuft im Main-Prozess und erreicht die Oberfläche als Patch über den vorhandenen `RemoteLog`
(`src/shared/patch.ts`). Undo und laufende Eingaben bleiben damit erhalten, genau wie beim Google-Kalender.

## Wann abgeglichen wird

- beim Start und wenn das Fenster oder die App wieder in den Vordergrund kommt
- 20 Sekunden nach der letzten Änderung (gebündelt, damit nicht jeder Tastendruck hochgeladen wird)
- alle 5 Minuten, solange die App offen ist
- auf dem Handy zusätzlich beim Öffnen, Android darf im Hintergrund nur selten

## Was am Datenmodell fehlt (Schritt 1)

| Typ | Fehlt |
|---|---|
| `TodoList`, `Category`, `EventTemplate`, `TodoTemplate` | `updatedAt`, `deletedAt` (teils fehlt auch `createdAt`) |
| `Board`, `WeeklyGoal` | `deletedAt` |
| `CalendarInfo` | `updatedAt`, `deletedAt` (für lokale Kalender) |
| `Character` | Zeitstempel pro Feldgruppe, Käufe als Liste |
| `Settings` | Aufteilung in gemeinsame und Geräte-Einstellungen |
| Papierkorb (`trash`, `eventTrash`) | wird zur Ansicht auf Einträge mit `deletedAt`, statt eigene Listen zu sein |

`normalizeData` ergänzt fehlende Zeitstempel beim Laden alter Daten. Diese Umstellung lohnt sich auch ohne Sync,
weil Export und Import sowie die Backups damit sauberer zusammenführen können.

## Anmeldung und Google-Freigabe

- Neue Berechtigung: `https://www.googleapis.com/auth/drive.appdata`. Sie erlaubt nur den versteckten Ordner unserer App,
  nicht die anderen Dateien im Drive. Wer schon mit Google verbunden ist, wird beim Einschalten einmal neu gefragt.
- Im eigenen Cloud-Projekt muss zusätzlich die **Google Drive API** aktiviert werden. [GOOGLE-SETUP.md](GOOGLE-SETUP.md) bekommt dafür einen Absatz.
- **Für andere Nutzer** brauchen wir einen gemeinsamen OAuth-Client von uns, statt dass jeder ein eigenes Projekt anlegt.
  Weil die Kalender-Berechtigung als „sensibel“ gilt, prüft Google die App: Datenschutzerklärung, Startseite, Begründung
  pro Berechtigung, kurzes Demo-Video. Das kostet nichts, dauert aber einige Wochen. Bis dahin gehen bis zu 100 Testnutzer
  mit dem Hinweis „nicht verifizierte App“. `drive.appdata` allein wäre nicht sensibel.
- Handy: eigener OAuth-Client für Android (Paketname und Signatur-Fingerabdruck) bzw. iOS. Anmeldung über den
  System-Browser (Custom Tabs) mit PKCE, wie am Desktop.

## Optionen in der App

Abschnitt „Geräte-Sync“ in den Optionen:

- Schalter „Über Google-Konto abgleichen“
- Status: „Zuletzt abgeglichen vor 2 Minuten“ oder die Fehlermeldung auf Deutsch
- Liste der Geräte mit letztem Abgleich, Gerät entfernen
- Knopf „Jetzt abgleichen“
- „Sync-Daten in Google löschen“ (fragt nach, entfernt den App-Ordner)

## Schritte

1. **Datenmodell:** Zeitstempel und Löschmarkierungen überall, Einstellungen aufteilen, `mergeData` mit Tests. Noch ohne Netzwerk.
2. **Drive-Sync am Desktop:** Berechtigung, Gerätedateien, Abgleich-Zeitpunkte, Optionen. Testbar mit zwei
   Desktop-Installationen (`EMBER_USER_DATA` zeigt auf zwei Datenordner).
3. **Termin-Zusatzangaben:** Verweise in `extendedProperties`, größere Angaben im Drive unter der Google-Termin-ID.
4. **Handy-App:** Capacitor mit derselben Oberfläche, Speicher-Schicht statt `fs`, Anmeldung auf Android ([ROADMAP.md](ROADMAP.md), Phase 6).
5. **Weitergabe:** eigener OAuth-Client, Datenschutzerklärung, Google-Prüfung. Kann parallel zu 3 und 4 laufen.

Später möglich:
- **Ordner-Sync ohne Google:** Dieselben Gerätedateien in einem gewählten Ordner (Dropbox, OneDrive, Syncthing).
  Das Zusammenführen bleibt gleich, nur der Speicherort ändert sich.
- **Verschlüsselung:** Die Gerätedateien vor dem Hochladen mit einer Passphrase verschlüsseln. Sicherer, aber wer die
  Passphrase vergisst, kommt an den Sync-Stand nicht mehr heran (die lokalen Daten bleiben).
- **Google Tasks** als zusätzliche Anzeige, damit ToDos auch in Googles eigener App auftauchen. Nicht als Speicher,
  dafür fehlen dort Projekte, Wiederholungen, Deadlines und Punkte.

## Offene Fragen

1. Sollen Design und Schrift auf allen Geräten gleich sein, oder pro Gerät einstellbar?
2. Verschlüsselung mit Passphrase gleich einbauen, als Option später, oder gar nicht?
3. Ab wann soll die App an andere gehen? Davon hängt ab, wann wir die Google-Prüfung anstoßen.
4. Android zuerst, iPhone später – passt das so?
