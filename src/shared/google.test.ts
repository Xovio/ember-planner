import { describe, expect, it } from 'vitest'
import { calendarInfoFromGoogle, paletteColorForHex, type GoogleCalendarEntry } from './google'

describe('paletteColorForHex', () => {
  it('maps Google calendar colours to the nearest palette colour', () => {
    expect(paletteColorForHex('#d50000')).toBe('red') // Tomate
    expect(paletteColorForHex('#f4511e')).toBe('orange') // Mandarine
    expect(paletteColorForHex('#f6bf26')).toBe('yellow') // Banane
    expect(paletteColorForHex('#0b8043')).toBe('green') // Basilikum
    expect(paletteColorForHex('#039be5')).toBe('aqua') // Pfau (Cyan-Blau)
    expect(paletteColorForHex('#3f51b5')).toBe('blue') // Heidelbeere
    expect(paletteColorForHex('#8e24aa')).toBe('violet') // Weintraube
    expect(paletteColorForHex('#e67c73')).toBe('red') // Flamingo
    expect(paletteColorForHex('#9fe1e7')).toBe('aqua')
  })

  it('falls back to blue for greys and junk', () => {
    expect(paletteColorForHex('#616161')).toBe('blue')
    expect(paletteColorForHex('kein hex')).toBe('blue')
  })
})

describe('calendarInfoFromGoogle', () => {
  const entry: GoogleCalendarEntry = {
    id: 'abc@group.calendar.google.com',
    name: 'Familie',
    hex: '#0b8043',
    accessRole: 'reader',
    primary: false,
    defaultReminders: [10],
    enabled: true
  }

  it('creates a read-only calendar with a stable local id', () => {
    expect(calendarInfoFromGoogle(entry)).toEqual({
      id: 'g:abc@group.calendar.google.com',
      name: 'Familie',
      color: 'green',
      visible: true,
      readOnly: true,
      defaultReminders: [10],
      external: { provider: 'google', id: 'abc@group.calendar.google.com' }
    })
  })

  it('keeps local name, colour and visibility', () => {
    const existing = { ...calendarInfoFromGoogle(entry), name: 'Fam', color: 'red' as const, visible: false }
    const next = calendarInfoFromGoogle({ ...entry, name: 'Familie (neu)', accessRole: 'writer' }, existing)
    expect(next).toMatchObject({ name: 'Fam', color: 'red', visible: false, readOnly: false })
  })
})
