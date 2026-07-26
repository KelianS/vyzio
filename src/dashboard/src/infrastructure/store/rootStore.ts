import { create } from 'zustand'
import { createCamerasSlice, type CamerasSlice } from './slices/cameras.slice'
import { createSystemStatsSlice, type SystemStatsSlice } from './slices/systemStats.slice'

export type RootStore = CamerasSlice & SystemStatsSlice

export const useRootStore = create<RootStore>()((...a) => ({
  ...createCamerasSlice(...a),
  ...createSystemStatsSlice(...a),
}))
