'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import useSWR from 'swr'
import { useStudentStore } from '@/store/useStudentStore'

const REGIONS = ['北區', '中區', '南區']
const ROLES = [
  '會員', '小天使', '輔導員', '輔導員共同經營',
  '傳愛領袖', '傳愛領袖共同經營',
  '輔導長', '輔導長共同經營',
  '體系長', '體系長共同經營',
]

const fetcher = (url: string) => fetch(url).then(r => r.json())

function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function FilterBar() {
  const { filters, setFilter, resetFilters } = useStudentStore()
  const hasFilter = Object.values(filters).some((v) => v !== '' && v !== false)
  const activeCount = Object.values(filters).filter((v) => v !== '' && v !== false).length

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { data: lastUpdatedData } = useSWR<{ updatedAt: string | null }>(
    '/api/last-updated', fetcher, { revalidateOnFocus: false, refreshInterval: 60_000 }
  )

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
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [filters, pathname, router])

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-slate-100 border-b border-slate-300">
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

      {/* 輔導員搜尋 */}
      <input
        type="text"
        placeholder="輔導員…"
        value={filters.counselor}
        onChange={(e) => setFilter('counselor', e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs w-28 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />

      {/* 地區 */}
      <select
        value={filters.region}
        onChange={(e) => setFilter('region', e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">全部地區</option>
        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* 角色 */}
      <select
        value={filters.role}
        onChange={(e) => setFilter('role', e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">全部角色</option>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* 五階篩選 */}
      <label className={`
        flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border transition-colors select-none
        ${filters.hasCourse5
          ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}
      `}>
        <input
          type="checkbox"
          checked={filters.hasCourse5}
          onChange={(e) => setFilter('hasCourse5', e.target.checked)}
          className="accent-blue-600"
        />
        有五階
      </label>

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

      {/* 最後更新時間 */}
      <span className="ml-auto text-xs text-slate-400 tabular-nums whitespace-nowrap">
        更新：{formatLastUpdated(lastUpdatedData?.updatedAt)}
      </span>
    </div>
  )
}
