'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnResizeMode,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useState, useEffect } from 'react'
import { useMaintenanceStudents, MAINTENANCE_PAGE_SIZE } from '@/hooks/useMaintenanceStudents'
import { useMaintenanceStore } from '@/store/useMaintenanceStore'
import { studentColumns } from '@/components/StudentGrid/columns'
import MobileStudentList from '@/components/MobileStudentList'

const SKELETON_ROWS = 15
const SKELETON_WIDTHS = [70, 55, 85, 60, 75, 90, 65, 80, 50, 70, 60, 85, 75, 55, 65, 80, 70, 90, 60, 75, 50, 65, 85, 70, 55]
const ROW_HEIGHT = 28

export default function MaintenanceStudentGrid() {
  const { students, count, isLoading } = useMaintenanceStudents()
  const { page, setPage, columnVisibility, setColumnVisibility } = useMaintenanceStore()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: false }])
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const table = useReactTable({
    data: students,
    columns: studentColumns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility(typeof updater === 'function' ? updater(columnVisibility) : updater)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange' as ColumnResizeMode,
    enableColumnResizing: true,
    defaultColumn: { minSize: 50 },
    initialState: {
      columnPinning: { left: ['id', 'name'] },
    },
  })

  const { rows } = table.getRowModel()

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0
  const totalPages = Math.ceil(count / MAINTENANCE_PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      {/* 手機版 */}
      {isMobile ? (
        <div className="flex-1 overflow-auto">
          <MobileStudentList students={students} isLoading={isLoading} />
        </div>
      ) : (
        <>
        {/* 桌面版 */}
        <div ref={containerRef} className="flex-1 overflow-auto">
        <table className="text-xs border-collapse w-max min-w-full" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-slate-200 border-b border-slate-400">
                {headerGroup.headers.map((header) => {
                  const isPinned = header.column.getIsPinned()
                  return (
                    <th
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        left: isPinned ? `${header.column.getStart('left')}px` : undefined,
                      }}
                      className={`
                        relative px-1.5 py-1.5 text-left font-bold text-slate-700 border-r border-slate-300
                        select-none whitespace-nowrap text-xs
                        ${header.column.getCanSort() ? 'cursor-pointer hover:bg-slate-200 hover:text-blue-700' : ''}
                        ${isPinned ? 'sticky z-30 bg-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]' : ''}
                      `}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="truncate block pr-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <span className="text-blue-600 ml-0.5">↑</span>}
                        {header.column.getIsSorted() === 'desc' && <span className="text-blue-600 ml-0.5">↓</span>}
                      </span>
                      {!isPinned && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-blue-400 opacity-0 hover:opacity-100 transition-opacity"
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <tr key={i} style={{ height: ROW_HEIGHT }} className="border-b border-slate-100">
                  {studentColumns.map((_, j) => (
                    <td key={j} className="border-r border-slate-100 px-1">
                      <div className="h-2.5 rounded bg-slate-200 animate-pulse" style={{ width: `${SKELETON_WIDTHS[j % SKELETON_WIDTHS.length]}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={studentColumns.length}>
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <span className="text-4xl mb-3">✅</span>
                    <p className="text-sm font-medium text-slate-500">此類別尚無異常資料</p>
                    <p className="text-xs mt-1">目前所有資料皆已正確填畢</p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && <tr><td style={{ height: `${paddingTop}px` }} /></tr>}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  return (
                    <tr
                      key={row.id}
                      className="group border-b border-slate-200 hover:bg-blue-50 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isPinned = cell.column.getIsPinned()
                        return (
                          <td
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                              minWidth: cell.column.getSize(),
                              left: isPinned ? `${cell.column.getStart('left')}px` : undefined,
                            }}
                            className={`
                              border-r border-slate-200 p-0 overflow-hidden
                              ${isPinned ? 'sticky z-10 bg-white group-hover:bg-blue-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]' : ''}
                            `}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {paddingBottom > 0 && <tr><td style={{ height: `${paddingBottom}px` }} /></tr>}
              </>
            )}
          </tbody>
        </table>
      </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
            <span className="tabular-nums">
              共 <span className="font-medium text-slate-700">{count.toLocaleString()}</span> 筆
              ・第 <span className="font-medium text-slate-700">{page + 1}</span> / {totalPages} 頁
            </span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-30 hover:bg-slate-100 transition-colors">
                ← 上一頁
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-30 hover:bg-slate-100 transition-colors">
                下一頁 →
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  )
}
