'use client'

import { useState, useRef, useEffect } from 'react'
import { useStudentStore } from '@/store/useStudentStore'
import { useStudents } from '@/hooks/useStudents'
import type { SheetSystem } from '@/lib/supabase/types'

const TABS: SheetSystem[] = ['星光']

const VIEWS = [
  { key: 'grid', label: '表格' },
  { key: 'org',  label: '組織圖' },
] as const

// 可隱藏的欄位分組（id/name 為凍結欄，不提供隱藏）
const COLUMN_GROUPS = [
  {
    label: '基本資訊',
    cols: [
      { id: 'gender', label: '性別' },
      { id: 'role', label: '角色' },
      { id: 'phone', label: '手機' },
      { id: 'line_id', label: 'LINE ID' },
    ],
  },
  {
    label: '組織脈絡',
    cols: [
      { id: 'introducer', label: '介紹人' },
      { id: 'relation', label: '關係人' },
      { id: 'business_chain', label: '業務脈' },
      { id: 'counselor', label: '輔導員' },
      { id: 'little_angel', label: '小天使' },
      { id: 'spirit_ambassador_join_date', label: '心之使者加入日' },
      { id: 'love_giving_start_date', label: '大愛付出起始日' },
      { id: 'spirit_ambassador_group', label: '心之使者組別' },
      { id: 'cumulative_seniority', label: '累積年資' },
      { id: 'dream_interpreter', label: '圓夢解盤員' },
      { id: 'senior_counselor', label: '輔導長' },
      { id: 'region', label: '地區' },
      { id: 'guidance_chain', label: '輔導脈' },
      { id: 'membership_expiry', label: '社團會籍' },
    ],
  },
  {
    label: '課程',
    cols: [
      { id: 'course_1', label: '一階' },
      { id: 'payment_1', label: '一階完款' },
      { id: 'parent_1', label: '一階家長' },
      { id: 'course_2', label: '二階' },
      { id: 'payment_2', label: '二階完款' },
      { id: 'course_3', label: '三階' },
      { id: 'payment_3', label: '三階完款' },
      { id: 'course_4', label: '四階' },
      { id: 'payment_4', label: '四階完款' },
      { id: 'course_5', label: '五階' },
      { id: 'payment_5', label: '五階完款' },
      { id: 'course_wuyun', label: '五運' },
      { id: 'payment_wuyun', label: '五運完款' },
      { id: 'wuyun_a', label: '五運A' },
      { id: 'wuyun_b', label: '五運B' },
      { id: 'wuyun_c', label: '五運C' },
      { id: 'wuyun_d', label: '五運D' },
      { id: 'wuyun_f', label: '五運F' },
    ],
  },
  {
    label: '特殊課程',
    cols: [
      { id: 'life_numbers', label: '生命數字' },
      { id: 'life_numbers_advanced', label: '生命數字實戰班' },
      { id: 'life_transform', label: '生命蛻變' },
      { id: 'debt_release', label: '生生世世告別負債貧窮' },
    ],
  },
  {
    label: '輔導長分組',
    cols: [
      { id: 'group_leader', label: '所屬分組' },
    ],
  },
  {
    label: '計算欄',
    cols: [
      { id: 'name_with_id', label: '學員(含學編)' },
      { id: 'course_summary', label: '上課梯次' },
    ],
  },
]

export default function Toolbar() {
  const { activeTab, setActiveTab, setImportModalOpen, view, setView, columnVisibility, setColumnVisibility } = useStudentStore()
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
    const res = await fetch(`/api/export?${params}`)
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
    <div className="flex flex-wrap items-center gap-y-1.5 px-3 py-1.5 bg-white border-b border-slate-200 shadow-sm">
      {/* 體系 Tab 切換 */}
      <div className="flex items-center gap-0.5 mr-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              px-4 py-1.5 text-xs font-semibold rounded transition-all
              ${activeTab === tab
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}
            `}
          >
            {tab}體系
          </button>
        ))}
        <span className="ml-3 text-xs text-slate-500 tabular-nums font-medium">
          {count.toLocaleString()} 筆
        </span>
      </div>

      {/* 檢視切換 */}
      <div className="flex items-center gap-0.5 border border-slate-200 rounded overflow-hidden">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3 py-1.5 text-xs font-semibold transition-all ${
              view === key
                ? 'bg-blue-700 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 工具按鈕 */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto">
        {/* 欄位顯示/隱藏 */}
        {view === 'grid' && (
          <div className="relative" ref={colMenuRef}>
            <button
              onClick={() => setShowColMenu(v => !v)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white rounded hover:bg-slate-50 border border-slate-300 transition-colors"
            >
              欄位
              {hiddenCount > 0 && (
                <span className="ml-0.5 px-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-semibold">{hiddenCount}</span>
              )}
              <span className="text-[10px] ml-0.5">▾</span>
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg w-56 max-h-[70vh] overflow-y-auto py-1">
                {COLUMN_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      {group.label}
                    </div>
                    {group.cols.map(({ id, label }) => {
                      const visible = columnVisibility[id] !== false
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() => toggleCol(id)}
                            className="accent-blue-600 w-3.5 h-3.5"
                          />
                          {label}
                        </label>
                      )
                    })}
                  </div>
                ))}
                <div className="border-t border-slate-100 px-3 py-1.5">
                  <button
                    onClick={() => setColumnVisibility({})}
                    className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    全部顯示
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setImportModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
        >
          <span className="text-sm leading-none">↑</span> 匯入 xlsx
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white rounded hover:bg-slate-50 active:bg-slate-100 transition-colors border border-slate-300"
        >
          <span className="text-sm leading-none">↓</span> 匯出 xlsx
        </button>
      </div>
    </div>
  )
}
