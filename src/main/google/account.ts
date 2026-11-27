import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DRIVE_SCOPE, type GoogleStatus } from '@shared/google'
import { GoogleClient, type CredentialStore, type GoogleCredentials } from '@shared/gsync/client'
import { GoogleAuthError } from '@shared/gsync/errors'
import { runLoopbackFlow } from './oauth'

export { GoogleApiError } from '@shared/gsync/errors'

export interface SecretBox {
  available(): boolean
  encrypt(plain: string): Buffer
  decrypt(data: Buffer): string
}

export interface AccountDeps {
  dir: string
  box: SecretBox
  openBrowser(url: string): void
  onStatus?(status: GoogleStatus): void
}

/** credentials in `google-auth.bin`, encrypted by Windows (safeStorage) */
class FileCredentialStore implements CredentialStore {
  constructor(
    private readonly file: string,
    private readonly box: SecretBox
  ) {}

  load(): GoogleCredentials | null {
    if (!existsSync(this.file)) return null
    return JSON.parse(this.box.decrypt(readFileSync(this.file))) as GoogleCredentials
  }

  save(creds: GoogleCredentials | null): void {
    if (!creds) {
      rmSync(this.file, { force: true })
      return
    }
    if (!this.box.available()) {
      throw new GoogleAuthError('Windows stellt keine Verschlüsselung bereit – die Anmeldung kann nicht sicher gespeichert werden.')
    }
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, this.box.encrypt(JSON.stringify(creds)))
    renameSync(tmp, this.file)
  }
}

/** The desktop's Google account: the shared client plus sign-in through the system browser. */
export class GoogleAccount extends GoogleClient {
  private connecting: AbortController | null = null

  constructor(private readonly deps: AccountDeps) {
    super(new FileCredentialStore(join(deps.dir, 'google-auth.bin'), deps.box), deps.onStatus)
  }

  override status(): GoogleStatus {
    const s = super.status()
    return this.connecting ? { ...s, state: 'connecting' } : s
  }

  /**
   * Opens the Google sign-in. `drive` also asks for the hidden Drive folder (device sync);
   * by default a reconnect keeps whatever was granted before.
   */
  async connect(opts: { drive?: boolean } = {}): Promise<GoogleStatus> {
    const drive = opts.drive ?? this.hasDrive
    const c = this.creds
    if (!c) throw new GoogleAuthError('Bitte zuerst Client-ID eintragen.')
    this.connecting?.abort()
    const ctrl = new AbortController()
    this.connecting = ctrl
    this.error = undefined
    this.emit()
    try {
      const tokens = await runLoopbackFlow({
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        openBrowser: this.deps.openBrowser,
        extraScopes: drive ? [DRIVE_SCOPE] : [],
        signal: ctrl.signal
      })
      this.signedIn(tokens)
      this.creds!.account = await this.fetchAccount().catch(() => undefined)
      this.write()
    } catch (err) {
      if (this.connecting === ctrl) this.error = (err as Error).message
    } finally {
      if (this.connecting === ctrl) this.connecting = null
    }
    return this.emit()
  }

  cancelConnect(): GoogleStatus {
    this.connecting?.abort()
    return this.status()
  }
}
