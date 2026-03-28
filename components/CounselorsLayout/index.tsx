'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useCounselorGroups } from '@/hooks/useCounselorGroups'
import { useCounselorStudents } from '@/hooks/useCounselorStudents'
import { useCounselorStore } from '@/store/useCounselorStore'
import CounselorStudentGrid from './CounselorStudentGrid'
import GroupManageModal from './GroupManageModal'

const REGIONS = ['北區', '中區', '南區']
const ROLES = [
  '會員', '小天使', '輔導員', '輔導員共同經營',
  '傳愛領袖', '傳愛領袖共同經營',
  '輔導長', '輔導長共同經營',
  '體系長', '體系長共同經營',
]

// 可隱藏欄位分組（同 Toolbar.tsx）
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

export default function CounselorsLayout() {
  const { groups, isLoading: groupsLoading } = useCounselorGroups()
  const { activeGroup, setActiveGroup, filters, setFilter, resetFilters, columnVisibility, setColumnVisibility } = useCounselorStore()
  const { count } = useCounselorStudents()
  const [showManage, setShowManage] = useState(false)
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  // 分組載入後，自動選取第一個
  useEffect(() => {
    if (!activeGroup && groups.length > 0) {
      setActiveGroup(groups[0].name)
    }
  }, [groups, activeGroup, setActiveGroup])

  // 點擊外部關閉欄位選單
  useEffect(() => {
    if (!showColMenu) return
    const handler = (e: MouseEvent) => {
      if (!colMenuRef.current?.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColMenu])

  const hasFilter = Object.values(filters).some(v => v !== '' && v !== false)
  const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== false).length
  const hiddenCount = Object.values(columnVisibility).filter(v => v === false).length

  const toggleCol = (id: string) => {
    setColumnVisibility({ ...columnVisibility, [id]: columnVisibility[id] === false ? true : false })
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-blue-800 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-yellow-300 text-lg leading-none">★</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">輔導長專區</h1>
        </div>
        <Link href="/students" className="text-xs text-blue-200/70 hover:text-white transition-colors">
          ← 學員管理
        </Link>
      </header>

      {/* 工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-3 py-1.5 bg-white border-b border-slate-200 shadow-sm">
        {/* 左側：分組 Tabs + 筆數 */}
        <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1 sm:flex-none">
          <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar py-0.5">
            {groupsLoading ? (
              <div className="h-7 w-48 bg-slate-200 animate-pulse rounded" />
            ) : (
              groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.name)}
                  className={`
                    px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all
                    ${activeGroup === g.name
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}
                  `}
                >
                  {g.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 右側：工具按鈕 */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
          {/* 欄位顯示/隱藏 */}
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
                        <input type="checkbox" checked={columnVisibility[id] !== false} onChange={() => toggleCol(id)} className="accent-blue-600 w-3.5 h-3.5" />
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

          <button
            onClick={() => setShowManage(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white rounded hover:bg-slate-50 border border-slate-300 transition-colors"
          >
            管理分組
          </button>
        </div>
      </div>

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-slate-100 border-b border-slate-300">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
          <input type="text" placeholder="搜尋姓名…" value={filters.name}
            onChange={e => setFilter('name', e.target.value)}
            className="border border-slate-300 rounded pl-6 pr-2 py-1 text-xs w-32 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
        <input type="text" placeholder="輔導員…" value={filters.counselor}
          onChange={e => setFilter('counselor', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs w-28 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        <select value={filters.region} onChange={e => setFilter('region', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
          <option value="">全部地區</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.role} onChange={e => setFilter('role', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
          <option value="">全部角色</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border transition-colors select-none
          ${filters.hasCourse5 ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
          <input type="checkbox" checked={filters.hasCourse5} onChange={e => setFilter('hasCourse5', e.target.checked)} className="accent-blue-600" />
          有五階
        </label>
        {hasFilter && (
          <div className="flex items-center gap-1 ml-0.5">
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium tabular-nums">{activeFilterCount}</span>
            <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-red-500 transition-colors px-1" title="清除所有篩選">✕ 清除</button>
          </div>
        )}

        {/* 筆數顯示 - 靠右對齊 */}
        {activeGroup && (
          <div className="ml-auto text-xs text-slate-500 tabular-nums font-medium bg-white/50 px-2 py-1 rounded border border-slate-200 shadow-sm">
            共 <span className="font-bold text-slate-700">{count.toLocaleString()}</span> 筆
          </div>
        )}
      </div>

      {/* 主表格 */}
      <div className="flex-1 min-h-0">
        {activeGroup ? (
          <CounselorStudentGrid />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            請選擇上方的輔導長分組
          </div>
        )}
      </div>

      {showManage && <GroupManageModal onClose={() => setShowManage(false)} />}
    </div>
  )
}
