'use client'

import { useState, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import NavButton from '@/components/NavButton'
import LogoutButton from '@/components/LogoutButton'
import { buildTree, type OrgStudent, type TreeNode } from '@/lib/utils/buildTree'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

interface RankingRow { id: number; name: string; count: number }
interface CountyRow { county: string; count: number }
interface Student { id: number; name: string; little_angel: string | null; business_chain: string | null; county: string | null }

interface Props {
  role: UserRole
  system: SheetSystem
  kpi: { angelCount: number; ledCount: number; avgLedPerAngel: number; noAngelCount: number }
  ranking: RankingRow[]
  countyDist: CountyRow[]
  dataQuality: {
    selfReferences: { id: number; name: string }[]
    danglingPointers: { id: number; name: string; pointsTo: string }[]
    mutualCycles: { id: number; name: string; pointsTo: string }[]
  }
  students: Student[]
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
function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className={`mt-2 font-bold text-3xl ${accent ? 'text-amber-600' : 'text-slate-800'}`}>{value}</div>
    </Card>
  )
}
function AlertBlock({ title, items }: { title: string; items: { id: number; name: string; pointsTo?: string }[] }) {
  return (
    <div>
      <div className="font-semibold text-slate-700 mb-1">{title} <span className="text-slate-400">({items.length})</span></div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">無</p>
      ) : (
        <ul className="space-y-0.5 max-h-40 overflow-auto">
          {items.map((p) => (
            <li key={p.id} className="text-xs">
              <a href={`/students?search=${encodeURIComponent(p.name)}`} className="text-blue-600 hover:underline">{p.name}</a>
              {p.pointsTo && <span className="text-slate-400">（指向 {p.pointsTo}）</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 樹狀圖節點：簡單縮排式遞迴渲染，不需要 @xyflow/react 的完整關聯圖能力 */
function TreeNodeRow({ node }: { node: TreeNode }) {
  return (
    <li>
      <a
        href={`/students?search=${encodeURIComponent(node.student.name)}`}
        className="text-xs text-slate-700 hover:text-blue-600 hover:underline"
      >
        {node.student.name}
      </a>
      {node.children.length > 0 && (
        <ul className="pl-4 border-l border-slate-200 mt-1 space-y-1">
          {node.children.map((c) => <TreeNodeRow key={c.student.id} node={c} />)}
        </ul>
      )}
    </li>
  )
}

export default function LittleAngelClient({ role, system, kpi, ranking, countyDist, dataQuality, students }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedAngelId, setSelectedAngelId] = useState<number | null>(null)

  const switchSystem = (s: SheetSystem) => {
    document.cookie = `sl_view_system=${encodeURIComponent(s)}; path=/; max-age=${30 * 60}; samesite=lax`
    router.refresh()
  }

  // 樹狀圖：以選定小天使為根節點，只在使用者選擇時才建樹（不需要每次都對
  // 全量學員建整片森林，選一個人就找出以他為根的那棵子樹即可）
  const orgStudents: OrgStudent[] = useMemo(
    () => students.map((s) => ({
      id: s.id, name: s.name, role: null, region: null, introducer: null,
      course_1: null, course_2: null, course_3: null, course_4: null, course_5: null,
      course_wuyun: null, life_numbers: null, life_numbers_advanced: null,
      life_transform: null, debt_release: null, little_angel: s.little_angel,
    })),
    [students],
  )
  const selectedTree = useMemo(() => {
    if (selectedAngelId === null) return null
    const { roots } = buildTree(orgStudents, 'little_angel')
    return roots.find((r) => r.student.id === selectedAngelId) ?? null
  }, [orgStudents, selectedAngelId])

  const rankingChartHeight = Math.min(Math.max(ranking.length * 22, 120), 900)
  const countyChartHeight = Math.min(Math.max(countyDist.length * 22, 120), 900)

  return (
    <div className="flex flex-col min-h-dvh bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-y-1 px-4 py-2.5 bg-sky-800 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-yellow-300 text-lg leading-none">🧚</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">小天使專區</h1>
        </div>
        <div className="flex items-center gap-3">
          {role === 'superadmin' && (
            <div className="flex items-center p-0.5 bg-white/10 rounded-lg">
              {ALL_SYSTEMS.map((s) => (
                <button key={s} onClick={() => switchSystem(s)}
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-all ${system === s ? 'bg-white text-sky-800' : 'text-white/70 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <NavButton href="/students" active={pathname === '/students'} className="text-xs text-sky-200/80 hover:text-white transition-colors">學員管理 →</NavButton>
          <NavButton href="/dashboard" active={pathname === '/dashboard'} className="text-xs text-sky-200/80 hover:text-white transition-colors">儀表板 →</NavButton>
          <NavButton href="/counselors" active={pathname === '/counselors'} className="text-xs text-sky-200/80 hover:text-white transition-colors">關懷長專區 →</NavButton>
          <NavButton href="/spirit" active={pathname === '/spirit'} className="text-xs text-sky-200/80 hover:text-white transition-colors">心之使者 →</NavButton>
          <LogoutButton className="text-xs text-sky-200/80 hover:text-white transition-colors disabled:opacity-50" />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6 max-w-6xl w-full mx-auto">
        {/* KPI 摘要卡 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="小天使人數" value={kpi.angelCount} />
          <KpiCard label="被帶學員人數" value={kpi.ledCount} />
          <KpiCard label="平均每位小天使帶人數" value={kpi.avgLedPerAngel} />
          <KpiCard label="無小天使人數" value={kpi.noAngelCount} accent={kpi.noAngelCount > 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 小天使人數排行榜 */}
          <Card>
            <CardHeader title="小天使帶人數排行" subtitle="點長條展開樹狀從屬圖" />
            <div className="p-4 overflow-auto" style={{ maxHeight: 480 }}>
              <ResponsiveContainer width="100%" height={rankingChartHeight}>
                <BarChart data={ranking} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar
                    dataKey="count"
                    fill="#0ea5e9"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={(d: any) => d?.id != null && setSelectedAngelId(d.id)}
                  >
                    <LabelList dataKey="count" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 地區（縣市）分布 */}
          <Card>
            <CardHeader title="地區分布" subtitle="被帶學員依縣市分布" />
            <div className="p-4 overflow-auto" style={{ maxHeight: 480 }}>
              <ResponsiveContainer width="100%" height={countyChartHeight}>
                <BarChart data={countyDist} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="county" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="count" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* 資料品質提醒 */}
        <Card>
          <CardHeader title="資料品質提醒" subtitle="可點名字到學員管理處理" />
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <AlertBlock title="自我指向" items={dataQuality.selfReferences} />
            <AlertBlock title="雙向互指（循環）" items={dataQuality.mutualCycles} />
            <AlertBlock title="小天使欄位查無此人" items={dataQuality.danglingPointers} />
          </div>
        </Card>
      </div>

      {/* 從屬樹狀圖 Modal */}
      {selectedAngelId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedAngelId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-800">
                {selectedTree?.student.name ?? '—'} <span className="text-slate-400 font-normal">的從屬結構</span>
              </h2>
              <button onClick={() => setSelectedAngelId(null)} aria-label="關閉" className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            <div className="overflow-auto p-4">
              {selectedTree ? (
                <ul className="space-y-1">
                  {selectedTree.children.map((c) => <TreeNodeRow key={c.student.id} node={c} />)}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">無資料</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
