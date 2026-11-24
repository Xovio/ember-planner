import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { extname } from 'path'
import { targetKind, type LaunchResult } from '@shared/launcher'

const STAGGER_MS = 350
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** opens one target: links through the OS (default browser, Steam, Obsidian …), files with their program */
async function openTarget(target: string): Promise<void> {
  const t = target.trim()
  const kind = targetKind(t)
  if (kind === 'link') return shell.openExternal(t)
  if (kind !== 'file') throw new Error('Kein gültiger Pfad oder Link')
  if (!existsSync(t)) throw new Error('Datei nicht gefunden')
  const err = await shell.openPath(t)
  if (err) throw new Error(err)
}

async function iconOf(target: string): Promise<string | null> {
  if (targetKind(target) !== 'file' || !existsSync(target)) return null
  try {
    let path = target
    const ext = extname(target).toLowerCase()
    if (ext === '.lnk') {
      const link = shell.readShortcutLink(target)
      path = link.icon || link.target || target
    } else if (ext === '.url') {
      const icon = /^IconFile=(.+)$/m.exec(readFileSync(target, 'utf8'))?.[1]?.trim()
      if (icon && existsSync(icon)) path = icon
    }
    const img = await app.getFileIcon(path, { size: 'large' })
    return img.isEmpty() ? null : img.toDataURL()
  } catch {
    return null
  }
}

export function registerLauncherIpc(win: () => BrowserWindow | null): void {
  ipcMain.handle('launcher:open', async (_e, targets: string[]): Promise<LaunchResult> => {
    const res: LaunchResult = { opened: 0, failed: [] }
    for (const [i, target] of targets.entries()) {
      if (i > 0) await wait(STAGGER_MS)
      try {
        await openTarget(target)
        res.opened++
      } catch (err) {
        res.failed.push({ target, error: err instanceof Error ? err.message : String(err) })
      }
    }
    return res
  })

  ipcMain.handle('launcher:icon', (_e, target: string) => iconOf(target))

  ipcMain.handle('launcher:pick', async () => {
    const w = win()
    const opts = {
      properties: ['openFile' as const],
      defaultPath: app.getPath('desktop'),
      filters: [
        { name: 'Programme und Verknüpfungen', extensions: ['exe', 'lnk', 'url', 'bat', 'cmd'] },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    }
    const res = w ? await dialog.showOpenDialog(w, opts) : await dialog.showOpenDialog(opts)
    const path = res.filePaths[0]
    return res.canceled || !path ? null : path
  })
}
