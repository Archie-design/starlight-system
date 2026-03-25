'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Student } from '@/lib/supabase/types'
import { useStudents } from '@/hooks/useStudents'

interface Props {
  value: string | null
  rowId: number
  field: keyof Student
  type?: 'text' | 'select' | 'date'
  options?: string[]
}

export default function EditableCell({ value, rowId, field, type = 'text', options = [] }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const { updateCell } = useStudents()

  // 外部 value 更新時同步 draft
  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = useCallback(async () => {
    setEditing(false)
    const newValue = draft.trim() || null
    if (newValue === (value ?? null)) return
    setSaving(true)
    try {
      await updateCell(rowId, field, newValue)
    } finally {
      setSaving(false)
    }
  }, [draft, value, rowId, field, updateCell])

  const cancel = useCallback(() => {
    setEditing(false)
    setDraft(value ?? '')
  }, [value])

  if (editing) {
    if (type === 'select') {
      return (
        <select
          ref={inputRef as React.Ref<HTMLSelectElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className="w-full h-full border border-blue-500 rounded px-1 text-xs bg-white outline-none ring-1 ring-blue-300 shadow-sm"
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    return (
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        className="w-full h-full border border-blue-500 rounded px-1 text-xs bg-white outline-none ring-1 ring-blue-300 shadow-sm"
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title={value ?? ''}
      className={`
        w-full h-full px-1.5 py-0.5 cursor-text truncate text-xs leading-5
        hover:bg-blue-50 rounded transition-colors group
        ${saving ? 'opacity-40' : ''}
        ${!value ? 'text-slate-300' : 'text-slate-700'}
      `}
    >
      {saving ? (
        <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin align-middle" />
      ) : (value ?? <span className="text-slate-300">—</span>)}
    </div>
  )
}
