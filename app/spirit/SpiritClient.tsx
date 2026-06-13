'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import NavButton from '@/components/NavButton'
import LogoutButton from '@/components/LogoutButton'
import { formatMonths } from '@/lib/utils/seniority'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

interface NamedCount { name: string; count: number }
interface GroupAvg { name: string; avgMonths: number; count: number }

interface GroupMember { id: number; name: string; seniority: string | null }

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

export default function SpiritClient({ role, system, kpi, groupCounts, groupMembers, seniorityDist, groupAvgSeniority, alerts }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  const switchSystem = (s: SheetSystem) => {
    document.cookie = `sl_view_system=${encodeURIComponent(s)}; path=/; max-age=${30 * 60}; samesite=lax`
    router.refresh() // 重新計算 server 端統計
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
          <LogoutButton className="text-xs text-indigo-200/80 hover:text-white transition-colors disabled:opacity-50" />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6 max-w-6xl w-full mx-auto">
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
