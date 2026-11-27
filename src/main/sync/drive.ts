import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'

const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

export interface DriveFile {
  id: string
  name: string
  modifiedTime?: string
}

/** the part of GoogleAccount the Drive client needs */
export interface DriveRequester {
  request<T>(url: string, init?: RequestInit): Promise<T>
}

/** Minimal client for the hidden app folder (`appDataFolder`) in Google Drive. */
export class AppFolder {
  constructor(private readonly google: DriveRequester) {}

  async list(): Promise<DriveFile[]> {
    const out: DriveFile[] = []
    let pageToken: string | undefined
    do {
      const q = new URLSearchParams({
        spaces: 'appDataFolder',
        fields: 'nextPageToken,files(id,name,modifiedTime)',
        pageSize: '1000',
        ...(pageToken ? { pageToken } : {})
      })
      const page = await this.google.request<{ files?: DriveFile[]; nextPageToken?: string }>(`${FILES}?${q}`)
      out.push(...(page.files ?? []))
      pageToken = page.nextPageToken
    } while (pageToken)
    return out
  }

  /** file contents parsed as JSON */
  read<T>(id: string): Promise<T> {
    return this.google.request<T>(`${FILES}/${encodeURIComponent(id)}?alt=media`)
  }

  async create(name: string, content: unknown): Promise<string> {
    const boundary = `ember${randomBytes(8).toString('hex')}`
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, parents: ['appDataFolder'] }) +
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(content) +
      `\r\n--${boundary}--`
    const res = await this.google.request<{ id: string }>(`${UPLOAD}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    })
    return res.id
  }

  async update(id: string, content: unknown): Promise<void> {
    await this.google.request(`${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(content)
    })
  }

  async remove(id: string): Promise<void> {
    await this.google.request(`${FILES}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }
}

/* ── optional encryption ── */

/** stored in the shared meta file; lets every device check a passphrase without seeing any data */
export interface EncryptionInfo {
  salt: string
  iterations: number
  /** a fixed text encrypted with the key */
  check: Sealed
}

/** an encrypted JSON value */
export interface Sealed {
  enc: 'aes-256-gcm'
  iv: string
  tag: string
  data: string
}

const CHECK_TEXT = 'ember-planner-sync'
const ITERATIONS = 210_000

export function isSealed(x: unknown): x is Sealed {
  return !!x && typeof x === 'object' && (x as Sealed).enc === 'aes-256-gcm'
}

export function deriveKey(passphrase: string, salt: string, iterations = ITERATIONS): Buffer {
  return pbkdf2Sync(passphrase.normalize('NFC'), Buffer.from(salt, 'base64'), iterations, 32, 'sha256')
}

export function seal(key: Buffer, value: unknown): Sealed {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return { enc: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
}

/** throws if the key is wrong or the data was changed */
export function open<T>(key: Buffer, sealed: Sealed): T {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'))
  const plain = Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()])
  return JSON.parse(plain.toString('utf8')) as T
}

/** new encryption settings for a passphrase, plus the key */
export function newEncryption(passphrase: string): { info: EncryptionInfo; key: Buffer } {
  const salt = randomBytes(16).toString('base64')
  const key = deriveKey(passphrase, salt)
  return { info: { salt, iterations: ITERATIONS, check: seal(key, CHECK_TEXT) }, key }
}

/** the key if the passphrase fits, otherwise null */
export function unlockKey(info: EncryptionInfo, passphrase: string): Buffer | null {
  const key = deriveKey(passphrase, info.salt, info.iterations)
  return keyFits(info, key) ? key : null
}

export function keyFits(info: EncryptionInfo, key: Buffer): boolean {
  try {
    return open<string>(key, info.check) === CHECK_TEXT
  } catch {
    return false
  }
}
