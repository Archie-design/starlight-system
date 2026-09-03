'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useDownlineLookup } from '@/hooks/useDownlineLookup'
import { csrfFetch } from '@/lib/utils/csrf'

interface OverrideRecord {
  id: string
  student_id: number
  student_name: string
  override_parent_id: number
  proxy_name: string
  note: string | null
}

// 正式站/preview 部署下 checkAuth(request) 的 CSRF 檢查對所有 HTTP method
// 都會做（見 lib/auth.ts），讀取也不例外，故一律用 csrfFetch。
const fetcher = (url: string) => csrfFetch(url).then(res => res.json())

export function useOverrideManagement() {
  const { data: overrideData, mutate: mutateOverrides } = useSWR<{ overrides: OverrideRecord[] }>('/api/student-overrides', fetcher)
  const { students: allStudents } = useDownlineLookup()

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
      const res = await csrfFetch('/api/student-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: selectedStudents, override_parent_id: pId, note: overrideNote }),
      })
      if (!res.ok) {
        alert('新增換線特例失敗，請重新整理頁面後再試一次。')
        return
      }
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
    const res = await csrfFetch(`/api/student-overrides/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('取消換線特例失敗，請重新整理頁面後再試一次。')
      return
    }
    await mutateOverrides()
  }, [mutateOverrides])

  const handleUpdateNote = useCallback(async (id: string) => {
    const res = await csrfFetch(`/api/student-overrides/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: editingNoteValue }),
    })
    if (!res.ok) {
      alert('更新備註失敗，請重新整理頁面後再試一次。')
      return
    }
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
