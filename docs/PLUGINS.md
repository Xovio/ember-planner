# Plugins und Widgets – Konzept

**Status:** Stufe 1 ist gebaut (24. November 2026). Stufe 2 und 3 sind Konzept.

## Ziel

Ember Planner soll sich erweitern lassen wie Obsidian, aber ohne Obsidians Schwäche: Plugins dürfen den Rechner nicht
übernehmen. Die linke Leiste ist der Andockpunkt. Sie ist heute schon eine Liste von Seiten (Planen, ToDos, Übersicht,
Ideen), und mit `DeadlineRadar`, `WeekLoad` und `YearHeatmap` gibt es bereits fertige Widgets auf der Übersicht.

Der Weg führt über drei Stufen. Jede ist für sich nützlich.

## Stufe 1 – Interne Widget-API

Die App nutzt die Schnittstelle zuerst selbst.

- Eine **Registrierung** für Seiten, Widgets und Befehle. `NavRail` liest seine Einträge daraus statt aus der festen
  Liste `ITEMS`. Die Übersicht (`TodayPage`) rendert ihre Widgets aus der Registrierung statt sie fest zu importieren.
- Jedes Widget meldet sich mit `id`, Titel, Standardgröße und Ort (Übersicht oder Seitenleiste) an.
- Damit wird das **Dashboard frei anordenbar**: Widgets ziehen, ein- und ausblenden, Größe wählen. Die Anordnung liegt in
  den Einstellungen. (Das steht schon in der Ideen-Sammlung unter „Oberfläche“.)
- Gewinn: Es zeigt sich früh, ob die Schnittstelle taugt, bevor fremder Code dazukommt.

**Umsetzung:**
- `src/renderer/src/plugins/registry.ts`: `registerPage` und `registerWidget` (geben eine Abmelde-Funktion zurück),
  `usePages`/`useWidgets` für die Oberfläche. Jeder Eintrag trägt eine `source` (`'core'` oder später die Plugin-ID).
- `src/renderer/src/plugins/core.tsx` meldet die fünf Seiten und acht Übersichts-Widgets der App an.
  Nav-Leiste, Seitenwechsel (`ActivePage`) und „Gehe zu: …“ in der Befehlspalette lesen nur noch daraus.
  Eine unbekannte Seiten-ID (etwa von einem entfernten Plugin) fällt auf „Planen“ zurück.
- Übersicht: „Anordnen“ schaltet den Bearbeiten-Modus ein. Widgets lassen sich ziehen, mit Pfeilen verschieben,
  zwischen halber und voller Breite umschalten und ausblenden. Ausgeblendete stehen in einer Leiste zum Zurückholen,
  „Standard“ setzt alles zurück.
- Gespeichert wird in `settings.overviewLayout` (`order`, `hidden`, `sizes`). Die Logik dafür steckt getestet in
  `plugins/layout.ts`. Einstellungen für Widgets, die gerade nicht angemeldet sind, bleiben erhalten, damit ein
  deaktiviertes Plugin seinen Platz behält.
- Noch nicht in Stufe 1: Widgets in der Seitenleiste, Befehle für die Palette und Schnelleingabe-Syntax über die
  Registrierung. Sie kommen, sobald es dafür einen ersten Nutzer gibt.

## Stufe 2 – Externe Plugins aus einem Ordner

Aufbau wie bei Obsidian: `<Benutzerdaten>/plugins/<id>/manifest.json` plus `main.js`.

```json
{
  "id": "pomodoro",
  "name": "Fokus-Timer",
  "version": "1.0.0",
  "apiVersion": 1,
  "author": "…",
  "permissions": ["read:todos", "write:todos"],
  "contributes": { "widgets": ["timer"], "commands": ["start-focus"] }
}
```

### Erweiterungspunkte

- eigener Eintrag in der Nav-Leiste mit eigener Seite
- Widget für die Seitenleiste oder die Übersicht
- Befehle in der Befehlspalette und eigene Syntax in der Schnelleingabe
- zusätzliche Kalender-Quellen, **nur lesend** (so wie heute die Feiertage)
- eigene Einstellungsseite und Einträge im Rechtsklick-Menü

### Sicherheit

Die App läuft mit `sandbox`, `contextIsolation` und ohne Node im Renderer (`src/main/index.ts`). Das bleibt so.

- **Abgeschottetes iframe** pro Plugin (`sandbox="allow-scripts"`, eigene Herkunft, kein Zugriff auf das DOM der App).
  Es spricht nur über `postMessage` mit der App. Die App prüft jede Nachricht gegen die Rechte des Plugins.
- **Rechte im Manifest**, z. B. `read:events`, `write:todos`, `net:api.example.com`. Man bestätigt sie beim Installieren,
  und neue Rechte bei einem Update erneut. Netzwerkzugriff nur auf die genannten Hosts, über einen Proxy im Main-Prozess.
- **Google- und Discord-Tokens** sind für Plugins nie erreichbar. Sie bleiben verschlüsselt im Main-Prozess.
- **`apiVersion`** im Manifest: Ein Plugin mit einer nicht mehr unterstützten Version wird deaktiviert und als solches
  angezeigt, statt stillschweigend kaputtzugehen.
- Schreibende Aktionen von Plugins laufen über die normale Undo-Logik und lassen sich rückgängig machen.

## Stufe 3 – Katalog

Eine kuratierte Liste auf GitHub (wie Obsidians `community-plugins.json`) mit Verweis auf das Repo jedes Plugins.
In der App durchsuchen, Rechte ansehen, installieren, aktualisieren.

## Mögliche erste Plugins

Als Plugins umgesetzt erproben sie gleich die API. Einige stehen schon in der Ideen-Sammlung der [ROADMAP](ROADMAP.md).

- Fokus-/Pomodoro-Timer
- Gewohnheiten-Tracker
- Wetter
- Countdown zur nächsten DnD-Session mit offenen Vorbereitungs-ToDos
- Notizzettel
- Obsidian-Tagesnotiz
- GitHub-Issues
- Mediensteuerung

## Offene Fragen

- Wie viel UI darf ein Widget-iframe selbst gestalten? Vorschlag: Die App reicht Theme-Variablen (Farben, Schrift) hinein,
  damit Plugins zu den Styles passen.
- Schnelleingabe-Syntax von mehreren Plugins: Wer gewinnt bei Überschneidungen?
- Sollen eingebaute Widgets später selbst als „Kern-Plugins“ abschaltbar sein (wie Obsidians Core Plugins)?
