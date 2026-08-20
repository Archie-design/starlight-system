import type { Student, SheetSystem } from '@/lib/supabase/types'

import type { MembershipStatus } from '@/lib/utils/studentStatus'

/**
 * 情境快捷視圖（跨欄位衍生條件，一次一個）
 * 註：'duplicate_name' 需以「全體系姓名出現次數」判定（跨列統計），
 *     不像其他視圖可逐列判斷。
 * 註：「會籍快到期」不走這個機制，而是快捷按鈕直接勾選
 *     membershipStatus 的 'expired' + 'in30'，與會籍下拉共用同一套邏輯。
 */
export type StudentView = 'resubscribe' | 'owing' | 'newbie' | 'duplicate_name'

/**
 * 表頭逐欄篩選的條件值，依欄位型態分三種。
 * key 為 `Student` 的欄位名（見 `columns.tsx` 的 `filterable` 白名單）。
 */
export type ColumnFilterValue =
  | { type: 'text'; value: string }              // 包含比對
  | { type: 'enum'; values: string[] }            // 複選
  | { type: 'range'; min?: string; max?: string } // 日期或數值區間（字串保留來源格式）

/**
 * 表頭欄位排序狀態。一次僅套用單一欄位，field 須為 `columns.tsx` 標記
 * `sortable: true` 的白名單欄位（排除課程進度等衍生欄位）。
 */
export interface SortState {
  field: string
  direction: 'asc' | 'desc'
}

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
  /** 會籍狀態（可複選；空陣列 = 不限） */
  membershipStatus?: MembershipStatus[]
  /** 心之使者 */
  isSpirit?: boolean
  /** 近 30 天新建檔 */
  isNewbie?: boolean
  /** 情境快捷視圖（與基礎篩選疊加；視圖之間互斥） */
  view?: StudentView | null
  /** 表頭逐欄篩選（與其他篩選以 AND 疊加），key 為欄位名 */
  columnFilters?: Record<string, ColumnFilterValue>
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
  findBySystem(system: SheetSystem, filters: StudentFilters, range: PageRange, sort?: SortState | null): Promise<PagedStudents>
  /** 依 group_leader + 體系分頁查詢（/counselors） */
  findByGroupLeader(groupLeader: string, system: SheetSystem, filters: StudentFilters, range: PageRange, sort?: SortState | null): Promise<PagedStudents>
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
