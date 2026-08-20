'use client'

import type { Column } from '@tanstack/react-table'
import type { Student } from '@/lib/supabase/types'
import type { ColumnFilterValue, SortState } from '@/lib/db/types'
import MultiSelectDropdown from '@/components/shared/MultiSelectDropdown'
import TextFilterPopover from '@/components/shared/TextFilterPopover'
import RangeFilterPopover from '@/components/shared/RangeFilterPopover'

interface ColumnHeaderFilterProps {
  column: Column<Student, unknown>
  columnFilters: Record<string, ColumnFilterValue>
  setColumnFilter: (field: string, value: ColumnFilterValue | null) => void
}

/** 依欄位 meta.filterable 掛載對應的表頭篩選面板；欄位未標記則不渲染 */
export function ColumnHeaderFilter({ column, columnFilters, setColumnFilter }: ColumnHeaderFilterProps) {
  const meta = column.columnDef.meta
  const field = column.id
  if (!meta?.filterable) return null
  const current = columnFilters[field]

  if (meta.filterable === 'text') {
    return (
      <TextFilterPopover
        label={String(column.columnDef.header)}
        value={current?.type === 'text' ? current.value : ''}
        onChange={(value) =>
          setColumnFilter(field, value ? { type: 'text', value } : null)
        }
      />
    )
  }

  if (meta.filterable === 'enum') {
    const selected = current?.type === 'enum' ? current.values : []
    return (
      <MultiSelectDropdown
        iconOnly
        label={String(column.columnDef.header)}
        title={`篩選「${String(column.columnDef.header)}」`}
        options={(meta.enumOptions ?? []).map((v) => ({ value: v, label: v }))}
        selected={selected}
        onChange={(values) =>
          setColumnFilter(field, values.length > 0 ? { type: 'enum', values } : null)
        }
      />
    )
  }

  if (meta.filterable === 'range') {
    const min = current?.type === 'range' ? current.min : undefined
    const max = current?.type === 'range' ? current.max : undefined
    return (
      <RangeFilterPopover
        label={String(column.columnDef.header)}
        min={min}
        max={max}
        onChange={(next_min, next_max) =>
          setColumnFilter(
            field,
            next_min || next_max ? { type: 'range', min: next_min, max: next_max } : null
          )
        }
      />
    )
  }

  return null
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
