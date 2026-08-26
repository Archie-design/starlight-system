'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import useSWR from 'swr'
import { useStudentStore } from '@/store/useStudentStore'
import { csrfFetch } from '@/lib/utils/csrf'
import { formatElapsedSinceImport } from '@/lib/utils/elapsedTime'
import { REGIONS, ROLES } from '@/lib/constants'
import type { StudentView } from '@/lib/db/types'
import type { MembershipStatus } from '@/lib/utils/studentStatus'
import MultiSelectDropdown from '@/components/shared/MultiSelectDropdown'
import {
  encodeColumnFiltersToParams, decodeColumnFiltersFromParams,
  encodeSortToParams, decodeSortFromParams,
} from '@/lib/utils/columnFilterUrl'

const COURSE_STAGES: { value: 0 | 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 0, label: '未上課' },
  { value: 1, label: '一階' },
  { value: 2, label: '二階' },
  { value: 3, label: '三階' },
  { value: 4, label: '四階' },
  { value: 5, label: '五階' },
]

const MEMBERSHIP_OPTIONS: { value: string; label: string }[] = [
  { value: 'expired', label: '已過期' },
  { value: 'in30', label: '30 天內到期' },
  { value: 'in90', label: '90 天內到期' },
  { value: 'valid', label: '有效' },
  { value: 'none', label: '無資料' },
]

const QUICK_VIEWS: { value: StudentView; label: string }[] = [
  { value: 'resubscribe', label: '續報潛力' },
  { value: 'owing', label: '待催欠款' },
  { value: 'newbie', label: '本月新生' },
  { value: 'duplicate_name', label: '同名學員' },
]

/** 「會籍快到期」快捷鍵勾選的會籍狀態組合，與會籍下拉共用同一套邏輯 */
const EXPIRING_STATUSES: MembershipStatus[] = ['expired', 'in30']

// 正式站/preview 部署下 checkAuth(request) 的 CSRF 檢查需要 x-csrf-token
// header（見 lib/utils/csrf.ts），普通 fetch 沒有帶會被判定失敗、回 401
// （P0 #1 修復把 CSRF 邏輯改嚴後才浮現此既有疏漏，一併修正）。
const fetcher = (url: string) => csrfFetch(url).then(r => r.json())

function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function FilterBar() {
  const { filters, setFilter, setMembershipStatus, toggleQuickView, resetFilters, setColumnFilter, sort, setSort } = useStudentStore()
  const isActive = (v: unknown) => v !== '' && v !== false && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  const { columnFilters, ...baseFilters } = filters
  const columnFilterCount = Object.keys(columnFilters).length
  const hasFilter = columnFilterCount > 0 || Object.values(baseFilters).some(isActive)
  const activeCount = columnFilterCount + Object.values(baseFilters).filter(isActive).length
  const isExpiringActive =
    filters.membershipStatus.length === EXPIRING_STATUSES.length &&
    EXPIRING_STATUSES.every((s) => filters.membershipStatus.includes(s))

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { data: lastUpdatedData } = useSWR<{ updatedAt: string | null }>(
    '/api/last-updated', fetcher, { revalidateOnFocus: false, refreshInterval: 60_000 }
  )
  const { data: lastImportData } = useSWR<{ lastImportAt: string | null }>(
    '/api/last-import', fetcher, { revalidateOnFocus: false, refreshInterval: 60_000 }
  )

  // 相對經過時間只需要隨「現在時間」推進而重算，不需要重新打 API——
  // 用一個每 30 秒 tick 一次的 state 觸發重渲染，而非縮短 SWR 的
  // refreshInterval（見 design.md 決策 5）。
  const [, forceElapsedTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceElapsedTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // 初次載入：從 URL 還原篩選條件
  useEffect(() => {
    const name = searchParams.get('name') ?? ''
    const counselor = searchParams.get('counselor') ?? ''
    const region = searchParams.get('region') ?? ''
    const role = searchParams.get('role') ?? ''
    const hasCourse5 = searchParams.get('hasCourse5') === '1'
    if (name) setFilter('name', name)
    if (counselor) setFilter('counselor', counselor)
    if (region) setFilter('region', region)
    if (role) setFilter('role', role)
    if (hasCourse5) setFilter('hasCourse5', true)

    const columnFilters = decodeColumnFiltersFromParams(searchParams)
    for (const [field, value] of Object.entries(columnFilters)) setColumnFilter(field, value)

    const restoredSort = decodeSortFromParams(searchParams)
    if (restoredSort) setSort(restoredSort)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 篩選變更時同步 URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.name) params.set('name', filters.name)
    if (filters.counselor) params.set('counselor', filters.counselor)
    if (filters.region) params.set('region', filters.region)
    if (filters.role) params.set('role', filters.role)
    if (filters.hasCourse5) params.set('hasCourse5', '1')
    encodeColumnFiltersToParams(params, filters.columnFilters)
    encodeSortToParams(params, sort)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [filters, sort, pathname, router])

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg shadow-sm">
      {/* 姓名搜尋 */}
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
        <input
          type="text"
          placeholder="搜尋姓名…"
          value={filters.name}
          onChange={(e) => setFilter('name', e.target.value)}
          className="border border-slate-300 rounded pl-6 pr-2 py-1 text-xs w-32 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
      </div>

      {/* 關懷員搜尋 */}
      <input
        type="text"
        placeholder="關懷員…"
        value={filters.counselor}
        onChange={(e) => setFilter('counselor', e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs w-28 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />

      {/* 地區 */}
      <select
        value={filters.region}
        onChange={(e) => setFilter('region', e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">全部地區</option>
        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* 角色 */}
      <select
        value={filters.role}
        onChange={(e) => setFilter('role', e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">全部角色</option>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* 課程進度（最高完成階） */}
      <select
        value={filters.courseStage === '' ? '' : String(filters.courseStage)}
        onChange={(e) => setFilter('courseStage', e.target.value === '' ? '' : (Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5))}
        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        title="課程進度（最高完成階）"
      >
        <option value="">全部進度</option>
        {COURSE_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {/* 會籍狀態（可複選） */}
      <MultiSelectDropdown
        label="會籍狀態"
        title="會籍狀態（可複選）"
        options={MEMBERSHIP_OPTIONS}
        selected={filters.membershipStatus}
        onChange={(next) => setMembershipStatus(next as MembershipStatus[])}
      />

      {/* 心之使者 */}
      <label className={`
        flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border transition-colors select-none
        ${filters.isSpirit
          ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}
      `}>
        <input
          type="checkbox"
          checked={filters.isSpirit}
          onChange={(e) => setFilter('isSpirit', e.target.checked)}
          className="accent-blue-600"
        />
        心之使者
      </label>

      {/* 情境快捷視圖（跨欄位，一鍵套用、互斥） */}
      <span className="text-slate-300 mx-0.5 select-none">|</span>
      {QUICK_VIEWS.slice(0, 2).map((v) => (
        <button
          key={v.value}
          onClick={() => toggleQuickView(v.value)}
          className={`text-xs px-2 py-1 rounded border transition-colors select-none ${
            filters.view === v.value
              ? 'bg-amber-500 border-amber-500 text-white font-medium shadow-sm'
              : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
          }`}
        >
          {v.label}
        </button>
      ))}
      {/* 會籍快到期：勾選會籍下拉的「已過期＋30 天內到期」，與下拉共用同一套邏輯 */}
      <button
        onClick={() => setMembershipStatus(isExpiringActive ? [] : EXPIRING_STATUSES)}
        title="等同於勾選會籍狀態：已過期 + 30 天內到期"
        className={`text-xs px-2 py-1 rounded border transition-colors select-none ${
          isExpiringActive
            ? 'bg-amber-500 border-amber-500 text-white font-medium shadow-sm'
            : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
        }`}
      >
        會籍快到期
      </button>
      {QUICK_VIEWS.slice(2).map((v) => (
        <button
          key={v.value}
          onClick={() => toggleQuickView(v.value)}
          className={`text-xs px-2 py-1 rounded border transition-colors select-none ${
            filters.view === v.value
              ? 'bg-amber-500 border-amber-500 text-white font-medium shadow-sm'
              : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
          }`}
        >
          {v.label}
        </button>
      ))}

      {/* 已啟用篩選數量 + 清除 */}
      {hasFilter && (
        <div className="flex items-center gap-1 ml-0.5">
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium tabular-nums">
            {activeCount}
          </span>
          <button
            onClick={resetFilters}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors px-1"
            title="清除所有篩選"
          >
            ✕ 清除
          </button>
        </div>
      )}

      {/* 最後更新時間 + 距上次匯入經過時間 */}
      <span className="ml-auto text-xs text-slate-400 tabular-nums whitespace-nowrap">
        更新：{formatLastUpdated(lastUpdatedData?.updatedAt)}
        <span className="mx-1 text-slate-300">・</span>
        {formatElapsedSinceImport(lastImportData?.lastImportAt)}
      </span>
    </div>
  )
}
