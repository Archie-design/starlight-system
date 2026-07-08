'use client'

import { create } from 'zustand'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'
import type { StudentView } from '@/lib/db/types'
import type { MembershipStatus } from '@/lib/utils/studentStatus'

export interface CounselorFilters {
  name: string
  counselor: string
  region: string
  role: string
  hasCourse5: boolean
  courseStage: 0 | 1 | 2 | 3 | 4 | 5 | ''
  membershipStatus: MembershipStatus | ''
  isSpirit: boolean
  isNewbie: boolean
  view: StudentView | null
}

const DEFAULT_FILTERS: CounselorFilters = {
  name: '',
  counselor: '',
  region: '',
  role: '',
  hasCourse5: false,
  courseStage: '',
  membershipStatus: '',
  isSpirit: false,
  isNewbie: false,
  view: null,
}

interface CounselorStore {
  username: string
  setUsername: (u: string) => void

  displayName: string | null
  setDisplayName: (n: string | null) => void

  role: UserRole
  setRole: (r: UserRole) => void

  system: SheetSystem
  setSystem: (s: SheetSystem) => void

  activeGroup: string | null
  setActiveGroup: (g: string | null) => void

  filters: CounselorFilters
  setFilter: (key: keyof CounselorFilters, value: string | number | boolean | null) => void
  toggleQuickView: (view: StudentView) => void
  resetFilters: () => void

  page: number
  setPage: (n: number) => void

  columnVisibility: Record<string, boolean>
  setColumnVisibility: (v: Record<string, boolean>) => void
}

export const useCounselorStore = create<CounselorStore>((set) => ({
  username: '',
  setUsername: (username) => set({ username }),

  displayName: null,
  setDisplayName: (displayName) => set({ displayName }),

  role: 'admin',
  setRole: (role) => set({ role }),

  system: '星光',
  setSystem: (system) => set({ system, page: 0 }),

  activeGroup: null,
  setActiveGroup: (activeGroup) => set({ activeGroup, page: 0 }),

  filters: DEFAULT_FILTERS,
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value }, page: 0 })),
  toggleQuickView: (view) =>
    set((state) => ({
      filters: { ...state.filters, view: state.filters.view === view ? null : view },
      page: 0,
    })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 0 }),

  page: 0,
  setPage: (page) => set({ page }),

  columnVisibility: {},
  setColumnVisibility: (columnVisibility) => set({ columnVisibility }),
}))
