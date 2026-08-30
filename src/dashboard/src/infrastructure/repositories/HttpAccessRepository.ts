import type {
  AccessState,
  CurrentSession,
  PasswordChangeResult,
} from '../../domain/entities/Access'
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
      // Nobody is signed in: that is the current state, not a failure. Anything else is one.
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

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<PasswordChangeResult> {
    const url = `${this.apiBaseUrl}/api/access/password`
    const response = await fetch(url, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    if (response.ok) return 'changed'

    // Deliberately outside `fetchJson`: a wrong current password is read beside the field, and must
    // never be confused with the session ending, which is what a 401 signals.
    if (response.status === 400) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (body?.error === 'wrong_password') return 'wrong-password'
    }
    throw new HttpError(response.status, url)
  }

  async signOut(): Promise<void> {
    await this.close(this.sessionUrl)
  }

  async signOutEverywhere(): Promise<void> {
    await this.close(`${this.apiBaseUrl}/api/access/sessions`)
  }

  /** Signing out never fails: an already dead cookie leaves with the same answer. */
  private async close(url: string): Promise<void> {
    const response = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } })
    if (!response.ok && response.status !== 401) throw new HttpError(response.status, url)
  }

  private get sessionUrl() {
    return `${this.apiBaseUrl}/api/access/session`
  }
}
