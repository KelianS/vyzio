import type { StateCreator } from 'zustand'
import { AppErrorKind } from '../../../common/errors/app_error'
import { toAppError } from '../../../common/errors/to_app_error'
import type { SystemStats } from '../../../domain/entities/system_stats.entity'
import type { GetSystemStats } from '../../../domain/usecases/get_system_stats.use_case'

export interface SystemStatsSlice {
  systemStats: SystemStats | null
  /** The last read could not reach Vyzio at all: the bar says so until one does (UI-30, UI-34). */
  hubLost: boolean
  loadSystemStats: (getSystemStats: GetSystemStats) => Promise<void>
}

/** Cross-screen system status, polled by the shell for every screen. */
export const createSystemStatsSlice: StateCreator<SystemStatsSlice> = (set) => ({
  systemStats: null,
  hubLost: false,
  loadSystemStats: async (getSystemStats) => {
    try {
      const systemStats = await getSystemStats.execute()
      set({ systemStats, hubLost: false })
    } catch (e) {
      // Only an unanswered read is a lost hub; an answered failure waits for the next poll (ADR-02).
      set({ hubLost: toAppError(e).kind === AppErrorKind.Network })
    }
  },
})
