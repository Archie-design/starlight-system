'use client'

import { useState } from 'react'
import useSWR from 'swr'
import LogoutButton from '@/components/LogoutButton'
import { csrfFetch } from '@/lib/utils/csrf'

const fetcher = (url: string) => csrfFetch(url).then((r) => r.json())

interface LoginLog {
  id: string
  username: string | null
  event: 'login_success' | 'login_failure' | 'password_change'
  ip: string | null
  user_agent: string | null
  created_at: string
}

const EVENT_LABEL: Record<LoginLog['event'], string> = {
  login_success: '登入成功',
  login_failure: '登入失敗',
  password_change: '改密碼',
}
const EVENT_STYLE: Record<LoginLog['event'], string> = {
  login_success: 'bg-emerald-100 text-emerald-700',
  login_failure: 'bg-red-100 text-red-700',
  password_change: 'bg-blue-100 text-blue-700',
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function LoginLogsClient() {
  const [username, setUsername] = useState('')
  const [event, setEvent] = useState('')

  const params = new URLSearchParams()
  if (username) params.set('username', username)
  if (event) params.set('event', event)
  const { data, isLoading } = useSWR<{ logs: LoginLog[] }>(
    `/api/login-logs${params.toString() ? `?${params}` : ''}`,
    fetcher,
    { revalidateOnFocus: false },
  )
  const logs = data?.logs ?? []

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">登入紀錄</h1>
          <div className="flex items-center gap-4">
            <a href="/admin/users" className="text-xs text-blue-600 hover:underline">← 帳號管理</a>
            <a href="/students" className="text-xs text-blue-600 hover:underline">學員管理</a>
            <LogoutButton className="text-xs text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50" />
          </div>
        </div>

        {/* 篩選 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="搜尋帳號…"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">全部事件</option>
            <option value="login_success">登入成功</option>
            <option value="login_failure">登入失敗</option>
            <option value="password_change">改密碼</option>
          </select>
        </div>

        {/* 列表 */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">時間</th>
                <th className="text-left px-3 py-2 font-semibold">帳號</th>
                <th className="text-left px-3 py-2 font-semibold">事件</th>
                <th className="text-left px-3 py-2 font-semibold">IP</th>
                <th className="text-left px-3 py-2 font-semibold">瀏覽器</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">載入中…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">無紀錄</td></tr>
              ) : logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600 tabular-nums whitespace-nowrap">{fmt(l.created_at)}</td>
                  <td className="px-3 py-2 text-slate-800">{l.username ?? '—'}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${EVENT_STYLE[l.event]}`}>{EVENT_LABEL[l.event]}</span></td>
                  <td className="px-3 py-2 text-slate-500 tabular-nums">{l.ip ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs max-w-xs truncate" title={l.user_agent ?? ''}>{l.user_agent ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
