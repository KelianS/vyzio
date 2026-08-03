import { create } from 'zustand'
import { createCamerasSlice, type CamerasSlice } from './slices/cameras.slice'
import { createSystemStatsSlice, type SystemStatsSlice } from './slices/systemStats.slice'
import {
  createSurveillanceRestartSlice,
  type SurveillanceRestartSlice,
} from './slices/surveillanceRestart.slice'

export type RootStore = CamerasSlice & SystemStatsSlice & SurveillanceRestartSlice

export const useRootStore = create<RootStore>()((...a) => ({
  ...createCamerasSlice(...a),
  ...createSystemStatsSlice(...a),
  ...createSurveillanceRestartSlice(...a),
}))
