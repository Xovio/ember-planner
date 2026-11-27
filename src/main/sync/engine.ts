import { createHash } from 'crypto'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { DeviceInfo, DeviceSyncStatus } from '@shared/devicesync'
import { MIN_PASSPHRASE } from '@shared/devicesync'
import type { DataPatch, RemoteChange } from '@shared/patch'
import { exportDoc, mergeDocs, type DeviceDoc } from '@shared/sync'
import type { AppData } from '@shared/types'
import type { SecretBox } from '../google/account'
import { AppFolder, isSealed, keyFits, newEncryption, open, seal, unlockKey, type DriveFile, type EncryptionInfo } from './drive'
import type { SyncTracker } from './tracker'

const META = 'ember-sync.json'
const DEVICE_PREFIX = 'device-'
const deviceFile = (id: string): string => `${DEVICE_PREFIX}${id}.json`

const INTERVAL_MS = 5 * 60_000
/** a focus triggers a sync only if the last one is older than this */
const MIN_GAP_MS = 60_000
/** local changes are uploaded after this quiet period */
const PUSH_DELAY_MS = 20_000
/** an unchanged doc is still re-uploaded this often, so other devices see this one as active */
const REFRESH_MS = 12 * 3600_000

/** shared file in the app folder */
interface MetaFile {
  format: 1
  createdAt: string
  encryption?: EncryptionInfo
}

/** local settings of device sync (`device-sync-config.json`) */
interface Config {
  enabled: boolean
  name: string
  lastSync?: string
  /** hash and time of the last upload of this device's doc */
  uploadHash?: string
  uploadedAt?: number
  devices?: DeviceInfo[]
}

export interface SyncAccount {
  readonly isConnected: boolean
  readonly hasDrive: boolean
  request<T>(url: string, init?: RequestInit): Promise<T>
  connect(opts: { drive?: boolean }): Promise<unknown>
  dropDrive(): void
}

export interface DeviceSyncDeps {
  store: { get(): AppData; applyRemote(patch: DataPatch): RemoteChange | null }
  tracker: Pick<SyncTracker, 'state' | 'touch'>
  account: SyncAccount
  dir: string
  box: SecretBox
  defaultName: string
  onStatus?(s: DeviceSyncStatus): void
  now?: () => number
}

/** errors with a `status` (GoogleApiError) without importing the class */
const httpStatus = (err: unknown): number | undefined => (err as { status?: number })?.status
const reasonOf = (err: unknown): string | undefined => (err as { reason?: string })?.reason

/**
 * Syncs the synced part of AppData with the user's other devices through the hidden app folder
 * in Google Drive. Each device writes only its own file and reads the others (docs/SYNC.md).
 */
export class DeviceSync {
  private cfg: Config
  private key: Buffer | null
  private running: Promise<void> | null = null
  private again = false
  private timer: NodeJS.Timeout | null = null
  private pushTimer: NodeJS.Timeout | null = null
  private error: string | undefined
  private needsPassphrase = false
  private encrypted = false
  private readonly folder: AppFolder
  private readonly cfgFile: string
  private readonly keyFile: string

  constructor(private readonly deps: DeviceSyncDeps) {
    this.folder = new AppFolder(deps.account)
    this.cfgFile = join(deps.dir, 'device-sync-config.json')
    this.keyFile = join(deps.dir, 'device-sync-key.bin')
    this.cfg = this.readConfig()
    this.key = this.readKey()
    this.encrypted = !!this.key
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }

  /* ── persistence ── */

  private readConfig(): Config {
    const fallback: Config = { enabled: false, name: this.deps.defaultName }
    if (!existsSync(this.cfgFile)) return fallback
    try {
      return { ...fallback, ...(JSON.parse(readFileSync(this.cfgFile, 'utf8')) as Partial<Config>) }
    } catch {
      return fallback
    }
  }

  private writeConfig(): void {
    const tmp = `${this.cfgFile}.tmp`
    writeFileSync(tmp, JSON.stringify(this.cfg, null, 2), 'utf8')
    renameSync(tmp, this.cfgFile)
  }

  private readKey(): Buffer | null {
    if (!existsSync(this.keyFile)) return null
    try {
      return Buffer.from(this.deps.box.decrypt(readFileSync(this.keyFile)), 'base64')
    } catch {
      return null // the passphrase is asked again
    }
  }

  private saveKey(key: Buffer | null): void {
    this.key = key
    if (!key) {
      rmSync(this.keyFile, { force: true })
      return
    }
    if (!this.deps.box.available()) throw new Error('Windows stellt keine Verschlüsselung bereit – der Schlüssel kann nicht sicher gespeichert werden.')
    writeFileSync(this.keyFile, this.deps.box.encrypt(key.toString('base64')))
  }

  /* ── status ── */

  status(): DeviceSyncStatus {
    const { account, tracker } = this.deps
    const self: DeviceInfo = {
      id: tracker.state.deviceId,
      name: this.cfg.name,
      savedAt: this.cfg.uploadedAt ? new Date(this.cfg.uploadedAt).toISOString() : '',
      self: true
    }
    return {
      enabled: this.cfg.enabled,
      running: !!this.running,
      googleConnected: account.isConnected,
      needsGrant: this.cfg.enabled && account.isConnected && !account.hasDrive,
      needsPassphrase: this.needsPassphrase,
      encrypted: this.encrypted,
      deviceId: tracker.state.deviceId,
      deviceName: this.cfg.name,
      devices: [self, ...(this.cfg.devices ?? []).filter((d) => !d.self)],
      lastSync: this.cfg.lastSync,
      error: this.error
    }
  }

  private emit(): DeviceSyncStatus {
    const s = this.status()
    this.deps.onStatus?.(s)
    return s
  }

  /* ── triggers ── */

  start(): void {
    this.stop()
    this.timer = setInterval(() => void this.syncNow(), INTERVAL_MS)
    setTimeout(() => void this.syncNow(), 4000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.timer = null
    this.pushTimer = null
  }

  /** e.g. window focus: sync unless it just happened */
  poke(): void {
    const last = this.cfg.lastSync ? Date.parse(this.cfg.lastSync) : 0
    if (this.now() - last > MIN_GAP_MS) void this.syncNow()
  }

  /** the UI saved something: upload after a quiet period */
  localChanged(): void {
    if (!this.cfg.enabled) return
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      void this.syncNow()
    }, PUSH_DELAY_MS)
  }

  /* ── actions ── */

  async setEnabled(enabled: boolean): Promise<DeviceSyncStatus> {
    this.cfg.enabled = enabled
    this.error = undefined
    this.writeConfig()
    this.emit()
    if (enabled) await this.syncNow()
    return this.status()
  }

  /** asks Google for the Drive folder (opens the browser) */
  async grant(): Promise<DeviceSyncStatus> {
    await this.deps.account.connect({ drive: true })
    if (!this.deps.account.hasDrive) {
      this.error = 'Google hat den Zugriff auf den App-Ordner nicht erteilt. Bitte das Häkchen bei der Anmeldung setzen.'
      return this.emit()
    }
    this.error = undefined
    await this.syncNow()
    return this.status()
  }

  setName(name: string): DeviceSyncStatus {
    const clean = name.trim().slice(0, 40)
    if (!clean || clean === this.cfg.name) return this.status()
    this.cfg.name = clean
    this.cfg.uploadHash = undefined // the name is part of the doc
    this.writeConfig()
    this.localChanged()
    return this.emit()
  }

  async syncNow(): Promise<DeviceSyncStatus> {
    if (this.running) {
      this.again = true
      await this.running.catch(() => undefined)
      return this.status()
    }
    if (!this.ready()) return this.emit()
    this.running = this.exclusive(() => this.run())
    await this.running
    return this.status()
  }

  /** runs `fn` while no sync runs and blocks syncs meanwhile; repeats a sync asked for meanwhile */
  private async exclusive(fn: () => Promise<void>): Promise<void> {
    this.emit()
    try {
      await fn()
    } finally {
      this.running = null
      this.emit()
      if (this.again) {
        this.again = false
        void this.syncNow()
      }
    }
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running) await this.running.catch(() => undefined)
    if (!this.ready()) throw new Error(this.error ?? 'Der Geräte-Sync ist nicht bereit.')
    let result!: T
    this.running = this.exclusive(async () => {
      result = await fn()
    })
    await this.running
    return result
  }

  private ready(): boolean {
    const { account } = this.deps
    if (!this.cfg.enabled) return false
    if (!account.isConnected) {
      this.error = 'Google ist nicht verbunden. Bitte oben unter „Google Kalender“ verbinden.'
      return false
    }
    if (!account.hasDrive) {
      this.error = undefined // shown as "needs grant", not as an error
      return false
    }
    return true
  }

  /** forgets another device; it reappears if it syncs again */
  async removeDevice(id: string): Promise<DeviceSyncStatus> {
    if (id === this.deps.tracker.state.deviceId) throw new Error('Dieses Gerät kann sich nicht selbst entfernen.')
    await this.withLock(async () => {
      const file = (await this.folder.list()).find((f) => f.name === deviceFile(id))
      if (file) await this.folder.remove(file.id)
      this.cfg.devices = (this.cfg.devices ?? []).filter((d) => d.id !== id)
      this.writeConfig()
    })
    return this.status()
  }

  /** deletes all sync files in Drive; local data and stamps stay */
  async wipe(): Promise<DeviceSyncStatus> {
    await this.withLock(async () => {
      for (const f of await this.folder.list()) await this.folder.remove(f.id)
      this.saveKey(null)
      this.encrypted = false
      this.needsPassphrase = false
      this.cfg = { enabled: this.cfg.enabled, name: this.cfg.name }
      this.writeConfig()
    })
    return this.syncNow()
  }

  /** unlocks data encrypted by another device */
  async unlock(passphrase: string): Promise<DeviceSyncStatus> {
    await this.withLock(async () => {
      const meta = await this.readMeta(await this.folder.list())
      if (!meta?.encryption) {
        this.needsPassphrase = false
        return
      }
      const key = unlockKey(meta.encryption, passphrase)
      if (!key) throw new Error('Die Passphrase stimmt nicht.')
      this.saveKey(key)
      this.encrypted = true
      this.needsPassphrase = false
      this.error = undefined
    })
    return this.syncNow()
  }

  /** switches encryption on, changes the passphrase, or (null) switches it off; re-encodes every device file */
  async setPassphrase(passphrase: string | null): Promise<DeviceSyncStatus> {
    if (passphrase !== null && passphrase.length < MIN_PASSPHRASE)
      throw new Error(`Die Passphrase braucht mindestens ${MIN_PASSPHRASE} Zeichen.`)
    await this.withLock(async () => {
      const files = await this.folder.list()
      const metaFile = files.find((f) => f.name === META)
      const meta = (await this.readMeta(files)) ?? { format: 1, createdAt: new Date(this.now()).toISOString() }
      const oldKey = meta.encryption ? this.key : null
      if (meta.encryption && (!oldKey || !keyFits(meta.encryption, oldKey)))
        throw new Error('Bitte zuerst mit der bisherigen Passphrase entsperren.')
      const next = passphrase === null ? null : newEncryption(passphrase)
      for (const f of files.filter((x) => x.name.startsWith(DEVICE_PREFIX))) {
        const raw = await this.folder.read<unknown>(f.id)
        let doc: unknown = raw
        if (isSealed(raw)) {
          if (!oldKey) continue
          try {
            doc = open(oldKey, raw)
          } catch {
            continue // left by an older encryption; that device uploads anew
          }
        }
        await this.folder.update(f.id, next ? seal(next.key, doc) : doc)
      }
      const nextMeta: MetaFile = { format: 1, createdAt: meta.createdAt, ...(next ? { encryption: next.info } : {}) }
      if (metaFile) await this.folder.update(metaFile.id, nextMeta)
      else await this.folder.create(META, nextMeta)
      this.saveKey(next?.key ?? null)
      this.encrypted = !!next
      this.cfg.uploadHash = undefined
      this.writeConfig()
    })
    return this.syncNow()
  }

  /* ── the sync itself ── */

  private async readMeta(files: DriveFile[]): Promise<MetaFile | null> {
    const f = files.find((x) => x.name === META)
    return f ? this.folder.read<MetaFile>(f.id) : null
  }

  private async run(): Promise<void> {
    const { store, tracker } = this.deps
    try {
      const files = await this.folder.list()
      let meta = await this.readMeta(files)
      if (!meta) {
        meta = { format: 1, createdAt: new Date(this.now()).toISOString() }
        await this.folder.create(META, meta)
      }
      if (meta.encryption) {
        if (!this.key || !keyFits(meta.encryption, this.key)) {
          this.needsPassphrase = true
          this.encrypted = true
          this.error = undefined
          return
        }
      } else if (this.key) this.saveKey(null) // another device switched encryption off
      this.encrypted = !!meta.encryption
      this.needsPassphrase = false

      const own = deviceFile(tracker.state.deviceId)
      const docs: DeviceDoc[] = []
      const devices: DeviceInfo[] = []
      for (const f of files) {
        if (!f.name.startsWith(DEVICE_PREFIX) || f.name === own) continue
        try {
          const raw = await this.folder.read<unknown>(f.id)
          const doc = (isSealed(raw) ? open<DeviceDoc>(this.key!, raw) : raw) as DeviceDoc
          if (doc?.format !== 1 || typeof doc.deviceId !== 'string' || !doc.records) continue
          docs.push(doc)
          devices.push({ id: doc.deviceId, name: doc.name, savedAt: doc.savedAt, self: false })
        } catch (err) {
          console.error('[device-sync] skipped', f.name, err)
        }
      }

      const merged = mergeDocs(tracker.state, store.get(), docs)
      if (Object.keys(merged.set).length || merged.remove.length) store.applyRemote({ records: merged })
      tracker.touch()

      const doc = exportDoc(tracker.state, store.get(), this.cfg.name, this.now())
      const hash = createHash('sha256')
        .update(JSON.stringify(doc.records))
        .update(this.cfg.name)
        .update(this.key ? this.key.toString('base64') : '-')
        .digest('base64')
      const ownFile = files.find((f) => f.name === own)
      const stale = !this.cfg.uploadedAt || this.now() - this.cfg.uploadedAt > REFRESH_MS
      if (!ownFile || hash !== this.cfg.uploadHash || stale) {
        const body = this.key ? seal(this.key, doc) : doc
        if (ownFile) {
          try {
            await this.folder.update(ownFile.id, body)
          } catch (err) {
            if (httpStatus(err) !== 404) throw err
            await this.folder.create(own, body) // removed meanwhile (wipe on another device)
          }
        } else await this.folder.create(own, body)
        this.cfg.uploadHash = hash
        this.cfg.uploadedAt = this.now()
      }
      this.cfg.devices = devices.sort((a, b) => a.name.localeCompare(b.name, 'de'))
      this.cfg.lastSync = new Date(this.now()).toISOString()
      this.error = undefined
      this.writeConfig()
    } catch (err) {
      if (httpStatus(err) === 403 && (reasonOf(err) === 'insufficientPermissions' || /scope/i.test((err as Error).message)))
        this.deps.account.dropDrive()
      this.error = (err as Error).message || 'Der Abgleich ist fehlgeschlagen.'
      console.error('[device-sync]', err)
    }
  }
}
