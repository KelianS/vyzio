import { vi } from 'vitest'

interface FakeAnswer {
  readonly status?: number
  readonly body?: unknown
  readonly delayMs?: number
}

interface SentRequest {
  readonly route: string
  readonly query: string
  readonly body: unknown
}

function parsed(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') return body
  try {
    return JSON.parse(body)
  } catch {
    // A body that is not JSON stays readable as sent, rather than failing inside the fake.
    return body
  }
}

export function ok(body?: unknown): FakeAnswer {
  return { status: 200, body }
}

/** The same answer, sent after a delay, as a slow camera would. */
export function late(answer: FakeAnswer, delayMs: number): FakeAnswer {
  return { ...answer, delayMs }
}

export function failure(status: number, error?: string, message?: string): FakeAnswer {
  return { status, body: { error, message } }
}

/**
 * Replaces `fetch` for one test: each route is `"METHOD /path"`, the query string ignored. A route
 * nobody declared answers 501 and names itself, so a missing fake reads as such in the failure.
 */
export function fakeNetwork(routes: Record<string, FakeAnswer>) {
  const table = new Map(Object.entries(routes))
  const sent: SentRequest[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://vyzio.test')
      const route = `${init.method ?? 'GET'} ${url.pathname}`
      const body = parsed(init.body)
      sent.push({ route, query: url.search, body })

      const answer = table.get(route) ?? failure(501, 'no_fake', `no fake answer for ${route}`)
      if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs))
      const status = answer.status ?? 200
      return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )

  return {
    /** What the screen sent, in order. */
    sent,
    /** Changes one route's answer from now on, as the backend would after a write. */
    answer(route: string, answer: FakeAnswer) {
      table.set(route, answer)
    },
  }
}
