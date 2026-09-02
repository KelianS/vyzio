export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    /** What the server said went wrong, when it said something the user can act on. */
    public readonly detail?: string,
  ) {
    super(detail ?? `HTTP ${status} on ${url}`)
    this.name = 'HttpError'
  }
}
