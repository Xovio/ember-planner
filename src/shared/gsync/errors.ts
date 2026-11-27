/** Errors of the Google connection, shared by the desktop and the Android app. */

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string
  ) {
    super(message)
  }
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
