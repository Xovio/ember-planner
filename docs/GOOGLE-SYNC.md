# Konzept: Google-Kalender-Sync (Phase 3)

Stand: 2026-11-23 · Branch `feature/google-sync` · Status: **fertig** – alle Etappen umgesetzt und mit echtem Konto getestet · Einrichtung: [GOOGLE-SETUP.md](GOOGLE-SETUP.md)

## Ziel

Google-Kalender erscheinen in Ember Planner wie eigene Kalender. Änderungen in beide Richtungen
werden automatisch abgeglichen, auch nach Offline-Phasen. Nichts geht still verloren: Bei einer
Kollision gewinnt die neuere Änderung, und die App zeigt einen Hinweis.

## Ausgangslage im Code

| Stelle | Heute | Problem für den Sync |
|---|---|---|
| `src/renderer/src/store.ts` | Der Renderer hält alle Daten und schickt nach jeder Änderung den **kompletten Stand** per `data:save` an den Main-Prozess | Der Sync läuft im Main-Prozess (Tokens, Netzwerk). Holt er Änderungen von Google, überschreibt sie der nächste Speichervorgang des Renderers mit einem veralteten Stand. |
| Undo/Redo | Speichert **ganze Daten-Schnappschüsse** | Ein Rückgängig nach einem Abruf würde die Google-Änderungen mit zurückdrehen. |
| `src/shared/types.ts` | `ExternalRef` (id, etag, calendarId) ist schon da | Es fehlen Sync-Token pro Kalender, Tombstones für gelöschte Termine, Ausnahmen in Serien und ein Schreibschutz-Flag. |
| `src/shared/recurrence.ts` | Eigenes Modell: täglich, wöchentlich mit Wochentagen, monatlich, jährlich, `until`/`count`, `exdates` | Google nutzt RRULE vollständig (z. B. „2. Dienstag im Monat“) und kennt **geänderte Einzeltermine** einer Serie. |
| Tests | keine | Das Mapping Google ⇄ intern ist fehleranfällig und braucht Tests. |

## Architektur

```
Renderer (UI, Zustand)          Main-Prozess                         Google
──────────────────────          ────────────────────────────────     ──────────
mutate() ──data:save──────────▶ DataStore  ── Diff ──▶ Outbox ──push──▶ Calendar API
           ◀──data:remote─────  (Schiedsrichter)  ◀── SyncEngine ◀─pull── (syncToken)
                                TokenStore (safeStorage/DPAPI)
                                OAuth (System-Browser + Loopback + PKCE)
```

1. **Der Main-Prozess entscheidet.** Beim Speichern vergleicht der `DataStore` den neuen Stand mit dem alten.
   Geänderte, neue und gelöschte Termine in Google-Kalendern landen in einer **Outbox**, die dauerhaft gespeichert wird.
2. **Änderungen von Google** spielt der Main-Prozess ein und schickt sie als Patch (`data:remote`) an den Renderer.
   Der Renderer übernimmt den Patch in seinen aktuellen Zustand, sodass laufende Eingaben erhalten bleiben.
3. **Schutz vor veralteten Ständen:** Jeder Patch von außen bekommt eine laufende Nummer (`seq`). Der Renderer schickt
   beim Speichern die letzte Nummer mit, die er schon kennt. Fehlen in seinem Stand neuere Patches, spielt der Main-Prozess
   sie vor dem Übernehmen erneut ein (`RemoteLog` in `src/shared/patch.ts`). Patches lassen sich mehrfach anwenden, ohne
   dass sich das Ergebnis ändert.
4. **Undo bleibt gültig:** Kommt ein Patch an, wendet der Renderer ihn auch auf alle Undo-/Redo-Schnappschüsse an.
   Rückgängig nimmt deshalb nur die eigene Änderung zurück, nicht dazwischen eingespielte Änderungen von Google.
   Das Rückgängigmachen ist selbst wieder eine lokale Änderung und wird hochgeladen.
5. **Lokale Änderungen erkennen:** `DataStore.set` vergleicht den alten und den neuen Stand der Termine (`diffEvents`) und meldet
   neue, geänderte und gelöschte Termine an Listener. Daraus füllt Etappe 4 die Outbox.

## Anmeldung (OAuth)

- OAuth-Client vom Typ **Desktop-App** im eigenen Google-Cloud-Projekt; die App bekommt dafür eine Einrichtungsanleitung
- Anmeldung im **System-Browser**, Rückleitung an `http://127.0.0.1:<zufälliger Port>`, abgesichert mit PKCE
- Refresh-Token verschlüsselt mit Electrons `safeStorage` (unter Windows DPAPI) in einer **eigenen Datei**, nie in `data.json`
- Scopes: `calendar.calendarlist.readonly` (Kalenderliste lesen) und `calendar.events` (Termine in allen Kalendern
  lesen und schreiben). Den vollen `calendar`-Scope (Kalender löschen und freigeben) brauchen wir nicht.
- Hat man bei der Anmeldung ein Häkchen entfernt, erkennt die App das an der Token-Antwort und zeigt einen Hinweis.
- Umsetzung: `src/main/google/oauth.ts` (PKCE, Loopback-Server, Token-Endpunkt) und `src/main/google/account.ts`
  (verschlüsselte Datei `google-auth.bin` im userData-Ordner, Token-Erneuerung, API-Aufrufe mit deutschen Fehlermeldungen)
- ⚠️ Steht das Cloud-Projekt im Status **„Testing“**, laufen Refresh-Tokens nach **7 Tagen** ab.
  Für dauerhaften Betrieb stellt man es auf „In Produktion“. Eine Verifizierung braucht es dafür nicht;
  Google zeigt dann bei der Anmeldung nur einen Hinweis „nicht verifizierte App“.
- Netzwerkzugriffe per `fetch` direkt auf die REST-API, ohne das große `googleapis`-Paket

## Abgleich

| Schritt | Umsetzung |
|---|---|
| Erstabgleich | `events.list` pro Kalender mit `singleEvents=false` (Serien als Master), Ergebnis inkl. `nextSyncToken` speichern |
| Folgeabgleich | `events.list?syncToken=…` liefert nur Änderungen; bei `410 Gone` erfolgt ein kompletter Neuabgleich |
| Hochladen | Outbox abarbeiten: `insert` / `patch` / `delete`, bei Änderungen mit `If-Match: <etag>` |
| Konflikt (`412`) | Google-Stand holen, `updated` mit lokalem `updatedAt` vergleichen, die neuere Version gewinnt, Toast „Termin wurde auch in Google geändert“ |
| Zeitpunkte | beim Start, alle 5 Minuten, wenn das Fenster in den Vordergrund kommt, wenige Sekunden nach einer lokalen Änderung, Knopf „Jetzt synchronisieren“ |
| Offline | Die Outbox bleibt erhalten; neuer Versuch mit Backoff, Statusanzeige „offline – n Änderungen ausstehend“ |

Push-Benachrichtigungen (Webhooks) von Google funktionieren für eine Desktop-App ohne Server nicht, daher wird abgefragt.

**Umsetzung des Abrufs** (`src/main/google/sync.ts`, `mapping.ts`):
- Sync-Tokens pro Kalender liegen in `google-sync.json` im userData-Ordner, nicht in `data.json`.
- Abgerufene Änderungen gehen als Patch über `DataStore.applyRemote` an die Oberfläche (siehe Etappe 1).
- Lokale Termin-ID `g:<Kalender-ID>:<Event-ID>`, deshalb ersetzen wiederholte Abrufe Termine, statt sie zu verdoppeln.
- Wird ein Kalender ausgeschaltet, vergisst die App sein Token. Beim Wiedereinschalten folgt ein vollständiger Abruf.
- Fehler bleiben je Kalender getrennt; vorhandene Daten bleiben erhalten, der nächste Lauf versucht es erneut.
- Schreibgeschützt sind nur Kalender, in denen du bei Google nur Leserechte hast. Mit „Kopieren“ landet ein Termin
  daraus als eigener Termin in einem beschreibbaren Kalender.

**Umsetzung des Hochladens** (`outbox.ts`, `write.ts`, `sync.ts`):
- Jede Speicherung der Oberfläche liefert einen Diff. Änderungen an Terminen in beschreibbaren Google-Kalendern landen in der
  **Outbox** (in `google-sync.json`). Mehrere Änderungen am selben Termin werden zu einem Eintrag zusammengefasst.
  Der Eintrag merkt sich die zuletzt mit Google abgeglichene Version (`base`).
- Ablauf jedes Syncs: **erst hochladen, dann abrufen.** Termine mit ausstehenden Änderungen überschreibt der Abruf nicht.
- Hochgeladen wird 2,5 Sekunden nach der letzten Änderung. Tippen in einem Titel ergibt so nur einen Upload.
- Neu angelegte Termine bekommen eine selbst gewählte Google-ID (SHA-1 der lokalen ID). Ein wiederholter Versuch nach
  verlorener Antwort legt deshalb keinen zweiten Termin an.
- Änderungen gehen als `PATCH` mit nur den geänderten Feldern raus. Felder, die Ember Planner nicht kennt (Teilnehmer, Videokonferenz,
  Farbe, HTML-Beschreibung), bleiben bei Google unverändert, solange man das jeweilige Feld nicht selbst ändert.
- Verschieben zwischen Google-Kalendern nutzt `events.move`. Vom Google- in einen lokalen Kalender bedeutet: bei Google löschen.
- Einzelne Termine einer Serie löschen schreibt ein `EXDATE` in die Serie. Einzeln geänderte Termine bekommen kein EXDATE,
  sonst würde Google die Änderung verwerfen.
- Einen Termin der Serie in der App einzeln ändern („nur dieser“, auch per Ziehen) legt lokal einen Termin mit `seriesId` +
  `originalStart` an; hochgeladen wird er als `PATCH` auf die Instanz der Serie (`<serien-id>_<ursprünglicher Beginn in UTC>`,
  ganztägig `<serien-id>_<JJJJMMTT>`) mit `status: confirmed` – so holt auch ein Wiederherstellen eine abgesagte Instanz zurück.
- „Diesen und folgende“ kürzt die Serie (`UNTIL` bzw. `COUNT`) und legt ab dem Termin eine neue Serie an. Einzeln geänderte
  Termine danach werden dabei zu eigenen Terminen, weil Google sie mit dem gekürzten Teil der Serie verwirft.
- Termine aus dem Papierkorb bekommen beim Wiederherstellen neue IDs und werden bei Google neu angelegt.
- **Kalender ausschalten oder lokal löschen löscht nie etwas bei Google.**
- Offline, abgelaufene Anmeldung oder Serverfehler: Die Outbox bleibt erhalten, der nächste Lauf versucht es erneut.
  Lehnt Google eine Änderung dreimal ab (oder sofort mit 403), wird sie verworfen und die App zeigt einen Hinweis.

## Abbildung der Daten

| Google | Ember Planner |
|---|---|
| `summary`, `location`, `description` | `title`, `location`, `notes` |
| `start.dateTime` / `start.date` (Ende exklusiv) | `start`/`end`, `allDay` – passt zum bestehenden Modell |
| `reminders.overrides` (popup) / `useDefault` | `reminders` (Minuten); `useDefault` wird beim Abruf in die Standard-Erinnerungen des Kalenders aufgelöst |
| `recurrence` (RRULE, EXDATE) | `recurrence`; **neu:** Roh-RRULE wird gespeichert, wenn unser Modell sie nicht abbilden kann |
| Geänderter Einzeltermin (`recurringEventId` + `originalStartTime`) | **neu:** eigener Termin mit `seriesId` + `originalStart`; der Master bekommt dazu ein `exdate` |
| `etag`, `id`, Kalender-ID | `external` (gibt es schon) |
| Teilnehmer, Videokonferenz, Farbe usw. | werden nicht angefasst, weil wir nur geänderte Felder per `patch` senden |
| Kalender mit `accessRole` reader / freeBusyReader | als **schreibgeschützt** markiert, im UI nicht verschiebbar |
| Kalenderfarbe | auf die nächste Farbe der eigenen Palette gemappt (Farbschwäche-Prüfung bleibt erhalten) |

**Ausnahmen in Serien:** Verschobene und abgesagte Einzeltermine tragen ihren ursprünglichen Beginn als `exdate` in die Serie ein.
Verschobene gibt es zusätzlich als eigenen Termin mit `seriesId` und `originalStart`. Beim Folgeabgleich bleiben die
`exdates` erhalten, auch wenn sich die Serie selbst ändert. Beim vollständigen Abruf werden sie neu aufgebaut.

**Zeitzonen:** Einzeltermine werden als absoluter Zeitpunkt gespeichert und sind damit immer korrekt. Serien werden in
der Zeitzone des PCs expandiert. Liegt eine Serie in einer anderen Zeitzone, kann sie rund um die Zeitumstellung eine Stunde abweichen.
`RDATE` (zusätzliche Einzeldaten einer Serie) wird noch nicht unterstützt.

**Wiederholungen, die unser Modell nicht kann** (z. B. „jeden 2. Dienstag“): Für die Anzeige expandieren wir die
Roh-RRULE mit der Bibliothek `rrule`. Im Editor zeigt die Wiederholung dann „Benutzerdefiniert (aus Google)“ und bleibt
unverändert, solange man sie nicht bewusst ersetzt.

## Oberfläche

- **Optionen → Google-Konto:** Einrichtungsanleitung, Client-ID eintragen, „Mit Google verbinden“, Konto trennen
- **Kalenderliste:** Google-Kalender erscheinen in der linken Leiste mit eigenem Abschnitt; pro Kalender Sync an/aus.
  Lokale Kalender-ID ist `g:<Google-ID>`, damit ein Kalender beim erneuten Einschalten seine Einstellungen behält.
  Name, Farbe und Sichtbarkeit lassen sich lokal ändern und werden nicht von Google überschrieben.
- **Trennen** widerruft das Token bei Google und entfernt die Google-Kalender samt Terminen aus der App
- **Status:** ↻-Symbol neben dem Abschnitt *Google* in der linken Leiste (dreht sich beim Abgleich, wird bei Problemen rot,
  Tooltip mit „zuletzt vor 2 Min.“ und ausstehenden Änderungen) sowie eine Zeile in den Optionen. Auf ein zusätzliches
  Symbol in der Titelleiste wurde bewusst verzichtet.
- Schreibgeschützte Termine zeigen ein Schloss-Symbol

## Umsetzung in Etappen

Jede Etappe ist für sich lauffähig und wird ein eigener Commit. Am Ende entsteht ein PR gegen `master`.

| # | Etappe | Ergebnis |
|---|---|---|
| 0 ✅ | **Tests einrichten** (Vitest) | Tests für Wiederholungslogik und das spätere Mapping |
| 1 ✅ | **Fundament:** Main als Schiedsrichter, nummerierte Patches, `data:remote`, Undo-Historie wird angepasst | App verhält sich wie vorher, ist aber bereit für Fremdänderungen |
| 2 ✅ | **Anmeldung:** OAuth, TokenStore, Optionen-Seite, Kalenderliste abrufen | Konto verbinden, Google-Kalender auswählen |
| 3 ✅ | **Abruf (nur lesen):** Erst- und Folgeabgleich, Mapping, Serien + Ausnahmen, `rrule` | Google-Termine erscheinen und aktualisieren sich |
| 4 ✅ | **Hochladen:** Outbox, etag, Konflikte, Offline | Echte 2-Wege-Synchronisation |
| 5 ✅ | **Feinschliff:** Statusanzeige, Fehlertexte, Doku (FEATURES/ROADMAP) | bereit zum Mergen |

## Berührungspunkte mit dem parallelen Chat (Ideen-Sammlung)

- **„Einzelne Termine einer Serie bearbeiten“** braucht genau das neue Ausnahmen-Modell (`seriesId`/`originalStart`).
  Das bauen wir hier in Etappe 3; der andere Chat sollte dieses Feature erst danach angehen.
- **Undo-Umbau** (Etappe 1) betrifft `store.ts`: Größere Änderungen an `mutate`/`undo` im anderen Chat vermeiden.
- **Export/Backups** sollten Token-Datei und Outbox auslassen.

## Entscheidungen (2026-11-23)

1. **Eigenes Google-Cloud-Projekt** pro Nutzer mit Einrichtungsanleitung in der App. Es wird keine Client-ID mitgeliefert.
2. **Lokale Kalender bleiben lokal.** Google-Kalender kommen zusätzlich dazu; „Kalender zu Google hochladen“ kommt vielleicht später.
3. **Zeitblöcke aus ToDos werden mitsynchronisiert**, wenn der ToDo-Kalender ein Google-Kalender ist. Die Verknüpfung
   zum ToDo steht in `extendedProperties.private.emberTodoId`.
