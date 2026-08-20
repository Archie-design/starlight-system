import type { Student } from '@/lib/supabase/types'
import type { ColumnFilterValue } from '@/lib/db/types'

/**
 * 表頭逐欄篩選的白名單：key 為 `Student` 欄位名，僅在
 * `components/StudentGrid/columns.tsx` 標記 `filterable` 的欄位可篩選。
 * 後端不信任前端傳來的任意 key——不在白名單內一律忽略，避免對未建索引
 * 的欄位下推查詢，見 design.md「Risks / Trade-offs」。
 *
 * 這裡刻意用一份獨立白名單（而非讀取 columns.tsx 的 meta），保持
 * `lib/` 不依賴 UI 元件模組；新增可篩選欄位時記得同步這兩處。
 */
export const COLUMN_FILTER_FIELDS: Record<string, ColumnFilterValue['type']> = {
  name: 'text',
  phone: 'text',
  line_id: 'text',
  introducer: 'text',
  relation: 'text',
  business_chain: 'text',
  counselor: 'text',
  little_angel: 'text',
  spirit_ambassador_group: 'text',
  dream_interpreter: 'text',
  senior_counselor: 'text',
  guidance_chain: 'text',
  group_leader: 'text',
  gender: 'enum',
  role: 'enum',
  region: 'enum',
  birthday: 'range',
  membership_expiry: 'range',
  spirit_ambassador_join_date: 'range',
  love_giving_start_date: 'range',
}

/**
 * 表頭排序的白名單：僅原生資料庫欄位可排序，須與 `columns.tsx` 各欄位
 * 的 `enableSorting` 標記一致——衍生計算欄（課程進度、上課梯次彙總等）
 * 不開放排序，避免要在已下推分頁的資料上做二次排序而導致跨頁排序錯誤。
 * `columns.tsx`（決定表頭是否顯示排序圖示）與兩個 repository（決定
 * `.order()`/JS 排序是否真的套用）都從這裡讀取，避免兩邊各自維護
 * 一份清單而漂移（曾發生：欄位顯示排序圖示，但後端白名單沒有該欄位，
 * 點擊排序圖示後資料順序沒有任何變化）。
 */
export const SORTABLE_FIELDS = new Set([
  'id', 'name', 'birthday', 'membership_expiry',
  'spirit_ambassador_join_date', 'love_giving_start_date',
])

/** 只保留白名單內、型態相符的欄位篩選，過濾掉未知或型態不符的 key */
export function sanitizeColumnFilters(
  columnFilters: Record<string, ColumnFilterValue> | undefined | null
): Record<string, ColumnFilterValue> {
  if (!columnFilters) return {}
  const result: Record<string, ColumnFilterValue> = {}
  for (const [field, value] of Object.entries(columnFilters)) {
    if (COLUMN_FILTER_FIELDS[field] === value.type) result[field] = value
  }
  return result
}

/** 單一欄位、單一條件是否命中 */
function matchesOne(s: Student, field: string, value: ColumnFilterValue): boolean {
  const raw = (s as unknown as Record<string, unknown>)[field]

  if (value.type === 'text') {
    if (!value.value) return true
    const text = typeof raw === 'string' ? raw : ''
    return text.includes(value.value)
  }

  if (value.type === 'enum') {
    if (value.values.length === 0) return true
    return typeof raw === 'string' && value.values.includes(raw)
  }

  if (value.type === 'range') {
    if (!value.min && !value.max) return true
    if (typeof raw !== 'string' || !raw) return false
    if (value.min && raw < value.min) return false
    if (value.max && raw > value.max) return false
    return true
  }

  return true
}

/**
 * 表頭逐欄篩選是否全部命中（AND 關係）。傳入前應先以
 * `sanitizeColumnFilters()` 過濾掉非白名單欄位。
 */
export function matchesColumnFilters(
  s: Student,
  columnFilters: Record<string, ColumnFilterValue> | undefined
): boolean {
  if (!columnFilters) return true
  for (const [field, value] of Object.entries(columnFilters)) {
    if (!matchesOne(s, field, value)) return false
  }
  return true
}
