'use client'

import { useCallback } from 'react'
import type { Column } from '@tanstack/react-table'
import type { Student } from '@/lib/supabase/types'
import type { ColumnFilterValue, SortState } from '@/lib/db/types'
import MultiSelectDropdown from '@/components/shared/MultiSelectDropdown'
import TextFilterPopover, { type TextConditionValue, type TextValueListValue } from '@/components/shared/TextFilterPopover'
import RangeFilterPopover from '@/components/shared/RangeFilterPopover'

interface ColumnHeaderFilterProps {
  column: Column<Student, unknown>
  columnFilters: Record<string, ColumnFilterValue>
  setColumnFilter: (field: string, value: ColumnFilterValue | null) => void
  /** 取得指定欄位在目前查詢範圍內的不重複值（表頭「依值篩選」用），由呼叫端綁定體系/分組/其他篩選範圍 */
  fetchDistinctValues: (field: string) => Promise<string[]>
}

/**
 * 依欄位 meta.filterable 掛載對應的表頭篩選面板；欄位未標記則不渲染。
 *
 * 三種篩選型態（text/enum/range）各自的面板邏輯拆到獨立子元件（見下方
 * `TextColumnFilter`/`EnumColumnFilter`/`RangeColumnFilter`），這裡只負責
 * 依 `meta.filterable` 分派，不再是單一函式承擔三種型態全部邏輯（P2 #30）。
 */
export function ColumnHeaderFilter({ column, columnFilters, setColumnFilter, fetchDistinctValues }: ColumnHeaderFilterProps) {
  const meta = column.columnDef.meta
  const field = column.id
  // hooks 需在任何 early return 之前呼叫；未標記 filterable 的欄位仍不會渲染面板
  const fetchValues = useCallback(() => fetchDistinctValues(field), [fetchDistinctValues, field])
  if (!meta?.filterable) return null

  const label = String(column.columnDef.header)
  const current = columnFilters[field]

  switch (meta.filterable) {
    case 'text':
      return (
        <TextColumnFilter
          field={field}
          label={label}
          current={current}
          setColumnFilter={setColumnFilter}
          fetchValues={fetchValues}
        />
      )
    case 'enum':
      return (
        <EnumColumnFilter
          field={field}
          label={label}
          current={current}
          enumOptions={meta.enumOptions}
          setColumnFilter={setColumnFilter}
        />
      )
    case 'range':
      return (
        <RangeColumnFilter
          field={field}
          label={label}
          current={current}
          setColumnFilter={setColumnFilter}
        />
      )
    default:
      return null
  }
}

interface ColumnFilterPanelProps {
  field: string
  label: string
  current: ColumnFilterValue | undefined
  setColumnFilter: (field: string, value: ColumnFilterValue | null) => void
}

function TextColumnFilter({
  field, label, current, setColumnFilter, fetchValues,
}: ColumnFilterPanelProps & { fetchValues: () => Promise<string[]> }) {
  // text 型欄位的依值篩選沿用 enum 型別（見 lib/utils/columnFilter.ts 的
  // COLUMN_FILTER_FIELDS 說明：text 欄位同時允許 'text'（依條件）與
  // 'enum'（依值）兩種篩選型態，互斥使用）
  const condition: TextConditionValue | undefined =
    current?.type === 'text' ? { operator: current.operator, value: current.value } : undefined
  const valueList: TextValueListValue | undefined =
    current?.type === 'enum' ? { values: current.values, mode: current.mode ?? 'include' } : undefined

  return (
    <TextFilterPopover
      label={label}
      condition={condition}
      valueList={valueList}
      fetchDistinctValues={fetchValues}
      onApply={(result) => {
        if (!result) return setColumnFilter(field, null)
        if (result.kind === 'condition') {
          setColumnFilter(field, { type: 'text', operator: result.value.operator, value: result.value.value })
        } else {
          setColumnFilter(field, { type: 'enum', values: result.value.values, mode: result.value.mode })
        }
      }}
    />
  )
}

function EnumColumnFilter({
  field, label, current, enumOptions, setColumnFilter,
}: ColumnFilterPanelProps & { enumOptions?: string[] }) {
  const selected = current?.type === 'enum' ? current.values : []
  const mode = current?.type === 'enum' ? (current.mode ?? 'include') : 'include'
  const isEmpty = current?.type === 'enum' ? current.isEmpty : undefined

  return (
    <MultiSelectDropdown
      iconOnly
      label={label}
      title={`篩選「${label}」`}
      options={(enumOptions ?? []).map((v) => ({ value: v, label: v }))}
      selected={selected}
      mode={mode}
      isEmpty={isEmpty}
      onChange={(values) =>
        setColumnFilter(field, values.length > 0 ? { type: 'enum', values, mode } : null)
      }
      onApply={(result) => {
        if (!result) return setColumnFilter(field, null)
        if (result.kind === 'values') {
          setColumnFilter(field, result.values.length > 0 ? { type: 'enum', values: result.values, mode: result.mode } : null)
        } else {
          setColumnFilter(field, { type: 'enum', values: [], isEmpty: result.isEmpty })
        }
      }}
    />
  )
}

function RangeColumnFilter({ field, label, current, setColumnFilter }: ColumnFilterPanelProps) {
  const min = current?.type === 'range' ? current.min : undefined
  const max = current?.type === 'range' ? current.max : undefined
  const mode = current?.type === 'range' ? (current.mode ?? 'include') : 'include'

  return (
    <RangeFilterPopover
      label={label}
      min={min}
      max={max}
      mode={mode}
      onChange={(next_min, next_max, nextMode) =>
        setColumnFilter(
          field,
          next_min || next_max ? { type: 'range', min: next_min, max: next_max, mode: nextMode } : null
        )
      }
    />
  )
}

interface ColumnHeaderSortProps {
  field: string
  sort: SortState | null
  setSort: (sort: SortState | null) => void
}

/** 表頭排序控制：遞增 → 遞減 → 取消，依序循環 */
export function ColumnHeaderSort({ field, sort, setSort }: ColumnHeaderSortProps) {
  const direction = sort?.field === field ? sort.direction : null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (direction === null) setSort({ field, direction: 'asc' })
    else if (direction === 'asc') setSort({ field, direction: 'desc' })
    else setSort(null)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-[10px] leading-none ${direction ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'} transition-colors`}
      title="排序"
    >
      {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}
    </button>
  )
}
