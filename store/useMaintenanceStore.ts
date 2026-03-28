'use client'

import { create } from 'zustand'

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
