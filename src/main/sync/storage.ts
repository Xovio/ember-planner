import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { DeviceSyncConfig, DeviceSyncStorage } from '@shared/syncEngine'
import type { SecretBox } from '../google/account'

/**
 * Device sync settings in `device-sync-config.json` and the encryption key in
 * `device-sync-key.bin`, protected by Windows (safeStorage), both in the userData folder.
 */
export class FileSyncStorage implements DeviceSyncStorage {
  private readonly cfgFile: string
  private readonly keyFile: string

  constructor(
    dir: string,
    private readonly box: SecretBox
  ) {
    this.cfgFile = join(dir, 'device-sync-config.json')
    this.keyFile = join(dir, 'device-sync-key.bin')
  }

  loadConfig(): Partial<DeviceSyncConfig> | null {
    if (!existsSync(this.cfgFile)) return null
    return JSON.parse(readFileSync(this.cfgFile, 'utf8')) as Partial<DeviceSyncConfig>
  }

  saveConfig(cfg: DeviceSyncConfig): void {
    const tmp = `${this.cfgFile}.tmp`
    writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
    renameSync(tmp, this.cfgFile)
  }

  loadKey(): string | null {
    if (!existsSync(this.keyFile)) return null
    return this.box.decrypt(readFileSync(this.keyFile))
  }

  saveKey(key: string | null): void {
    if (!key) {
      rmSync(this.keyFile, { force: true })
      return
    }
    if (!this.box.available())
      throw new Error('Windows stellt keine Verschlüsselung bereit – der Schlüssel kann nicht sicher gespeichert werden.')
    writeFileSync(this.keyFile, this.box.encrypt(key))
  }
}
