'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { csrfFetch } from '@/lib/utils/csrf'
import { toast } from '@/lib/toast'

interface AliasRecord {
  id: string
  original_parent_id: number
  proxy_parent_id: number
  note: string | null
}

// 正式站/preview 部署下 checkAuth(request) 的 CSRF 檢查對所有 HTTP method
// 都會做（見 lib/auth.ts），讀取也不例外，故一律用 csrfFetch。
const fetcher = (url: string) => csrfFetch(url).then(res => res.json())

export function useAliasManagement() {
  const { data: aliasData, mutate: mutateAliases } = useSWR<{ aliases: AliasRecord[] }>('/api/parent-aliases', fetcher)
  const [origId, setOrigId] = useState('')
  const [proxyId, setProxyId] = useState('')
  const [aliasNote, setAliasNote] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreateAlias = useCallback(async () => {
    const oId = parseInt(origId)
    const pId = parseInt(proxyId)
    if (isNaN(oId) || isNaN(pId)) return
    setSaving(true)
    try {
      const res = await csrfFetch('/api/parent-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_parent_id: oId, proxy_parent_id: pId, note: aliasNote }),
      })
      if (!res.ok) {
        toast.error('新增代管失敗，請重新整理頁面後再試一次。')
        return
      }
      await mutateAliases()
      setOrigId('')
      setProxyId('')
      setAliasNote('')
    } finally {
      setSaving(false)
    }
  }, [origId, proxyId, aliasNote, mutateAliases])

  const handleDeleteAlias = useCallback(async (id: string) => {
    if (!confirm('確定刪除此代管關係？相關組織鏈將回歸原始介紹人。')) return
    const res = await csrfFetch(`/api/parent-aliases/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('刪除代管失敗，請重新整理頁面後再試一次。')
      return
    }
    await mutateAliases()
  }, [mutateAliases])

  return {
    aliases: aliasData?.aliases ?? [],
    origId,
    setOrigId,
    proxyId,
    setProxyId,
    aliasNote,
    setAliasNote,
    saving,
    handleCreateAlias,
    handleDeleteAlias,
  }
}
