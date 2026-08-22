'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePopoverToggle } from './usePopoverToggle'
import type { TextOperator, ColumnFilterMode } from '@/lib/db/types'

const OPERATOR_LABELS: Record<TextOperator, string> = {
  contains: '包含',
  not_contains: '不包含',
  equals: '等於',
  starts_with: '開頭是',
  ends_with: '結尾是',
  is_empty: '為空',
  is_not_empty: '不為空',
}
const OPERATORS = Object.keys(OPERATOR_LABELS) as TextOperator[]
const NO_VALUE_OPERATORS: TextOperator[] = ['is_empty', 'is_not_empty']

/** 值清單超過此門檻時提示改用依條件篩選，仍保留搜尋框協助縮小範圍 */
const MANY_VALUES_THRESHOLD = 200

export type TextConditionValue = { operator: TextOperator; value: string }
export type TextValueListValue = { values: string[]; mode: ColumnFilterMode }

interface TextFilterPopoverProps {
  label: string
  /** 目前生效的依條件篩選（無則 undefined） */
  condition?: TextConditionValue
  /** 目前生效的依值篩選（無則 undefined） */
  valueList?: TextValueListValue
  /** 套用依條件篩選；傳 null 清除 */
  onApplyCondition: (next: TextConditionValue | null) => void
  /** 套用依值篩選；傳 null 清除 */
  onApplyValueList: (next: TextValueListValue | null) => void
  /** 開啟「依值」籤頁時延遲呼叫，取得該欄位目前查詢範圍內的不重複值 */
  fetchDistinctValues: () => Promise<string[]>
  title?: string
}

/**
 * 表頭文字欄位篩選面板：「依值」與「依條件」雙籤頁。
 * 依值＝動態值清單勾選（沿用 enum 型別的 include/exclude 語意）；
 * 依條件＝7 種比對條件（包含/不包含/等於/開頭是/結尾是/為空/不為空）。
 * 兩籤頁互斥（切換籤頁時捨棄另一籤頁的草稿），對應同一個表頭欄位一次
 * 只會生效一種篩選型態。
 */
export default function TextFilterPopover({
  label, condition, valueList, onApplyCondition, onApplyValueList, fetchDistinctValues, title,
}: TextFilterPopoverProps) {
  const { open, setOpen, ref } = usePopoverToggle<HTMLDivElement>()
  const [tab, setTab] = useState<'value' | 'condition'>(valueList ? 'value' : 'condition')

  // 依條件籤頁草稿
  const [draftOperator, setDraftOperator] = useState<TextOperator>(condition?.operator ?? 'contains')
  const [draftValue, setDraftValue] = useState(condition?.value ?? '')

  // 依值籤頁草稿
  const [allValues, setAllValues] = useState<string[] | null>(null)
  const [loadingValues, setLoadingValues] = useState(false)
  const [search, setSearch] = useState('')
  const [draftSelected, setDraftSelected] = useState<string[]>(valueList?.values ?? [])
  const [draftMode, setDraftMode] = useState<ColumnFilterMode>(valueList?.mode ?? 'include')

  const active = !!condition || !!valueList

  useEffect(() => {
    if (!open) return
    setTab(valueList ? 'value' : 'condition')
    setDraftOperator(condition?.operator ?? 'contains')
    setDraftValue(condition?.value ?? '')
    setDraftSelected(valueList?.values ?? [])
    setDraftMode(valueList?.mode ?? 'include')
    setSearch('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 開啟依值籤頁時才查詢，避免每次開面板都打一次 API
  useEffect(() => {
    if (!open || tab !== 'value' || allValues !== null) return
    let cancelled = false
    setLoadingValues(true)
    fetchDistinctValues()
      .then((values) => { if (!cancelled) setAllValues(values) })
      .finally(() => { if (!cancelled) setLoadingValues(false) })
    return () => { cancelled = true }
  }, [open, tab, allValues, fetchDistinctValues])

  const filteredValues = useMemo(() => {
    if (!allValues) return []
    if (!search) return allValues
    return allValues.filter((v) => v.includes(search))
  }, [allValues, search])

  const toggleValue = (v: string) => {
    setDraftSelected((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }

  const applyValueList = () => {
    onApplyValueList(draftSelected.length > 0 ? { values: draftSelected, mode: draftMode } : null)
    onApplyCondition(null)
    setOpen(false)
  }

  const applyCondition = () => {
    onApplyCondition({ operator: draftOperator, value: NO_VALUE_OPERATORS.includes(draftOperator) ? '' : draftValue })
    onApplyValueList(null)
    setOpen(false)
  }

  const clearAll = () => {
    onApplyCondition(null)
    onApplyValueList(null)
    setOpen(false)
  }

  const activeMode = valueList?.mode
  const isExclude = activeMode === 'exclude'

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
          className="absolute z-50 mt-1 right-0 w-56 bg-white border border-slate-300 rounded shadow-lg p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => setTab('value')}
              className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                tab === 'value' ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              依值
            </button>
            <button
              type="button"
              onClick={() => setTab('condition')}
              className={`flex-1 text-[11px] py-0.5 rounded transition-colors ${
                tab === 'condition' ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              依條件
            </button>
          </div>

          {tab === 'value' ? (
            <div>
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
                type="text"
                placeholder="搜尋值…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              {loadingValues ? (
                <div className="text-xs text-slate-400 py-3 text-center">載入中…</div>
              ) : (
                <>
                  {allValues && allValues.length > MANY_VALUES_THRESHOLD && (
                    <div className="text-[10px] text-amber-600 mb-1">
                      值過多（{allValues.length} 項），建議改用「依條件」篩選
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <button
                      type="button"
                      onClick={() => setDraftSelected((prev) => Array.from(new Set([...prev, ...filteredValues])))}
                      className="hover:text-blue-600"
                    >
                      全選
                    </button>
                    <span>{draftSelected.length} / {allValues?.length ?? 0}</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-slate-100 rounded">
                    {filteredValues.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3 text-center">沒有符合的值</div>
                    ) : (
                      filteredValues.map((v) => (
                        <label
                          key={v}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={draftSelected.includes(v)}
                            onChange={() => toggleValue(v)}
                            className="accent-blue-600"
                          />
                          <span className="truncate">{v}</span>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
              <div className="flex items-center justify-between mt-1.5">
                <button type="button" onClick={clearAll} disabled={!active}
                  className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors">
                  清除
                </button>
                <button type="button" onClick={applyValueList}
                  className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                  套用
                </button>
              </div>
            </div>
          ) : (
            <div>
              <select
                value={draftOperator}
                onChange={(e) => setDraftOperator(e.target.value as TextOperator)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                ))}
              </select>
              {!NO_VALUE_OPERATORS.includes(draftOperator) && (
                <input
                  autoFocus
                  type="text"
                  placeholder={`「${label}」${OPERATOR_LABELS[draftOperator]}…`}
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyCondition()
                    if (e.key === 'Escape') setOpen(false)
                  }}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
              <div className="flex items-center justify-between mt-1.5">
                <button type="button" onClick={clearAll} disabled={!active}
                  className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors">
                  清除
                </button>
                <button type="button" onClick={applyCondition}
                  className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                  套用
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
