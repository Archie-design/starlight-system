'use client'

import { useState, useEffect } from 'react'
import { usePopoverToggle } from './usePopoverToggle'

interface TextFilterPopoverProps {
  label: string
  value: string
  onChange: (next: string) => void
  title?: string
}

/** 表頭文字欄位篩選：包含比對，開啟時聚焦輸入框 */
export default function TextFilterPopover({ label, value, onChange, title }: TextFilterPopoverProps) {
  const { open, setOpen, ref } = usePopoverToggle<HTMLDivElement>()
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const active = value !== ''

  const apply = () => {
    onChange(draft)
    setOpen(false)
  }

  const clear = () => {
    onChange('')
    setDraft('')
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={active ? `「${label}」已套用篩選，點擊調整` : title}
        className={`flex items-center justify-center w-4 h-4 rounded transition-colors ${
          active
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
        }`}
      >
        <span className="text-[10px]">🔍</span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 right-0 w-44 bg-white border border-slate-300 rounded shadow-lg p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type="text"
            placeholder={`篩選「${label}」包含…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply()
              if (e.key === 'Escape') setOpen(false)
            }}
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex items-center justify-between mt-1.5">
            <button
              type="button"
              onClick={clear}
              disabled={!active}
              className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              清除
            </button>
            <button
              type="button"
              onClick={apply}
              className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              套用
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
