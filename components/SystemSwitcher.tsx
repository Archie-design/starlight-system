'use client'

import type { SheetSystem } from '@/lib/supabase/types'

const ALL_SYSTEMS: SheetSystem[] = ['星光', '太陽']

/**
 * 體系切換器（僅 superadmin 顯示）。
 * 切換時同步寫入 sl_view_system cookie，讓 SSR 頁與 API 採同一體系，
 * 並呼叫 onChange 更新對應 store 的 system。
 */
export default function SystemSwitcher({
  value,
  onChange,
}: {
  value: SheetSystem
  onChange: (s: SheetSystem) => void
}) {
  const switchSystem = (s: SheetSystem) => {
    document.cookie = `sl_view_system=${encodeURIComponent(s)}; path=/; max-age=${30 * 60}; samesite=lax`
    onChange(s)
  }

  return (
    <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
      {ALL_SYSTEMS.map((s) => (
        <button
          key={s}
          onClick={() => switchSystem(s)}
          className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
            value === s ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
