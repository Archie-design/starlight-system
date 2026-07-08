'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import NavButton from '../NavButton'
import { useCounselorGroups } from '@/hooks/useCounselorGroups'
import { useCounselorStudents } from '@/hooks/useCounselorStudents'
import { useCounselorStore } from '@/store/useCounselorStore'
import CounselorStudentGrid from './CounselorStudentGrid'
import GroupManageModal from './GroupManageModal'
import SystemSwitcher from '../SystemSwitcher'
import LogoutButton from '../LogoutButton'
import { REGIONS, ROLES, COLUMN_GROUPS } from '@/lib/constants'
import type { StudentView } from '@/lib/db/types'

const COURSE_STAGES: { value: 0 | 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 0, label: '未上課' }, { value: 1, label: '一階' }, { value: 2, label: '二階' },
  { value: 3, label: '三階' }, { value: 4, label: '四階' }, { value: 5, label: '五階' },
]
const MEMBERSHIP_OPTIONS: { value: string; label: string }[] = [
  { value: 'expired', label: '已過期' }, { value: 'in30', label: '30 天內到期' },
  { value: 'in90', label: '90 天內到期' }, { value: 'valid', label: '有效' }, { value: 'none', label: '無資料' },
]
const QUICK_VIEWS: { value: StudentView; label: string }[] = [
  { value: 'resubscribe', label: '續報潛力' }, { value: 'owing', label: '待催欠款' },
  { value: 'expiring', label: '會籍快到期' }, { value: 'newbie', label: '本月新生' },
]

export default function CounselorsLayout() {
  const { role, system, setSystem, activeGroup, setActiveGroup, filters, setFilter, toggleQuickView, resetFilters, columnVisibility, setColumnVisibility, displayName, username } = useCounselorStore()
  const { groups, isLoading: groupsLoading } = useCounselorGroups(system)
  const { count } = useCounselorStudents()
  const [showManage, setShowManage] = useState(false)
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // 分組載入後（或切換體系後），若目前選取的分組不在清單中，自動選取第一個
  useEffect(() => {
    if (groups.length === 0) return
    const stillValid = activeGroup && groups.some((g) => g.name === activeGroup)
    if (!stillValid) {
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

  const isActive = (v: unknown) => v !== '' && v !== false && v !== null && v !== undefined
  const hasFilter = Object.values(filters).some(isActive)
  const activeFilterCount = Object.values(filters).filter(isActive).length
  const hiddenCount = Object.values(columnVisibility).filter(v => v === false).length

  const toggleCol = (id: string) => {
    setColumnVisibility({ ...columnVisibility, [id]: columnVisibility[id] === false ? true : false })
  }

  return (
    <div className="flex flex-col h-dvh bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-blue-800 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-yellow-300 text-lg leading-none">★</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">關懷長專區</h1>
        </div>
        <div className="flex items-center gap-4">
          <NavButton href="/dashboard" active={pathname === '/dashboard'} className="text-xs text-blue-200/70 hover:text-white transition-colors">
            儀表板 →
          </NavButton>
          <NavButton href="/maintenance" active={pathname === '/maintenance'} className="text-xs text-blue-200/70 hover:text-white transition-colors">
            資料維護
          </NavButton>
          <NavButton href="/spirit" active={pathname === '/spirit'} className="text-xs text-blue-200/70 hover:text-white transition-colors">
            心之使者
          </NavButton>
          <NavButton href="/students" active={pathname === '/students'} className="text-xs text-blue-200/70 hover:text-white transition-colors">
            ← 學員管理
          </NavButton>
          {role !== 'admin' && (
            <NavButton href="/admin/users" active={pathname === '/admin/users'} className="text-xs text-amber-200/90 hover:text-white transition-colors">
              帳號管理 →
            </NavButton>
          )}
          {(displayName || username) && (
            <span className="text-xs text-amber-100/80">👤 {displayName || username}</span>
          )}
          <LogoutButton />
        </div>
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
          {/* 體系切換（僅 superadmin） */}
          {role === 'superadmin' && (
            <SystemSwitcher value={system} onChange={setSystem} />
          )}
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
      <div className="px-4 pt-2">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg shadow-sm">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
          <input type="text" placeholder="搜尋姓名…" value={filters.name}
            onChange={e => setFilter('name', e.target.value)}
            className="border border-slate-300 rounded pl-6 pr-2 py-1 text-xs w-32 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
        <input type="text" placeholder="關懷員…" value={filters.counselor}
          onChange={e => setFilter('counselor', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs w-28 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        <select value={filters.region} onChange={e => setFilter('region', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
          <option value="">全部地區</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.role} onChange={e => setFilter('role', e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
          <option value="">全部角色</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.courseStage === '' ? '' : String(filters.courseStage)}
          onChange={e => setFilter('courseStage', e.target.value === '' ? '' : (Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5))}
          title="課程進度（最高完成階）"
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
          <option value="">全部進度</option>
          {COURSE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filters.membershipStatus} onChange={e => setFilter('membershipStatus', e.target.value)}
          title="會籍狀態"
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
          <option value="">全部會籍</option>
          {MEMBERSHIP_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border transition-colors select-none
          ${filters.isSpirit ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
          <input type="checkbox" checked={filters.isSpirit} onChange={e => setFilter('isSpirit', e.target.checked)} className="accent-blue-600" />
          心之使者
        </label>
        <span className="text-slate-300 mx-0.5 select-none">|</span>
        {QUICK_VIEWS.map(v => (
          <button key={v.value} onClick={() => toggleQuickView(v.value)}
            className={`text-xs px-2 py-1 rounded border transition-colors select-none ${
              filters.view === v.value ? 'bg-amber-500 border-amber-500 text-white font-medium shadow-sm' : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
            }`}>
            {v.label}
          </button>
        ))}
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
      </div>

      {/* 主表格 */}
      <div className="flex-1 min-h-0 px-4 py-2">
        {activeGroup ? (
          <CounselorStudentGrid />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm border border-slate-300 rounded-lg bg-white">
            請選擇上方的關懷長分組
          </div>
        )}
      </div>

      {showManage && <GroupManageModal onClose={() => setShowManage(false)} />}
    </div>
  )
}
