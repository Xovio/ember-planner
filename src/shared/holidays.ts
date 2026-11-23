import type { LocalDate } from './types'

/** German states with their own public holidays ('DE' = nationwide only). */
export const HOLIDAY_REGIONS: { id: string; name: string }[] = [
  { id: 'DE', name: 'Nur bundesweite Feiertage' },
  { id: 'DE-BW', name: 'Baden-Württemberg' },
  { id: 'DE-BY', name: 'Bayern' },
  { id: 'DE-BE', name: 'Berlin' },
  { id: 'DE-BB', name: 'Brandenburg' },
  { id: 'DE-HB', name: 'Bremen' },
  { id: 'DE-HH', name: 'Hamburg' },
  { id: 'DE-HE', name: 'Hessen' },
  { id: 'DE-MV', name: 'Mecklenburg-Vorpommern' },
  { id: 'DE-NI', name: 'Niedersachsen' },
  { id: 'DE-NW', name: 'Nordrhein-Westfalen' },
  { id: 'DE-RP', name: 'Rheinland-Pfalz' },
  { id: 'DE-SL', name: 'Saarland' },
  { id: 'DE-SN', name: 'Sachsen' },
  { id: 'DE-ST', name: 'Sachsen-Anhalt' },
  { id: 'DE-SH', name: 'Schleswig-Holstein' },
  { id: 'DE-TH', name: 'Thüringen' }
]

/** Gregorian Easter Sunday (anonymous algorithm, Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const pad = (n: number): string => String(n).padStart(2, '0')
const iso = (d: Date): LocalDate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const plus = (d: Date, days: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)

/** Buß- und Bettag: the Wednesday before 23 November */
function repentanceDay(year: number): Date {
  const nov23 = new Date(year, 10, 23)
  const back = ((nov23.getDay() - 3 + 7) % 7) || 7
  return plus(nov23, -back)
}

/**
 * Public holidays of one year, keyed by local date.
 * Holidays that only apply in some municipalities (e.g. Mariä Himmelfahrt in parts of Bavaria) are left out.
 */
export function holidaysOfYear(year: number, region: string): Map<LocalDate, string> {
  const state = region.startsWith('DE-') ? region.slice(3) : ''
  const in_ = (...states: string[]): boolean => states.includes(state)
  const easter = easterSunday(year)
  const out = new Map<LocalDate, string>()
  const add = (d: Date, name: string, when = true): void => {
    if (when) out.set(iso(d), name)
  }

  add(new Date(year, 0, 1), 'Neujahr')
  add(new Date(year, 0, 6), 'Heilige Drei Könige', in_('BW', 'BY', 'ST'))
  add(new Date(year, 2, 8), 'Internationaler Frauentag', in_('BE') || (in_('MV') && year >= 2023))
  add(plus(easter, -2), 'Karfreitag')
  add(easter, 'Ostersonntag', in_('BB'))
  add(plus(easter, 1), 'Ostermontag')
  add(new Date(year, 4, 1), 'Tag der Arbeit')
  add(plus(easter, 39), 'Christi Himmelfahrt')
  add(plus(easter, 49), 'Pfingstsonntag', in_('BB'))
  add(plus(easter, 50), 'Pfingstmontag')
  add(plus(easter, 60), 'Fronleichnam', in_('BW', 'BY', 'HE', 'NW', 'RP', 'SL'))
  add(new Date(year, 7, 15), 'Mariä Himmelfahrt', in_('SL'))
  add(new Date(year, 8, 20), 'Weltkindertag', in_('TH') && year >= 2019)
  add(new Date(year, 9, 3), 'Tag der Deutschen Einheit')
  add(
    new Date(year, 9, 31),
    'Reformationstag',
    year === 2017 || in_('BB', 'MV', 'SN', 'ST', 'TH') || (in_('HB', 'HH', 'NI', 'SH') && year >= 2018)
  )
  add(new Date(year, 10, 1), 'Allerheiligen', in_('BW', 'BY', 'NW', 'RP', 'SL'))
  add(repentanceDay(year), 'Buß- und Bettag', in_('SN'))
  add(new Date(year, 11, 25), '1. Weihnachtstag')
  add(new Date(year, 11, 26), '2. Weihnachtstag')
  return out
}

const cache = new Map<string, Map<LocalDate, string>>()

/** Holiday name for a local date, or undefined. Region '' = off. */
export function holidayOn(date: LocalDate, region: string): string | undefined {
  if (!region) return undefined
  const year = Number(date.slice(0, 4))
  const key = `${region}:${year}`
  let map = cache.get(key)
  if (!map) {
    map = holidaysOfYear(year, region)
    cache.set(key, map)
  }
  return map.get(date)
}
