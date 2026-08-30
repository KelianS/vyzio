import { HttpError } from './HttpError'
import { reportSessionLost } from './sessionLost'

/** One place knows that a 401 is a fact about the interface, not one more error. */
function failed(response: Response, url: string): HttpError {
  if (response.status === 401) reportSessionLost(url)
  return new HttpError(response.status, url)
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw failed(response, url)
  return response.json() as Promise<T>
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw failed(response, url)
  return parseJsonBody(response) as Promise<T>
}

export async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw failed(response, url)
  return parseJsonBody(response) as Promise<T>
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw failed(response, url)
  return parseJsonBody(response) as Promise<T>
}

export async function deleteReq(url: string): Promise<void> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw failed(response, url)
}

export async function deleteJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw failed(response, url)
  return parseJsonBody(response) as Promise<T>
}

async function parseJsonBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const payload = await response.text()
  if (!payload.trim()) return null
  return JSON.parse(payload)
}
