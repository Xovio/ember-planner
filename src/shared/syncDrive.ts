/**
 * Google Drive app folder and optional encryption for device sync (docs/SYNC.md).
 * Uses only web APIs (fetch via the account, Web Crypto), so the desktop and the Android app share it.
 */

const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

export interface DriveFile {
  id: string
  name: string
  modifiedTime?: string
}

/** the part of the Google account the Drive client needs */
export interface DriveRequester {
  request<T>(url: string, init?: RequestInit): Promise<T>
}

const randomHex = (bytes: number): string =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')

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
    const boundary = `ember${randomHex(8)}`
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

/** an encrypted JSON value (AES-256-GCM, 12-byte IV, 16-byte tag, all base64) */
export interface Sealed {
  enc: 'aes-256-gcm'
  iv: string
  tag: string
  data: string
}

/** raw 32-byte key */
export type SyncKey = Uint8Array<ArrayBuffer>

const CHECK_TEXT = 'ember-planner-sync'
const ITERATIONS = 210_000
const TAG_BYTES = 16

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

const utf8 = new TextEncoder()

export function isSealed(x: unknown): x is Sealed {
  return !!x && typeof x === 'object' && (x as Sealed).enc === 'aes-256-gcm'
}

export async function deriveKey(passphrase: string, salt: string, iterations = ITERATIONS): Promise<SyncKey> {
  const base = await crypto.subtle.importKey('raw', utf8.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations },
    base,
    256
  )
  return new Uint8Array(bits)
}

const aesKey = (key: SyncKey, use: KeyUsage): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', key, 'AES-GCM', false, [use])

export async function seal(key: SyncKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const out = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(key, 'encrypt'), utf8.encode(JSON.stringify(value)))
  )
  return {
    enc: 'aes-256-gcm',
    iv: toBase64(iv),
    tag: toBase64(out.subarray(out.length - TAG_BYTES)),
    data: toBase64(out.subarray(0, out.length - TAG_BYTES))
  }
}

/** rejects if the key is wrong or the data was changed */
export async function open<T>(key: SyncKey, sealed: Sealed): Promise<T> {
  const data = fromBase64(sealed.data)
  const tag = fromBase64(sealed.tag)
  const joined = new Uint8Array(data.length + tag.length)
  joined.set(data)
  joined.set(tag, data.length)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv) },
    await aesKey(key, 'decrypt'),
    joined
  )
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

/** new encryption settings for a passphrase, plus the key */
export async function newEncryption(passphrase: string): Promise<{ info: EncryptionInfo; key: SyncKey }> {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)))
  const key = await deriveKey(passphrase, salt)
  return { info: { salt, iterations: ITERATIONS, check: await seal(key, CHECK_TEXT) }, key }
}

/** the key if the passphrase fits, otherwise null */
export async function unlockKey(info: EncryptionInfo, passphrase: string): Promise<SyncKey | null> {
  const key = await deriveKey(passphrase, info.salt, info.iterations)
  return (await keyFits(info, key)) ? key : null
}

export async function keyFits(info: EncryptionInfo, key: SyncKey): Promise<boolean> {
  try {
    return (await open<string>(key, info.check)) === CHECK_TEXT
  } catch {
    return false
  }
}

/** SHA-256 of a text, base64 */
export async function sha256(text: string): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(text))))
}
