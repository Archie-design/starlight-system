import type { ColumnFilterValue, SortState } from '@/lib/db/types'
import { COLUMN_FILTER_FIELDS } from './columnFilter'

const CF_PREFIX = 'cf.'

/**
 * 將 `columnFilters` 序列化進 URLSearchParams，key 為 `cf.<field>`，
 * value 為該欄位條件的 JSON 字串（`URLSearchParams` 會自動處理編碼）。
 */
export function encodeColumnFiltersToParams(
  params: URLSearchParams,
  columnFilters: Record<string, ColumnFilterValue>
): void {
  for (const [field, value] of Object.entries(columnFilters)) {
    params.set(`${CF_PREFIX}${field}`, JSON.stringify(value))
  }
}

/**
 * 從 URLSearchParams 還原 `columnFilters`。僅接受白名單欄位
 * （`COLUMN_FILTER_FIELDS`）且型態相符的值，其餘忽略。
 */
export function decodeColumnFiltersFromParams(params: URLSearchParams): Record<string, ColumnFilterValue> {
  const result: Record<string, ColumnFilterValue> = {}
  for (const [key, raw] of params.entries()) {
    if (!key.startsWith(CF_PREFIX)) continue
    const field = key.slice(CF_PREFIX.length)
    if (!(field in COLUMN_FILTER_FIELDS)) continue
    try {
      const value = JSON.parse(raw) as ColumnFilterValue
      if (value.type === COLUMN_FILTER_FIELDS[field]) result[field] = value
    } catch {
      // 忽略無法解析的值
    }
  }
  return result
}

/** 排序狀態序列化為 sortField / sortDir 兩個參數 */
export function encodeSortToParams(params: URLSearchParams, sort: SortState | null): void {
  if (!sort) return
  params.set('sortField', sort.field)
  params.set('sortDir', sort.direction)
}

/** 從 URLSearchParams 還原排序狀態，缺任一參數或值不合法則回傳 null */
export function decodeSortFromParams(params: URLSearchParams): SortState | null {
  const field = params.get('sortField')
  const direction = params.get('sortDir')
  if (!field || (direction !== 'asc' && direction !== 'desc')) return null
  return { field, direction }
}
