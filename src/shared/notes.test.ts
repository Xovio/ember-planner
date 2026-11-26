import { describe, expect, it } from 'vitest'
import {
  absolutePath,
  addLink,
  inheritedLinks,
  isInside,
  mergeVaults,
  noteTypes,
  obsidianUri,
  parseFrontmatter,
  parseObsidianRegistry,
  preselectVaults,
  removeLink,
  resolveLink,
  searchNotes,
  titleOf,
  vaultNameOf,
  type NoteEntry
} from './notes'

const note = (path: string, extra: Partial<NoteEntry> = {}): NoteEntry => ({
  vault: 'Two Realities',
  path,
  title: titleOf(path),
  folder: path.split('/').slice(0, -1).join('/'),
  tags: [],
  aliases: [],
  mtime: 0,
  ...extra
})

describe('paths', () => {
  it('names vaults and notes like Obsidian', () => {
    expect(vaultNameOf('D:\\Obisidan-Books\\Two Realities\\')).toBe('Two Realities')
    expect(titleOf('NPCs/Mira die Schmiedin.md')).toBe('Mira die Schmiedin')
  })

  it('builds absolute paths and keeps them inside the vault', () => {
    const vaults = [{ name: 'SW5E', path: 'D:\\Obisidan-Books\\SW5E' }]
    const abs = absolutePath({ vault: 'SW5E', path: 'Clone Wars One Shot/Start.md' }, vaults)
    expect(abs).toBe('D:\\Obisidan-Books\\SW5E\\Clone Wars One Shot\\Start.md')
    expect(absolutePath({ vault: 'Andere', path: 'x.md' }, vaults)).toBeNull()
    expect(isInside(abs!, 'd:\\obisidan-books\\sw5e')).toBe(true)
    expect(isInside('D:\\Obisidan-Books\\SW5E\\..\\Projekte\\x.md', 'D:\\Obisidan-Books\\SW5E')).toBe(false)
    expect(isInside('D:\\Obisidan-Books\\SW5E-alt\\x.md', 'D:\\Obisidan-Books\\SW5E')).toBe(false)
    expect(obsidianUri('D:\\A B\\c.md')).toBe('obsidian://open?path=D%3A%5CA%20B%5Cc.md')
  })
})

describe('vault setup', () => {
  const registry = JSON.stringify({
    vaults: {
      a: { path: 'D:\\Obisidan-Books\\Two Realities', ts: 1 },
      b: { path: 'D:\\Obisidan-Books\\SW5E', ts: 2 },
      c: { path: 'D:\\FoundryClaude\\design\\army-module', ts: 3 },
      d: { ts: 4 }
    }
  })

  it('reads obsidian.json', () => {
    expect(parseObsidianRegistry(registry).map((v) => v.name)).toEqual(['army-module', 'SW5E', 'Two Realities'])
    expect(parseObsidianRegistry('kaputt')).toEqual([])
  })

  it('switches on the vaults of the most common folder only', () => {
    const pre = preselectVaults(parseObsidianRegistry(registry))
    expect(pre.filter((v) => v.enabled).map((v) => v.name)).toEqual(['SW5E', 'Two Realities'])
    expect(preselectVaults([{ name: 'X', path: 'C:\\X' }])[0].enabled).toBe(true)
  })

  it('adds newly found vaults switched off', () => {
    const merged = mergeVaults([{ name: 'SW5E', path: 'D:\\Obisidan-Books\\SW5E', enabled: true }], parseObsidianRegistry(registry))
    expect(merged.map((v) => [v.name, v.enabled])).toEqual([
      ['SW5E', true],
      ['army-module', false],
      ['Two Realities', false]
    ])
  })
})

describe('parseFrontmatter', () => {
  it('reads type, block lists and inline lists', () => {
    const fm = parseFrontmatter('---\nType: Biome\ntags:\n  - biome\n  - "#wald"\naliases: [Weinender Wald, Tränenwald]\n---\n# Text')
    expect(fm).toEqual({ type: 'Biome', tags: ['biome', 'wald'], aliases: ['Weinender Wald', 'Tränenwald'] })
  })

  it('handles CRLF, a single alias and missing frontmatter', () => {
    expect(parseFrontmatter('---\r\ntype: NPC\r\nalias: Mira\r\ntags: npc, schmied\r\n---\r\n')).toEqual({
      type: 'NPC',
      tags: ['npc', 'schmied'],
      aliases: ['Mira']
    })
    expect(parseFrontmatter('# Nur Text\n---\ntype: x\n---')).toEqual({ tags: [], aliases: [] })
  })
})

describe('searchNotes', () => {
  const notes = [
    note('Two Realities/NPCs/Mira die Schmiedin.md', { type: 'NPC', aliases: ['Eisenmira'], mtime: 3 }),
    note('Two Realities/Städte/Miramar.md', { type: 'Stadt', mtime: 1 }),
    note('Two Realities/Biome/Der Weinende Wald.md', { type: 'Biome', mtime: 2 }),
    note('Two Realities/NPCs/Ödön.md', { type: 'NPC', mtime: 0 })
  ]

  it('ranks title starts above other hits and needs every word', () => {
    expect(searchNotes(notes, 'mira').map((n) => n.title)).toEqual(['Miramar', 'Mira die Schmiedin'])
    expect(searchNotes(notes, 'mira schmied').map((n) => n.title)).toEqual(['Mira die Schmiedin'])
    expect(searchNotes(notes, 'wald').map((n) => n.title)).toEqual(['Der Weinende Wald'])
  })

  it('finds aliases, folders and ignores accents', () => {
    expect(searchNotes(notes, 'eisen').map((n) => n.title)).toEqual(['Mira die Schmiedin'])
    expect(searchNotes(notes, 'odon').map((n) => n.title)).toEqual(['Ödön'])
    expect(searchNotes(notes, 'stadte').map((n) => n.title)).toEqual(['Miramar'])
  })

  it('filters by type and shows newest first without a query', () => {
    expect(searchNotes(notes, '', { type: 'NPC' }).map((n) => n.title)).toEqual(['Mira die Schmiedin', 'Ödön'])
    expect(noteTypes(notes)).toEqual([
      { type: 'NPC', count: 2 },
      { type: 'Biome', count: 1 },
      { type: 'Stadt', count: 1 }
    ])
  })
})

describe('links', () => {
  const mira = { vault: 'Two Realities', path: 'Two Realities/NPCs/Mira.md', title: 'Mira' }

  it('adds without duplicates and removes', () => {
    const one = addLink(undefined, mira)
    expect(addLink(one, { ...mira, path: mira.path.toUpperCase() })).toBe(one)
    expect(removeLink(one, mira)).toEqual([])
  })

  it('finds a moved note by its unique file name', () => {
    const moved = note('Two Realities/NPCs/Schmiede/Mira.md')
    expect(resolveLink(mira, [moved])).toBe(moved)
    expect(resolveLink(mira, [moved, note('Two Realities/Alt/Mira.md')])).toBeNull()
    expect(resolveLink(mira, [{ ...moved, vault: 'SW5E' }])).toBeNull()
  })

  it('inherits project links that are not linked directly', () => {
    const city = { vault: 'Two Realities', path: 'Städte/Miramar.md', title: 'Miramar' }
    expect(inheritedLinks([mira], [mira, city], [city])).toEqual([city])
  })
})
