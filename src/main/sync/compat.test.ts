import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { deriveKey, open, seal, toBase64, unlockKey, type Sealed } from '@shared/syncDrive'
import { FileSyncStorage } from './storage'

/** the Node-only implementation from before the move to Web Crypto (v0.8 dev builds) */
const legacy = {
  key: (pass: string, salt: string, it: number): Buffer =>
    pbkdf2Sync(pass.normalize('NFC'), Buffer.from(salt, 'base64'), it, 32, 'sha256'),
  seal(key: Buffer, value: unknown): Sealed {
    const iv = randomBytes(12)
    const c = createCipheriv('aes-256-gcm', key, iv)
    const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()])
    return { enc: 'aes-256-gcm', iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }
  },
  open(key: Buffer, s: Sealed): unknown {
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(s.iv, 'base64'))
    d.setAuthTag(Buffer.from(s.tag, 'base64'))
    return JSON.parse(Buffer.concat([d.update(Buffer.from(s.data, 'base64')), d.final()]).toString('utf8'))
  }
}

describe('encryption stays compatible', () => {
  const salt = randomBytes(16).toString('base64')

  it('derives the same key as before', async () => {
    const web = await deriveKey('korrekt pferd', salt, 1000)
    expect(toBase64(web)).toBe(legacy.key('korrekt pferd', salt, 1000).toString('base64'))
  })

  it('reads what the old code wrote, and the other way round', async () => {
    const key = legacy.key('korrekt pferd', salt, 1000)
    const old = legacy.seal(key, { todos: ['ä', 'ö'] })
    expect(await open(new Uint8Array(key), old)).toEqual({ todos: ['ä', 'ö'] })
    const fresh = await seal(new Uint8Array(key), { x: 1 })
    expect(legacy.open(key, fresh)).toEqual({ x: 1 })
  })

  it('accepts the passphrase for old encryption settings', async () => {
    const key = legacy.key('korrekt pferd', salt, 1000)
    const info = { salt, iterations: 1000, check: legacy.seal(key, 'ember-planner-sync') }
    expect(await unlockKey(info, 'korrekt pferd')).not.toBeNull()
    expect(await unlockKey(info, 'falsch')).toBeNull()
  })
})

describe('FileSyncStorage', () => {
  it('keeps config and key across instances and removes the key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ember-store-'))
    const box = {
      available: () => true,
      encrypt: (s: string) => Buffer.from(s.split('').reverse().join(''), 'utf8'),
      decrypt: (b: Buffer) => b.toString('utf8').split('').reverse().join('')
    }
    try {
      const a = new FileSyncStorage(dir, box)
      expect(a.loadConfig()).toBeNull()
      a.saveConfig({ enabled: true, name: 'PC' })
      a.saveKey('c2VjcmV0')
      const b = new FileSyncStorage(dir, box)
      expect(b.loadConfig()).toEqual({ enabled: true, name: 'PC' })
      expect(b.loadKey()).toBe('c2VjcmV0')
      b.saveKey(null)
      expect(new FileSyncStorage(dir, box).loadKey()).toBeNull()
      expect(() => new FileSyncStorage(dir, { ...box, available: () => false }).saveKey('x')).toThrow('Verschlüsselung')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
