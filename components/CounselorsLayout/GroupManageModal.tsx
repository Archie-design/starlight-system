'use client'

import { useState, useEffect, useRef } from 'react'
import { useCounselorGroups } from '@/hooks/useCounselorGroups'
import type { CounselorGroup } from '@/lib/supabase/types'

interface Props {
  onClose: () => void
}

export default function GroupManageModal({ onClose }: Props) {
  const { groups, mutate } = useCounselorGroups()
  const [newName, setNewName] = useState('')
  const [newRoots, setNewRoots] = useState('')
  const [saving, setSaving] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)
  const [backfillProgress, setBackfillProgress] = useState(0)
  const backfillTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (backfilling) {
      setBackfillProgress(0)
      backfillTimerRef.current = setInterval(() => {
        setBackfillProgress(p => {
          if (p >= 90) { clearInterval(backfillTimerRef.current!); return 90 }
          return p + 1
        })
      }, 200)
    } else {
      if (backfillTimerRef.current) clearInterval(backfillTimerRef.current)
      if (backfillResult) setBackfillProgress(100)
    }
    return () => { if (backfillTimerRef.current) clearInterval(backfillTimerRef.current) }
  }, [backfilling, backfillResult])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRoots, setEditRoots] = useState('')

  const parseRoots = (s: string): number[] =>
    s.split(/[,\s]+/).map(v => parseInt(v)).filter(n => !isNaN(n) && n > 0)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    await fetch('/api/counselor-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        display_order: (groups.at(-1)?.display_order ?? 0) + 1,
        root_student_ids: parseRoots(newRoots),
      }),
    })
    await mutate()
    setNewName('')
    setNewRoots('')
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」分組？已指派的學員不會被刪除，但 group_leader 欄位將失效。`)) return
    await fetch(`/api/counselor-groups/${id}`, { method: 'DELETE' })
    await mutate()
  }

  const startEdit = (g: CounselorGroup) => {
    setEditId(g.id)
    setEditName(g.name)
    setEditRoots(g.root_student_ids.join(', '))
  }

  const handleBackfill = async () => {
    if (!confirm('將依介紹人鏈重新計算所有學員的所屬分組，並寫入資料庫。確定執行？')) return
    setBackfilling(true)
    setBackfillResult(null)
    const res = await fetch('/api/counselor-groups/backfill', { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      setBackfillResult(`完成：共更新 ${json.updated} 位學員（總計 ${json.total} 筆）`)
    } else {
      setBackfillResult(`錯誤：${json.error}`)
    }
    setBackfilling(false)
  }

  const handleUpdate = async () => {
    if (!editId || !editName.trim()) return
    setSaving(true)
    await fetch(`/api/counselor-groups/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), root_student_ids: parseRoots(editRoots) }),
    })
    await mutate()
    setEditId(null)
    setSaving(false)
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= groups.length) return

    const current = groups[index]
    const other = groups[targetIndex]

    // 交換 display_order
    const currentOrder = current.display_order
    const otherOrder = other.display_order

    setSaving(true)
    try {
      // 依序更新順序
      await Promise.all([
        fetch(`/api/counselor-groups/${current.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: otherOrder }),
        }),
        fetch(`/api/counselor-groups/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: currentOrder }),
        })
      ])
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-3 bg-slate-800 text-white">
          <h2 className="text-sm font-semibold">管理輔導長分組</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-lg leading-none transition-colors">✕</button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* 現有分組列表 */}
          <div className="space-y-2 mb-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">目前分組列表</p>
            {groups.map((g, index) => (
              <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                {editId === g.id ? (
                  <>
                    <div className="flex-1 space-y-1">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400"
                        placeholder="分組名稱"
                      />
                      <input
                        value={editRoots}
                        onChange={e => setEditRoots(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800 placeholder:text-slate-400"
                        placeholder="根節點學員 ID（逗號分隔，例：3034, 2888）"
                      />
                    </div>
                    <button onClick={handleUpdate} disabled={saving} className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-bold shadow-sm">儲存</button>
                    <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 font-medium">取消</button>
                  </>
                ) : (
                  <>
                    {/* 排序按鈕 */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0 || saving}
                        className="p-0.5 text-slate-300 hover:text-blue-600 disabled:opacity-10 transition-colors"
                        title="上移"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === groups.length - 1 || saving}
                        className="p-0.5 text-slate-300 hover:text-blue-600 disabled:opacity-10 transition-colors"
                        title="下移"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{g.name}</span>
                        <span className="text-[9px] px-1 bg-slate-200 text-slate-500 rounded font-mono">#{g.display_order}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                        根節點: {g.root_student_ids.length > 0 ? g.root_student_ids.join(', ') : '未設定'}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(g)} className="text-[10px] text-slate-500 hover:text-blue-600 font-bold px-2 py-1 rounded bg-white border border-slate-200 shadow-sm">編輯</button>
                      <button onClick={() => handleDelete(g.id, g.name)} className="text-[10px] text-slate-500 hover:text-red-500 font-bold px-2 py-1 rounded bg-white border border-slate-200 shadow-sm">刪除</button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4 italic">尚無分組</p>
            )}
          </div>

          {/* 重新計算歸屬 */}
          <div className="border-t border-slate-200 pt-3 mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">重新計算學員歸屬</p>
            <p className="text-[10px] text-slate-400 mb-2">依介紹人鏈追溯，自動填入所有學員的所屬分組。初次建立或修改根節點後請執行一次。</p>
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              {backfilling ? '計算中…' : '執行重新計算'}
            </button>
            {backfilling && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>正在分析並更新學員歸屬</span>
                  <span className="tabular-nums">{backfillProgress}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-200"
                    style={{ width: `${backfillProgress}%` }}
                  />
                </div>
              </div>
            )}
            {!backfilling && backfillResult && (
              <div className="mt-2">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-green-500 rounded-full w-full transition-all duration-300" />
                </div>
                <p className="text-[10px] text-slate-600">{backfillResult}</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">新增分組</p>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="分組名稱（例：王小明）"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/30 transition-all"
            />
            <input
              value={newRoots}
              onChange={e => setNewRoots(e.target.value)}
              placeholder="根節點學員 ID（逗號分隔，例：3034, 2888）"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/30 transition-all"
            />
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="w-full sm:w-auto px-6 py-2 text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 transition-all shadow-sm hover:shadow active:shadow-inner"
            >
              {saving ? '儲存中...' : '確認新增分組'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
