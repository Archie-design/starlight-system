'use client'

import { create } from 'zustand'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'
import type { StudentView, ColumnFilterValue, SortState } from '@/lib/db/types'
import type { MembershipStatus } from '@/lib/utils/studentStatus'

export interface CounselorFilters {
  name: string
  counselor: string
  region: string
  role: string
  hasCourse5: boolean
  courseStage: 0 | 1 | 2 | 3 | 4 | 5 | ''
  /** 會籍狀態（可複選；空陣列 = 不限） */
  membershipStatus: MembershipStatus[]
  isSpirit: boolean
  isNewbie: boolean
  view: StudentView | null
  /** 表頭逐欄篩選（與其他篩選以 AND 疊加），key 為欄位名 */
  columnFilters: Record<string, ColumnFilterValue>
}

const DEFAULT_FILTERS: CounselorFilters = {
  name: '',
  counselor: '',
  region: '',
  role: '',
  hasCourse5: false,
  courseStage: '',
  membershipStatus: [],
  isSpirit: false,
  isNewbie: false,
  view: null,
  columnFilters: {},
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
  /** 會籍狀態複選 */
  setMembershipStatus: (statuses: MembershipStatus[]) => void
  /** 設定單一欄位的表頭篩選（value 為 null 時等同清除該欄位） */
  setColumnFilter: (field: string, value: ColumnFilterValue | null) => void
  /** 清除單一欄位的表頭篩選 */
  clearColumnFilter: (field: string) => void
  toggleQuickView: (view: StudentView) => void
  resetFilters: () => void

  page: number
  setPage: (n: number) => void

  // 表頭欄位排序（伺服器端；一次僅單一欄位）
  sort: SortState | null
  setSort: (sort: SortState | null) => void

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
  setMembershipStatus: (membershipStatus) =>
    set((state) => ({ filters: { ...state.filters, membershipStatus }, page: 0 })),
  setColumnFilter: (field, value) =>
    set((state) => {
      const columnFilters = { ...state.filters.columnFilters }
      if (value === null) delete columnFilters[field]
      else columnFilters[field] = value
      return { filters: { ...state.filters, columnFilters }, page: 0 }
    }),
  clearColumnFilter: (field) =>
    set((state) => {
      const columnFilters = { ...state.filters.columnFilters }
      delete columnFilters[field]
      return { filters: { ...state.filters, columnFilters }, page: 0 }
    }),
  toggleQuickView: (view) =>
    set((state) => ({
      filters: { ...state.filters, view: state.filters.view === view ? null : view },
      page: 0,
    })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 0 }),

  page: 0,
  setPage: (page) => set({ page }),

  sort: null,
  setSort: (sort) => set({ sort, page: 0 }),

  columnVisibility: {},
  setColumnVisibility: (columnVisibility) => set({ columnVisibility }),
}))
