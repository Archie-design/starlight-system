'use client'

import { useState, useRef, useEffect } from 'react'
import type { OrgStudent } from '@/lib/utils/buildTree'
import { getRoleColor } from './roleColor'

interface SearchBoxProps {
  students: OrgStudent[]
  onSelect: (student: OrgStudent) => void
}

export function SearchBox({ students, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounce 搜尋輸入（300ms）以減少過濾運算
  useEffect(() => {
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [query])

  const results = debouncedQuery.trim().length >= 1
    ? students.filter(s => s.name.includes(debouncedQuery.trim())).slice(0, 20)
    : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
        <input
          type="text"
          placeholder="搜尋學員姓名…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="border border-slate-300 rounded pl-6 pr-2 py-1 text-xs w-44 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 text-xs"
          >✕</button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-slate-200 rounded shadow-lg w-56 max-h-60 overflow-auto">
          {results.map(s => (
            <button
              key={s.id}
              onClick={() => { onSelect(s); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors text-left"
            >
              <span className="font-medium text-slate-800 flex-1">
                <span className="text-slate-400 font-normal">{s.id}_</span>{s.name}
              </span>
              {s.role && (
                <span className={`text-[10px] px-1 py-0.5 rounded-full ${getRoleColor(s.role)}`}>{s.role}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 1 && results.length === 0 && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-slate-200 rounded shadow-lg w-56 px-3 py-2 text-xs text-slate-400">
          找不到符合的學員
        </div>
      )}
    </div>
  )
}
