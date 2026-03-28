'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import NavButton from '../NavButton'
import { useMaintenanceStudents } from '@/hooks/useMaintenanceStudents'
import { useMaintenanceStore, MaintenanceCategory } from '@/store/useMaintenanceStore'
import MaintenanceStudentGrid from './MaintenanceStudentGrid'

const REGIONS = ['北區', '中區', '南區']
const ROLES = [
  '會員', '小天使', '輔導員', '輔導員共同經營',
  '傳愛領袖', '傳愛領袖共同經營',
  '輔導長', '輔導長共同經營',
  '體系長', '體系長共同經營',
]

const MAINTENANCE_CATEGORIES: { id: MaintenanceCategory; label: string }[] = [
  { id: 'MISSING_GROUP', label: '未分配組別' },
  { id: 'MISSING_COUNSELOR', label: '輔導長空白' },
  { id: 'MISSING_CHAIN', label: '輔導體系空白' },
]

// 可隱藏欄位分組
const COLUMN_GROUPS = [
  { label: '基本資訊', cols: [{ id: 'gender', label: '性別' }, { id: 'role', label: '角色' }, { id: 'phone', label: '手機' }, { id: 'line_id', label: 'LINE ID' }] },
  { label: '組織脈絡', cols: [
    { id: 'introducer', label: '介紹人' }, { id: 'relation', label: '關係人' },
    { id: 'business_chain', label: '業務脈' }, { id: 'counselor', label: '輔導員' },
    { id: 'little_angel', label: '小天使' },
    { id: 'spirit_ambassador_join_date', label: '心之使者加入日' },
    { id: 'love_giving_start_date', label: '大愛付出起始日' },
    { id: 'spirit_ambassador_group', label: '心之使者組別' },
    { id: 'cumulative_seniority', label: '累積年資' },
    { id: 'dream_interpreter', label: '圓夢解盤員' },
    { id: 'senior_counselor', label: '輔導長' }, { id: 'region', label: '地區' },
    { id: 'guidance_chain', label: '輔導脈' }, { id: 'membership_expiry', label: '社團會籍' },
    { id: 'group_leader', label: '所屬分組' },
  ]},
  { label: '課程', cols: [
    { id: 'course_1', label: '一階' }, { id: 'payment_1', label: '一階完款' }, { id: 'parent_1', label: '一階家長' },
    { id: 'course_2', label: '二階' }, { id: 'payment_2', label: '二階完款' },
    { id: 'course_3', label: '三階' }, { id: 'payment_3', label: '三階完款' },
    { id: 'course_4', label: '四階' }, { id: 'payment_4', label: '四階完款' },
    { id: 'course_5', label: '五階' }, { id: 'payment_5', label: '五階完款' },
    { id: 'course_wuyun', label: '五運' }, { id: 'payment_wuyun', label: '五運完款' },
    { id: 'wuyun_a', label: '五運A' }, { id: 'wuyun_b', label: '五運B' },
    { id: 'wuyun_c', label: '五運C' }, { id: 'wuyun_d', label: '五運D' }, { id: 'wuyun_f', label: '五運F' },
  ]},
  { label: '特殊課程', cols: [
    { id: 'life_numbers', label: '生命數字' }, { id: 'life_numbers_advanced', label: '生命數字實戰班' },
    { id: 'life_transform', label: '生命蛻變' }, { id: 'debt_release', label: '生生世世告別負債貧窮' },
  ]},
]

export default function MaintenanceLayout() {
  const { activeCategory, setActiveCategory, filters, setFilter, resetFilters, columnVisibility, setColumnVisibility } = useMaintenanceStore()
  const { count } = useMaintenanceStudents()
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // 點擊外部關閉欄位選單
  useEffect(() => {
    if (!showColMenu) return
    const handler = (e: MouseEvent) => {
      if (!colMenuRef.current?.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColMenu])

  const hasFilter = Object.values(filters).some(v => v !== '')
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length
  const hiddenCount = Object.values(columnVisibility).filter(v => v === false).length

  const toggleCol = (id: string) => {
    setColumnVisibility({ ...columnVisibility, [id]: columnVisibility[id] === false ? true : false })
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-amber-400 text-lg leading-none">🛠️</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">資料維護專區</h1>
        </div>
        <div className="flex items-center gap-4">
          <NavButton href="/dashboard" active={pathname === '/dashboard'} className="text-xs text-slate-300 hover:text-white transition-colors">
            儀表板 →
          </NavButton>
          <NavButton href="/counselors" active={pathname === '/counselors'} className="text-xs text-slate-300 hover:text-white transition-colors">
            輔導長專區
          </NavButton>
          <NavButton href="/students" active={pathname === '/students'} className="text-xs text-slate-300 hover:text-white transition-colors">
            ← 學員管理
          </NavButton>
        </div>
      </header>

      {/* 第一層：類別選取標籤 */}
      <div className="flex items-center justify-between gap-y-2 px-3 py-1.5 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {MAINTENANCE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`
                px-4 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all
                ${activeCategory === cat.id
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 右側：工具按鈕 */}
        <div className="flex items-center gap-1.5 shrink-0">
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
                {COLUMN_GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">{group.label}</div>
                    {group.cols.map(({ id, label }) => (
                      <label key={id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
                        <input type="checkbox" checked={columnVisibility[id] !== false} onChange={() => toggleCol(id)} className="accent-slate-600 w-3.5 h-3.5" />
                        {label}
                      </label>
                    ))}
                  </div>
                ))}
                <div className="border-t border-slate-100 px-3 py-1.5">
                  <button onClick={() => setColumnVisibility({})} className="text-xs text-slate-400 hover:text-blue-600 transition-colors">全部顯示</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 第二層：搜尋/篩選列 */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-300">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
          <input type="text" placeholder="搜尋姓名…" value={filters.name}
            onChange={e => setFilter('name', e.target.value)}
            className="border border-slate-300 rounded pl-6 pr-2 py-1 text-xs w-32 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-colors"
          />
        </div>
        <input type="text" placeholder="輔導員…" value={filters.counselor}
          onChange={e => setFilter('counselor', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs w-28 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-colors"
        />
        <select value={filters.region} onChange={e => setFilter('region', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 transition-colors">
          <option value="">全部地區</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.role} onChange={e => setFilter('role', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 transition-colors">
          <option value="">全部角色</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {hasFilter && (
          <div className="flex items-center gap-1 ml-0.5">
            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-xs rounded-full font-medium tabular-nums">{activeFilterCount}</span>
            <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-red-500 transition-colors px-1" title="清除所有篩選">✕ 清除</button>
          </div>
        )}

        <div className="ml-auto text-xs text-slate-500 tabular-nums font-medium bg-white/50 px-2 py-1 rounded border border-slate-200 shadow-sm">
          待修正筆數：<span className="font-bold text-slate-700">{count.toLocaleString()}</span>
        </div>
      </div>

      {/* 主表格 */}
      <div className="flex-1 min-h-0">
        <MaintenanceStudentGrid />
      </div>
    </div>
  )
}
