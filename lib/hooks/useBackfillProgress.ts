'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export function useBackfillProgress() {
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

  const handleBackfill = useCallback(async () => {
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
  }, [])

  return {
    backfilling,
    backfillResult,
    backfillProgress,
    handleBackfill,
  }
}
