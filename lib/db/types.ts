import type { Student, SheetSystem } from '@/lib/supabase/types'

import type { MembershipStatus } from '@/lib/utils/studentStatus'

/** 情境快捷視圖（跨欄位衍生條件，一次一個） */
export type StudentView = 'resubscribe' | 'owing' | 'expiring' | 'newbie'

/**
 * 學員清單的通用篩選器（對應 FilterBar / store filters）。
 */
export interface StudentFilters {
  name?: string
  counselor?: string
  region?: string
  role?: string
  hasCourse5?: boolean
  /** 課程進度：最高完成階別。'' = 不限；0 = 未上課 */
  courseStage?: 0 | 1 | 2 | 3 | 4 | 5 | ''
  /** 會籍狀態 */
  membershipStatus?: MembershipStatus | ''
  /** 心之使者 */
  isSpirit?: boolean
  /** 近 30 天新建檔 */
  isNewbie?: boolean
  /** 情境快捷視圖（與基礎篩選疊加；視圖之間互斥） */
  view?: StudentView | null
}

/**
 * 維護專區的複查類別。null 欄位即代表該類別需要修正的資料。
 */
export type MaintenanceCategory = 'MISSING_GROUP' | 'MISSING_COUNSELOR' | 'MISSING_CHAIN' | null

/**
 * 分頁查詢的範圍。
 */
export interface PageRange {
  page: number
  pageSize: number
}

export interface PagedStudents {
  rows: Student[]
  count: number
}

/**
 * 單一儲存格編輯的稽核資訊（給 audit log 使用）。
 */
export interface CellEdit {
  id: number
  field: string
  value: string | null
  oldValue: string | null
  studentName: string | null
  /** 操作者帳號（登入者 username），寫入 edit_logs.changed_by */
  changedBy?: string | null
}

/**
 * 學員資料存取介面 — 隔離 Supabase 細節，讓 hook 與業務邏輯不直接依賴具體資料庫。
 */
export interface StudentRepository {
  /** 依體系（business_chain）分頁查詢（/students 主表） */
  findBySystem(system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents>
  /** 依 group_leader + 體系分頁查詢（/counselors） */
  findByGroupLeader(groupLeader: string, system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents>
  /** 依維護類別 + 體系分頁查詢（/maintenance） */
  findByMaintenanceCategory(category: MaintenanceCategory, system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents>
  /** 更新單一欄位並寫入稽核 log（log 為 fire-and-forget，不阻塞） */
  updateCell(edit: CellEdit): Promise<void>
}

/**
 * 依賴注入用的根上下文。後續可加入 groups / aliases / overrides。
 */
export interface RepositoryContextValue {
  students: StudentRepository
}
