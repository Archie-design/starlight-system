'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useCounselorGroups } from '@/hooks/useCounselorGroups'
import { useDownlineLookup } from '@/hooks/useDownlineLookup'
import { csrfFetch } from '@/lib/utils/csrf'
import { toast } from '@/lib/toast'
import type { CounselorGroup } from '@/lib/supabase/types'

export function useGroupManagement() {
  const { groups, mutate: mutateGroups } = useCounselorGroups()
  const { students: allStudents } = useDownlineLookup()
  const [newName, setNewName] = useState('')
  const [newRoots, setNewRoots] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRoots, setEditRoots] = useState('')
  const [saving, setSaving] = useState(false)

  const parseRoots = useCallback((s: string): number[] =>
    s.split(/[,\s]+/).map(v => parseInt(v)).filter(n => !isNaN(n) && n > 0),
  [])

  const nameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of allStudents) map.set(s.id, s.name)
    return map
  }, [allStudents])

  /** 依「根節點學員 ID」輸入框的原始字串，回傳「ID = 姓名」的查詢結果字串（查不到則標示「查無此 ID」），供輸入框下方提示使用 */
  const lookupRootNames = useCallback((rootsInput: string): string => {
    const ids = parseRoots(rootsInput)
    if (ids.length === 0) return ''
    return ids.map((id) => `${id} = ${nameById.get(id) ?? '查無此 ID'}`).join('　')
  }, [parseRoots, nameById])

  const newRootNames = useMemo(() => lookupRootNames(newRoots), [lookupRootNames, newRoots])
  const editRootNames = useMemo(() => lookupRootNames(editRoots), [lookupRootNames, editRoots])

  // 分組名稱欄位仍是空白時，自動帶入第一個根節點 ID 查到的姓名，減少
  // 「其餘同 XXX」這種手動重複輸入。只在欄位空白時補入，使用者一旦自己
  // 輸入過（或先前已被自動帶入過後又手動改掉）就不再覆蓋——用 newName
  // 本身當作「是否仍為空」的判斷依據，不需要額外的「是否已自動帶入過」
  // 旗標：一旦有值（不論來源）就不再自動覆蓋，行為單純且可預期。
  useEffect(() => {
    if (newName.trim()) return
    const firstId = parseRoots(newRoots)[0]
    if (firstId == null) return
    const name = nameById.get(firstId)
    if (name) setNewName(name)
  }, [newRoots, nameById, newName, parseRoots])

  const handleCreateGroup = useCallback(async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await csrfFetch('/api/counselor-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          display_order: (groups.at(-1)?.display_order ?? 0) + 1,
          root_student_ids: parseRoots(newRoots),
        }),
      })
      if (!res.ok) {
        toast.error('新增分組失敗，請重新整理頁面後再試一次。')
        return
      }
      await mutateGroups()
      setNewName('')
      setNewRoots('')
    } finally {
      setSaving(false)
    }
  }, [newName, newRoots, groups, parseRoots, mutateGroups])

  const handleDeleteGroup = useCallback(async (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」分組？已指派的學員不會被刪除，但 group_leader 欄位將失效。`)) return
    const res = await csrfFetch(`/api/counselor-groups/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('刪除分組失敗，請重新整理頁面後再試一次。')
      return
    }
    await mutateGroups()
  }, [mutateGroups])

  const startEdit = useCallback((g: CounselorGroup) => {
    setEditId(g.id)
    setEditName(g.name)
    setEditRoots(g.root_student_ids.join(', '))
  }, [])

  const handleUpdate = useCallback(async () => {
    if (!editId || !editName.trim()) return
    setSaving(true)
    try {
      const res = await csrfFetch(`/api/counselor-groups/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), root_student_ids: parseRoots(editRoots) }),
      })
      if (!res.ok) {
        toast.error('儲存分組失敗，請重新整理頁面後再試一次。')
        return
      }
      await mutateGroups()
      setEditId(null)
    } finally {
      setSaving(false)
    }
  }, [editId, editName, editRoots, parseRoots, mutateGroups])

  const handleMove = useCallback(async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= groups.length) return

    const current = groups[index]
    const other = groups[targetIndex]
    const currentOrder = current.display_order
    const otherOrder = other.display_order

    setSaving(true)
    try {
      const results = await Promise.all([
        csrfFetch(`/api/counselor-groups/${current.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: otherOrder }),
        }),
        csrfFetch(`/api/counselor-groups/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: currentOrder }),
        })
      ])
      if (results.some((r) => !r.ok)) {
        toast.error('調整順序失敗，請重新整理頁面後再試一次。')
        return
      }
      await mutateGroups()
    } finally {
      setSaving(false)
    }
  }, [groups, mutateGroups])

  return {
    groups,
    newName,
    setNewName,
    newRoots,
    setNewRoots,
    newRootNames,
    editId,
    setEditId,
    editName,
    setEditName,
    editRoots,
    setEditRoots,
    editRootNames,
    saving,
    handleCreateGroup,
    handleDeleteGroup,
    startEdit,
    handleUpdate,
    handleMove,
  }
}
