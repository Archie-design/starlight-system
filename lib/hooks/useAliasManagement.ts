'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'

interface AliasRecord {
  id: string
  original_parent_id: number
  proxy_parent_id: number
  note: string | null
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

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
      await fetch('/api/parent-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_parent_id: oId, proxy_parent_id: pId, note: aliasNote }),
      })
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
    await fetch(`/api/parent-aliases/${id}`, { method: 'DELETE' })
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
