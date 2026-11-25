# Avatar – Konzept

Ein kleiner Charakter, der mit dir wächst: Was du im Alltag schaffst, macht ihn stärker, und mit verdienten Coins
richtest du ihn und sein Zimmer ein. Motivierend, nie strafend (siehe ADHS-Grundsätze in der [Roadmap](ROADMAP.md)).

## Grundsätze

- **Nichts geht verloren:** kein Verfall, keine Strafe für Pausen, keine Pflicht zum täglichen Einloggen
- **ToDos sind die Hauptquelle.** Passive Einnahmen (später der Autobattler) sind nur ein Zuschuss
- **Alles entsteht aus Code** (SVG-Baukasten in `components/character/Avatar.tsx`, Katalog in `shared/wardrobe.ts`):
  jedes Teil ist eine Form plus Farbe, Schatten, Licht und Kontur werden aus der Farbe abgeleitet. So bleiben viele Teile
  stimmig und Farbvarianten kosten nichts

## Stil (entschieden nach Recherche)

- **Vektor-Chibi** statt Pixel: breitere Wirkung, im Code stufenlos anpassbar (Körper, Farben), flüssige Animation,
  Möbel aus Code-Körpern drehbar. Begründung: [Kunststil für Avatar und Zimmer](research/Kunststil%20für%20Avatar%20und%20Zimmer.md),
  Regeln: [Vektor Chibi Look optimieren](research/Vektor%20Chibi%20Look%20optimieren.md)
- Etwa 2,5 Kopfhöhen, Bohnenkörper, Fäustlingshände; Augen mit farbiger Iris, zwei Glanzlichtern, Oberlid und Brauen
- Farben als Rampen (Grund, Schatten, Licht, Kontur) mit gemeinsamem Pflaume-Schatten und Creme-Licht, kein reines Schwarz/Weiß
- Planer-Oberfläche bleibt ruhig und flach; der Charme lebt auf der Charakter-Seite, im Widget und im späteren Zimmer
- Bewegung (Atmen, Blinzeln, Winken) nur ohne „Bewegung reduzieren“
- Eigenes Design – keine Figuren, Möbel oder Grafiken aus bestehenden Spielen

## Drei getrennte Fortschritte

| | Was | Woher | Wofür |
|---|---|---|---|
| **Attribute** | 6 Werte, **jedes mit eigener Erfahrung und eigenem Level** | erledigte ToDos ihrer Kategorie, Ziele, Sessions, Prep | schalten Items frei; später Kampfwerte |
| **Coins** | eigene Währung | ToDos nach **Schwierigkeit × gebrauchter Zeit**, Ziele, Sessions; später wenig passiv | Kleidung, Möbel, Zimmer-Erweiterungen, Kampf-Ausrüstung |
| **Punkte** (gibt es schon) | Gesamtlevel, Wochenverlauf | wie bisher | Überblick; Charakter-Level = Summe der Attribut-Level |

### Attribute

| Attribut | Wächst durch (Voreinstellung) | Später im Kampf |
|---|---|---|
| Fitness | Sport, Gym-Ziele | Angriff |
| Ausdauer | komplette Wochenziele, dranbleiben | Leben |
| Köpfchen | Lernen, Projekte | Magie |
| Kreativität | D&D-Prep, Ideen-Boards, Prep-Stunden | Zauber/Fähigkeiten |
| Ordnung | Haushalt, Papierkram | Verteidigung |
| Sozial | Sessions, Termine mit anderen | Gefährten/Unterstützung |

- Jede **ToDo-Kategorie** bekommt in den Optionen ein Attribut (für vorhandene Kategorien schlägt Ember eins vor);
  Wochenziele bekommen ebenfalls ein Attribut (Gym → Fitness)
- Erfahrung pro Attribut, Level wie beim Gesamtlevel langsam steigend

### Coins für ToDos

- **Schwierigkeit** als eigenes Feld am ToDo: leicht · mittel · schwer · episch (Priorität bleibt Dringlichkeit, nicht Schwierigkeit)
- **Gebrauchte Zeit**, in dieser Reihenfolge: gemessene Fokus-Zeit (Timer, später) → Dauer des abgehakten Zeitblocks
  im Kalender → Zeitschätzung → pauschal
- Formel (Entwurf, zum Feintunen): `Coins = Basis[Schwierigkeit] × (1 + Minuten / 30)`, gedeckelt pro ToDo,
  z. B. leicht 2, mittel 4, schwer 8, episch 15 als Basis
- Erfahrung fürs Attribut nach derselben Logik
- Wieder-Öffnen nimmt die Belohnung zurück; der Kontostand fällt dabei nie unter 0 (Gekauftes bleibt)

## Stufen

1. **Charakter** ✅ (v0.5) – Figur erstellen (Hautton, Frisur, Haarfarbe, Augen, Startkleidung), Seite „Charakter“ + Widget,
   Attribute mit eigenem Level, Coins, Schwierigkeit an ToDos, Kleiderschrank und Shop (Start ≈ 30 Teile, viele als
   Farbvarianten), Atmen, Blinzeln, Winken und fünf Gesichtsausdrücke
2. **Zimmer** ✅ – isometrischer Raum (6×6 Kacheln, siehe unten), Möbel kaufen, auf Kacheln stellen, drehen, einlagern;
   später Erweiterungen (zweites Zimmer, Garten, Tapeten, Böden)
3. **Abenteuer** – Autobattler/Idle: der Charakter zieht los, Attribute entscheiden über Erfolg, Beute sind Items und
   ein kleiner passiver Coin-Zuschuss. Details besprechen wir, wenn Stufe 2 steht

## Zimmer (Stufe 2)

Entschieden nach zwei Entwürfen (Isometrie gegen frontales Puppenhaus): **echte Isometrie**, weil Einrichten und Umräumen
der Kern ist und Möbel aus Code-Körpern alle vier Drehrichtungen gratis bekommen.

- **Technik:** `shared/room.ts` (Katalog, Platzregeln, Kiste, Zeichenreihenfolge, getestet) und
  `components/character/room/` (Iso-Projektion, Möbel als Quader plus organische Formen, Szene, Kiste und Shop).
  Ein Möbel = Teile in seinem eigenen Grundriss (Vorderseite +y) plus Deko über eine Punkt-Abbildung, die der Drehung folgt
- **Raum:** 6×6 Kacheln, x entlang der rechten Wand, y entlang der linken; Fenster fest auf der rechten Wand (Plätze 2–3).
  Diorama-Kante (Wandstärke, Bodenplatte), Sockelleiste, Dielen, Ecken-Verdunkelung, Lichtfleck vom Fenster, leichtes Korn
- **Regeln:** Möbel belegen ganze Kacheln und stapeln sich nicht; Teppiche liegen darunter (eigene Ebene);
  Wandsachen hängen an einer Wand, nicht auf dem Fenster. Tiefensortierung über die Grundrisse (topologisch)
- **Bedienung:** eigener Einrichten-Modus, damit im Alltag nichts versehentlich verrutscht; die Figur sucht sich
  einen freien Platz nahe der Mitte
- **Ab Werk:** Sitzsack, Teppich, Topfpflanze, Stehlampe (das Bett ist der erste große Kauf)
- **Preise:** Kleinkram 20–50, Möbel 60–120, Groß 150–300, Besonderes 120–250 (ab Attribut-Level 3–4);
  ein voll eingerichtetes Zimmer in etwa 2–3 Wochen normaler Nutzung
- **Nichts geht verloren:** Gekauftes lässt sich nicht verkaufen oder zerstören, Einlagern geht immer, jeder Schritt mit `Strg+Z`
- **Später:** Tapeten (80–150), Böden (100–200), Fensterformen, größeres Zimmer 8×8 (≈ 600), zweites Zimmer (≈ 800),
  Garten (≈ 1.200), Körbchen fürs Haustier, den ganzen Raum drehen, mehrere gleiche Teile, Zimmer-Widget,
  Figur in Ruhe-Pose (statt Winken) und kleines Herumlaufen

## Offen

- Rollstuhl und weitere Hilfsmittel als kostenlose Option (Hörgerät und Brille gibt es schon)
- Mehr Frisuren und Gesichtsausdrücke, Begleit-Haustier (nur positiv reagierend)
- Rive als Ausbaustufe für ausdrucksstärkere Animation (offizieller MCP-Server)
- Animation beim Aufstieg eines Attributs
- Startwerte und genaue Formeln (nach den ersten Wochen echter Nutzung nachjustieren)
- Wie gebrauchte Zeit gemessen wird (Fokus-Timer kommt mit der Fokus-Modus-Idee aus der Roadmap)
