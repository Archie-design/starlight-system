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
