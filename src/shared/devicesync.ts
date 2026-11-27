/** Device sync over the Google account (docs/SYNC.md): what the UI sees and can do. */

export interface DeviceInfo {
  id: string
  name: string
  /** last upload of that device (ISO) */
  savedAt: string
  self: boolean
}

export interface DeviceSyncStatus {
  enabled: boolean
  running: boolean
  /** Google is connected at all */
  googleConnected: boolean
  /** the Drive permission is still missing: the user has to allow it once */
  needsGrant: boolean
  /** the synced data is encrypted, but this device does not know the passphrase yet */
  needsPassphrase: boolean
  encrypted: boolean
  deviceId: string
  deviceName: string
  devices: DeviceInfo[]
  /** last successful sync (ISO) */
  lastSync?: string
  /** last problem in plain German */
  error?: string
}

export type DeviceSyncResult<T> = { ok: true; value: T } | { ok: false; error: string }

export interface DeviceSyncApi {
  status(): Promise<DeviceSyncStatus>
  setEnabled(enabled: boolean): Promise<DeviceSyncResult<DeviceSyncStatus>>
  /** opens the Google sign-in to allow the Drive folder */
  grant(): Promise<DeviceSyncResult<DeviceSyncStatus>>
  syncNow(): Promise<DeviceSyncResult<DeviceSyncStatus>>
  setName(name: string): Promise<DeviceSyncResult<DeviceSyncStatus>>
  /** removes another device's file from Drive */
  removeDevice(id: string): Promise<DeviceSyncResult<DeviceSyncStatus>>
  /** switches encryption on (or changes the passphrase); null switches it off */
  setPassphrase(passphrase: string | null): Promise<DeviceSyncResult<DeviceSyncStatus>>
  /** unlocks data another device encrypted */
  unlock(passphrase: string): Promise<DeviceSyncResult<DeviceSyncStatus>>
  /** deletes all sync data in Google Drive; local data stays */
  wipe(): Promise<DeviceSyncResult<DeviceSyncStatus>>
  onStatus(cb: (s: DeviceSyncStatus) => void): () => void
}

/** the passphrase needs some length, everything else is up to the user */
export const MIN_PASSPHRASE = 8
