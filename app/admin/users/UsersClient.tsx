'use client'

import { useState } from 'react'
import useSWR from 'swr'
import LogoutButton from '@/components/LogoutButton'
import { csrfFetch } from '@/lib/utils/csrf'
import type { AppUser, SheetSystem, UserRole } from '@/lib/supabase/types'

const fetcher = (url: string) => csrfFetch(url).then(r => r.json())

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: '系統管理者',
  system_admin: '體系長',
  admin: '體系管理者',
}

// GET /api/users 回傳每筆多帶 display_name_resolved（已套用姓名解析）
type UserRow = AppUser & { display_name_resolved?: string | null }

export default function UsersClient({
  actorRole,
  actorSystem,
}: {
  actorRole: UserRole
  actorSystem: SheetSystem | null
}) {
  const { data, mutate, isLoading } = useSWR<{ users: UserRow[] }>('/api/users', fetcher, {
    revalidateOnFocus: false,
  })
  const users = data?.users ?? []

  const isSuper = actorRole === 'superadmin'
  // system_admin 只能在自己體系建帳號；superadmin 可選任一體系
  const lockedSystem: SheetSystem = actorSystem ?? '星光'

  // 新增帳號表單（非 superadmin 預設綁自己體系、角色僅能建 admin/system_admin）
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('admin')
  const [system, setSystem] = useState<SheetSystem>(isSuper ? '星光' : lockedSystem)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    // superadmin 不綁體系；其餘角色須帶體系（非 superadmin 一律鎖自己體系）
    const payloadSystem = role === 'superadmin' ? null : (isSuper ? system : lockedSystem)
    const res = await csrfFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        role,
        system: payloadSystem,
        display_name: displayName.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setUsername(''); setPassword(''); setDisplayName(''); setRole('admin'); setSystem(isSuper ? '星光' : lockedSystem)
      mutate()
    } else {
      const d = await res.json()
      setError(d.error ?? '新增失敗')
    }
  }

  const toggleActive = async (u: AppUser) => {
    await csrfFetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    })
    mutate()
  }

  const resetPassword = async (u: AppUser) => {
    const np = prompt(`為「${u.username}」設定新密碼（至少 8 字元）：`)
    if (!np) return
    const res = await csrfFetch(`/api/users/${u.id}`, {
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

  const editDisplayName = async (u: UserRow) => {
    const dn = prompt(`為「${u.username}」設定顯示姓名（留空則清除，改以帳號/學員姓名顯示）：`, u.display_name ?? '')
    if (dn === null) return // 取消
    const res = await csrfFetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: dn.trim() || null }),
    })
    if (res.ok) {
      mutate()
    } else {
      const d = await res.json()
      alert(d.error ?? '更新失敗')
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">帳號管理</h1>
          <div className="flex items-center gap-4">
            <a href="/admin/login-logs" className="text-xs text-blue-600 hover:underline">登入紀錄 →</a>
            <a href="/students" className="text-xs text-blue-600 hover:underline">← 回學員管理</a>
            <LogoutButton className="text-xs text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50" />
          </div>
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
              <label htmlFor="dn" className="text-xs text-slate-500">顯示姓名（選填）</label>
              <input id="dn" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="留空則以帳號 / 學員姓名顯示"
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="r" className="text-xs text-slate-500">角色</label>
              <select id="r" value={role} onChange={e => setRole(e.target.value as UserRole)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="admin">體系管理者</option>
                <option value="system_admin">體系長</option>
                {/* 只有 superadmin 能再建立 superadmin */}
                {isSuper && <option value="superadmin">系統管理者</option>}
              </select>
            </div>
            {role !== 'superadmin' && (
              <div className="space-y-1">
                <label htmlFor="s" className="text-xs text-slate-500">體系</label>
                {isSuper ? (
                  <select id="s" value={system} onChange={e => setSystem(e.target.value as SheetSystem)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="星光">星光</option>
                    <option value="太陽">太陽</option>
                  </select>
                ) : (
                  // 非 superadmin 鎖定自己體系，不可變更
                  <input id="s" value={lockedSystem} disabled
                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm bg-slate-50 text-slate-500" />
                )}
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
                    {u.display_name_resolved || u.username}
                    {u.must_change_password && <span className="ml-1.5 text-[10px] text-amber-600">（待改密碼）</span>}
                    {(u.display_name_resolved || u.username) !== u.username && (
                      <div className="text-[11px] text-slate-400">{u.username}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td className="px-3 py-2 text-slate-600">{u.system ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={u.active ? 'text-emerald-600' : 'text-red-500'}>
                      {u.active ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => editDisplayName(u)}
                      className="text-xs text-blue-600 hover:underline mr-3">改姓名</button>
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
