'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { AppUser, SheetSystem, UserRole } from '@/lib/supabase/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function UsersClient() {
  const { data, mutate, isLoading } = useSWR<{ users: AppUser[] }>('/api/users', fetcher, {
    revalidateOnFocus: false,
  })
  const users = data?.users ?? []

  // 新增帳號表單
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('admin')
  const [system, setSystem] = useState<SheetSystem>('星光')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        role,
        system: role === 'admin' ? system : null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setUsername(''); setPassword(''); setRole('admin'); setSystem('星光')
      mutate()
    } else {
      const d = await res.json()
      setError(d.error ?? '新增失敗')
    }
  }

  const toggleActive = async (u: AppUser) => {
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    })
    mutate()
  }

  const resetPassword = async (u: AppUser) => {
    const np = prompt(`為「${u.username}」設定新密碼（至少 8 字元）：`)
    if (!np) return
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: np }),
    })
    if (res.ok) {
      alert(`已重設「${u.username}」的密碼，對方下次登入須再次修改。`)
      mutate()
    } else {
      const d = await res.json()
      alert(d.error ?? '重設失敗')
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">帳號管理</h1>
          <a href="/students" className="text-xs text-blue-600 hover:underline">← 回學員管理</a>
        </div>

        {/* 新增帳號 */}
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">新增帳號</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="u" className="text-xs text-slate-500">帳號</label>
              <input id="u" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="p" className="text-xs text-slate-500">初始密碼</label>
              <input id="p" type="text" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="r" className="text-xs text-slate-500">角色</label>
              <select id="r" value={role} onChange={e => setRole(e.target.value as UserRole)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="admin">體系管理者</option>
                <option value="superadmin">系統管理者</option>
              </select>
            </div>
            {role === 'admin' && (
              <div className="space-y-1">
                <label htmlFor="s" className="text-xs text-slate-500">體系</label>
                <select id="s" value={system} onChange={e => setSystem(e.target.value as SheetSystem)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="星光">星光</option>
                  <option value="太陽">太陽</option>
                </select>
              </div>
            )}
          </div>
          {error && <p role="alert" className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>}
          <button type="submit" disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? '新增中…' : '新增帳號'}
          </button>
        </form>

        {/* 帳號列表 */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">帳號</th>
                <th className="text-left px-3 py-2 font-semibold">角色</th>
                <th className="text-left px-3 py-2 font-semibold">體系</th>
                <th className="text-left px-3 py-2 font-semibold">狀態</th>
                <th className="text-right px-3 py-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">載入中…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">尚無帳號</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">
                    {u.username}
                    {u.must_change_password && <span className="ml-1.5 text-[10px] text-amber-600">（待改密碼）</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{u.role === 'superadmin' ? '系統管理者' : '體系管理者'}</td>
                  <td className="px-3 py-2 text-slate-600">{u.system ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={u.active ? 'text-emerald-600' : 'text-red-500'}>
                      {u.active ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => resetPassword(u)}
                      className="text-xs text-blue-600 hover:underline mr-3">重設密碼</button>
                    <button onClick={() => toggleActive(u)}
                      className="text-xs text-slate-500 hover:text-red-500">
                      {u.active ? '停用' : '啟用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
