'use client'

import { useState, useEffect } from 'react'
import { usePopoverToggle } from './usePopoverToggle'

interface RangeFilterPopoverProps {
  label: string
  min: string | undefined
  max: string | undefined
  onChange: (min: string | undefined, max: string | undefined) => void
  /** 輸入型態，日期欄用 'date'，數值欄用 'number'（目前欄位皆為日期） */
  inputType?: 'date' | 'number'
  title?: string
}

/** 表頭區間篩選：日期或數值的 min/max，兩端皆可留空（僅設下限或上限） */
export default function RangeFilterPopover({ label, min, max, onChange, inputType = 'date', title }: RangeFilterPopoverProps) {
  const { open, setOpen, ref } = usePopoverToggle<HTMLDivElement>()
  const [draftMin, setDraftMin] = useState(min ?? '')
  const [draftMax, setDraftMax] = useState(max ?? '')

  useEffect(() => {
    if (open) {
      setDraftMin(min ?? '')
      setDraftMax(max ?? '')
    }
  }, [open, min, max])

  const active = !!min || !!max

  const apply = () => {
    onChange(draftMin || undefined, draftMax || undefined)
    setOpen(false)
  }

  const clear = () => {
    onChange(undefined, undefined)
    setDraftMin('')
    setDraftMax('')
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        className={`flex items-center text-slate-400 hover:text-blue-600 transition-colors ${active ? 'text-blue-600' : ''}`}
      >
        <span className="text-[10px]">🔍</span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 right-0 w-48 bg-white border border-slate-300 rounded shadow-lg p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-slate-400 mb-1">篩選「{label}」區間</div>
          <div className="flex flex-col gap-1">
            <input
              type={inputType}
              value={draftMin}
              onChange={(e) => setDraftMin(e.target.value)}
              placeholder="起"
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type={inputType}
              value={draftMax}
              onChange={(e) => setDraftMax(e.target.value)}
              placeholder="迄"
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
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
