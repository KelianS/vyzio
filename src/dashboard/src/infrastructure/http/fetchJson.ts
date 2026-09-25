import type { HttpError } from './HttpError'
import { httpErrorFrom, send } from './send'
import { reportSessionLost } from './sessionLost'

/** One place knows that a 401 is a fact about the interface, not one more error. */
async function failed(response: Response, url: string, method: string): Promise<HttpError> {
  if (response.status === 401) reportSessionLost(url)
  return httpErrorFrom(response, url, method)
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await send(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw await failed(response, url, 'GET')
  return response.json() as Promise<T>
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await send(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw await failed(response, url, 'POST')
  return parseJsonBody(response) as Promise<T>
}

export async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await send(url, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await failed(response, url, 'PUT')
  return parseJsonBody(response) as Promise<T>
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await send(url, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await failed(response, url, 'PATCH')
  return parseJsonBody(response) as Promise<T>
}

export async function deleteReq(url: string): Promise<void> {
  const response = await send(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw await failed(response, url, 'DELETE')
}

export async function deleteJson<T>(url: string): Promise<T> {
  const response = await send(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw await failed(response, url, 'DELETE')
  return parseJsonBody(response) as Promise<T>
}

async function parseJsonBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const payload = await response.text()
  if (!payload.trim()) return null
  return JSON.parse(payload)
}
