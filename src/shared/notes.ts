/**
 * Obsidian notes linked to events, ToDos, projects and event templates.
 * The app only reads vaults – it never writes into them. Concept: docs/OBSIDIAN.md
 */

/** link to a note in an Obsidian vault */
export interface NoteLink {
  /** vault name as Obsidian shows it (the folder name), e.g. "Two Realities" */
  vault: string
  /** vault-relative, forward slashes, with `.md`, e.g. "Two Realities/NPCs/Mira.md" */
  path: string
  /** file name without `.md`; kept for display and to find a moved note again */
  title: string
}

/** a vault the user chose in the options */
export interface ObsidianVault {
  name: string
  /** absolute folder path */
  path: string
  enabled: boolean
}

/** one note in the index the main process builds */
export interface NoteEntry {
  vault: string
  path: string
  title: string
  /** vault-relative folder, '' for the vault root */
  folder: string
  /** frontmatter `Type` / `type` */
  type?: string
  tags: string[]
  aliases: string[]
  mtime: number
}

export interface VaultRef {
  name: string
  path: string
}

export interface ObsidianApi {
  /** vaults Obsidian itself knows (from its obsidian.json) */
  discover(): Promise<VaultRef[]>
  /** (re)builds the index for these vaults and watches them; resolves with all notes */
  index(vaults: VaultRef[]): Promise<NoteEntry[]>
  /** the index changed because files in a watched vault changed */
  onChanged(cb: (entries: NoteEntry[]) => void): () => void
  /** opens the note in Obsidian; false when the file is outside the indexed vaults */
  open(absPath: string): Promise<boolean>
  /** folder dialog for a vault Obsidian does not know */
  pickFolder(): Promise<string | null>
}

/* ───────────── paths ───────────── */

const slash = (p: string): string => p.replace(/\\/g, '/')

/** last folder name of an absolute path, which is also how Obsidian names the vault */
export function vaultNameOf(path: string): string {
  const parts = slash(path).replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || path
}

export function titleOf(path: string): string {
  const file = slash(path).split('/').pop() ?? path
  return file.replace(/\.md$/i, '')
}

export function folderOf(path: string): string {
  const parts = slash(path).split('/')
  parts.pop()
  return parts.join('/')
}

/** absolute path of a linked note, or null when its vault is not set up */
export function absolutePath(link: Pick<NoteLink, 'vault' | 'path'>, vaults: VaultRef[]): string | null {
  const v = vaults.find((x) => x.name === link.vault)
  if (!v) return null
  const root = v.path.replace(/[\\/]+$/, '')
  const sep = root.includes('\\') ? '\\' : '/'
  return root + sep + link.path.split('/').join(sep)
}

/** true when `abs` lies inside `root` (both absolute; case-insensitive like Windows) */
export function isInside(abs: string, root: string): boolean {
  const a = slash(abs).toLowerCase()
  const r = slash(root).replace(/\/+$/, '').toLowerCase() + '/'
  return a.startsWith(r) && !a.slice(r.length).split('/').includes('..')
}

export const obsidianUri = (absPath: string): string => `obsidian://open?path=${encodeURIComponent(absPath)}`

/* ───────────── obsidian.json ───────────── */

/** vaults from Obsidian's own registry (`%APPDATA%\obsidian\obsidian.json`) */
export function parseObsidianRegistry(text: string): VaultRef[] {
  try {
    const json = JSON.parse(text) as { vaults?: Record<string, { path?: string; ts?: number }> }
    return Object.values(json.vaults ?? {})
      .filter((v): v is { path: string; ts?: number } => typeof v?.path === 'string' && v.path.length > 0)
      .map((v) => ({ name: vaultNameOf(v.path), path: v.path }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  } catch {
    return []
  }
}

/**
 * First setup: the vaults in the most common parent folder are switched on (e.g. all under
 * `D:\Obsidian`), any odd one elsewhere stays off. With a single vault it is on.
 */
export function preselectVaults(found: VaultRef[]): ObsidianVault[] {
  const count = new Map<string, number>()
  for (const v of found) {
    const p = folderOf(slash(v.path).replace(/\/+$/, '')).toLowerCase()
    count.set(p, (count.get(p) ?? 0) + 1)
  }
  let best = ''
  let max = 0
  for (const [p, n] of count) if (n > max) [best, max] = [p, n]
  return found.map((v) => ({
    ...v,
    enabled: found.length === 1 || folderOf(slash(v.path).replace(/\/+$/, '')).toLowerCase() === best
  }))
}

/** stored vaults plus newly discovered ones (switched off) */
export function mergeVaults(stored: ObsidianVault[], found: VaultRef[]): ObsidianVault[] {
  const known = new Set(stored.map((v) => slash(v.path).toLowerCase()))
  return [...stored, ...found.filter((v) => !known.has(slash(v.path).toLowerCase())).map((v) => ({ ...v, enabled: false }))]
}

/* ───────────── frontmatter ───────────── */

const unquote = (s: string): string => s.trim().replace(/^(['"])(.*)\1$/, '$2').trim()

function listValue(raw: string): string[] {
  const v = raw.trim()
  if (!v) return []
  if (v.startsWith('[') && v.endsWith(']'))
    return v
      .slice(1, -1)
      .split(',')
      .map(unquote)
      .filter(Boolean)
  return v.split(/[,\s]+/).map(unquote).filter(Boolean)
}

/** reads `type`, `tags` and `aliases` from a note's YAML frontmatter (simple subset, no library) */
export function parseFrontmatter(text: string): { type?: string; tags: string[]; aliases: string[] } {
  const out: { type?: string; tags: string[]; aliases: string[] } = { tags: [], aliases: [] }
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!m) return out
  let current: 'tags' | 'aliases' | null = null
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s*(.*)$/.exec(line)
    if (item && current) {
      const v = unquote(item[1])
      if (v) out[current].push(v)
      continue
    }
    current = null
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!kv) continue
    const key = kv[1].toLowerCase()
    const value = kv[2]
    if (key === 'type' && unquote(value)) out.type = unquote(value)
    else if (key === 'tags' || key === 'tag') {
      current = 'tags'
      out.tags.push(...listValue(value))
    } else if (key === 'aliases' || key === 'alias') {
      current = 'aliases'
      out.aliases.push(...(value.trim().startsWith('[') ? listValue(value) : unquote(value) ? [unquote(value)] : []))
    }
  }
  out.tags = [...new Set(out.tags.map((t) => t.replace(/^#/, '')))]
  return out
}

/* ───────────── search ───────────── */

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** 0 = no match; higher is better. Every word must hit title, alias, folder, type or tag. */
export function scoreNote(e: NoteEntry, query: string): number {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return 1
  const title = norm(e.title)
  const aliases = e.aliases.map(norm)
  const rest = norm(`${e.folder} ${e.type ?? ''} ${e.tags.join(' ')} ${e.vault}`)
  let score = 0
  for (const w of words) {
    if (title === w) score += 100
    else if (title.startsWith(w)) score += 60
    else if (title.split(/[\s\-_.]+/).some((p) => p.startsWith(w))) score += 40
    else if (title.includes(w)) score += 25
    else if (aliases.some((a) => a.startsWith(w))) score += 30
    else if (aliases.some((a) => a.includes(w))) score += 15
    else if (rest.includes(w)) score += 5
    else return 0
  }
  return score
}

export function searchNotes(entries: NoteEntry[], query: string, opts: { type?: string; limit?: number } = {}): NoteEntry[] {
  const limit = opts.limit ?? 30
  const scored: [NoteEntry, number][] = []
  for (const e of entries) {
    if (opts.type && e.type !== opts.type) continue
    const s = scoreNote(e, query)
    if (s > 0) scored.push([e, s])
  }
  const q = query.trim()
  scored.sort(
    (a, b) =>
      b[1] - a[1] ||
      // without a query: newest first; with one: shorter titles first
      (q ? a[0].title.length - b[0].title.length : b[0].mtime - a[0].mtime) ||
      a[0].title.localeCompare(b[0].title, 'de')
  )
  return scored.slice(0, limit).map(([e]) => e)
}

/** note types with their counts, most common first – for the filter chips */
export function noteTypes(entries: NoteEntry[]): { type: string; count: number }[] {
  const m = new Map<string, number>()
  for (const e of entries) if (e.type) m.set(e.type, (m.get(e.type) ?? 0) + 1)
  return [...m].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type, 'de'))
}

/* ───────────── links ───────────── */

export const linkOf = (e: Pick<NoteEntry, 'vault' | 'path' | 'title'>): NoteLink => ({ vault: e.vault, path: e.path, title: e.title })

const sameLink = (a: Pick<NoteLink, 'vault' | 'path'>, b: Pick<NoteLink, 'vault' | 'path'>): boolean =>
  a.vault === b.vault && a.path.toLowerCase() === b.path.toLowerCase()

export function addLink(links: NoteLink[] | undefined, link: NoteLink): NoteLink[] {
  const list = links ?? []
  return list.some((l) => sameLink(l, link)) ? list : [...list, link]
}

export function removeLink(links: NoteLink[] | undefined, link: NoteLink): NoteLink[] {
  return (links ?? []).filter((l) => !sameLink(l, link))
}

/**
 * The note a link points to: the exact path, or – after a rename or move in Obsidian – the only
 * note in the same vault with that file name. `null` when it cannot be found (vault off, deleted).
 */
export function resolveLink(link: NoteLink, entries: NoteEntry[]): NoteEntry | null {
  const exact = entries.find((e) => sameLink(e, link))
  if (exact) return exact
  const title = link.title.toLowerCase()
  const byName = entries.filter((e) => e.vault === link.vault && e.title.toLowerCase() === title)
  return byName.length === 1 ? byName[0] : null
}

/** inherited links (e.g. from the project) that are not already linked directly */
export function inheritedLinks(own: NoteLink[] | undefined, ...from: (NoteLink[] | undefined)[]): NoteLink[] {
  let out: NoteLink[] = []
  for (const links of from) for (const l of links ?? []) if (!(own ?? []).some((o) => sameLink(o, l))) out = addLink(out, l)
  return out
}
