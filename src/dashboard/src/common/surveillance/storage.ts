import type { SystemStats } from '../../domain/entities/system_stats.entity'

type Storage = NonNullable<SystemStats['storage']>

/** The share of the disk in use, 0 when its size is unknown. */
export function storageUsedRatio(storage: Storage): number {
  return storage.totalGb > 0 ? storage.usedGb / storage.totalGb : 0
}

/** Past this share the disk is almost full: the panel draws it as a warning and the bar raises it (HIST-01). */
export function isStorageCritical(storage: Storage): boolean {
  return storageUsedRatio(storage) > 0.9
}
