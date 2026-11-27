import { createHash, randomBytes } from 'crypto'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { GOOGLE_AUTH_URL, GOOGLE_SCOPES, GOOGLE_TOKEN_URL } from '@shared/google'

/** RFC 7636: 43–128 chars from the unreserved set; base64url of 32 random bytes = 43 chars */
export function createVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function buildAuthUrl(p: {
  clientId: string
  redirectUri: string
  challenge: string
  state: string
  /** extra scopes on top of the calendar ones, e.g. Drive for device sync */
  extraScopes?: readonly string[]
}): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: [...GOOGLE_SCOPES, ...(p.extraScopes ?? [])].join(' '),
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    state: p.state,
    // offline + consent: always hand out a refresh token, even on reconnect
    access_type: 'offline',
    prompt: 'consent',
    // keep earlier grants when asking for more
    include_granted_scopes: 'true'
  })
  return `${GOOGLE_AUTH_URL}?${q.toString()}`
}

export interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    /** sign-in is no longer valid and must be redone */
    readonly needsReconnect = false
  ) {
    super(message)
  }
}

/** missing scopes in German, or null when everything was granted */
export function missingScopes(granted: string | undefined): string | null {
  if (!granted) return null
  const have = new Set(granted.split(' '))
  const labels: Record<string, string> = {
    [GOOGLE_SCOPES[0]]: 'Kalenderliste',
    [GOOGLE_SCOPES[1]]: 'Termine'
  }
  const missing = GOOGLE_SCOPES.filter((s) => !have.has(s)).map((s) => labels[s])
  return missing.length ? missing.join(' und ') : null
}

async function postToken(body: Record<string, string | undefined>): Promise<TokenResponse> {
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(body)) if (v) form.set(k, v)
  let res: Response
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    })
  } catch {
    throw new GoogleAuthError('Google ist nicht erreichbar. Bist du online?')
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, string>
  if (!res.ok) {
    if (json.error === 'invalid_grant')
      throw new GoogleAuthError(
        'Die Anmeldung bei Google ist abgelaufen oder wurde widerrufen. Bitte neu verbinden.',
        true
      )
    if (json.error === 'invalid_client')
      throw new GoogleAuthError('Client-ID oder Clientschlüssel stimmen nicht. Bitte in den Optionen prüfen.', true)
    throw new GoogleAuthError(
      `Google hat die Anmeldung abgelehnt (${json.error_description ?? json.error ?? res.status}).`
    )
  }
  return json as unknown as TokenResponse
}

export function refreshAccessToken(c: {
  clientId: string
  clientSecret?: string
  refreshToken: string
}): Promise<TokenResponse> {
  return postToken({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: c.refreshToken,
    grant_type: 'refresh_token'
  })
}

const PAGE = (title: string, text: string): string => `<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>Ember Planner</title><style>body{font-family:system-ui,sans-serif;background:#15100e;color:#e9dcd6;display:grid;
place-items:center;height:100vh;margin:0}main{max-width:28rem;text-align:center}h1{color:#e0475b;font-size:1.4rem}</style>
</head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`

/**
 * Runs the installed-app flow: loopback server on 127.0.0.1, system browser, PKCE.
 * Resolves with the tokens once Google redirects back.
 */
export function runLoopbackFlow(opts: {
  clientId: string
  clientSecret?: string
  openBrowser: (url: string) => void
  extraScopes?: readonly string[]
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<TokenResponse> {
  const verifier = createVerifier()
  const state = randomBytes(16).toString('hex')
  let server: Server

  return new Promise<TokenResponse>((resolve, reject) => {
    let done = false
    const finish = (err: Error | null, tokens?: TokenResponse): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      server.close()
      if (err) reject(err)
      else resolve(tokens!)
    }
    const timer = setTimeout(
      () => finish(new GoogleAuthError('Die Anmeldung hat zu lange gedauert. Bitte noch einmal versuchen.')),
      opts.timeoutMs ?? 5 * 60_000
    )
    opts.signal?.addEventListener('abort', () => finish(new GoogleAuthError('Anmeldung abgebrochen.')))

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/') {
        res.writeHead(404).end()
        return
      }
      const reply = (status: number, title: string, text: string): void => {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE(title, text))
      }
      if (url.searchParams.get('state') !== state) {
        reply(400, 'Ungültige Anfrage', 'Diese Antwort gehört nicht zu der Anmeldung aus Ember Planner.')
        return
      }
      const error = url.searchParams.get('error')
      if (error) {
        reply(200, 'Nicht verbunden', 'Du hast den Zugriff nicht erlaubt. Du kannst dieses Fenster schließen.')
        finish(
          new GoogleAuthError(error === 'access_denied' ? 'Zugriff wurde nicht erlaubt.' : `Google meldet: ${error}`)
        )
        return
      }
      const code = url.searchParams.get('code')
      if (!code) {
        reply(400, 'Ungültige Anfrage', 'Es fehlt der Anmeldecode.')
        return
      }
      const { port } = server.address() as AddressInfo
      postToken({
        code,
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        redirect_uri: `http://127.0.0.1:${port}`,
        grant_type: 'authorization_code',
        code_verifier: verifier
      }).then(
        (tokens) => {
          reply(
            200,
            'Verbunden ✓',
            'Ember Planner ist jetzt mit Google Kalender verbunden. Du kannst dieses Fenster schließen.'
          )
          finish(null, tokens)
        },
        (err: Error) => {
          reply(200, 'Nicht verbunden', `${err.message} Du kannst dieses Fenster schließen.`)
          finish(err)
        }
      )
    })

    server.on('error', (err) => finish(err))
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      opts.openBrowser(
        buildAuthUrl({
          clientId: opts.clientId,
          redirectUri: `http://127.0.0.1:${port}`,
          challenge: challengeFor(verifier),
          state,
          extraScopes: opts.extraScopes
        })
      )
    })
  })
}
