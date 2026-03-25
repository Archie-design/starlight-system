'use client'

import { create } from 'zustand'
import type { SheetSystem } from '@/lib/supabase/types'

export interface StudentFilters {
  name: string
  counselor: string
  region: string
  role: string
  hasCourse5: boolean
}

const DEFAULT_FILTERS: StudentFilters = {
  name: '',
  counselor: '',
  region: '',
  role: '',
  hasCourse5: false,
}

interface StudentStore {
  // 目前顯示的體系 tab
  activeTab: SheetSystem
  setActiveTab: (tab: SheetSystem) => void

  // 篩選條件
  filters: StudentFilters
  setFilter: (key: keyof StudentFilters, value: string | boolean) => void
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
  view: 'grid' | 'org'
  setView: (view: 'grid' | 'org') => void

  // 欄位顯示
  columnVisibility: Record<string, boolean>
  setColumnVisibility: (v: Record<string, boolean>) => void
}

export const useStudentStore = create<StudentStore>((set) => ({
  activeTab: '星光',
  setActiveTab: (tab) => set({ activeTab: tab, page: 0 }),

  filters: DEFAULT_FILTERS,
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
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
