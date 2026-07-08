'use client'

import { useState } from 'react'
import useSWR from 'swr'
import LogoutButton from '@/components/LogoutButton'
import { csrfFetch } from '@/lib/utils/csrf'

const fetcher = (url: string) => csrfFetch(url).then((r) => r.json())

interface LoginLog {
  id: string
  username: string | null
  display_name?: string | null
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

interface AuditLog {
  id: string
  actor: string | null
  display_name?: string | null
  action: string
  target: string | null
  detail: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  user_created: '建立帳號',
  user_enabled: '啟用帳號',
  user_disabled: '停用帳號',
  password_reset: '重設密碼',
  data_export: '資料匯出',
  import_applied: '套用匯入',
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

type Source = 'login' | 'audit'

export default function LoginLogsClient() {
  const [source, setSource] = useState<Source>('login')
  const [username, setUsername] = useState('')
  const [event, setEvent] = useState('')

  const params = new URLSearchParams()
  if (username) params.set('username', username)
  if (event) params.set('event', event)
  const { data: loginData, isLoading: loginLoading } = useSWR<{ logs: LoginLog[] }>(
    source === 'login' ? `/api/login-logs${params.toString() ? `?${params}` : ''}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const auditParams = new URLSearchParams()
  if (username) auditParams.set('actor', username)
  const { data: auditData, isLoading: auditLoading } = useSWR<{ logs: AuditLog[] }>(
    source === 'audit' ? `/api/admin-audit${auditParams.toString() ? `?${auditParams}` : ''}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const logs = loginData?.logs ?? []
  const audits = auditData?.logs ?? []
  const isLoading = source === 'login' ? loginLoading : auditLoading

  const tabClass = (s: Source) =>
    `text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
      source === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
    }`

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">操作 / 登入紀錄</h1>
          <div className="flex items-center gap-4">
            <a href="/admin/users" className="text-xs text-blue-600 hover:underline">← 帳號管理</a>
            <a href="/students" className="text-xs text-blue-600 hover:underline">學員管理</a>
            <LogoutButton className="text-xs text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50" />
          </div>
        </div>

        {/* 來源切換 */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSource('login')} className={tabClass('login')}>登入紀錄</button>
          <button type="button" onClick={() => setSource('audit')} className={tabClass('audit')}>操作稽核</button>
        </div>

        {/* 篩選 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={source === 'login' ? '搜尋帳號…' : '搜尋操作者…'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {source === 'login' && (
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
          )}
        </div>

        {/* 列表 */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {source === 'login' ? (
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
                    <td className="px-3 py-2 text-slate-800">{l.display_name || l.username || '—'}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${EVENT_STYLE[l.event]}`}>{EVENT_LABEL[l.event]}</span></td>
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{l.ip ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs max-w-xs truncate" title={l.user_agent ?? ''}>{l.user_agent ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">時間</th>
                  <th className="text-left px-3 py-2 font-semibold">操作者</th>
                  <th className="text-left px-3 py-2 font-semibold">動作</th>
                  <th className="text-left px-3 py-2 font-semibold">對象 / 內容</th>
                  <th className="text-left px-3 py-2 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">載入中…</td></tr>
                ) : audits.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">無紀錄</td></tr>
                ) : audits.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-600 tabular-nums whitespace-nowrap">{fmt(l.created_at)}</td>
                    <td className="px-3 py-2 text-slate-800">{l.display_name || l.actor || '—'}</td>
                    <td className="px-3 py-2"><span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">{ACTION_LABEL[l.action] ?? l.action}</span></td>
                    <td className="px-3 py-2 text-slate-500">
                      {l.target ?? '—'}{l.detail ? <span className="text-slate-400 text-xs">（{l.detail}）</span> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{l.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
