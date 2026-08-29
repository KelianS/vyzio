import type { AccessState, CurrentSession } from '../../domain/entities/Access'
import type { AccessRepository } from '../../domain/ports/AccessRepository'
import { fetchJson, postJson } from '../http/fetchJson'
import { HttpError } from '../http/HttpError'

export class HttpAccessRepository implements AccessRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getState(): Promise<AccessState> {
    return fetchJson<AccessState>(`${this.apiBaseUrl}/api/access/state`)
  }

  async getCurrentSession(): Promise<CurrentSession | null> {
    try {
      return await fetchJson<CurrentSession>(this.sessionUrl)
    } catch (error) {
      // Personne n'est connecte : c'est l'etat courant, pas une panne. Le reste en est une.
      if (error instanceof HttpError && error.status === 401) return null
      throw error
    }
  }

  async createOwner(password: string): Promise<CurrentSession> {
    return postJson<CurrentSession>(`${this.apiBaseUrl}/api/access/account`, { password })
  }

  async signIn(password: string): Promise<CurrentSession | null> {
    try {
      return await postJson<CurrentSession>(this.sessionUrl, { password })
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) return null
      throw error
    }
  }

  async signOut(): Promise<void> {
    await this.close(this.sessionUrl)
  }

  async signOutEverywhere(): Promise<void> {
    await this.close(`${this.apiBaseUrl}/api/access/sessions`)
  }

  /** Se deconnecter n'echoue pas : un cookie deja mort repart avec la meme reponse. */
  private async close(url: string): Promise<void> {
    const response = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } })
    if (!response.ok && response.status !== 401) throw new HttpError(response.status, url)
  }

  private get sessionUrl() {
    return `${this.apiBaseUrl}/api/access/session`
  }
}
