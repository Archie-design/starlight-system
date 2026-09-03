'use client'

import { useState, useCallback, useMemo } from 'react'
import { useCounselorGroups } from '@/hooks/useCounselorGroups'
import { useDownlineLookup } from '@/hooks/useDownlineLookup'
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

  const handleCreateGroup = useCallback(async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await fetch('/api/counselor-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          display_order: (groups.at(-1)?.display_order ?? 0) + 1,
          root_student_ids: parseRoots(newRoots),
        }),
      })
      await mutateGroups()
      setNewName('')
      setNewRoots('')
    } finally {
      setSaving(false)
    }
  }, [newName, newRoots, groups, parseRoots, mutateGroups])

  const handleDeleteGroup = useCallback(async (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」分組？已指派的學員不會被刪除，但 group_leader 欄位將失效。`)) return
    await fetch(`/api/counselor-groups/${id}`, { method: 'DELETE' })
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
      await fetch(`/api/counselor-groups/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), root_student_ids: parseRoots(editRoots) }),
      })
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
