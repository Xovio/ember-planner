import { app, BrowserWindow, ipcMain, Menu, Tray, shell } from 'electron'
import { join } from 'path'
import { DataStore } from './store'
import { ReminderScheduler } from './reminders'
import { createAppIcon } from './icon'
import type { AppData, LoadResult, TitleBarTheme } from '@shared/types'

const APP_ID = 'de.ember.planner'
const startHidden = process.argv.includes('--hidden')

let win: BrowserWindow | null = null
let tray: Tray | null = null
let store: DataStore
let reminders: ReminderScheduler
let quitting = false

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

  ipcMain.handle('data:load', (): LoadResult => ({ data: store.get(), seq: store.seq }))
  ipcMain.handle('data:save', (_e, next: AppData, baseSeq?: number) => {
    const prevLogin = store.get().settings.launchAtLogin
    store.set(next, baseSeq)
    if (prevLogin !== next.settings.launchAtLogin) applyLoginItem(next)
    reminders.poke()
    return true
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

  store.subscribe({
    onRemoteChange(change) {
      win?.webContents.send('data:remote', change)
      reminders.poke()
    }
  })

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
  store?.flush()
})

app.on('window-all-closed', () => {
  // stay alive in the tray; quitting goes through the tray menu
  if (!store?.get().settings.closeToTray) app.quit()
})
