import { describe, expect, it } from 'vitest'
import { nameFromTarget, targetKind } from './launcher'

describe('targetKind', () => {
  it('tells files, links and unsafe targets apart', () => {
    expect(targetKind('C:\\Program Files\\Obsidian\\Obsidian.exe')).toBe('file')
    expect(targetKind('\\\\nas\\share')).toBe('file')
    expect(targetKind('steam://rungameid/570')).toBe('link')
    expect(targetKind('https://www.dndbeyond.com')).toBe('link')
    expect(targetKind('obsidian://open?vault=Kampagne')).toBe('link')
    expect(targetKind('javascript:alert(1)')).toBe('invalid')
    expect(targetKind('data:text/html,hi')).toBe('invalid')
    expect(targetKind('Obsidian')).toBe('invalid')
    expect(targetKind('')).toBe('invalid')
  })
})

describe('nameFromTarget', () => {
  it('makes a readable name', () => {
    expect(nameFromTarget('C:\\Users\\x\\Desktop\\Foundry Virtual Tabletop.lnk')).toBe('Foundry Virtual Tabletop')
    expect(nameFromTarget('D:\\Obisidan-Books\\Kampagne')).toBe('Kampagne')
    expect(nameFromTarget('https://www.dndbeyond.com/campaigns/1')).toBe('dndbeyond.com')
    expect(nameFromTarget('steam://rungameid/570')).toBe('Steam-Spiel')
  })
})
