import { HttpError, NetworkError, pathOf } from './http_error'

interface Answer {
  code?: string
  detail?: string
  traceId?: string
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** The API answers every error as a ProblemDetails (BACKEND-18); a proxy in between may answer anything. */
async function readAnswer(response: Response): Promise<Answer> {
  let body: unknown
  try {
    body = await response.clone().json()
  } catch {
    return {}
  }
  if (typeof body !== 'object' || body === null) return {}

  const problem = body as Record<string, unknown>
  return {
    code: text(problem.code),
    detail: text(problem.detail),
    traceId: text(problem.traceId),
  }
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
  const diagnostic = [`${method} ${pathOf(url)}`, status, answer.code, answer.detail, traceId]
    .filter(Boolean)
    .join(' · ')
  return new HttpError(response.status, url, diagnostic, answer.code)
}
