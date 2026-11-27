import { app, BrowserWindow, dialog, ipcMain, Menu, powerMonitor, Tray, safeStorage, shell } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { DataStore } from './store'
import { ReminderScheduler } from './reminders'
import { Backups } from './backup'
import { createAppIcon } from './icon'
import { GoogleAccount } from './google/account'
import { registerGoogleIpc } from './google/ipc'
import { GoogleSync } from './google/sync'
import { DiscordAccount } from './discord/account'
import { registerDiscordIpc } from './discord/ipc'
import { DiscordSync } from './discord/sync'
import { autoUpdater } from 'electron-updater'
import { Updater } from './updater'
import { AppTimeTracker } from './apptime'
import { SyncTracker } from './sync/tracker'
import { DeviceSync } from './sync/engine'
import { registerDeviceSyncIpc } from './sync/ipc'
import { hostname } from 'os'
import { registerLauncherIpc } from './launcher'
import { registerObsidianIpc } from './obsidian'
import { PREP_WIDGET_ID, prepConfig } from '@shared/apptime'
import type { GoogleStatus } from '@shared/google'
import type { DiscordStatus } from '@shared/discord'
import type { AppData, LoadResult, TitleBarTheme } from '@shared/types'

interface FileFilter {
  name: string
  extensions: string[]
}

// Taskbar identity. Must match `build.appId` so the installed shortcut and the window share one pin.
// Dev runs get their own, otherwise Windows pins electron.exe (without the app) under the real app's id.
const APP_ID = app.isPackaged ? 'de.ember.planner' : 'de.ember.planner.dev'
const startHidden = process.argv.includes('--hidden')

let win: BrowserWindow | null = null
let tray: Tray | null = null
let store: DataStore
let reminders: ReminderScheduler
let backups: Backups
let googleSync: GoogleSync | null = null
let discordSync: DiscordSync | null = null
let updater: Updater | null = null
let appTime: AppTimeTracker | null = null
let syncTracker: SyncTracker | null = null
let deviceSync: DeviceSync | null = null
let quitting = false

// separate data folder, e.g. for testing without touching the real data
if (process.env['EMBER_USER_DATA']) app.setPath('userData', process.env['EMBER_USER_DATA'])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  app.whenReady().then(init)
}

function init(): void {
  app.setAppUserModelId(APP_ID)
  store = new DataStore()
  applyLoginItem(store.get())
  // change stamps for device sync; a failure here must never keep the app from starting
  try {
    syncTracker = new SyncTracker(app.getPath('userData'), store.get())
  } catch (err) {
    console.error('Device sync tracking disabled:', err)
  }

  ipcMain.handle('data:load', (): LoadResult => ({ data: store.get(), seq: store.seq }))
  ipcMain.handle('data:save', (_e, next: AppData, baseSeq?: number) => {
    const prevLogin = store.get().settings.launchAtLogin
    store.set(next, baseSeq)
    if (prevLogin !== next.settings.launchAtLogin) applyLoginItem(next)
    reminders.poke()
    return true
  })
  backups = new Backups(store)
  backups.start()
  ipcMain.handle('backup:list', () => backups.list())
  ipcMain.handle('backup:create', () => backups.create(true))
  ipcMain.handle('backup:read', (_e, file: string) => backups.read(file))
  ipcMain.handle('backup:open-folder', () => {
    if (backups.list().length === 0) backups.create(true)
    return shell.openPath(backups.dir)
  })

  ipcMain.handle(
    'file:save',
    async (_e, name: string, content: string, filters: FileFilter[], extras: { name: string; content: string }[] = []) => {
      const res = await dialog.showSaveDialog(win!, { defaultPath: join(app.getPath('documents'), name), filters })
      if (res.canceled || !res.filePath) return null
      writeFileSync(res.filePath, content, 'utf8')
      // companion files (e.g. a .canvas next to its note); plain names only, same folder
      for (const x of extras) writeFileSync(join(dirname(res.filePath), basename(x.name)), x.content, 'utf8')
      return res.filePath
    }
  )
  ipcMain.handle('file:open', async (_e, filters: FileFilter[]) => {
    const res = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters })
    const path = res.filePaths[0]
    if (res.canceled || !path) return null
    return { name: basename(path), content: readFileSync(path, 'utf8') }
  })

  ipcMain.on('window:theme', (_e, t: TitleBarTheme) => {
    if (process.platform === 'win32' && win) {
      win.setTitleBarOverlay({ color: t.color, symbolColor: t.symbolColor, height: 40 })
      win.setBackgroundColor(t.color)
    }
  })

  reminders = new ReminderScheduler(
    () => store.get(),
    (payload, notification) => {
      win?.webContents.send('reminder:fired', payload)
      notification?.on('click', () => {
        showWindow()
        win?.webContents.send(payload.kind === 'todo' ? 'todo:open' : 'event:open', payload.id)
      })
    }
  )
  reminders.start()

  const google = new GoogleAccount({
    dir: app.getPath('userData'),
    box: {
      available: () => safeStorage.isEncryptionAvailable(),
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (data) => safeStorage.decryptString(data)
    },
    openBrowser: (url) => void shell.openExternal(url),
    onStatus: () => {
      sendGoogleStatus()
      if (deviceSync) win?.webContents.send('devicesync:status', deviceSync.status())
    }
  })
  googleSync = new GoogleSync({
    store,
    account: google,
    dir: app.getPath('userData'),
    onState: () => sendGoogleStatus(),
    onNotice: (text) => win?.webContents.send('google:notice', text)
  })
  const googleStatus = (): GoogleStatus => ({ ...google.status(), sync: googleSync?.state })
  const sendGoogleStatus = (): void => win?.webContents.send('google:status', googleStatus())
  registerGoogleIpc(store, google, googleSync, googleStatus)
  googleSync.start()

  // device sync over the hidden Drive folder (docs/SYNC.md); needs the change stamps
  if (syncTracker) {
    deviceSync = new DeviceSync({
      store,
      tracker: syncTracker,
      account: google,
      dir: app.getPath('userData'),
      box: {
        available: () => safeStorage.isEncryptionAvailable(),
        encrypt: (plain) => safeStorage.encryptString(plain),
        decrypt: (data) => safeStorage.decryptString(data)
      },
      defaultName: hostname() || 'Desktop',
      onStatus: (s) => win?.webContents.send('devicesync:status', s)
    })
    registerDeviceSyncIpc(deviceSync)
    deviceSync.start()
  } else {
    ipcMain.handle('devicesync:status', () => null)
  }

  const discord = new DiscordAccount({
    dir: app.getPath('userData'),
    box: {
      available: () => safeStorage.isEncryptionAvailable(),
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (data) => safeStorage.decryptString(data)
    },
    onStatus: () => sendDiscordStatus()
  })
  discordSync = new DiscordSync({
    store,
    account: discord,
    dir: app.getPath('userData'),
    onState: () => sendDiscordStatus(),
    onNotice: (text) => win?.webContents.send('discord:notice', text),
    // e.g. a session moved in Discord: a Google calendar holding it must hear about it too
    onEventsChanged: (diff, data) => googleSync?.recordLocal(diff, data)
  })
  const discordStatus = (): DiscordStatus => ({ ...discord.status(), sync: discordSync?.state })
  const sendDiscordStatus = (): void => win?.webContents.send('discord:status', discordStatus())
  registerDiscordIpc(store, discord, discordSync, discordStatus)
  discordSync.start()

  store.subscribe({
    onSave(prev, next) {
      try {
        syncTracker?.observe(prev, next)
        deviceSync?.localChanged()
      } catch (err) {
        console.error('Device sync tracking failed:', err)
      }
    },
    onLocalChange(diff, data) {
      googleSync?.recordLocal(diff, data)
      discordSync?.recordLocal(diff)
    },
    onRemoteChange(change) {
      win?.webContents.send('data:remote', change)
      reminders.poke()
    }
  })

  // only installer builds carry an app-update.yml (written by electron-builder); dev runs and `npm run pack` stay "unsupported"
  const canUpdate = app.isPackaged && existsSync(join(process.resourcesPath, 'app-update.yml'))
  updater = new Updater({
    backend: canUpdate ? autoUpdater : null,
    currentVersion: app.getVersion(),
    enabled: () => store.get().settings.autoUpdate,
    onStatus: (info) => win?.webContents.send('update:status', info),
    beforeInstall: () => {
      quitting = true
    }
  })
  ipcMain.handle('update:info', () => updater!.info)
  ipcMain.handle('update:check', () => updater!.check())
  ipcMain.handle('update:install', () => updater!.install())
  updater.start()

  appTime = new AppTimeTracker({
    dir: app.getPath('userData'),
    config: () => prepConfig(store.get().settings.widgetConfig?.[PREP_WIDGET_ID]),
    idleSeconds: () =>
      powerMonitor.getSystemIdleState(60) === 'locked' ? Infinity : powerMonitor.getSystemIdleTime(),
    onUpdate: (state) => win?.webContents.send('apptime:update', state)
  })
  ipcMain.handle('apptime:get', () => appTime!.state)
  ipcMain.handle('apptime:processes', () => appTime!.processes())
  appTime.start()

  registerLauncherIpc(() => win)
  const closeObsidian = registerObsidianIpc(() => win)
  app.on('will-quit', closeObsidian)

  createWindow()
  createTray()
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Ember Planner',
    icon: createAppIcon(64),
    backgroundColor: '#15100e',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#15100e', symbolColor: '#e9dcd6', height: 40 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // coming back to the window is a good moment to look for changes at Google
  win.on('focus', () => {
    googleSync?.poke()
    discordSync?.poke()
    deviceSync?.poke()
  })

  win.once('ready-to-show', () => {
    if (!startHidden) win?.show()
  })

  win.on('close', (e) => {
    if (!quitting && store.get().settings.closeToTray) {
      e.preventDefault()
      win?.hide()
    }
  })

  // external links open in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  tray = new Tray(createAppIcon(32))
  tray.setToolTip('Ember Planner')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Öffnen', click: () => showWindow() },
      {
        label: 'Neuer Termin',
        click: () => {
          showWindow()
          win?.webContents.send('event:new')
        }
      },
      { type: 'separator' },
      { label: 'Beenden', click: () => quit() }
    ])
  )
  tray.on('click', () => showWindow())
}

function showWindow(): void {
  if (!win) return createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function applyLoginItem(data: AppData): void {
  if (!app.isPackaged) return // avoid registering electron.exe during development
  app.setLoginItemSettings({ openAtLogin: data.settings.launchAtLogin, args: ['--hidden'] })
}

function quit(): void {
  quitting = true
  app.quit()
}

app.on('before-quit', () => {
  quitting = true
  reminders?.stop()
  backups?.stop()
  googleSync?.stop()
  discordSync?.stop()
  updater?.stop()
  appTime?.stop()
  store?.flush()
  syncTracker?.flush()
})

app.on('window-all-closed', () => {
  // stay alive in the tray; quitting goes through the tray menu
  if (!store?.get().settings.closeToTray) app.quit()
})
