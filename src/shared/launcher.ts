/**
 * Launcher widget: tiles that open programs, games, folders or links. A tile with several
 * targets is a "scene" (e.g. "D&D-Abend": Discord, Foundry, the campaign vault, a playlist).
 * Config lives in settings.widgetConfig[LAUNCHER_WIDGET_ID].
 */

export const LAUNCHER_WIDGET_ID = 'launcher'

export interface LaunchItem {
  id: string
  name: string
  /** file paths (.exe, .lnk, .url, folders, documents) or links (https://, steam://, obsidian:// …) */
  targets: string[]
}

export interface LauncherConfig extends Record<string, unknown> {
  items: LaunchItem[]
}

export const LAUNCHER_DEFAULTS: LauncherConfig = { items: [] }

export interface LaunchResult {
  opened: number
  /** targets that could not be opened, with the reason */
  failed: { target: string; error: string }[]
}

export interface LauncherApi {
  open(targets: string[]): Promise<LaunchResult>
  /** the file's icon as a data URL, or null */
  icon(target: string): Promise<string | null>
  /** file dialog; null when cancelled */
  pick(): Promise<string | null>
  /** path of a file dropped onto the page */
  pathOf(file: File): string
}

/** schemes that would run code in the app or read arbitrary data; everything else goes to the OS */
const BLOCKED = /^(javascript|data|vbscript|about|blob|chrome|devtools):/i

export type TargetKind = 'link' | 'file' | 'invalid'

export function targetKind(target: string): TargetKind {
  const t = target.trim()
  if (!t) return 'invalid'
  // "C:\…" or "\\server\…" or a POSIX path
  if (/^[a-z]:[\\/]/i.test(t) || t.startsWith('\\\\') || t.startsWith('/')) return 'file'
  if (BLOCKED.test(t)) return 'invalid'
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return 'link'
  return 'invalid'
}

/** "C:\…\Obsidian.exe" → "Obsidian", "https://www.dndbeyond.com/x" → "dndbeyond.com" */
export function nameFromTarget(target: string): string {
  const t = target.trim()
  if (targetKind(t) === 'file') {
    const base = t.split(/[\\/]/).filter(Boolean).pop() ?? t
    return base.replace(/\.(exe|lnk|url|bat|cmd)$/i, '')
  }
  try {
    const u = new URL(t)
    if (u.protocol === 'steam:') return 'Steam-Spiel'
    return u.hostname.replace(/^www\./, '') || u.protocol.replace(/:$/, '')
  } catch {
    return t
  }
}
