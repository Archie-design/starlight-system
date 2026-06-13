'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 登出按鈕：呼叫 /api/logout 清除 session cookie 後導回登入頁。
 * 樣式可由 className 覆寫，預設沿用頂部導覽列的淡色連結風格。
 */
export default function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={className ?? 'text-xs text-blue-200/70 hover:text-white transition-colors disabled:opacity-50'}
    >
      {loading ? '登出中…' : '登出 ⏻'}
    </button>
  )
}
