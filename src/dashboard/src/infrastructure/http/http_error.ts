/** The path a request went to, without origin or query: enough to name it, never a token. */
export function pathOf(url: string): string {
  try {
    return new URL(url, 'http://local').pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

/** What a failed answer said, kept whole so the screen can show it to support (SPECS 1.5). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly diagnostic: string,
    /** The error code the API named, when it named one: what the interface branches on. */
    public readonly code?: string,
  ) {
    super(`HTTP ${status} on ${url}`)
    this.name = 'HttpError'
  }
}

/** The request never got an answer. Still a TypeError, which is how a failed fetch reads. */
export class NetworkError extends TypeError {
  constructor(
    public readonly diagnostic: string,
    options?: { cause?: unknown },
  ) {
    super(diagnostic, options)
    this.name = 'NetworkError'
  }
}
