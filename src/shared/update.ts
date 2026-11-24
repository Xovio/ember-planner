/** state of the auto-updater, shown in the settings and the title bar */
export type UpdateStatus =
  /** dev build or browser: updates only work in the installed app */
  | { state: 'unsupported' }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'uptodate'; checkedAt: string }
  | { state: 'downloading'; version: string; percent: number }
  /** downloaded; installs on the next quit or via "Jetzt neu starten" */
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export interface UpdateInfo {
  /** version of the running app, e.g. "0.1.0" */
  current: string
  status: UpdateStatus
}

export interface UpdateApi {
  info(): Promise<UpdateInfo>
  check(): Promise<void>
  /** quits and installs a downloaded update, then restarts the app */
  install(): Promise<void>
  onStatus(cb: (s: UpdateInfo) => void): () => void
}

export const RELEASES_URL = 'https://github.com/Xovio/ember-planner/releases'

/** short German text for the status line in the settings */
export function updateStatusLabel(s: UpdateStatus): string {
  switch (s.state) {
    case 'unsupported':
      return 'Updates gibt es nur in der installierten Version.'
    case 'idle':
      return 'Noch nicht gesucht.'
    case 'checking':
      return 'Suche nach Updates …'
    case 'uptodate':
      return 'Du hast die neueste Version.'
    case 'downloading':
      return `Lade Version ${s.version} herunter … ${Math.round(s.percent)} %`
    case 'ready':
      return `Version ${s.version} ist bereit. Sie wird beim nächsten Beenden installiert.`
    case 'error':
      return `Update fehlgeschlagen: ${s.message}`
  }
}
