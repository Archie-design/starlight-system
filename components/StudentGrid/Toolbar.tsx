'use client'

import { useStudentStore } from '@/store/useStudentStore'
import { useStudents } from '@/hooks/useStudents'
import type { SheetSystem } from '@/lib/supabase/types'

const TABS: SheetSystem[] = ['星光', '太陽']

const VIEWS = [
  { key: 'grid', label: '表格' },
  { key: 'org',  label: '組織圖' },
] as const

export default function Toolbar() {
  const { activeTab, setActiveTab, setImportModalOpen, view, setView } = useStudentStore()
  const { count } = useStudents()

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
    <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-slate-200 shadow-sm">
      {/* 體系 Tab 切換 */}
      <div className="flex items-center gap-0.5">
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
      <div className="flex items-center gap-1.5">
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
