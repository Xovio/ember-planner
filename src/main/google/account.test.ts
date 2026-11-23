import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GOOGLE_TOKEN_URL } from '@shared/google'
import { GoogleAccount, type SecretBox } from './account'

/** reversible stand-in for safeStorage */
const box: SecretBox = {
  available: () => true,
  encrypt: (s) => Buffer.from(Buffer.from(s).toString('base64').split('').reverse().join('')),
  decrypt: (b) => Buffer.from(b.toString().split('').reverse().join(''), 'base64').toString()
}

let dir = ''
const make = (onStatus = vi.fn()) => new GoogleAccount({ dir, box, openBrowser: vi.fn(), onStatus })

type Handler = (url: string, init?: RequestInit) => { status: number; json?: unknown }
function mockFetch(handler: Handler) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const r = handler(String(input), init)
    return new Response(r.status === 204 ? null : JSON.stringify(r.json ?? {}), { status: r.status })
  })
}

/** account that looks connected without running the browser flow */
function connectedAccount(): GoogleAccount {
  const a = make()
  a.configure('123-abc.apps.googleusercontent.com', 'sec')
  // simulate a finished sign-in
  ;(a as unknown as { creds: object }).creds = {
    clientId: '123-abc.apps.googleusercontent.com',
    clientSecret: 'sec',
    refreshToken: 'rt',
    account: 'me@example.com'
  }
  return a
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ember-google-'))
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
})

describe('GoogleAccount setup', () => {
  it('starts unconfigured and validates the client id', () => {
    const a = make()
    expect(a.status().state).toBe('unconfigured')
    expect(() => a.configure('quatsch')).toThrow('Client-ID')
  })

  it('stores credentials encrypted and reads them back', () => {
    const onStatus = vi.fn()
    make(onStatus).configure(' 123-abc.apps.googleusercontent.com ', 'GOCSPX-geheim')
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ state: 'disconnected' }))

    const raw = readFileSync(join(dir, 'google-auth.bin')).toString()
    expect(raw).not.toContain('geheim')
    expect(make().status()).toEqual({ state: 'disconnected', clientId: '123-abc.apps.googleusercontent.com', account: undefined, error: undefined })
  })

  it('refuses to store without OS encryption', () => {
    const a = new GoogleAccount({ dir, box: { ...box, available: () => false }, openBrowser: vi.fn() })
    expect(() => a.configure('123-abc.apps.googleusercontent.com')).toThrow('Verschlüsselung')
  })
})

describe('GoogleAccount API calls', () => {
  it('refreshes the access token once and reuses it', async () => {
    const a = connectedAccount()
    let refreshes = 0
    mockFetch((url, init) => {
      if (url === GOOGLE_TOKEN_URL) {
        refreshes++
        expect(new URLSearchParams(String(init?.body)).get('refresh_token')).toBe('rt')
        return { status: 200, json: { access_token: 'at1', expires_in: 3600 } }
      }
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer at1')
      return { status: 200, json: { items: [] } }
    })
    await a.listCalendars()
    await a.listCalendars()
    expect(refreshes).toBe(1)
  })

  it('drops the sign-in when Google says invalid_grant', async () => {
    const onStatus = vi.fn()
    const a = new GoogleAccount({ dir, box, openBrowser: vi.fn(), onStatus })
    a.configure('123-abc.apps.googleusercontent.com')
    ;(a as unknown as { creds: { refreshToken?: string } }).creds.refreshToken = 'rt'
    mockFetch(() => ({ status: 400, json: { error: 'invalid_grant' } }))

    await expect(a.listCalendars()).rejects.toThrow('abgelaufen')
    expect(a.status().state).toBe('disconnected')
    expect(a.status().error).toContain('abgelaufen')
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'disconnected' }))
  })

  it('pages through the calendar list and sorts primary, own, shared', async () => {
    const a = connectedAccount()
    mockFetch((url) => {
      if (url === GOOGLE_TOKEN_URL) return { status: 200, json: { access_token: 'at', expires_in: 3600 } }
      const page = new URL(url).searchParams.get('pageToken')
      if (!page)
        return {
          status: 200,
          json: {
            nextPageToken: 'p2',
            items: [
              { id: 'feiertage', summary: 'Feiertage', accessRole: 'reader', backgroundColor: '#16a765' },
              { id: 'me@example.com', summary: 'Ich', accessRole: 'owner', primary: true }
            ]
          }
        }
      return {
        status: 200,
        json: {
          items: [
            { id: 'dnd', summary: 'DnD', summaryOverride: 'DnD-Runde', accessRole: 'owner', defaultReminders: [{ method: 'popup', minutes: 30 }, { method: 'email', minutes: 60 }] },
            { id: 'old', summary: 'Alt', accessRole: 'owner', deleted: true }
          ]
        }
      }
    })
    const list = await a.listCalendars()
    expect(list.map((c) => c.name)).toEqual(['Ich', 'DnD-Runde', 'Feiertage'])
    expect(list[1].defaultReminders).toEqual([30])
  })

  it('explains a disabled Calendar API', async () => {
    const a = connectedAccount()
    mockFetch((url) =>
      url === GOOGLE_TOKEN_URL
        ? { status: 200, json: { access_token: 'at', expires_in: 3600 } }
        : { status: 403, json: { error: { message: 'x', errors: [{ reason: 'accessNotConfigured' }] } } }
    )
    await expect(a.listCalendars()).rejects.toThrow('nicht aktiviert')
  })

  it('disconnect revokes the token, keeps the client id', async () => {
    const a = connectedAccount()
    const fetchSpy = mockFetch(() => ({ status: 200, json: {} }))
    const s = await a.disconnect()
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/revoke')
    expect(s.state).toBe('disconnected')
    expect(s.clientId).toBe('123-abc.apps.googleusercontent.com')

    await a.reset()
    expect(existsSync(join(dir, 'google-auth.bin'))).toBe(false)
    expect(a.status().state).toBe('unconfigured')
  })
})
