'use client'

import { create } from 'zustand'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

export interface CounselorFilters {
  name: string
  counselor: string
  region: string
  role: string
  hasCourse5: boolean
}

const DEFAULT_FILTERS: CounselorFilters = {
  name: '',
  counselor: '',
  region: '',
  role: '',
  hasCourse5: false,
}

interface CounselorStore {
  role: UserRole
  setRole: (r: UserRole) => void

  system: SheetSystem
  setSystem: (s: SheetSystem) => void

  activeGroup: string | null
  setActiveGroup: (g: string | null) => void

  filters: CounselorFilters
  setFilter: (key: keyof CounselorFilters, value: string | boolean) => void
  resetFilters: () => void

  page: number
  setPage: (n: number) => void

  columnVisibility: Record<string, boolean>
  setColumnVisibility: (v: Record<string, boolean>) => void
}

export const useCounselorStore = create<CounselorStore>((set) => ({
  role: 'admin',
  setRole: (role) => set({ role }),

  system: '星光',
  setSystem: (system) => set({ system, page: 0 }),

  activeGroup: null,
  setActiveGroup: (activeGroup) => set({ activeGroup, page: 0 }),

  filters: DEFAULT_FILTERS,
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value }, page: 0 })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 0 }),

  page: 0,
  setPage: (page) => set({ page }),

  columnVisibility: {},
  setColumnVisibility: (columnVisibility) => set({ columnVisibility }),
}))
