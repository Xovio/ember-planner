# Google Kalender einrichten

Ember Planner spricht direkt mit der Google-Kalender-API. Dafür brauchst du einmalig ein eigenes,
kostenloses Google-Cloud-Projekt mit einer **OAuth-Client-ID**. Das dauert etwa 10 Minuten.
Deine Daten gehen dabei nur zwischen deinem PC und Google hin und her, es gibt keinen Server dazwischen.

> **Kosten:** Für Ember Planner fallen keine Kosten an, und du brauchst keine Kreditkarte. Google bewirbt in der Console
> ein Angebot „Kostenlos testen“ mit Startguthaben. Das gilt für kostenpflichtige Cloud-Dienste, die wir nicht nutzen.
> Ignoriere es einfach. Fragt ein Schritt nach einem Rechnungskonto oder einer Kreditkarte, bist du im Testangebot gelandet:
> abbrechen und zurück zur Console.

## 1. Projekt anlegen

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) und melde dich mit dem Google-Konto an,
   dessen Kalender du synchronisieren willst.
2. Oben in der Projektauswahl auf **Neues Projekt** klicken, als Namen z. B. `Ember Planner` eingeben und auf **Erstellen** klicken.
3. Achte darauf, dass das neue Projekt oben ausgewählt ist.

## 2. Google Calendar API aktivieren

1. Öffne **APIs & Dienste → Bibliothek**.
2. Suche nach **Google Calendar API**, öffne sie und klicke auf **Aktivieren**.
3. Für den [Geräte-Sync](#7-geräte-sync-optional) zusätzlich: **Google Drive API** suchen und ebenfalls **Aktivieren**.

## 3. Zustimmungsbildschirm (Google Auth Platform)

1. Öffne **APIs & Dienste → OAuth-Zustimmungsbildschirm**. Unter Umständen heißt der Bereich auch **Google Auth Platform**.
   Falls nötig, klicke auf **Jetzt starten**.
2. **App-Informationen:** App-Name `Ember Planner`, als Support-E-Mail deine eigene Adresse.
3. **Zielgruppe:** **Extern** wählen.
4. **Kontaktdaten:** deine E-Mail-Adresse. Bestätige die Richtlinie und klicke auf **Erstellen**.
5. Unter **Datenzugriff → Bereiche hinzufügen** trägst du diese beiden Bereiche ein (optional, die App fragt sie ohnehin an):
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`: Kalenderliste lesen
   - `https://www.googleapis.com/auth/calendar.events`: Termine lesen und bearbeiten
   - `https://www.googleapis.com/auth/drive.appdata`: nur für den Geräte-Sync, eigener versteckter App-Ordner in Drive
6. Unter **Zielgruppe → Testnutzer** fügst du dein eigenes Google-Konto hinzu.

## 4. Client-ID erstellen

1. Öffne **Clients** (oder **APIs & Dienste → Anmeldedaten**) und wähle **Client erstellen** bzw. **OAuth-Client-ID**.
2. Als Anwendungstyp wählst du **Desktop-App**, als Namen z. B. `Ember Planner Desktop`.
3. Klicke auf **Erstellen**. Kopiere dann die **Client-ID** und den **Clientschlüssel** (Client-Secret).

> Der Clientschlüssel einer Desktop-App ist laut Google kein echtes Geheimnis. Ember Planner speichert ihn trotzdem
> verschlüsselt, zusammen mit dem Anmelde-Token.

## 5. In Ember Planner verbinden

1. Öffne **Optionen → Google Kalender**.
2. Füge Client-ID und Clientschlüssel ein und klicke auf **Speichern und verbinden**.
3. Der Browser öffnet sich. Melde dich an und erlaube den Zugriff.
   Google zeigt dabei die Warnung **„Google hat diese App nicht überprüft“**. Das ist normal, denn es ist deine eigene App:
   Klicke auf **Erweitert → Weiter zu Ember Planner (unsicher)**.
   Lass beide Häkchen (Kalenderliste und Termine) gesetzt.
4. Zurück in der App wählst du aus, welche Kalender synchronisiert werden sollen.

## 6. Wichtig: dauerhaft angemeldet bleiben

Solange das Projekt im Status **„Testen“** steht, verfällt die Anmeldung nach **7 Tagen**. Danach musst du dich neu verbinden.
Das vermeidest du so:

1. Öffne **Zielgruppe** (bzw. **OAuth-Zustimmungsbildschirm**).
2. Klicke unter Veröffentlichungsstatus auf **App veröffentlichen** und bestätige.

Eine Überprüfung durch Google ist für den eigenen Gebrauch nicht nötig. Die Warnung „nicht überprüft“ erscheint
weiterhin bei der Anmeldung, die Anmeldung bleibt aber gültig.

## 7. Geräte-Sync (optional)

Damit gleicht Ember Planner ToDos, Projekte, Punkte, Charakter und eigene Kalender mit deinen anderen Geräten ab.
Gespeichert wird das in einem **versteckten App-Ordner** in deinem Google Drive. Den sieht man im Drive nicht, und die App
kommt an deine anderen Dateien nicht heran. Hintergründe: [SYNC.md](SYNC.md).

1. Im Cloud-Projekt die **Google Drive API** aktivieren (Schritt 2.3).
2. In Ember Planner **Optionen → Geräte-Sync** einschalten.
3. Auf **Freigeben** klicken. Der Browser öffnet sich noch einmal; erlaube dort zusätzlich den Zugriff auf den App-Ordner.
4. Auf jedem weiteren Gerät mit **demselben Google-Konto** genauso einschalten.
5. Optional: **Verschlüsseln …** und eine Passphrase festlegen. Die anderen Geräte fragen dann einmal danach.
   Vergisst du sie, löschst du unter **Sync-Daten in Google löschen** den Sync-Stand; die Daten auf den Geräten bleiben.

## 8. Freunde mitnutzen lassen

Ember Planner ist nicht veröffentlicht. Damit Freunde nicht jeweils ein eigenes Cloud-Projekt anlegen müssen, können sie
**deine** Client-ID und deinen Clientschlüssel eintragen. Jede Person meldet sich trotzdem mit ihrem **eigenen**
Google-Konto an und sieht nur ihre eigenen Kalender und Sync-Daten.

- Das Projekt muss **veröffentlicht** sein (Schritt 6), sonst laufen die Anmeldungen nach 7 Tagen ab bzw. nur Testnutzer kommen rein.
- Bei der Anmeldung erscheint die Warnung „nicht überprüft“. Über **Erweitert → Weiter zu Ember Planner** geht es weiter.
- Ohne Überprüfung durch Google sind höchstens **100 Personen** möglich. Für den Freundeskreis reicht das.

## Verbindung trennen

**Optionen → Google Kalender → Trennen** widerruft den Zugriff und löscht das gespeicherte Token. Die Google-Kalender
verschwinden dabei aus Ember Planner. In Google bleiben alle Termine erhalten.
Zusätzlich kannst du den Zugriff jederzeit unter [myaccount.google.com/permissions](https://myaccount.google.com/permissions) entziehen.

## Probleme

| Meldung | Lösung |
|---|---|
| „Zugriff blockiert: … hat die Überprüfung nicht abgeschlossen“ | Dein Konto fehlt unter **Testnutzer** (Schritt 3.6), oder du veröffentlichst die App (Schritt 6) |
| „Die Anmeldung ist abgelaufen“ | Status „Testen“ und 7 Tage vorbei: neu verbinden und Schritt 6 erledigen |
| „Es fehlt die Berechtigung für …“ | Bei der Anmeldung wurde ein Häkchen entfernt: neu verbinden und beide Häkchen setzen |
| „Google Calendar API wurde nicht aktiviert“ | Schritt 2 im richtigen Projekt nachholen; danach ein paar Minuten warten |
| „Die Google Drive API ist im Cloud-Projekt nicht aktiviert“ | Schritt 2.3 nachholen, ein paar Minuten warten, dann **Jetzt abgleichen** |
| „Der Zugriff auf den App-Ordner in Google Drive fehlt“ | Unter **Optionen → Geräte-Sync** auf **Freigeben** klicken und das Häkchen für Drive setzen |
