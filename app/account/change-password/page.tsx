'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirm) {
      setError('兩次輸入的新密碼不一致')
      return
    }
    if (newPassword.length < 8) {
      setError('新密碼至少 8 個字元')
      return
    }

    setLoading(true)
    const res = await fetch('/api/account/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    })

    if (res.ok) {
      router.push('/students')
    } else {
      const data = await res.json()
      setError(data.error ?? '修改失敗')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-xl font-bold text-gray-800">修改密碼</h1>
          <p className="text-sm text-gray-500 mt-1">為了帳號安全，請設定新密碼</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="old" className="block text-sm font-medium text-gray-700">目前密碼</label>
            <input
              id="old"
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              required
              autoFocus
              autoComplete="current-password"
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="new" className="block text-sm font-medium text-gray-700">新密碼（至少 8 字元）</label>
            <input
              id="new"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">再次輸入新密碼</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              aria-invalid={!!error}
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '儲存中…' : '更新密碼'}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-sm text-red-500 bg-red-50 rounded p-2 mt-4">{error}</p>
        )}
      </div>
    </div>
  )
}
