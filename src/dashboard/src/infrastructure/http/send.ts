import { HttpError, NetworkError, pathOf } from './HttpError'

const CODE = /^[a-z][a-z0-9_]*$/

interface Answer {
  code?: string
  reason?: string
  traceId?: string
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Whatever shape the API gave its error body, the parts support needs to read. */
async function readAnswer(response: Response): Promise<Answer> {
  let body: Record<string, unknown>
  try {
    body = (await response.clone().json()) as Record<string, unknown>
  } catch {
    return {}
  }
  if (typeof body !== 'object' || body === null) return {}

  const error = text(body.error)
  const code = error && CODE.test(error) ? error : undefined
  const reason =
    text(body.message) ?? text(body.detail) ?? (code ? undefined : error) ?? text(body.title)
  return { code, reason, traceId: text(body.traceId) }
}

/** `fetch`, except that a request that never got an answer says which request it was. */
export async function send(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e)
    throw new NetworkError(`${init.method ?? 'GET'} ${pathOf(url)} · ${cause}`, { cause: e })
  }
}

/** The error for an answer that is not ok, carrying its diagnostic line. */
export async function httpErrorFrom(
  response: Response,
  url: string,
  method = 'GET',
): Promise<HttpError> {
  const answer = await readAnswer(response)
  const status = [String(response.status), response.statusText].filter(Boolean).join(' ')
  const traceId = answer.traceId ? `trace ${answer.traceId}` : undefined
  const diagnostic = [`${method} ${pathOf(url)}`, status, answer.code, answer.reason, traceId]
    .filter(Boolean)
    .join(' · ')
  return new HttpError(response.status, url, diagnostic, answer.code)
}
