# Geräte-Sync über das Google-Konto – Konzept

**Status:** Schritt 1 (Sync-Modell) gebaut, 27. November 2026. Schritte 2–4 sind Konzept.

## Ziel

Desktop-App und Handy-App zeigen dieselben Termine, ToDos, Projekte, Punkte und denselben Charakter. Dafür braucht es
**keinen eigenen Server**: Wir nutzen das Google-Konto, mit dem man sich für den Kalender-Sync ohnehin anmeldet.

- **Termine in Google-Kalendern** laufen wie heute über die Calendar API ([GOOGLE-SYNC.md](GOOGLE-SYNC.md)).
  Die Handy-App macht dasselbe, Google ist die gemeinsame Quelle.
- **Alles andere** liegt als JSON im versteckten App-Ordner des Nutzers in Google Drive (`appDataFolder`).
- Die Handy-App gibt es nur für Android. Vorerst nutzen nur du und Freunde die App, sie wird nicht veröffentlicht.

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
| Gemeinsame Einstellungen (Standardansicht, Standard-Erinnerungen, Feiertage, ToDo-Kalender) | Drive | |
| Geräte-Einstellungen (Design, Schrift, Ecken, Autostart, Tray, Widget-Anordnung, Vault-Pfade) | nur lokal | jedes Gerät stellt sie selbst ein |
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

Umgesetzt in `src/shared/sync.ts` (Schritt 1), mit Tests in `sync.test.ts`.

**Einträge statt Dateien.** Der abgeglichene Teil der Daten wird in einzelne Einträge zerlegt, z. B. `todos/<id>`,
`lists/<id>`, `points/<id>`, `character/look`, `rewards/<id>` oder `settings/defaultView`. Jeder Eintrag hat einen
**Stempel**: Zeit und Gerät der letzten Änderung. Beim Zusammenführen gewinnt pro Eintrag der neuere Stempel.
Bei Gleichstand entscheidet die Geräte-ID, damit alle Geräte dasselbe Ergebnis haben.

1. **Sammlungen mit IDs** (Kalender, Termine, ToDos, Papierkorb, Listen, Kategorien, Vorlagen, Boards, Ziele):
   jeder Eintrag einzeln. Ein ToDo in den Papierkorb legen heißt: `todos/x` gelöscht, `trash/x` neu.
2. **Löschen:** Wird ein Eintrag entfernt, bleibt sein Stempel als Löschmarkierung stehen. Eine Löschung ist eine
   Änderung wie jede andere: Ist sie neuer als eine Bearbeitung auf dem anderen Gerät, gewinnt sie, sonst die Bearbeitung.
   Löschmarkierungen werden **90 Tage** mit hochgeladen, länger als der Papierkorb (30 Tage), damit auch ein länger
   offline liegendes Handy die Löschung noch mitbekommt.
3. **Punkte:** Jeder Punkteeintrag ist ein eigener Eintrag und ändert sich nie, deshalb gibt es keine Konflikte.
4. **Charakter:** jedes Feld einzeln (`look`, `outfit`, `room`, `outfits` …), Belohnungen pro Eintrag. Wer auf dem
   Handy die Frisur ändert und am PC ein Möbelstück verschiebt, behält beides. Gekaufte Teile (`owned`) werden vereinigt.
   Bekannte Grenze: Kauft man auf zwei Geräten gleichzeitig offline ein, zählt bei den ausgegebenen Münzen (`spent`)
   nur ein Gerät. Das ist selten und kostet höchstens ein paar Münzen.
5. **Wiederholbare ToDos:** `repeatable.completions` wird vereinigt, sonst geht ein Abhaken auf einem Gerät verloren.
6. **Unteraufgaben** zählen zum ToDo. Wer auf zwei Geräten verschiedene Unteraufgaben abhakt, bekommt die neuere Fassung.

**Wer stempelt?** Der Main-Prozess, nicht die Oberfläche. Bei jedem Speichern vergleicht er den alten und den neuen
Stand Eintrag für Eintrag und stempelt, was sich geändert hat (`SyncTracker`, `src/main/sync/tracker.ts`, Datei
`device-sync.json`). Dadurch musste am Datenmodell und an der Oberfläche nichts geändert werden. Das läuft ab dieser
Version immer mit, auch wenn der Sync noch aus ist, damit beim Einschalten klar ist, was wann geändert wurde.

**Daten von vor dem Sync:** Einträge, die noch genau dem Auslieferungszustand entsprechen (Standard-Listen und
-Kalender), bekommen den Stempel 0. Alles andere bekommt sein `updatedAt` oder 1. Ein frisch installiertes Handy
überschreibt so nie die echten Daten vom PC.

**Uhren:** Ein Gerät stempelt nie früher als den höchsten Stempel, den es schon gesehen hat (einfache „hybride Uhr“).
Eine nachgehende Uhr kann so keine neuere Änderung verdrängen.

**Zur Oberfläche** kommen zusammengeführte Einträge als Patch (`DataPatch.records`) über den vorhandenen `RemoteLog`
(`src/shared/patch.ts`). Undo und laufende Eingaben bleiben damit erhalten, genau wie beim Google-Kalender.

## Wann abgeglichen wird

- beim Start und wenn das Fenster oder die App wieder in den Vordergrund kommt
- 20 Sekunden nach der letzten Änderung (gebündelt, damit nicht jeder Tastendruck hochgeladen wird)
- alle 5 Minuten, solange die App offen ist
- auf dem Handy zusätzlich beim Öffnen, Android darf im Hintergrund nur selten

## Anmeldung und Google-Freigabe

- Neue Berechtigung: `https://www.googleapis.com/auth/drive.appdata`. Sie erlaubt nur den versteckten Ordner unserer App,
  nicht die anderen Dateien im Drive. Wer schon mit Google verbunden ist, wird beim Einschalten einmal neu gefragt.
- Im eigenen Cloud-Projekt muss zusätzlich die **Google Drive API** aktiviert werden. [GOOGLE-SETUP.md](GOOGLE-SETUP.md) bekommt dafür einen Absatz.
- **Für andere Nutzer** brauchen wir einen gemeinsamen OAuth-Client von uns, statt dass jeder ein eigenes Projekt anlegt.
  Weil die Kalender-Berechtigung als „sensibel“ gilt, prüft Google die App: Datenschutzerklärung, Startseite, Begründung
  pro Berechtigung, kurzes Demo-Video. Das kostet nichts, dauert aber einige Wochen. Bis dahin gehen bis zu 100 Testnutzer
  mit dem Hinweis „nicht verifizierte App“. `drive.appdata` allein wäre nicht sensibel.
- Handy: eigener OAuth-Client für Android (Paketname und Signatur-Fingerabdruck) im selben Cloud-Projekt. Anmeldung über den
  System-Browser (Custom Tabs) mit PKCE, wie am Desktop.

## Optionen in der App

Abschnitt „Geräte-Sync“ in den Optionen:

- Schalter „Über Google-Konto abgleichen“
- Status: „Zuletzt abgeglichen vor 2 Minuten“ oder die Fehlermeldung auf Deutsch
- Liste der Geräte mit letztem Abgleich, Gerät entfernen
- Knopf „Jetzt abgleichen“
- „Sync-Daten in Google löschen“ (fragt nach, entfernt den App-Ordner)

## Schritte

1. ~~**Sync-Modell:** Einträge, Stempel, Löschmarkierungen, gemeinsame und Geräte-Einstellungen, Zusammenführen mit Tests, Stempel im Main-Prozess. Noch ohne Netzwerk.~~ ✅
2. **Drive-Sync am Desktop:** Berechtigung, Gerätedateien, Abgleich-Zeitpunkte, Optionen, optionale Verschlüsselung
   (AES-GCM, Schlüssel aus der Passphrase per PBKDF2). Testbar mit zwei Desktop-Installationen
   (`EMBER_USER_DATA` zeigt auf zwei Datenordner).
3. **Termin-Zusatzangaben:** Verweise in `extendedProperties`, größere Angaben im Drive unter der Google-Termin-ID.
4. **Android-App:** Capacitor mit derselben Oberfläche, Speicher-Schicht statt `fs`, Anmeldung auf Android ([ROADMAP.md](ROADMAP.md), Phase 6).
5. **Weitergabe an die Öffentlichkeit:** Datenschutzerklärung, Google-Prüfung. Erst, wenn die App veröffentlicht werden soll.

Später möglich:
- **Ordner-Sync ohne Google:** Dieselben Gerätedateien in einem gewählten Ordner (Dropbox, OneDrive, Syncthing).
  Das Zusammenführen bleibt gleich, nur der Speicherort ändert sich.
- **Google Tasks** als zusätzliche Anzeige, damit ToDos auch in Googles eigener App auftauchen. Nicht als Speicher,
  dafür fehlen dort Projekte, Wiederholungen, Deadlines und Punkte.

## Entscheidungen (27. November 2026)

1. **Design und Schrift sind Geräte-Einstellungen.** Jedes Gerät stellt sie selbst ein, sie werden nicht abgeglichen.
2. **Verschlüsselung kommt als Option mit in Schritt 2.** Standard ist aus. Wer sie einschaltet, vergibt eine Passphrase
   und gibt sie auf jedem weiteren Gerät einmal ein. Die App warnt deutlich, dass eine vergessene Passphrase nur den
   Sync-Stand unbrauchbar macht, nicht die lokalen Daten.
3. **Vorerst nur für dich und Freunde, keine Veröffentlichung.** Damit entfällt die Google-Prüfung. Wir nutzen einen
   gemeinsamen OAuth-Client aus deinem Cloud-Projekt, Status „In Produktion“ (sonst laufen Anmeldungen nach 7 Tagen ab).
   Freunde sehen bei der Anmeldung den Hinweis „nicht verifizierte App“ und klicken sich durch. Grenze: 100 Nutzer.
   Schritt 5 (Weitergabe) wird erst wieder Thema, wenn die App öffentlich werden soll.
4. **Nur Android.** iPhone ist nicht geplant. Die Handy-App bekommt nur einen Android-OAuth-Client.
