import type { Profile } from '../domain/entities/profile.entity'
import type { ProfilePhoto } from '../domain/entities/profile_photo.entity'

/** A known person as the screens read them, for tests; each test overrides only what it is about. */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'person-1',
    name: 'Alice',
    category: 'family',
    alertMode: 'always',
    lastSeenAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** One photo of a known person, for tests. */
export function makeProfilePhoto(overrides: Partial<ProfilePhoto> = {}): ProfilePhoto {
  return {
    id: 'photo-1',
    profileId: 'person-1',
    filename: 'alice-1.jpg',
    frigateSynced: true,
    syncedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
