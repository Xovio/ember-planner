import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'fs'
import { open, readdir, readFile, stat } from 'fs/promises'
import { join, relative } from 'path'
import {
  folderOf,
  isInside,
  obsidianUri,
  parseFrontmatter,
  parseObsidianRegistry,
  titleOf,
  type NoteEntry,
  type VaultRef
} from '@shared/notes'

/** frontmatter lives at the top; reading more of each note would only cost time */
const HEAD_BYTES = 4096
const SKIP_DIRS = new Set(['.obsidian', '.trash', '.git', 'node_modules'])
const DEBOUNCE_MS = 800

async function readHead(file: string): Promise<string> {
  const fh = await open(file, 'r')
  try {
    const buf = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0)
    return buf.subarray(0, bytesRead).toString('utf8')
  } finally {
    await fh.close()
  }
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** template folders (core Templates plugin and Templater) – their notes are blueprints, not content */
async function templateFolders(vaultPath: string): Promise<string[]> {
  const cfg = join(vaultPath, '.obsidian')
  const [core, templater] = await Promise.all([
    readJson(join(cfg, 'templates.json')),
    readJson(join(cfg, 'plugins', 'templater-obsidian', 'data.json'))
  ])
  return [core.folder, templater.templates_folder]
    .filter((f): f is string => typeof f === 'string')
    .map((f) => f.trim().replace(/^\/+|\/+$/g, '').toLowerCase())
    .filter(Boolean)
}

/** all Markdown notes of one vault – read only, nothing is ever written */
export async function indexVault(v: VaultRef): Promise<NoteEntry[]> {
  const out: NoteEntry[] = []
  const skip = await templateFolders(v.path)
  const walk = async (dir: string): Promise<void> => {
    let items
    try {
      items = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const it of items) {
      const abs = join(dir, it.name)
      if (it.isDirectory()) {
        if (!SKIP_DIRS.has(it.name) && !it.name.startsWith('.')) await walk(abs)
        continue
      }
      if (!it.isFile() || !it.name.toLowerCase().endsWith('.md')) continue
      const path = relative(v.path, abs).split('\\').join('/')
      const lower = path.toLowerCase()
      if (skip.some((f) => lower.startsWith(`${f}/`))) continue
      try {
        const [head, st] = await Promise.all([readHead(abs), stat(abs)])
        const fm = parseFrontmatter(head)
        out.push({
          vault: v.name,
          path,
          title: titleOf(path),
          folder: folderOf(path),
          ...(fm.type ? { type: fm.type } : {}),
          tags: fm.tags,
          aliases: fm.aliases,
          mtime: st.mtimeMs
        })
      } catch {
        /* unreadable file (e.g. being synced right now) – skipped until the next change */
      }
    }
  }
  await walk(v.path)
  return out
}

/** keeps an index of the chosen vaults and refreshes it when files change */
class VaultIndex {
  private vaults: VaultRef[] = []
  private entries = new Map<string, NoteEntry[]>()
  private watchers = new Map<string, FSWatcher>()
  private timers = new Map<string, NodeJS.Timeout>()

  constructor(private notify: (entries: NoteEntry[]) => void) {}

  all(): NoteEntry[] {
    return this.vaults.flatMap((v) => this.entries.get(v.path) ?? [])
  }

  async set(vaults: VaultRef[]): Promise<NoteEntry[]> {
    const valid: VaultRef[] = []
    for (const v of vaults) {
      try {
        if ((await stat(v.path)).isDirectory()) valid.push(v)
      } catch {
        /* folder gone or drive not connected */
      }
    }
    const keep = new Set(valid.map((v) => v.path))
    for (const [path, w] of this.watchers) {
      if (keep.has(path)) continue
      w.close()
      this.watchers.delete(path)
      this.entries.delete(path)
    }
    this.vaults = valid
    await Promise.all(valid.map((v) => this.refresh(v)))
    for (const v of valid) this.watch(v)
    return this.all()
  }

  /** the absolute path lies inside one of the indexed vaults */
  allows(absPath: string): boolean {
    return absPath.toLowerCase().endsWith('.md') && this.vaults.some((v) => isInside(absPath, v.path))
  }

  private async refresh(v: VaultRef): Promise<void> {
    this.entries.set(v.path, await indexVault(v))
  }

  private watch(v: VaultRef): void {
    if (this.watchers.has(v.path)) return
    try {
      const w = watch(v.path, { recursive: true }, (_type, file) => {
        const f = String(file ?? '')
        if (f.split(/[\\/]/).some((p) => SKIP_DIRS.has(p))) return
        clearTimeout(this.timers.get(v.path))
        this.timers.set(
          v.path,
          setTimeout(() => {
            if (!this.vaults.some((x) => x.path === v.path)) return
            void this.refresh(v).then(() => this.notify(this.all()))
          }, DEBOUNCE_MS)
        )
      })
      w.on('error', () => {
        w.close()
        this.watchers.delete(v.path)
      })
      this.watchers.set(v.path, w)
    } catch {
      /* watching is a bonus; the index still works, it just refreshes on the next start */
    }
  }

  close(): void {
    for (const w of this.watchers.values()) w.close()
    for (const t of this.timers.values()) clearTimeout(t)
    this.watchers.clear()
  }
}

export function registerObsidianIpc(win: () => BrowserWindow | null): () => void {
  const index = new VaultIndex((entries) => win()?.webContents.send('obsidian:changed', entries))

  ipcMain.handle('obsidian:discover', async (): Promise<VaultRef[]> => {
    try {
      return parseObsidianRegistry(await readFile(join(app.getPath('appData'), 'obsidian', 'obsidian.json'), 'utf8'))
    } catch {
      return []
    }
  })

  ipcMain.handle('obsidian:index', (_e, vaults: VaultRef[]) =>
    index.set(Array.isArray(vaults) ? vaults.filter((v) => typeof v?.path === 'string' && typeof v?.name === 'string') : [])
  )

  ipcMain.handle('obsidian:open', async (_e, absPath: string): Promise<boolean> => {
    if (typeof absPath !== 'string' || !index.allows(absPath)) return false
    await shell.openExternal(obsidianUri(absPath))
    return true
  })

  ipcMain.handle('obsidian:pickFolder', async () => {
    const w = win()
    const opts = { title: 'Vault-Ordner wählen', properties: ['openDirectory' as const] }
    const res = w ? await dialog.showOpenDialog(w, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })

  return () => index.close()
}
