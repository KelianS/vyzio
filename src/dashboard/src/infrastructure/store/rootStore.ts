import { create } from 'zustand'
import { createCamerasSlice, type CamerasSlice } from './slices/cameras.slice'
import { createSystemStatsSlice, type SystemStatsSlice } from './slices/systemStats.slice'
import {
  createSurveillanceRestartSlice,
  type SurveillanceRestartSlice,
} from './slices/surveillanceRestart.slice'
import {
  createNavigationGuardSlice,
  type NavigationGuardSlice,
} from './slices/navigationGuard.slice'

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
