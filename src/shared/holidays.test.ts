import { describe, expect, it } from 'vitest'
import { easterSunday, holidayOn, holidaysOfYear } from './holidays'

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('holidays', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25']
  ])('Easter %i', (y, expected) => {
    expect(iso(easterSunday(y))).toBe(expected)
  })

  it('has the nine nationwide holidays', () => {
    const de = holidaysOfYear(2026, 'DE')
    expect(de.size).toBe(9)
    expect(de.get('2026-04-03')).toBe('Karfreitag')
    expect(de.get('2026-05-14')).toBe('Christi Himmelfahrt')
    expect(de.get('2026-05-25')).toBe('Pfingstmontag')
    expect(de.get('2026-10-03')).toBe('Tag der Deutschen Einheit')
  })

  it('adds state holidays', () => {
    expect(holidayOn('2026-06-04', 'DE-BY')).toBe('Fronleichnam')
    expect(holidayOn('2026-06-04', 'DE-BE')).toBeUndefined()
    expect(holidayOn('2026-11-01', 'DE-NW')).toBe('Allerheiligen')
    expect(holidayOn('2026-10-31', 'DE-NI')).toBe('Reformationstag')
    expect(holidayOn('2026-03-08', 'DE-BE')).toBe('Internationaler Frauentag')
    expect(holidayOn('2026-09-20', 'DE-TH')).toBe('Weltkindertag')
    expect(holidaysOfYear(2026, 'DE-BY').size).toBe(12)
  })

  it('computes Buß- und Bettag (Wednesday before 23 Nov)', () => {
    expect(holidayOn('2026-11-18', 'DE-SN')).toBe('Buß- und Bettag')
    expect(holidayOn('2025-11-19', 'DE-SN')).toBe('Buß- und Bettag')
    // 23 Nov 2022 was a Wednesday → one week earlier
    expect(holidayOn('2022-11-16', 'DE-SN')).toBe('Buß- und Bettag')
  })

  it('is off for an empty region', () => {
    expect(holidayOn('2026-12-25', '')).toBeUndefined()
  })
})
