'use client'

import { useState, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import NavButton from '@/components/NavButton'
import LogoutButton from '@/components/LogoutButton'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'
import type { StageSummary, RosterStudent, ClubSummary } from './page'

interface WuyunSummary { totalEnrolled: number; completedCount: number; owedCount: number; owedAmount: number }

interface Props {
  role: UserRole
  system: SheetSystem
  stages: StageSummary[]
  wuyunSummary: WuyunSummary
  clubSummary: ClubSummary
  roster: Record<string, RosterStudent[]>
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

function formatMoney(n: number): string {
  return n.toLocaleString('zh-Hant-TW')
}

export default function CourseClient({ role, system, stages, wuyunSummary, clubSummary, roster }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedLevel, setSelectedLevel] = useState<number>(1)
  // rosterKey 格式："level"｜"level-batch"｜"wuyun"｜"makeup-{level}-{idx}"
  // （出席）｜"makeup-{level}-{idx}-absent"（缺席）｜"club-joined"；
  // null 表示未開啟名單 modal
  const [rosterKey, setRosterKey] = useState<string | null>(null)

  const switchSystem = (s: SheetSystem) => {
    document.cookie = `sl_view_system=${encodeURIComponent(s)}; path=/; max-age=${30 * 60}; samesite=lax`
    router.refresh()
  }

  const currentStage = stages.find((s) => s.level === selectedLevel) ?? stages[0]
  const batchChartData = useMemo(
    () => (currentStage?.batches ?? []).map((b) => ({ label: `第${b.batch}梯`, batchKey: b.batchKey, count: b.count })),
    [currentStage],
  )
  const batchChartHeight = Math.min(Math.max(batchChartData.length * 22, 120), 900)

  const rosterList = rosterKey ? (roster[rosterKey] ?? []) : []
  const rosterTitle = useMemo(() => {
    if (!rosterKey) return ''
    if (rosterKey === 'wuyun') return '五運班'
    if (rosterKey === 'club-joined') return '聯誼會已報名'
    if (rosterKey.startsWith('makeup-')) {
      const isAbsent = rosterKey.endsWith('-absent')
      const body = isAbsent ? rosterKey.slice(0, -'-absent'.length) : rosterKey
      const [, levelStr, idxStr] = body.split('-')
      const stage = stages.find((s) => String(s.level) === levelStr)
      const cls = stage?.makeupClasses[Number(idxStr)]
      return `${stage?.label ?? `${levelStr}階`}・${cls?.label ?? ''}・${isAbsent ? '缺席' : '出席'}`
    }
    if (rosterKey.includes('-')) {
      const [level, batch] = rosterKey.split('-')
      return `${currentStage?.label ?? `${level}階`}・第${batch}梯`
    }
    const stage = stages.find((s) => String(s.level) === rosterKey)
    return stage?.label ?? rosterKey
  }, [rosterKey, currentStage, stages])

  return (
    <div className="flex flex-col min-h-dvh bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-y-1 px-4 py-2.5 bg-emerald-800 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-amber-300 text-lg leading-none">📚</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">課程專區</h1>
        </div>
        <div className="flex items-center gap-3">
          {role === 'superadmin' && (
            <div className="flex items-center p-0.5 bg-white/10 rounded-lg">
              {ALL_SYSTEMS.map((s) => (
                <button key={s} onClick={() => switchSystem(s)}
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-all ${system === s ? 'bg-white text-emerald-800' : 'text-white/70 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <NavButton href="/students" active={pathname === '/students'} className="text-xs text-emerald-200/80 hover:text-white transition-colors">學員管理 →</NavButton>
          <NavButton href="/dashboard" active={pathname === '/dashboard'} className="text-xs text-emerald-200/80 hover:text-white transition-colors">儀表板 →</NavButton>
          <NavButton href="/counselors" active={pathname === '/counselors'} className="text-xs text-emerald-200/80 hover:text-white transition-colors">關懷長專區 →</NavButton>
          <NavButton href="/spirit" active={pathname === '/spirit'} className="text-xs text-emerald-200/80 hover:text-white transition-colors">心之使者 →</NavButton>
          <NavButton href="/little-angel" active={pathname === '/little-angel'} className="text-xs text-emerald-200/80 hover:text-white transition-colors">小天使 →</NavButton>
          <LogoutButton className="text-xs text-emerald-200/80 hover:text-white transition-colors disabled:opacity-50" />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6 max-w-6xl w-full mx-auto">
        {/* 階別選擇器 */}
        <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex-wrap">
          {stages.map((s) => (
            <button
              key={s.level}
              onClick={() => setSelectedLevel(s.level)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedLevel === s.level ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.label} <span className="opacity-70">({s.totalEnrolled})</span>
            </button>
          ))}
        </div>

        {currentStage && (
          <>
            {/* KPI 摘要卡 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label={`${currentStage.label}報名人數`} value={currentStage.totalEnrolled} />
              <KpiCard label="已排梯次數" value={currentStage.batches.length} />
              <KpiCard label="欠款人數" value={currentStage.owedCount} accent={currentStage.owedCount > 0} />
              <KpiCard label="欠款金額" value={`$${formatMoney(currentStage.owedAmount)}`} accent={currentStage.owedAmount > 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 梯次分布 */}
              <Card>
                <CardHeader title={`${currentStage.label}梯次分布`} subtitle="點長條看該梯次學員名單" />
                <div className="p-4 overflow-auto" style={{ maxHeight: 480 }}>
                  {batchChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={batchChartHeight}>
                      <BarChart data={batchChartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="label" type="category" width={70} tick={{ fontSize: 11 }} />
                        <Tooltip cursor={{ fill: '#f1f5f9' }} />
                        <Bar
                          dataKey="count"
                          fill="#10b981"
                          radius={[0, 4, 4, 0]}
                          cursor="pointer"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          onClick={(d: any) => d?.batchKey && setRosterKey(d.batchKey)}
                        >
                          <LabelList dataKey="count" position="right" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-400 py-8 text-center">此階尚無已排定梯次的報名資料</p>
                  )}
                </div>
              </Card>

              {/* 該階總覽（點看全部名單） */}
              <Card>
                <CardHeader title={`${currentStage.label}總覽`} subtitle="含尚未排定梯次者" />
                <div className="p-4 space-y-3">
                  <button
                    onClick={() => setRosterKey(String(currentStage.level))}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-xs"
                  >
                    <span className="font-semibold text-slate-700">查看{currentStage.label}全部學員名單</span>
                    <span className="text-slate-400"> （共 {currentStage.totalEnrolled} 人，含未排梯次者）</span>
                  </button>
                  <div className="text-xs text-slate-500 space-y-1 px-1">
                    <p>已排定梯次：{currentStage.batches.reduce((a, b) => a + b.count, 0)} 人</p>
                    <p>待確認梯次或其他狀態：{currentStage.totalEnrolled - currentStage.batches.reduce((a, b) => a + b.count, 0)} 人</p>
                    <p>欠款金額：帳面欠款金額，依付款欄位為純數字者加總，非最終應收帳款</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* 課後課完課狀況 */}
            {currentStage.makeupClasses.length > 0 && (
              <Card>
                <CardHeader
                  title={`${currentStage.label}課後課完課狀況`}
                  subtitle={`統計母體：已上${currentStage.label}主課者共 ${currentStage.completedMainCourseCount} 人・全部堂數皆已出席 ${currentStage.fullyAttendedMakeupCount} 人`}
                />
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentStage.makeupClasses.map((cls) => {
                    const rate = currentStage.completedMainCourseCount > 0
                      ? Math.round((cls.attendedCount / currentStage.completedMainCourseCount) * 100)
                      : 0
                    return (
                      <div key={cls.rosterKey} className="border border-slate-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-slate-700 mb-1.5">{cls.label}</div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-600 tabular-nums">{rate}%</span>
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <button onClick={() => setRosterKey(cls.rosterKey)} className="text-emerald-600 hover:underline">
                            出席 {cls.attendedCount} 人
                          </button>
                          <span className="text-slate-300">・</span>
                          <button onClick={() => setRosterKey(`${cls.rosterKey}-absent`)} className="text-slate-500 hover:underline">
                            缺席 {currentStage.completedMainCourseCount - cls.attendedCount} 人
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </>
        )}

        {/* 五運班 */}
        <Card>
          <CardHeader title="五運班" subtitle="無梯次概念，僅付款統計" />
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => setRosterKey('wuyun')} className="text-left">
              <div className="text-xs text-slate-500 font-medium">報名人數</div>
              <div className="mt-1 font-bold text-2xl text-slate-800 hover:text-emerald-600 transition-colors">{wuyunSummary.totalEnrolled}</div>
            </button>
            <div>
              <div className="text-xs text-slate-500 font-medium">完款人數</div>
              <div className="mt-1 font-bold text-2xl text-slate-800">{wuyunSummary.completedCount}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">欠款人數</div>
              <div className={`mt-1 font-bold text-2xl ${wuyunSummary.owedCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{wuyunSummary.owedCount}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">欠款金額</div>
              <div className={`mt-1 font-bold text-2xl ${wuyunSummary.owedAmount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>${formatMoney(wuyunSummary.owedAmount)}</div>
            </div>
          </div>
        </Card>

        {/* 聯誼會報名 */}
        <Card>
          <CardHeader title="聯誼會報名" subtitle="加入日有值即代表已報名，與課程階別各自獨立統計" />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <button onClick={() => setRosterKey('club-joined')} className="text-left mb-3 block">
                <div className="text-xs text-slate-500 font-medium">已報名人數</div>
                <div className="mt-1 font-bold text-2xl text-slate-800 hover:text-emerald-600 transition-colors">{clubSummary.joinedCount}</div>
              </button>
              <div className="text-xs text-slate-500">
                <p>未報名：{clubSummary.notJoinedCount} 人</p>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1.5">組別分布</div>
              {clubSummary.groupDist.length === 0 ? (
                <p className="text-xs text-slate-400">無</p>
              ) : (
                <ul className="text-xs text-slate-600 space-y-0.5 max-h-32 overflow-auto">
                  {clubSummary.groupDist.map((g) => (
                    <li key={g.group} className="flex justify-between">
                      <span>{g.group}</span>
                      <span className="tabular-nums text-slate-400">{g.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* 學員名單 Modal */}
      {rosterKey !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRosterKey(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-800">
                {rosterTitle} <span className="text-slate-400 font-normal">（{rosterList.length} 人）</span>
              </h2>
              <button onClick={() => setRosterKey(null)} aria-label="關閉" className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            <div className="overflow-auto p-2">
              {rosterList.length === 0 ? (
                <p className="p-4 text-xs text-slate-400">無資料</p>
              ) : (
                rosterList.map((m) => (
                  <a
                    key={m.id}
                    href={`/students?search=${encodeURIComponent(m.name)}`}
                    className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-blue-50 text-sm"
                  >
                    <span className="text-slate-800">{m.name}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">{m.statusLabel}</span>
                      <span className={m.owes ? 'text-amber-600 font-medium' : 'text-slate-400'}>{m.paymentLabel}</span>
                    </span>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
