'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useOrgData } from '@/hooks/useOrgData'

interface OverrideRecord {
  id: string
  student_id: number
  student_name: string
  override_parent_id: number
  proxy_name: string
  note: string | null
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function useOverrideManagement() {
  const { data: overrideData, mutate: mutateOverrides } = useSWR<{ overrides: OverrideRecord[] }>('/api/student-overrides', fetcher)
  const { students: allStudents } = useOrgData()

  const [overrideOrigId, setOverrideOrigId] = useState('')
  const [overrideProxyId, setOverrideProxyId] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [downlineSearch, setDownlineSearch] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [saving, setSaving] = useState(false)

  const downlines = useMemo(() => {
    const pId = parseInt(overrideOrigId)
    if (isNaN(pId)) return []
    const baseList = allStudents.filter(s => {
      let match = s.introducer?.match(/^(\d+)_/)
      if (match && parseInt(match[1]) === pId) return true
      match = s.counselor?.match(/^(\d+)_/)
      if (match && parseInt(match[1]) === pId) return true
      return false
    })

    if (!downlineSearch.trim()) return baseList
    return baseList.filter(s =>
      s.name.includes(downlineSearch.trim()) ||
      s.id.toString().includes(downlineSearch.trim())
    )
  }, [allStudents, overrideOrigId, downlineSearch])

  const handleCreateOverrides = useCallback(async () => {
    const pId = parseInt(overrideProxyId)
    if (isNaN(pId) || selectedStudents.length === 0) return
    setSaving(true)
    try {
      await fetch('/api/student-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: selectedStudents, override_parent_id: pId, note: overrideNote }),
      })
      await mutateOverrides()
      setSelectedStudents([])
      setOverrideOrigId('')
      setOverrideProxyId('')
      setOverrideNote('')
    } finally {
      setSaving(false)
    }
  }, [overrideProxyId, selectedStudents, overrideNote, mutateOverrides])

  const handleDeleteOverride = useCallback(async (id: string) => {
    if (!confirm('確定取消此特定學員的強制換線設定？')) return
    await fetch(`/api/student-overrides/${id}`, { method: 'DELETE' })
    await mutateOverrides()
  }, [mutateOverrides])

  const handleUpdateNote = useCallback(async (id: string) => {
    await fetch(`/api/student-overrides/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: editingNoteValue }),
    })
    await mutateOverrides()
    setEditingNoteId(null)
  }, [editingNoteValue, mutateOverrides])

  return {
    overrides: overrideData?.overrides ?? [],
    downlines,
    overrideOrigId,
    setOverrideOrigId,
    overrideProxyId,
    setOverrideProxyId,
    overrideNote,
    setOverrideNote,
    selectedStudents,
    setSelectedStudents,
    downlineSearch,
    setDownlineSearch,
    editingNoteId,
    setEditingNoteId,
    editingNoteValue,
    setEditingNoteValue,
    saving,
    handleCreateOverrides,
    handleDeleteOverride,
    handleUpdateNote,
  }
}
