'use client'

import { create } from 'zustand'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'
import type { StudentView } from '@/lib/db/types'
import type { MembershipStatus } from '@/lib/utils/studentStatus'

export interface StudentFilters {
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

const DEFAULT_FILTERS: StudentFilters = {
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

interface StudentStore {
  // 登入者帳號（寫入 edit_logs.changed_by）
  username: string
  setUsername: (u: string) => void

  // 登入者角色（決定體系 TAB 可否切換）
  role: UserRole
  setRole: (role: UserRole) => void

  // 目前顯示的體系 tab（admin 鎖定其體系；superadmin 可切換）
  activeTab: SheetSystem
  setActiveTab: (tab: SheetSystem) => void

  // 篩選條件
  filters: StudentFilters
  setFilter: (key: keyof StudentFilters, value: string | number | boolean | null) => void
  /** 快捷視圖：點同一個則取消（互斥，一次一個） */
  toggleQuickView: (view: StudentView) => void
  resetFilters: () => void

  // 分頁
  page: number
  setPage: (page: number) => void

  // 匯入 Modal 狀態
  importModalOpen: boolean
  setImportModalOpen: (open: boolean) => void

  // 新增學員 Modal 狀態
  newStudentOpen: boolean
  setNewStudentOpen: (open: boolean) => void

  // 檢視模式
  view: 'grid' | 'org' | 'network'
  setView: (view: 'grid' | 'org' | 'network') => void

  // 欄位顯示
  columnVisibility: Record<string, boolean>
  setColumnVisibility: (v: Record<string, boolean>) => void
}

export const useStudentStore = create<StudentStore>((set) => ({
  username: '',
  setUsername: (username) => set({ username }),

  role: 'admin',
  setRole: (role) => set({ role }),

  activeTab: '星光',
  setActiveTab: (tab) => set({ activeTab: tab, page: 0 }),

  filters: DEFAULT_FILTERS,
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 0,
    })),
  toggleQuickView: (view) =>
    set((state) => ({
      filters: { ...state.filters, view: state.filters.view === view ? null : view },
      page: 0,
    })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 0 }),

  page: 0,
  setPage: (page) => set({ page }),

  importModalOpen: false,
  setImportModalOpen: (open) => set({ importModalOpen: open }),

  newStudentOpen: false,
  setNewStudentOpen: (open) => set({ newStudentOpen: open }),

  view: 'grid',
  setView: (view) => set({ view }),

  columnVisibility: {},
  setColumnVisibility: (columnVisibility) => set({ columnVisibility }),
}))
