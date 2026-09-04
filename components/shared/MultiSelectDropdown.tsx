'use client'

import { usePopoverToggle } from './usePopoverToggle'

interface Option {
  value: string
  label: string
}

export type MultiSelectMode = 'include' | 'exclude'

/**
 * 套用結果，單一入口——呼叫端只需依此寫回對應的狀態，一次動作只觸發一次
 * 狀態更新。這裡刻意不拆成 onChange/onModeChange/onIsEmptyChange 三個各自
 * 獨立呼叫的回呼：先前的設計是三個回呼各自呼叫 setColumnFilter 寫入同一個
 * store 欄位，只要同一個使用者動作連續呼叫兩個回呼（例如「清除」需要同時
 * 清空清單與 isEmpty），後呼叫的就會覆蓋先呼叫的，导致淨效果與預期不符
 * （見 TextFilterPopover 曾修過的同類 race condition：commit
 * "consolidate TextFilterPopover callbacks into single onApply handler"）。
 */
export type MultiSelectResult =
  | { kind: 'values'; values: string[]; mode: MultiSelectMode }
  | { kind: 'isEmpty'; isEmpty: boolean }
  | null

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
   * 未傳入 mode 時不顯示切換鈕，維持原本純複選行為（會籍狀態等既有用法不受影響）。
   */
  mode?: MultiSelectMode
  /**
   * 是否已套用「為空／不為空」條件（選用）。傳入時面板底部會顯示「為空」
   * 「不為空」快捷按鈕，與清單複選互斥。
   */
  isEmpty?: boolean
  /**
   * 「模式切換」「為空/不為空」「清除」的單一套用入口（選用）。傳入
   * `onApply` 時才會顯示模式切換鈕與為空/不為空按鈕；不傳則維持原本純
   * `onChange` 複選行為。
   */
  onApply?: (result: MultiSelectResult) => void
}

/** 通用多選下拉：以 checkbox 清單勾選多個值，按鈕上顯示已選數量；選用支援模式切換與「為空/不為空」快捷條件 */
export default function MultiSelectDropdown({
  label, options, selected, onChange, title, iconOnly, mode, isEmpty, onApply,
}: MultiSelectDropdownProps) {
  const { open, setOpen, ref } = usePopoverToggle<HTMLDivElement>()

  // isEmpty: true=為空、false=不為空、undefined=未使用此模式（與 checkbox 清單互斥）
  const isEmptyActive = isEmpty !== undefined

  const toggle = (value: string) => {
    // 只呼叫 onChange：它會用 setColumnFilter 寫入完整的新 ColumnFilterValue
    // （不含 isEmpty 欄位），下一輪渲染時 `isEmpty` prop 自然變回 undefined，
    // 不需要另外通知「清空 isEmpty」。
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const active = selected.length > 0 || isEmptyActive
  const showModeToggle = !!onApply && mode !== undefined
  const showEmptyToggle = !!onApply
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
          aria-label={active ? `${title ?? label}${statusSuffix}` : (title ?? `篩選「${label}」`)}
          aria-expanded={open}
          className={`flex items-center justify-center w-4 h-4 rounded transition-colors ${
            active ? `${activeColorClasses.icon} shadow-sm` : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
          }`}
        >
          <span className="text-[10px]" aria-hidden="true">🔍</span>
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
                onClick={() => onApply!({ kind: 'values', values: selected, mode: 'include' })}
                className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                  !isExclude ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                包含
              </button>
              <button
                type="button"
                onClick={() => onApply!({ kind: 'values', values: selected, mode: 'exclude' })}
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
                onClick={() => onApply!(isEmpty === true ? null : { kind: 'isEmpty', isEmpty: true })}
                className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                  isEmpty === true ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                為空
              </button>
              <button
                type="button"
                onClick={() => onApply!(isEmpty === false ? null : { kind: 'isEmpty', isEmpty: false })}
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
              onClick={() => (onApply ? onApply(null) : onChange([]))}
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
