import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { GoogleSyncFile, GoogleSyncStorage } from '@shared/gsync/sync'

/** sync tokens and unsent changes of the Google calendar sync in `google-sync.json` */
export class FileGoogleSyncStorage implements GoogleSyncStorage {
  private readonly file: string

  constructor(dir: string) {
    this.file = join(dir, 'google-sync.json')
  }

  load(): GoogleSyncFile | null {
    if (!existsSync(this.file)) return null
    return JSON.parse(readFileSync(this.file, 'utf8')) as GoogleSyncFile
  }

  save(content: GoogleSyncFile): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(content, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }
}
