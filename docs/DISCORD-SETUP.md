# Discord-Bot einrichten

Ember Planner liest und erstellt Server-Events über einen **eigenen Discord-Bot**. Ein normaler Discord-Login reicht dafür
nicht: Discord gibt Apps über den Login keinen Zugriff auf Server-Events, und den eigenen Account-Token zu verwenden
verstößt gegen die Nutzungsbedingungen (Discord sperrt dafür Accounts).

Der Bot ist nur ein Zugangsschlüssel. Er läuft auf keinem Server und muss nicht dauerhaft online sein: Ember Planner fragt
die Events mit ihm ab, solange die App läuft. Er liest keine Nachrichten. Die Einrichtung dauert etwa 5 Minuten und ist kostenlos.

> **Wichtig:** Auf einen Server einladen kann den Bot nur, wer dort das Recht **„Server verwalten“** hat. Für deine eigenen
> Server ist das kein Problem. Bei fremden Servern muss das jemand aus dem Admin-Team mit deinem Einladungslink machen.

## 1. Anwendung anlegen

1. Öffne das [Discord Developer Portal](https://discord.com/developers/applications) und melde dich mit deinem Discord-Konto an.
2. Klicke oben rechts auf **New Application**, gib als Namen z. B. `Ember Planner` ein, bestätige die Bedingungen und klicke auf **Create**.

## 2. Bot vorbereiten

1. Öffne links **Bot**.
2. Schalte **Public Bot** aus. Dann kann niemand außer dir den Bot einladen. Meldet Discord dabei einen Fehler zum
   Installationslink, stelle zuerst unter **Installation** den **Install Link** auf **None** und versuche es noch einmal.
3. Lässt du **Public Bot** an, kann auch das Admin-Team eines fremden Servers den Bot mit deinem Link einladen. Andere
   finden den Bot dadurch nicht, sie bräuchten trotzdem den Link.
4. Unter **Privileged Gateway Intents** bleibt alles **aus**. Ember Planner braucht weder Nachrichten noch die Mitgliederliste.
5. Optional: Profilbild für den Bot hochladen, damit man ihn auf dem Server erkennt.

## 3. Token kopieren

1. Klicke unter **Bot** auf **Reset Token** und bestätige.
2. Kopiere den angezeigten Token. Discord zeigt ihn **nur einmal** an.

> Der Token ist ein Passwort für den Bot. Gib ihn niemandem weiter und füge ihn nirgends außer in Ember Planner ein.
> Ist er doch einmal irgendwo gelandet: einfach wieder **Reset Token** klicken, dann ist der alte ungültig.

## 4. In Ember Planner verbinden

1. Öffne **Optionen → Discord**.
2. Füge den **Token** ein und klicke auf **Verbinden**. Ember Planner prüft ihn bei Discord und speichert ihn verschlüsselt
   auf deinem PC (nicht in `data.json` und nicht in Sicherungen).
3. Klicke auf **Bot zu einem Server einladen**. Es öffnet sich Discord im Browser mit den passenden Rechten:
   - **Kanäle ansehen** und **Verbinden** – um Events in Sprachkanälen anzulegen
   - **Events erstellen** – um Events anzulegen und die eigenen zu ändern oder abzusagen
4. Wähle den Server aus und klicke auf **Autorisieren**. Für jeden weiteren Server wiederholen, oder den Link an das
   Admin-Team des Servers schicken.
5. Die Server erscheinen in Ember Planner. Hake an, welche als Kalender angezeigt werden sollen.

Den Einladungslink kannst du auch selbst zusammensetzen (`<ID>` durch die **Application ID** von der Seite
*General Information* im Developer Portal ersetzen):

```
https://discord.com/oauth2/authorize?client_id=<ID>&scope=bot&permissions=17592187094016
```

Mehr Rechte braucht der Bot nicht: Events anderer Mitglieder zeigt Ember Planner nur an, es ändert sie nicht.

## Trennen

- In Ember Planner: **Optionen → Discord → Trennen** löscht den gespeicherten Token. Bei Discord wird dabei nichts gelöscht.
- Bot von einem Server entfernen: auf dem Server Rechtsklick auf den Bot → **Kicken**.
- Ganz löschen: im Developer Portal unter **General Information → Delete App**.
