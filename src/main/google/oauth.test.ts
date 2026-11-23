import { afterEach, describe, expect, it, vi } from 'vitest'
import { GOOGLE_SCOPES, GOOGLE_TOKEN_URL } from '@shared/google'
import { buildAuthUrl, challengeFor, createVerifier, missingScopes, runLoopbackFlow } from './oauth'

const realFetch = globalThis.fetch

/** lets requests to the local loopback server through, answers Google's token endpoint */
function mockTokenEndpoint(reply: (body: URLSearchParams) => { status: number; json: unknown }) {
  const calls: URLSearchParams[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    if (url !== GOOGLE_TOKEN_URL) return realFetch(input, init)
    const body = new URLSearchParams(String(init?.body))
    calls.push(body)
    const r = reply(body)
    return new Response(JSON.stringify(r.json), { status: r.status })
  })
  return calls
}

afterEach(() => vi.restoreAllMocks())

describe('PKCE', () => {
  it('matches the RFC 7636 example', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    )
  })

  it('creates verifiers of valid length and charset', () => {
    const v = createVerifier()
    expect(v).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
    expect(createVerifier()).not.toBe(v)
  })

  it('builds the consent URL with offline access and both scopes', () => {
    const url = new URL(
      buildAuthUrl({
        clientId: 'id.apps.googleusercontent.com',
        redirectUri: 'http://127.0.0.1:5000',
        challenge: 'c',
        state: 's'
      })
    )
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('scope')).toBe(GOOGLE_SCOPES.join(' '))
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
  })
})

describe('missingScopes', () => {
  it('names scopes the user unticked', () => {
    expect(missingScopes(GOOGLE_SCOPES.join(' '))).toBeNull()
    expect(missingScopes(GOOGLE_SCOPES[0])).toBe('Termine')
    expect(missingScopes('openid')).toBe('Kalenderliste und Termine')
  })
})

describe('runLoopbackFlow', () => {
  it('receives the code on 127.0.0.1 and exchanges it with the verifier', async () => {
    const calls = mockTokenEndpoint(() => ({
      status: 200,
      json: { access_token: 'at', expires_in: 3600, refresh_token: 'rt', scope: GOOGLE_SCOPES.join(' ') }
    }))
    let page = ''
    const tokens = await runLoopbackFlow({
      clientId: 'id.apps.googleusercontent.com',
      clientSecret: 'secret',
      openBrowser: (authUrl) => {
        const u = new URL(authUrl)
        const redirect = u.searchParams.get('redirect_uri')!
        expect(redirect).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
        // simulate Google redirecting the browser back
        void realFetch(`${redirect}/?code=the-code&state=${u.searchParams.get('state')}`).then(async (r) => {
          page = await r.text()
        })
      }
    })
    expect(tokens.refresh_token).toBe('rt')
    expect(calls).toHaveLength(1)
    expect(calls[0].get('code')).toBe('the-code')
    expect(calls[0].get('client_secret')).toBe('secret')
    expect(calls[0].get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    await vi.waitFor(() => expect(page).toContain('Verbunden'))
  })

  it('rejects a redirect with a foreign state and keeps waiting', async () => {
    mockTokenEndpoint(() => ({ status: 500, json: {} }))
    const ctrl = new AbortController()
    const statuses: number[] = []
    const flow = runLoopbackFlow({
      clientId: 'x.apps.googleusercontent.com',
      signal: ctrl.signal,
      openBrowser: (authUrl) => {
        const redirect = new URL(authUrl).searchParams.get('redirect_uri')!
        void realFetch(`${redirect}/?code=evil&state=wrong`).then((r) => {
          statuses.push(r.status)
          ctrl.abort()
        })
      }
    })
    await expect(flow).rejects.toThrow('abgebrochen')
    expect(statuses).toEqual([400])
  })

  it('reports a denied consent', async () => {
    const flow = runLoopbackFlow({
      clientId: 'x.apps.googleusercontent.com',
      openBrowser: (authUrl) => {
        const u = new URL(authUrl)
        void realFetch(
          `${u.searchParams.get('redirect_uri')}/?error=access_denied&state=${u.searchParams.get('state')}`
        )
      }
    })
    await expect(flow).rejects.toThrow('nicht erlaubt')
  })
})
