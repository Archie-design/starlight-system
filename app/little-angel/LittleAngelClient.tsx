'use client'

import { useState, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import NavButton from '@/components/NavButton'
import LogoutButton from '@/components/LogoutButton'
import { SearchBox } from '@/components/OrgChart/SearchBox'
import { buildTree, findPath, type OrgStudent, type TreeNode } from '@/lib/utils/buildTree'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

interface RankingRow { id: number; name: string; count: number }
interface CountyRow { county: string; count: number }
interface GenderRow { gender: string; count: number }
interface AngelRosterRow { id: number; name: string; gender: string | null; ledCount: number }
interface Student { id: number; name: string; little_angel: string | null; business_chain: string | null; county: string | null }

interface Props {
  role: UserRole
  system: SheetSystem
  kpi: { angelCount: number; ledCount: number; avgLedPerAngel: number; noAngelCount: number }
  ranking: RankingRow[]
  countyDist: CountyRow[]
  genderDist: GenderRow[]
  angelRoster: AngelRosterRow[]
  dataQuality: {
    selfReferences: { id: number; name: string }[]
    danglingPointers: { id: number; name: string; pointsTo: string }[]
    mutualCycles: { id: number; name: string; pointsTo: string }[]
    crossSystemPointers: { id: number; name: string; pointsTo: string; targetName: string; targetSystem: string }[]
  }
  students: Student[]
}

const ALL_SYSTEMS: SheetSystem[] = ['星光', '太陽']
const GENDER_COLORS: Record<string, string> = {
  '男': '#3b82f6',
  '女': '#ec4899',
  '未填寫': '#94a3b8',
}
const GENDER_FALLBACK_COLOR = '#a78bfa'

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
              <a href={`/students?search=${encodeURIComponent(p.name)}`} className="text-blue-600 hover:underline">
                <span className="text-slate-400">{p.id}_</span>{p.name}
              </a>
              {p.pointsTo && <span className="text-slate-400">（指向 {p.pointsTo}）</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 跨體系指派：此人確實存在，只是屬於另一個體系——與「查無此人」的懸空指標分開顯示，避免誤判成髒資料 */
function CrossSystemAlertBlock({ items }: { items: { id: number; name: string; pointsTo: string; targetName: string; targetSystem: string }[] }) {
  return (
    <div>
      <div className="font-semibold text-slate-700 mb-1">小天使指向其他體系的人 <span className="text-slate-400">({items.length})</span></div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">無</p>
      ) : (
        <ul className="space-y-0.5 max-h-40 overflow-auto">
          {items.map((p) => (
            <li key={p.id} className="text-xs">
              <a href={`/students?search=${encodeURIComponent(p.name)}`} className="text-blue-600 hover:underline">
                <span className="text-slate-400">{p.id}_</span>{p.name}
              </a>
              <span className="text-slate-400"> → {p.pointsTo}（{p.targetSystem}體系）</span>
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

export default function LittleAngelClient({ role, system, kpi, ranking, countyDist, genderDist, angelRoster, dataQuality, students }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  // 選定學員的 id——可來自排行榜點擊（該人本身是小天使），也可來自搜尋框
  // （任意學員，不限排行榜；查詢他在小天使脈絡裡的完整位置，見下方 findPath）
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)

  const switchSystem = (s: SheetSystem) => {
    document.cookie = `sl_view_system=${encodeURIComponent(s)}; path=/; max-age=${30 * 60}; samesite=lax`
    router.refresh()
  }

  // 全量建一次森林，供搜尋任意學員時查詢他的完整路徑（往上）與子樹（往下）。
  const orgStudents: OrgStudent[] = useMemo(
    () => students.map((s) => ({
      id: s.id, name: s.name, role: null, region: null, introducer: null,
      course_1: null, course_2: null, course_3: null, course_4: null, course_5: null,
      course_wuyun: null, life_numbers: null, life_numbers_advanced: null,
      life_transform: null, debt_release: null, little_angel: s.little_angel,
    })),
    [students],
  )
  const roots = useMemo(() => buildTree(orgStudents, 'little_angel').roots, [orgStudents])

  // 選定學員在森林裡的完整路徑（從根節點到他本人）。比照組織圖的
  // findPath + 麵包屑模式：path 的最後一個節點就是選定的學員，其
  // children 即為他往下帶的人；path 前面的節點則是往上帶他的人。
  const selectedPath = useMemo(() => {
    if (selectedStudentId === null) return []
    return findPath(roots, selectedStudentId)
  }, [roots, selectedStudentId])
  const selectedTree = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : null

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
        {/* 查詢學員脈絡：比照組織圖搜尋，任意學員皆可查（不限排行榜上的小天使）。
            注意：這裡刻意不用 <Card>——Card 固定帶 overflow-hidden（讓卡片圓角
            裁切乾淨），但 SearchBox 的下拉結果是 absolute 定位、會超出容器邊界，
            套在 overflow-hidden 容器裡會被裁掉看不見。 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-600 shrink-0">查詢同一脈絡：</span>
          <SearchBox students={orgStudents} onSelect={(s: OrgStudent) => setSelectedStudentId(s.id)} />
          <span className="text-[11px] text-slate-400">搜尋任一學員，檢視其小天使脈絡中的往上（誰帶他）與往下（他帶了誰）關係</span>
        </div>

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
                    onClick={(d: any) => d?.id != null && setSelectedStudentId(d.id)}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 小天使男女比例 */}
          <Card>
            <CardHeader title="小天使男女比例" subtitle={`共 ${kpi.angelCount} 位小天使`} />
            <div className="h-[260px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderDist}
                    dataKey="count"
                    nameKey="gender"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={((d: any) => `${d.gender}（${d.count}）`) as any}
                  >
                    {genderDist.map((g) => (
                      <Cell key={g.gender} fill={GENDER_COLORS[g.gender] ?? GENDER_FALLBACK_COLOR} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 小天使名單 */}
          <Card>
            <CardHeader title="小天使名單" subtitle="依帶人數由多到少・點名字查看脈絡" />
            <div className="overflow-auto" style={{ maxHeight: 300 }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-2 font-medium">姓名</th>
                    <th className="px-4 py-2 font-medium">性別</th>
                    <th className="px-4 py-2 font-medium text-right">帶人數</th>
                  </tr>
                </thead>
                <tbody>
                  {angelRoster.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-1.5">
                        <button onClick={() => setSelectedStudentId(a.id)} className="text-blue-600 hover:underline">
                          {a.name}
                        </button>
                      </td>
                      <td className="px-4 py-1.5 text-slate-500">{a.gender ?? '—'}</td>
                      <td className="px-4 py-1.5 text-right text-slate-700 tabular-nums">{a.ledCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* 資料品質提醒 */}
        <Card>
          <CardHeader title="資料品質提醒" subtitle="可點名字到學員管理處理" />
          <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <AlertBlock title="自我指向" items={dataQuality.selfReferences} />
            <AlertBlock title="雙向互指（循環）" items={dataQuality.mutualCycles} />
            <AlertBlock title="小天使欄位查無此人" items={dataQuality.danglingPointers} />
            <CrossSystemAlertBlock items={dataQuality.crossSystemPointers} />
          </div>
        </Card>
      </div>

      {/* 從屬脈絡 Modal：麵包屑顯示往上路徑，子樹顯示往下帶的人 */}
      {selectedStudentId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedStudentId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-800">
                {selectedTree?.student.name ?? `(id ${selectedStudentId})`} <span className="text-slate-400 font-normal">的小天使脈絡</span>
              </h2>
              <button onClick={() => setSelectedStudentId(null)} aria-label="關閉" className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            {selectedTree ? (
              <div className="overflow-auto p-4 space-y-3">
                {/* 麵包屑：往上路徑，最後一項是選定的學員本人 */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  {selectedPath.length > 1 ? (
                    selectedPath.map((node, i) => (
                      <span key={node.student.id} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-slate-300">›</span>}
                        <button
                          onClick={() => setSelectedStudentId(node.student.id)}
                          className={`font-medium transition-colors ${
                            i === selectedPath.length - 1
                              ? 'text-slate-700 cursor-default'
                              : 'text-blue-600 hover:text-blue-800'
                          }`}
                        >
                          {node.student.name}
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">此人無小天使帶他，為頂層</span>
                  )}
                </div>

                {/* 往下：選定學員帶的人 */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-1.5">往下帶的人</div>
                  {selectedTree.children.length > 0 ? (
                    <ul className="space-y-1">
                      {selectedTree.children.map((c) => <TreeNodeRow key={c.student.id} node={c} />)}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">尚未帶任何學員</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-1.5">
                <p className="text-xs text-slate-600">此 ID 在目前體系的學員資料中查無對應姓名。</p>
                <p className="text-xs text-slate-400">
                  這通常代表某位學員的「小天使」欄位填寫的 ID 有誤，或指向的學員不屬於目前體系——可在下方「資料品質提醒」的「小天使欄位查無此人」或「小天使指向其他體系的人」找到對應紀錄並核對修正。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
