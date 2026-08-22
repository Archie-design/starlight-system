'use client'

import { usePopoverToggle } from './usePopoverToggle'

interface Option {
  value: string
  label: string
}

export type MultiSelectMode = 'include' | 'exclude'

interface MultiSelectDropdownProps {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  title?: string
  /** 精簡模式：僅顯示放大鏡圖示（用於表頭欄位篩選），不顯示文字/箭頭 */
  iconOnly?: boolean
  /**
   * 包含/排除模式（選用）。傳入時面板會顯示模式切換鈕：
   * 'include'（預設）＝勾選才顯示；'exclude'＝隱藏勾選的、顯示其餘。
   * 未傳入 mode/onModeChange 時不顯示切換鈕，維持原本純複選行為
   * （會籍狀態等既有用法不受影響）。
   */
  mode?: MultiSelectMode
  onModeChange?: (mode: MultiSelectMode) => void
  /**
   * 是否已套用「為空／不為空」條件（選用）。傳入 `onIsEmptyChange` 時，
   * 面板底部會顯示「為空」「不為空」快捷按鈕，與清單複選互斥——
   * 套用為空/不為空時會清空已勾選的清單，反之亦然。
   */
  isEmpty?: boolean
  onIsEmptyChange?: (isEmpty: boolean | null) => void
}

/** 通用多選下拉：以 checkbox 清單勾選多個值，按鈕上顯示已選數量；選用支援「為空/不為空」快捷條件 */
export default function MultiSelectDropdown({
  label, options, selected, onChange, title, iconOnly, mode, onModeChange, isEmpty, onIsEmptyChange,
}: MultiSelectDropdownProps) {
  const { open, setOpen, ref } = usePopoverToggle<HTMLDivElement>()

  // isEmpty: true=為空、false=不為空、undefined=未使用此模式（與 checkbox 清單互斥）
  const isEmptyActive = isEmpty !== undefined

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
    if (isEmptyActive) onIsEmptyChange?.(null)
  }

  const active = selected.length > 0 || isEmptyActive
  const showModeToggle = !!onModeChange
  const showEmptyToggle = !!onIsEmptyChange
  const isExclude = mode === 'exclude'
  // 排除模式啟用時用琥珀色系跟一般（包含）模式的藍色系區分，避免誤讀成一般篩選
  const activeColorClasses = isExclude
    ? { icon: 'bg-amber-500 text-white', pill: 'bg-amber-50 border-amber-400 text-amber-700', badge: 'bg-amber-500' }
    : { icon: 'bg-blue-600 text-white', pill: 'bg-blue-50 border-blue-400 text-blue-700', badge: 'bg-blue-500' }

  const modeLabel = isExclude ? '排除' : '包含'
  const statusSuffix = isEmptyActive
    ? `（已設為${isEmpty ? '為空' : '不為空'}，點擊調整）`
    : active ? `（${modeLabel} ${selected.length} 項，點擊調整）` : ''

  return (
    <div className="relative" ref={ref}>
      {iconOnly ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={active ? `${title ?? label}${statusSuffix}` : title}
          className={`flex items-center justify-center w-4 h-4 rounded transition-colors ${
            active ? `${activeColorClasses.icon} shadow-sm` : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
          }`}
        >
          <span className="text-[10px]">🔍</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={title}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors select-none ${
            active ? `${activeColorClasses.pill} font-medium` : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {label}
          {active && (
            <span className={`px-1 text-white rounded-full text-[10px] leading-tight tabular-nums ${activeColorClasses.badge}`}>
              {isExclude ? '排除' : selected.length}
            </span>
          )}
          <span className="text-slate-400 text-[10px]">▾</span>
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 min-w-[9rem] bg-white border border-slate-300 rounded shadow-lg py-1">
          {showModeToggle && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-slate-100">
              <button
                type="button"
                onClick={() => onModeChange!('include')}
                className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                  !isExclude ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                包含
              </button>
              <button
                type="button"
                onClick={() => onModeChange!('exclude')}
                className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                  isExclude ? 'bg-amber-500 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                排除
              </button>
            </div>
          )}
          <div className={isEmptyActive ? 'opacity-40 pointer-events-none' : ''}>
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
          </div>
          {showEmptyToggle && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { onChange([]); onIsEmptyChange!(isEmpty === true ? null : true) }}
                className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                  isEmpty === true ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                為空
              </button>
              <button
                type="button"
                onClick={() => { onChange([]); onIsEmptyChange!(isEmpty === false ? null : false) }}
                className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                  isEmpty === false ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                不為空
              </button>
            </div>
          )}
          {active && (
            <button
              type="button"
              onClick={() => { onChange([]); onIsEmptyChange?.(null) }}
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
