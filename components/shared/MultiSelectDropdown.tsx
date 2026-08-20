'use client'

import { usePopoverToggle } from './usePopoverToggle'

interface Option {
  value: string
  label: string
}

interface MultiSelectDropdownProps {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  title?: string
}

/** 通用多選下拉：以 checkbox 清單勾選多個值，按鈕上顯示已選數量 */
export default function MultiSelectDropdown({ label, options, selected, onChange, title }: MultiSelectDropdownProps) {
  const { open, setOpen, ref } = usePopoverToggle<HTMLDivElement>()

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const active = selected.length > 0

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors select-none ${
          active
            ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {label}
        {active && (
          <span className="px-1 bg-blue-500 text-white rounded-full text-[10px] leading-tight tabular-nums">
            {selected.length}
          </span>
        )}
        <span className="text-slate-400 text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[9rem] bg-white border border-slate-300 rounded shadow-lg py-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-blue-600"
              />
              {opt.label}
            </label>
          ))}
          {active && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-500 border-t border-slate-100 transition-colors"
            >
              清除
            </button>
          )}
        </div>
      )}
    </div>
  )
}
