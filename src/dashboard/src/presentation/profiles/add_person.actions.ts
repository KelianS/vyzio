import type { ProfileAlertMode, ProfileCategory } from '../../domain/entities/profile.entity'

export type AddPersonAction =
  | { type: 'NAME_SET'; name: string }
  | { type: 'CATEGORY_SET'; category: ProfileCategory }
  | { type: 'ALERT_MODE_SET'; alertMode: ProfileAlertMode }
  | { type: 'CREATE_STARTED' }
  | { type: 'CREATE_FINISHED' }
