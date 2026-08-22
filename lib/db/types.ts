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

/** 篩選模式：'include'（預設）＝符合條件才顯示；'exclude' ＝符合條件的隱藏，其餘顯示 */
export type ColumnFilterMode = 'include' | 'exclude'

/**
 * text 型欄位的比對條件（依條件篩選）。
 * - contains/not_contains：對應舊格式的 mode 'include'/'exclude'
 * - equals：精確等於
 * - starts_with / ends_with：字首/字尾比對
 * - is_empty / is_not_empty：欄位是否為空值，此時 `value` 忽略
 */
export type TextOperator =
  | 'contains' | 'not_contains' | 'equals'
  | 'starts_with' | 'ends_with'
  | 'is_empty' | 'is_not_empty'

/**
 * 表頭逐欄篩選的條件值，依欄位型態分三種，key 為 `Student` 的欄位名
 * （見 `columns.tsx` 的 `filterable` 白名單）：
 * - text：以 `operator` 決定比對方式（見 `TextOperator`）。`mode` 為舊格式
 *   殘留欄位，僅供向下相容解碼用（新資料一律寫 `operator`，不再寫 `mode`）。
 * - enum：`mode='exclude'` 時排除勾選的值，顯示其餘（含空值）；
 *   `isEmpty` 有值時忽略 `values`/`mode`，改比對欄位是否為空
 *   （`true` = 為空、`false` = 不為空）
 * - range：`mode='exclude'` 時排除落在該區間內的資料，顯示區間外（含空值）
 */
export type ColumnFilterValue =
  | { type: 'text'; operator: TextOperator; value: string; mode?: ColumnFilterMode }
  | { type: 'enum'; values: string[]; mode?: ColumnFilterMode; isEmpty?: boolean }
  | { type: 'range'; min?: string; max?: string; mode?: ColumnFilterMode } // 日期或數值區間（字串保留來源格式）

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
  /**
   * 取得指定欄位在目前查詢範圍（體系 + 其他已生效篩選，排除該欄位自身
   * 的表頭篩選）內的不重複值，供表頭「依值篩選」的值清單使用。
   * `field` 須為 `COLUMN_FILTER_FIELDS` 白名單內的欄位。
   */
  getDistinctValues(field: string, system: SheetSystem, filters: StudentFilters, scope?: { groupLeader?: string }): Promise<string[]>
  /** 更新單一欄位並寫入稽核 log（log 為 fire-and-forget，不阻塞） */
  updateCell(edit: CellEdit): Promise<void>
}

/**
 * 依賴注入用的根上下文。後續可加入 groups / aliases / overrides。
 */
export interface RepositoryContextValue {
  students: StudentRepository
}
