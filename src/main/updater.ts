import type { UpdateInfo, UpdateStatus } from '@shared/update'

/** the part of electron-updater's `autoUpdater` we use – injectable for tests */
export interface UpdaterBackend {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on(event: string, listener: (...args: any[]) => void): unknown
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export interface UpdaterOptions {
  backend: UpdaterBackend | null
  currentVersion: string
  /** setting "Automatisch nach Updates suchen" */
  enabled: () => boolean
  onStatus: (info: UpdateInfo) => void
  /** called right before quitAndInstall so the window doesn't hide in the tray instead of closing */
  beforeInstall: () => void
  /** first check after start, then periodically */
  firstDelayMs?: number
  intervalMs?: number
}

const NO_RELEASE = /HttpError: 404|No published versions|Cannot find latest/i
const FIRST_DELAY = 15_000
const INTERVAL = 6 * 60 * 60_000

/**
 * Checks GitHub Releases for a newer version, downloads it in the background and installs it on the next quit
 * (or right away via `install`). Without a backend (dev build) everything is a no-op with state "unsupported".
 */
export class Updater {
  private status: UpdateStatus
  private timers: ReturnType<typeof setTimeout>[] = []

  constructor(private readonly opts: UpdaterOptions) {
    this.status = opts.backend ? { state: 'idle' } : { state: 'unsupported' }
    const b = opts.backend
    if (!b) return
    b.autoDownload = true
    b.autoInstallOnAppQuit = true
    b.on('checking-for-update', () => this.set({ state: 'checking' }))
    b.on('update-not-available', () => this.set({ state: 'uptodate', checkedAt: new Date().toISOString() }))
    b.on('update-available', (info: { version: string }) =>
      this.set({ state: 'downloading', version: info.version, percent: 0 })
    )
    b.on('download-progress', (p: { percent: number }) => {
      if (this.status.state === 'downloading') this.set({ ...this.status, percent: p.percent })
    })
    b.on('update-downloaded', (info: { version: string }) => this.set({ state: 'ready', version: info.version }))
    b.on('error', (err: unknown) => {
      // a finished download stays installable even if a later check fails
      if (this.status.state === 'ready') return
      this.fail(err)
    })
  }

  get info(): UpdateInfo {
    return { current: this.opts.currentVersion, status: this.status }
  }

  start(): void {
    if (!this.opts.backend) return
    const tick = (): void => {
      if (this.opts.enabled()) void this.check()
    }
    this.timers.push(setTimeout(tick, this.opts.firstDelayMs ?? FIRST_DELAY))
    this.timers.push(setInterval(tick, this.opts.intervalMs ?? INTERVAL))
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
  }

  async check(): Promise<void> {
    const b = this.opts.backend
    // nothing to do while a download runs or one is waiting to be installed
    if (!b || this.status.state === 'downloading' || this.status.state === 'ready') return
    try {
      await b.checkForUpdates()
    } catch (err) {
      // usually also reported via the 'error' event; this covers rejections without one
      if (this.status.state === 'checking' || this.status.state === 'idle') this.fail(err)
    }
  }

  install(): void {
    if (!this.opts.backend || this.status.state !== 'ready') return
    this.opts.beforeInstall()
    // silent: reuse the existing install folder without showing the wizard; then start the app again
    this.opts.backend.quitAndInstall(true, true)
  }

  private fail(err: unknown): void {
    // no release on GitHub yet means there is nothing newer – not an error worth a red line
    if (NO_RELEASE.test(err instanceof Error ? err.message : String(err)))
      this.set({ state: 'uptodate', checkedAt: new Date().toISOString() })
    else this.set({ state: 'error', message: friendlyError(err) })
  }

  private set(s: UpdateStatus): void {
    this.status = s
    this.opts.onStatus(this.info)
  }
}

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/net::|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/.test(msg)) return 'Keine Verbindung zu GitHub.'
  if (/sha512 checksum mismatch/i.test(msg)) return 'Download beschädigt, wird beim nächsten Mal neu geladen.'
  return msg.split('\n')[0]!.slice(0, 160)
}
