import type { StateCreator } from 'zustand'
import type { SystemStats } from '../../../domain/entities/system_stats.entity'
import type { GetSystemStats } from '../../../domain/usecases/get_system_stats.use_case'

export interface SystemStatsSlice {
  systemStats: SystemStats | null
  loadSystemStats: (getSystemStats: GetSystemStats) => Promise<void>
}

/** Cross-screen Frigate/system status — shared by Hub, Cameras and the LiveFeed modal. */
export const createSystemStatsSlice: StateCreator<SystemStatsSlice> = (set) => ({
  systemStats: null,
  loadSystemStats: async (getSystemStats) => {
    try {
      const systemStats = await getSystemStats.execute()
      set({ systemStats })
    } catch {
      // Polling failure is silently ignored — the next poll retries (ADR-33).
    }
  },
})
