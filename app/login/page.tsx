'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { APP_NAME } from '@/lib/config'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (res.ok) {
      const data = await res.json()
      // 首次登入（或被重設）需強制改密碼
      router.push(data.mustChangePassword ? '/account/change-password' : '/students')
    } else {
      const data = await res.json()
      setError(data.error ?? '登入失敗')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⭐</div>
          <h1 className="text-xl font-bold text-gray-800">{APP_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">請輸入帳號與密碼以繼續</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              帳號
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="請輸入帳號"
              required
              autoFocus
              autoComplete="username"
              aria-invalid={!!error}
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              密碼
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              required
              autoComplete="current-password"
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '登入中…' : '登入'}
          </button>
        </form>

        {error && (
          <p id="login-error" role="alert" className="text-sm text-red-500 bg-red-50 rounded p-2 mt-4">{error}</p>
        )}

        <p className="text-xs text-gray-400 mt-4 leading-relaxed">
          關懷長以上首次登入：帳號為您的學員 ID、密碼為手機末四碼，登入後請立即修改密碼。
        </p>
      </div>
    </div>
  )
}
