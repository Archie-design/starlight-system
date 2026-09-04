'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import NavButton from '@/components/NavButton'
import LogoutButton from '@/components/LogoutButton'
import { formatMonths } from '@/lib/utils/seniority'
import { csrfFetch } from '@/lib/utils/csrf'
import { toast } from '@/lib/toast'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

interface NamedCount { name: string; count: number }
interface GroupAvg { name: string; avgMonths: number; count: number }

interface GroupMember { id: number; name: string; seniority: string | null }

/**
 * 分組總表的組員：pendingMakeup 決定是否顯示淺綠底；canToggleMakeup 決定
 * 是否顯示補課狀態的編輯入口（標記完成/取消標記皆算）——與 pendingMakeup
 * 分開，確保標記完成後（pendingMakeup 變 false）編輯入口不會跟著消失。
 * isLeader 是否為該組小隊長（任命制，與年資無關，決定排序置頂與徽章）。
 */
interface RosterMember {
  id: number
  name: string
  seniority: string | null
  pendingMakeup: boolean
  canToggleMakeup: boolean
  isLeader: boolean
}
interface RosterGroup { name: string; members: RosterMember[] }

interface Props {
  role: UserRole
  system: SheetSystem
  kpi: { total: number; groupCount: number; avgMonths: number; noGroupCount: number }
  groupCounts: NamedCount[]
  groupMembers: Record<string, GroupMember[]>
  seniorityDist: { bucket: string; count: number }[]
  groupAvgSeniority: GroupAvg[]
  alerts: {
    noGroup: { id: number; name: string }[]
    noSeniority: { id: number; name: string }[]
    singletonGroups: { name: string; member: string }[]
  }
  /** 分組總表：依資料庫實際分組動態產生，母體含「已分組但未完課」者，與上方 groupMembers（母體限心之使者）分開 */
  rosterGroups: RosterGroup[]
}

const ALL_SYSTEMS: SheetSystem[] = ['星光', '太陽']

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>{children}</div>
}
function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export default function SpiritClient({ role, system, kpi, groupCounts, groupMembers, seniorityDist, groupAvgSeniority, alerts, rosterGroups }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const canEditMakeup = role === 'superadmin' || role === 'system_admin'

  const switchSystem = (s: SheetSystem) => {
    document.cookie = `sl_view_system=${encodeURIComponent(s)}; path=/; max-age=${30 * 60}; samesite=lax`
    router.refresh() // 重新計算 server 端統計
  }

  /**
   * 切換分組總表格子的補課狀態，雙向都支援（標記完成／改回未完成）——
   * 先前版本只做了「標記完成」單向操作，一旦點擊後 pendingMakeup 變
   * false，連按鈕本身都消失，點錯了完全無法復原（見使用者回報）。成功
   * 後用 router.refresh() 讓 Server Component 重新查詢——這個頁面已有
   * 相同模式（switchSystem），比手動維護本地 state 的樂觀更新更簡單
   * 可靠。權限與 /api/students/[id]/spirit-makeup 一致：僅 superadmin/
   * system_admin 可操作。
   */
  const toggleMakeupCompleted = async (studentId: number, name: string, nextCompleted: boolean) => {
    if (!canEditMakeup || updatingId !== null) return
    const confirmMsg = nextCompleted
      ? `確認「${name}」已完成心之使者補課？`
      : `確認將「${name}」改回「尚未完成補課」？`
    if (!confirm(confirmMsg)) return
    setUpdatingId(studentId)
    try {
      const res = await csrfFetch(`/api/students/${studentId}/spirit-makeup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: nextCompleted }),
      })
      if (!res.ok) {
        toast.error('更新補課狀態失敗，請重新整理頁面後再試一次。')
        return
      }
      toast.success(nextCompleted ? `已將「${name}」標記為完成補課` : `已將「${name}」改回尚未完成補課`)
      router.refresh()
    } finally {
      setUpdatingId(null)
    }
  }

  /**
   * 切換分組總表的小隊長標記，雙向都支援。標記為小隊長時，若同組已有
   * 其他人被標記，伺服器端（/api/students/[id]/spirit-leader）會自動
   * 把舊小隊長降級，保證每組最多一位——前端不需要另外處理同組互斥。
   */
  const toggleLeader = async (studentId: number, name: string, nextIsLeader: boolean) => {
    if (!canEditMakeup || updatingId !== null) return
    const confirmMsg = nextIsLeader
      ? `確認將「${name}」標記為小隊長？若該組已有其他小隊長，會自動改回一般組員。`
      : `確認將「${name}」改回一般組員？`
    if (!confirm(confirmMsg)) return
    setUpdatingId(studentId)
    try {
      const res = await csrfFetch(`/api/students/${studentId}/spirit-leader`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLeader: nextIsLeader }),
      })
      if (!res.ok) {
        toast.error('更新小隊長標記失敗，請重新整理頁面後再試一次。')
        return
      }
      toast.success(nextIsLeader ? `已將「${name}」標記為小隊長` : `已將「${name}」改回一般組員`)
      router.refresh()
    } finally {
      setUpdatingId(null)
    }
  }

  // 各組人數圖高度依組數（每列 22px），上限避免過長
  const groupChartHeight = Math.min(Math.max(groupCounts.length * 22, 120), 900)
  const avgChartHeight = Math.min(Math.max(groupAvgSeniority.length * 22, 120), 900)

  return (
    <div className="flex flex-col min-h-dvh bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-y-1 px-4 py-2.5 bg-indigo-800 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-pink-300 text-lg leading-none">💗</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">心之使者專區</h1>
        </div>
        <div className="flex items-center gap-3">
          {role === 'superadmin' && (
            <div className="flex items-center p-0.5 bg-white/10 rounded-lg">
              {ALL_SYSTEMS.map((s) => (
                <button key={s} onClick={() => switchSystem(s)}
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-all ${system === s ? 'bg-white text-indigo-800' : 'text-white/70 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <NavButton href="/students" active={pathname === '/students'} className="text-xs text-indigo-200/80 hover:text-white transition-colors">學員管理 →</NavButton>
          <NavButton href="/dashboard" active={pathname === '/dashboard'} className="text-xs text-indigo-200/80 hover:text-white transition-colors">儀表板 →</NavButton>
          <NavButton href="/counselors" active={pathname === '/counselors'} className="text-xs text-indigo-200/80 hover:text-white transition-colors">關懷長專區 →</NavButton>
          <NavButton href="/little-angel" active={pathname === '/little-angel'} className="text-xs text-indigo-200/80 hover:text-white transition-colors">小天使 →</NavButton>
          <NavButton href="/courses" active={pathname === '/courses'} className="text-xs text-indigo-200/80 hover:text-white transition-colors">課程 →</NavButton>
          <LogoutButton className="text-xs text-indigo-200/80 hover:text-white transition-colors disabled:opacity-50" />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6 max-w-6xl w-full mx-auto">
        {/* 分組總表：比照關懷長手動維護的分組表單佈局，組長置頂、組員垂直
            排列於下；已分組但尚未完成補課者標示淺綠底。依資料庫實際分組
            動態產生欄位，不寫死組數。 */}
        <Card>
          <CardHeader
            title="分組總表"
            subtitle={`共 ${rosterGroups.length} 組・★＝小隊長・淺綠底＝已分組但尚未完成補課`}
          />
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {rosterGroups.map((g) => (
                <div key={g.name} className="w-20 shrink-0 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-1.5 py-1 bg-rose-50 border-b border-rose-100 text-[11px] font-bold text-rose-800 text-center truncate" title={g.name}>
                    {g.name}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {g.members.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 ${
                          m.isLeader ? 'bg-rose-50' : m.pendingMakeup ? 'bg-green-100' : ''
                        }`}
                      >
                        {canEditMakeup && (
                          <button
                            type="button"
                            onClick={() => toggleLeader(m.id, m.name, !m.isLeader)}
                            disabled={updatingId !== null}
                            title={m.isLeader ? '取消小隊長標記' : '標記為小隊長'}
                            aria-label={m.isLeader ? `取消「${m.name}」的小隊長標記` : `標記「${m.name}」為小隊長`}
                            className={`shrink-0 disabled:opacity-40 text-[11px] leading-none ${
                              m.isLeader ? 'text-rose-600 hover:text-rose-800' : 'text-slate-300 hover:text-rose-500'
                            }`}
                          >
                            {updatingId === m.id ? '…' : '★'}
                          </button>
                        )}
                        {!canEditMakeup && m.isLeader && (
                          <span className="shrink-0 text-[11px] text-rose-600" aria-hidden="true">★</span>
                        )}
                        <a
                          href={`/students?search=${encodeURIComponent(m.name)}`}
                          title={
                            m.isLeader
                              ? `${m.name}（小隊長）`
                              : m.pendingMakeup
                                ? `${m.name}（已分組，尚未完成補課）`
                                : m.name
                          }
                          className={`flex-1 min-w-0 text-[11px] truncate hover:underline ${
                            m.isLeader ? 'font-bold text-rose-900' : m.pendingMakeup ? 'text-green-900' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {m.name}
                        </a>
                        {m.canToggleMakeup && canEditMakeup && (
                          <button
                            type="button"
                            onClick={() => toggleMakeupCompleted(m.id, m.name, m.pendingMakeup)}
                            disabled={updatingId !== null}
                            title={m.pendingMakeup ? '標記為已完成補課' : '改回尚未完成補課'}
                            aria-label={m.pendingMakeup ? `標記「${m.name}」已完成補課` : `將「${m.name}」改回尚未完成補課`}
                            className={`shrink-0 disabled:opacity-40 text-[11px] leading-none px-0.5 ${
                              m.pendingMakeup ? 'text-green-700 hover:text-green-900' : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            {updatingId === m.id ? '…' : m.pendingMakeup ? '✓' : '↺'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* KPI 摘要卡 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="心之使者總數" value={kpi.total} />
          <KpiCard label="組別數" value={kpi.groupCount} />
          <KpiCard label="平均年資" value={formatMonths(kpi.avgMonths)} small />
          <KpiCard label="無組別人數" value={kpi.noGroupCount} accent={kpi.noGroupCount > 0} />
        </div>

        {/* 年資分佈 */}
        <Card>
          <CardHeader title="年資分佈" subtitle="依累積年資分桶之心之使者人數" />
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seniorityDist} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 各組人數（點長條看組員） */}
          <Card>
            <CardHeader title="各組人數" subtitle={`共 ${groupCounts.length} 組・點長條看組員`} />
            <div className="p-4 overflow-auto" style={{ maxHeight: 480 }}>
              <ResponsiveContainer width="100%" height={groupChartHeight}>
                <BarChart data={groupCounts} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar
                    dataKey="count"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(d: { name?: string }) => d?.name && setSelectedGroup(d.name)}
                  >
                    <LabelList dataKey="count" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 各組平均年資 */}
          <Card>
            <CardHeader title="各組平均年資" subtitle="月數（hover 看人數）" />
            <div className="p-4 overflow-auto" style={{ maxHeight: 480 }}>
              <ResponsiveContainer width="100%" height={avgChartHeight}>
                <BarChart data={groupAvgSeniority} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((v: any, _n: any, p: any) => [`${formatMonths(Number(v))}（${p?.payload?.count ?? 0} 人）`, '平均年資']) as any}
                  />
                  <Bar dataKey="avgMonths" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* 資料品質提醒 */}
        <Card>
          <CardHeader title="資料品質提醒" subtitle="可點名字到學員管理處理" />
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <AlertBlock title="有加入日但無組別" people={alerts.noGroup} />
            <AlertBlock title="無累積年資" people={alerts.noSeniority} />
            <div>
              <div className="font-semibold text-slate-700 mb-1">單人小組 <span className="text-slate-400">({alerts.singletonGroups.length})</span></div>
              {alerts.singletonGroups.length === 0 ? (
                <p className="text-xs text-slate-400">無</p>
              ) : (
                <ul className="space-y-0.5">
                  {alerts.singletonGroups.map((g) => (
                    <li key={g.name} className="text-xs text-slate-600">{g.name}（{g.member}）</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* 組員名單 Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedGroup(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-800">
                {selectedGroup} <span className="text-slate-400 font-normal">（{groupMembers[selectedGroup]?.length ?? 0} 人）</span>
              </h2>
              <button onClick={() => setSelectedGroup(null)} aria-label="關閉" className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            <div className="overflow-auto p-2">
              {(groupMembers[selectedGroup] ?? []).map((m) => (
                <a
                  key={m.id}
                  href={`/students?search=${encodeURIComponent(m.name)}`}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-blue-50 text-sm"
                >
                  <span className="text-slate-800">{m.name}</span>
                  <span className="text-xs text-slate-400">{m.seniority ?? '—'}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, small, accent }: { label: string; value: string | number; small?: boolean; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className={`mt-2 font-bold ${small ? 'text-xl' : 'text-3xl'} ${accent ? 'text-amber-600' : 'text-slate-800'}`}>{value}</div>
    </Card>
  )
}

function AlertBlock({ title, people }: { title: string; people: { id: number; name: string }[] }) {
  return (
    <div>
      <div className="font-semibold text-slate-700 mb-1">{title} <span className="text-slate-400">({people.length})</span></div>
      {people.length === 0 ? (
        <p className="text-xs text-slate-400">無</p>
      ) : (
        <ul className="space-y-0.5 max-h-40 overflow-auto">
          {people.map((p) => (
            <li key={p.id}>
              <a href={`/students?search=${encodeURIComponent(p.name)}`} className="text-xs text-blue-600 hover:underline">{p.name}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
