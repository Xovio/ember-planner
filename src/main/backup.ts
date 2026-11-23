import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { DataStore } from './store'

export interface BackupInfo {
  file: string
  /** ISO timestamp of the backup */
  at: string
  size: number
  auto: boolean
}

/** backups kept on disk (automatic and manual together) */
const KEEP = 14
const NAME_RE = /^ember-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})(-manuell)?\.json$/
const CHECK_MS = 60 * 60 * 1000

const pad = (n: number): string => String(n).padStart(2, '0')
const stamp = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`

/**
 * Daily snapshot of the data file in `<userData>/Backups`.
 * Only reads from the store; restoring happens in the renderer so it can be undone.
 */
export class Backups {
  readonly dir: string
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly store: DataStore) {
    this.dir = join(dirname(store.path), 'Backups')
  }

  start(): void {
    this.daily()
    this.timer = setInterval(() => this.daily(), CHECK_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** one automatic backup per calendar day */
  daily(): void {
    const today = stamp(new Date()).slice(0, 10)
    if (this.list().some((b) => b.auto && b.file.startsWith(`ember-${today}`))) return
    // nothing worth saving on a fresh install
    const d = this.store.get()
    if (!d.events.length && !d.todos.length) return
    this.create(false)
  }

  create(manual: boolean): BackupInfo {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
    const file = `ember-${stamp(new Date())}${manual ? '-manuell' : ''}.json`
    writeFileSync(join(this.dir, file), JSON.stringify(this.store.get(), null, 2), 'utf8')
    this.prune()
    return this.info(file)!
  }

  list(): BackupInfo[] {
    if (!existsSync(this.dir)) return []
    return readdirSync(this.dir)
      .filter((f) => NAME_RE.test(f))
      .sort()
      .reverse()
      .map((f) => this.info(f))
      .filter((b): b is BackupInfo => !!b)
  }

  read(file: string): string {
    const name = basename(file)
    if (!NAME_RE.test(name)) throw new Error('Unbekannte Sicherung')
    return readFileSync(join(this.dir, name), 'utf8')
  }

  private info(file: string): BackupInfo | null {
    const m = file.match(NAME_RE)
    if (!m) return null
    const [y, mo, d] = m[1].split('-').map(Number)
    let size = 0
    try {
      size = statSync(join(this.dir, file)).size
    } catch {
      return null
    }
    return { file, at: new Date(y, mo - 1, d, Number(m[2]), Number(m[3])).toISOString(), size, auto: !m[4] }
  }

  private prune(): void {
    for (const b of this.list().slice(KEEP)) {
      try {
        unlinkSync(join(this.dir, b.file))
      } catch {
        /* ignore */
      }
    }
  }
}
