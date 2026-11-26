import { expandAll } from './recurrence'
import type { CalendarEvent, OutfitTag } from './types'

/**
 * What the character is doing because of the calendar: a running event (and a while after it)
 * is matched to an activity by keywords in its title. German and English for now; adding a
 * language means adding words here. Everything stays local.
 */

/** checked in this order: the first group with a hit wins (so "D&D-Prep" is creative, "D&D-Session" is dnd) */
export const ACTIVITY_WORDS: [OutfitTag, string[]][] = [
  ['creative', ['prep', 'malen', 'zeichnen', 'draw', 'paint', 'schreiben', 'writing', 'kreativ', 'creative', 'musik', 'music', 'gitarre', 'guitar', 'basteln', 'craft', 'design', 'foto', 'photo']],
  ['fitness', ['gym', 'fitness', 'sport', 'training', 'workout', 'laufen', 'joggen', 'jogging', 'running', 'schwimmen', 'swim', 'rad', 'bike', 'krafttraining', 'pilates', 'klettern', 'bouldern', 'boxen', 'fußball', 'football', 'tennis']],
  ['relax', ['yoga', 'meditation', 'meditieren', 'entspann', 'relax', 'spa', 'sauna', 'massage', 'pause', 'break', 'urlaub', 'vacation']],
  ['dnd', ['d&d', 'dnd', 'dungeons', 'session', 'spieleabend', 'game night', 'pen & paper', 'pen and paper', 'pnp', 'rollenspiel', 'rpg', 'brettspiel', 'board game', 'zocken', 'gaming']],
  ['study', ['lern', 'study', 'uni', 'vorlesung', 'lecture', 'seminar', 'prüfung', 'klausur', 'exam', 'hausaufgabe', 'homework', 'kurs', 'course', 'schule', 'school', 'lesen', 'read']],
  ['work', ['arbeit', 'work', 'meeting', 'büro', 'office', 'call', 'standup', 'besprechung', 'job', 'schicht', 'shift', 'projekt', 'project']],
  ['party', ['party', 'feier', 'geburtstag', 'birthday', 'konzert', 'concert', 'festival', 'tanzen', 'dance', 'club']]
]

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** words must start at a word boundary; short ones (≤ 3 letters) must also end at one, so "uni" does not hit "Unity" */
const PATTERNS: [OutfitTag, RegExp][] = ACTIVITY_WORDS.map(([tag, words]) => [
  tag,
  new RegExp(words.map((w) => `(?:^|[^\\p{L}\\d])${esc(w)}${w.length <= 3 ? '(?![\\p{L}])' : ''}`).join('|'), 'iu')
])

export function activityOf(title: string): OutfitTag | null {
  return PATTERNS.find(([, re]) => re.test(title))?.[0] ?? null
}

export interface CurrentActivity {
  tag: OutfitTag
  title: string
  start: Date
  end: Date
  /** running now, or over but still within the after-time */
  phase: 'during' | 'after'
}

/** minutes an activity keeps going after its event ended */
export const AFTER_MINUTES = 60

/** the activity right now: a running event wins (the one that began last), then the one that ended last */
export function activityAt(events: CalendarEvent[], now: Date, afterMin = AFTER_MINUTES): CurrentActivity | null {
  const from = new Date(now.getTime() - afterMin * 60_000 - 24 * 3600_000)
  const to = new Date(now.getTime() + 60_000)
  let during: CurrentActivity | null = null
  let after: CurrentActivity | null = null
  for (const o of expandAll(events, from, to)) {
    if (o.event.allDay || o.event.deletedAt) continue
    const tag = activityOf(o.event.title)
    if (!tag) continue
    const a = { tag, title: o.event.title, start: o.start, end: o.end }
    const t = now.getTime()
    if (o.start.getTime() <= t && t < o.end.getTime()) {
      if (!during || o.start > during.start) during = { ...a, phase: 'during' }
    } else if (o.end.getTime() <= t && t < o.end.getTime() + afterMin * 60_000) {
      if (!after || o.end > after.end) after = { ...a, phase: 'after' }
    }
  }
  return during ?? after
}

/** small animations that need no furniture, per activity; "after" is calmer */
export const COMPANION_ACTIONS: Record<OutfitTag, { during: string[]; after: string[]; verb: string }> = {
  fitness: { during: ['lift', 'yoga', 'stretch'], after: ['stretch', 'meditate'], verb: 'trainiert' },
  work: { during: ['laptop', 'write'], after: ['stretch', 'hum'], verb: 'arbeitet' },
  study: { during: ['read', 'write'], after: ['read', 'hum'], verb: 'lernt' },
  creative: { during: ['paint', 'write'], after: ['hum'], verb: 'ist kreativ' },
  dnd: { during: ['dice', 'gm'], after: ['hop', 'dance'], verb: 'ist am Spieltisch' },
  relax: { during: ['meditate', 'yoga'], after: ['hum', 'meditate'], verb: 'entspannt' },
  party: { during: ['dance', 'hop'], after: ['hum'], verb: 'feiert' }
}
