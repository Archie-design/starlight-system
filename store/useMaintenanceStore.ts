'use client'

import { create } from 'zustand'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

export type MaintenanceCategory = 'MISSING_GROUP' | 'MISSING_COUNSELOR' | 'MISSING_CHAIN'

export interface MaintenanceFilters {
  name: string
  counselor: string
  region: string
  role: string
}

const DEFAULT_FILTERS: MaintenanceFilters = {
  name: '',
  counselor: '',
  region: '',
  role: '',
}

interface MaintenanceStore {
  username: string
  setUsername: (u: string) => void

  displayName: string | null
  setDisplayName: (n: string | null) => void

  role: UserRole
  setRole: (r: UserRole) => void

  system: SheetSystem
  setSystem: (s: SheetSystem) => void

  activeCategory: MaintenanceCategory
  setActiveCategory: (cat: MaintenanceCategory) => void

  filters: MaintenanceFilters
  setFilter: (key: keyof MaintenanceFilters, value: string) => void
  resetFilters: () => void

  page: number
  setPage: (n: number) => void

  columnVisibility: Record<string, boolean>
  setColumnVisibility: (v: Record<string, boolean>) => void
}

export const useMaintenanceStore = create<MaintenanceStore>((set) => ({
  username: '',
  setUsername: (username) => set({ username }),

  displayName: null,
  setDisplayName: (displayName) => set({ displayName }),

  role: 'admin',
  setRole: (role) => set({ role }),

  system: '星光',
  setSystem: (system) => set({ system, page: 0 }),

  activeCategory: 'MISSING_GROUP',
  setActiveCategory: (activeCategory) => set({ activeCategory, page: 0 }),

  filters: DEFAULT_FILTERS,
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value }, page: 0 })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 0 }),

  page: 0,
  setPage: (page) => set({ page }),

  columnVisibility: {},
  setColumnVisibility: (columnVisibility) => set({ columnVisibility }),
}))
