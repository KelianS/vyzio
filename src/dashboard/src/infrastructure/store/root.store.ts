import { create } from 'zustand'
import { createCamerasSlice, type CamerasSlice } from './slices/cameras.slice'
import { createSystemStatsSlice, type SystemStatsSlice } from './slices/system_stats.slice'
import {
  createSurveillanceRestartSlice,
  type SurveillanceRestartSlice,
} from './slices/surveillance_restart.slice'
import {
  createNavigationGuardSlice,
  type NavigationGuardSlice,
} from './slices/navigation_guard.slice'

export type RootStore = CamerasSlice &
  SystemStatsSlice &
  SurveillanceRestartSlice &
  NavigationGuardSlice

export const useRootStore = create<RootStore>()((...a) => ({
  ...createCamerasSlice(...a),
  ...createSystemStatsSlice(...a),
  ...createSurveillanceRestartSlice(...a),
  ...createNavigationGuardSlice(...a),
}))
