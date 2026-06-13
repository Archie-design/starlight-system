'use client'

import { useState, useRef, useEffect } from 'react'
import { useStudentStore } from '@/store/useStudentStore'
import { useStudents } from '@/hooks/useStudents'
import { csrfFetch } from '@/lib/utils/csrf'
import { COLUMN_GROUPS } from '@/lib/constants'
import type { SheetSystem } from '@/lib/supabase/types'

const ALL_SYSTEMS: SheetSystem[] = ['星光', '太陽']

const VIEWS = [
  { key: 'grid', label: '表格' },
  { key: 'org',  label: '組織圖' },
  { key: 'network', label: '關聯圖' },
] as const

export default function Toolbar() {
  const { role, activeTab, setActiveTab, setImportModalOpen, view, setView, columnVisibility, setColumnVisibility, filters } = useStudentStore()

  // superadmin 切換體系：同步寫入 view cookie，讓 SSR 頁與 API 採同一體系
  const switchSystem = (tab: SheetSystem) => {
    document.cookie = `sl_view_system=${encodeURIComponent(tab)}; path=/; max-age=${30 * 60}; samesite=lax`
    setActiveTab(tab)
  }
  const { count } = useStudents()
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  // 點擊外部關閉
  useEffect(() => {
    if (!showColMenu) return
    const handler = (e: MouseEvent) => {
      if (!colMenuRef.current?.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColMenu])

  const hiddenCount = Object.values(columnVisibility).filter(v => v === false).length

  const toggleCol = (id: string) => {
    setColumnVisibility({ ...columnVisibility, [id]: columnVisibility[id] === false ? true : false })
  }

  const handleExport = async () => {
    const params = new URLSearchParams({ system: activeTab })
    // 帶上當前篩選，讓「匯出 = 畫面所見」
    if (filters.name) params.set('name', filters.name)
    if (filters.counselor) params.set('counselor', filters.counselor)
    if (filters.region) params.set('region', filters.region)
    if (filters.role) params.set('role', filters.role)
    if (filters.courseStage !== '' && filters.courseStage !== undefined) params.set('courseStage', String(filters.courseStage))
    if (filters.membershipStatus) params.set('membershipStatus', filters.membershipStatus)
    if (filters.isSpirit) params.set('isSpirit', '1')
    if (filters.isNewbie) params.set('isNewbie', '1')
    if (filters.view) params.set('view', filters.view)
    const res = await csrfFetch(`/api/export?${params}`)
    if (!res.ok) return alert('匯出失敗')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `學員名單_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-white border-b border-slate-200 shadow-sm min-h-[48px]">
      {/* 體系 Tab：admin 鎖定其體系；superadmin 可切換 */}
      <div className="flex-1 flex items-center gap-1.5 sm:gap-0.5 min-w-0">
        {role === 'superadmin' ? (
          ALL_SYSTEMS.map((tab) => (
            <button
              key={tab}
              onClick={() => switchSystem(tab)}
              className={`
                px-2 sm:px-4 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap
                ${activeTab === tab
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}
              `}
            >
              {tab}體系
            </button>
          ))
        ) : (
          <span className="px-2 sm:px-4 py-1.5 text-xs font-semibold rounded bg-blue-700 text-white shadow-sm whitespace-nowrap">
            {activeTab}體系
          </span>
        )}
        <span className="ml-1.5 sm:ml-3 text-[11px] text-slate-400 tabular-nums font-medium whitespace-nowrap">
          {count.toLocaleString()} 筆
        </span>
      </div>

      {/* 檢視切換 - 置中 */}
      <div className="flex-none">
        <div className="flex items-center p-0.5 bg-slate-100/80 rounded-lg border border-slate-200/60 shadow-inner">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 sm:px-5 py-2 sm:py-1 text-xs font-bold rounded-md transition-all duration-200 active:scale-95 ${
                view === key
                  ? 'bg-white text-blue-700 shadow-sm scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 工具按鈕 - 靠右 */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* 欄位顯示/隱藏 */}
        {view === 'grid' && (
          <div className="relative" ref={colMenuRef}>
            <button
              onClick={() => setShowColMenu(v => !v)}
              className="group flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white rounded-md hover:bg-slate-50 border border-slate-200 transition-all active:scale-95 shadow-sm"
            >
              <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              欄位
              {hiddenCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[9px] font-bold ring-2 ring-white">
                  {hiddenCount}
                </span>
              )}
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-64 max-h-[70vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="overflow-y-auto py-2">
                  {COLUMN_GROUPS.map((group) => (
                    <div key={group.label} className="mb-2 last:mb-0">
                      <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                        {group.label}
                      </div>
                      <div className="grid grid-cols-1 gap-0.5 px-1">
                        {group.cols.map(({ id, label }) => {
                          const visible = columnVisibility[id] !== false
                          return (
                            <label
                              key={id}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50/50 rounded-md cursor-pointer text-xs text-slate-700 transition-colors group"
                            >
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={visible}
                                  onChange={() => toggleCol(id)}
                                  className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-300 transition-all checked:border-blue-600 checked:bg-blue-600 focus:outline-none"
                                />
                                <svg className="absolute h-4 w-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                              <span className="group-hover:text-blue-700 font-medium transition-colors">{label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/80 flex justify-between items-center">
                  <button
                    onClick={() => setColumnVisibility({})}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    重置顯示全部
                  </button>
                  <span className="text-[10px] text-slate-400 font-medium">共 {COLUMN_GROUPS.reduce((acc, g) => acc + g.cols.length, 0)} 欄</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="h-6 w-px bg-slate-200 mx-0.5 sm:mx-1" />

        <button
          onClick={() => setImportModalOpen(true)}
          className="flex items-center gap-1.5 px-2 sm:px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all shadow-sm hover:shadow-md ring-1 ring-blue-700/10"
          title="匯入 xlsx"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="hidden sm:inline">匯入 xlsx</span>
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-2 sm:px-4 py-1.5 text-xs font-bold text-slate-700 bg-white rounded-md hover:bg-slate-50 active:scale-95 transition-all border border-slate-200 shadow-sm hover:shadow"
          title="匯出 xlsx"
        >
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="hidden sm:inline">匯出 xlsx</span>
        </button>
      </div>
    </div>
  )
}
