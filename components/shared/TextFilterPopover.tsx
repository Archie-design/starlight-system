'use client'

import { useState, useEffect } from 'react'
import { usePopoverToggle } from './usePopoverToggle'

export type TextFilterMode = 'include' | 'exclude'

interface TextFilterPopoverProps {
  label: string
  value: string
  onChange: (next: string, mode: TextFilterMode) => void
  title?: string
  /** 目前的包含/排除模式，預設 'include' */
  mode?: TextFilterMode
}

/** 表頭文字欄位篩選：包含或排除比對，開啟時聚焦輸入框 */
export default function TextFilterPopover({ label, value, onChange, title, mode = 'include' }: TextFilterPopoverProps) {
  const { open, setOpen, ref } = usePopoverToggle<HTMLDivElement>()
  const [draft, setDraft] = useState(value)
  const [draftMode, setDraftMode] = useState<TextFilterMode>(mode)

  useEffect(() => {
    if (open) {
      setDraft(value)
      setDraftMode(mode)
    }
  }, [open, value, mode])

  const active = value !== ''
  const isExclude = mode === 'exclude'

  const apply = () => {
    onChange(draft, draftMode)
    setOpen(false)
  }

  const clear = () => {
    onChange('', draftMode)
    setDraft('')
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={active ? `「${label}」已套用${isExclude ? '排除' : ''}篩選，點擊調整` : title}
        className={`flex items-center justify-center w-4 h-4 rounded transition-colors ${
          active
            ? isExclude ? 'bg-amber-500 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'
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
          <div className="flex items-center gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => setDraftMode('include')}
              className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                draftMode === 'include' ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              包含
            </button>
            <button
              type="button"
              onClick={() => setDraftMode('exclude')}
              className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                draftMode === 'exclude' ? 'bg-amber-500 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              排除
            </button>
          </div>
          <input
            autoFocus
            type="text"
            placeholder={`篩選「${label}」${draftMode === 'exclude' ? '不包含' : '包含'}…`}
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
