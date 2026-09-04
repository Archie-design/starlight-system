'use client'

import { useState, useMemo, useDeferredValue } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import NavButton from '@/components/NavButton'
import LogoutButton from '@/components/LogoutButton'
import { useModalDismiss } from '@/lib/hooks/useModalDismiss'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'
import type { StageSummary, RosterStudent, ClubSummary, L2ClubGap, L1DreamProgram } from './page'

interface WuyunSummary { totalEnrolled: number; completedCount: number; owedCount: number; owedAmount: number }

interface Props {
  role: UserRole
  system: SheetSystem
  stages: StageSummary[]
  wuyunSummary: WuyunSummary
  clubSummary: ClubSummary
  l2ClubGap: L2ClubGap
  l1DreamProgram: L1DreamProgram
  roster: Record<string, RosterStudent[]>
}

/** CSV 欄位值跳脫：含逗號/雙引號/換行者用雙引號包起來，內部雙引號重複兩次 */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * 把名單資料轉成 CSV 文字並觸發瀏覽器下載。純前端處理，不經過伺服器
 * ——這是名單 modal 裡的小規模資料（幾十到幾百筆），不需要動用伺服器端
 * 的 exceljs 匯出管線（那是給 /api/export 的完整學員資料庫匯出用的）。
 * 加 BOM 前綴確保 Excel 開啟中文不亂碼。
 *
 * 帶上 ID、手機、LINE ID：匯出的主要用途是讓關懷員方便直接聯繫名單上
 * 的學員，只有姓名無法聯繫——手機/LINE ID 缺值時輸出空字串，不用 "—"
 * 之類佔位符（CSV 給人後續匯入其他工具用，佔位符反而是雜訊）。
 */
function downloadRosterCsv(title: string, rows: RosterStudent[]) {
  const header = ['ID', '姓名', '手機', 'LINE ID', '狀態', '備註']
  const lines = [header.map(csvEscape).join(',')]
  for (const r of rows) {
    lines.push([String(r.id), r.name, r.phone ?? '', r.lineId ?? '', r.statusLabel, r.paymentLabel].map(csvEscape).join(','))
  }
  const csvContent = '﻿' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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

type RosterSortKey = 'name' | 'statusLabel' | 'paymentLabel'

/** 名單表格可點擊排序的欄位標題，顯示目前排序方向的箭頭 */
function RosterSortHeader({
  label, sortKey, current, onClick,
}: {
  label: string
  sortKey: RosterSortKey
  current: { key: RosterSortKey; dir: 'asc' | 'desc' }
  onClick: (key: RosterSortKey) => void
}) {
  const active = current.key === sortKey
  return (
    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
      <button onClick={() => onClick(sortKey)} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
        {label}
        <span className={active ? 'text-emerald-600' : 'text-slate-300'}>
          {active ? (current.dir === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </button>
    </th>
  )
}

export default function CourseClient({ role, system, stages, wuyunSummary, clubSummary, l2ClubGap, l1DreamProgram, roster }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedLevel, setSelectedLevel] = useState<number>(1)
  // rosterKey 格式："level"｜"level-batch"｜"wuyun"｜"makeup-{level}-{idx}"
  // （出席）｜"makeup-{level}-{idx}-absent"（缺席）｜"club-joined"｜
  // "incomplete-makeup-{level}"（未全部完課）｜"club-not-joined-l2"
  // （二階已完課未報聯誼會）｜"l1-dream-program"（一階解圓夢計劃資格）；
  // null 表示未開啟名單 modal
  const [rosterKey, setRosterKey] = useState<string | null>(null)
  // ESC 關閉 + focus trap，與 GroupManageModal 等既有 modal 一致的無障礙行為
  const rosterModalRef = useModalDismiss<HTMLDivElement>(() => setRosterKey(null))

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

  // 名單表格的篩選與排序狀態。切換名單（rosterKey 改變）時要重置，
  // 否則會沿用上一份名單的篩選字串/排序，容易讓使用者誤以為篩選壞了。
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterStatusFilter, setRosterStatusFilter] = useState('')
  const [rosterSort, setRosterSort] = useState<{ key: RosterSortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })

  const openRoster = (key: string) => {
    setRosterSearch('')
    setRosterStatusFilter('')
    setRosterSort({ key: 'name', dir: 'asc' })
    setRosterKey(key)
  }

  const rosterListRaw = rosterKey ? (roster[rosterKey] ?? []) : []

  // 狀態欄位下拉篩選的選項——從目前這份名單實際出現過的 statusLabel 取值，
  // 不同名單格式差異很大（"已上課"、"已上 3 / 6 堂"、"2026/08/19 (三)..." 等），
  // 用實際資料生成選項，而不是寫死一組固定清單。
  const rosterStatusOptions = useMemo(
    () => Array.from(new Set(rosterListRaw.map((m) => m.statusLabel))).filter(Boolean).sort(),
    [rosterListRaw],
  )

  /** 「已上 X / Y 堂」格式抽出 X 供數字排序；其餘格式回傳 null，退回文字排序 */
  function parseAttendedCount(label: string): number | null {
    const m = label.match(/已上\s*(\d+)\s*\/\s*\d+\s*堂/)
    return m ? Number(m[1]) : null
  }

  // 輸入框本身用 rosterSearch 立即反映（不卡頓打字體驗），實際參與篩選
  // 運算的用 deferredRosterSearch——大名單（例如「未全部完課」近2000人）
  // 每次按鍵都重新 filter+sort 在較舊裝置上可能有感知延遲，useDeferredValue
  // 讓 React 把這次重運算標記為低優先權，跟按鍵輸入本身不搶執行緒。
  const deferredRosterSearch = useDeferredValue(rosterSearch)

  const rosterList = useMemo(() => {
    const kw = deferredRosterSearch.trim().toLowerCase()
    let list = rosterListRaw
    if (kw) {
      list = list.filter((m) =>
        [m.name, m.statusLabel, m.paymentLabel, m.phone, m.lineId].some((v) => (v ?? '').toLowerCase().includes(kw)),
      )
    }
    if (rosterStatusFilter) {
      list = list.filter((m) => m.statusLabel === rosterStatusFilter)
    }
    const sorted = [...list].sort((a, b) => {
      const { key, dir } = rosterSort
      let cmp: number
      if (key === 'statusLabel') {
        const an = parseAttendedCount(a.statusLabel)
        const bn = parseAttendedCount(b.statusLabel)
        cmp = an != null && bn != null ? an - bn : a.statusLabel.localeCompare(b.statusLabel, 'zh-Hant')
      } else {
        cmp = a[key].localeCompare(b[key], 'zh-Hant')
      }
      return dir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rosterListRaw, deferredRosterSearch, rosterStatusFilter, rosterSort])

  const toggleRosterSort = (key: RosterSortKey) => {
    setRosterSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }
  const rosterTitle = useMemo(() => {
    if (!rosterKey) return ''
    if (rosterKey === 'wuyun') return '五運班'
    if (rosterKey === 'club-joined') return '聯誼會已報名'
    if (rosterKey === 'club-not-joined-l2') return '二階已完課未報聯誼會'
    if (rosterKey === 'l1-dream-program') return '一階解圓夢計劃資格'
    if (rosterKey.startsWith('incomplete-makeup-')) {
      const levelStr = rosterKey.slice('incomplete-makeup-'.length)
      const stage = stages.find((s) => String(s.level) === levelStr)
      return `${stage?.label ?? `${levelStr}階`}・未全部完課`
    }
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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard label={`${currentStage.label}報名人數`} value={currentStage.totalEnrolled} />
              <KpiCard label="已排梯次數" value={currentStage.batches.length} />
              <KpiCard label="已排梯次人數" value={currentStage.batches.reduce((a, b) => a + b.count, 0)} />
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
                          onClick={(d: any) => d?.batchKey && openRoster(d.batchKey)}
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
                    onClick={() => openRoster(String(currentStage.level))}
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
                <div className="px-4 pt-4">
                  <button
                    onClick={() => openRoster(`incomplete-makeup-${currentStage.level}`)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors text-xs border border-amber-200"
                  >
                    <span className="font-semibold text-amber-800">查看未全部完課名單（需鼓勵補課）</span>
                    <span className="font-bold text-amber-700">{currentStage.incompleteMakeupCount} 人</span>
                  </button>
                </div>
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
                          <button onClick={() => openRoster(cls.rosterKey)} className="text-emerald-600 hover:underline">
                            出席 {cls.attendedCount} 人
                          </button>
                          <span className="text-slate-300">・</span>
                          <button onClick={() => openRoster(`${cls.rosterKey}-absent`)} className="text-slate-500 hover:underline">
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

        {/* 一階解圓夢計劃資格：一階已完課者，額外上完 3 堂以上一階課後課
            （不含同學會）即符合資格。與課後課完課狀況分開呈現，這是資格
            門檻查詢，不是完課率查詢。 */}
        <Card>
          <CardHeader
            title="一階解圓夢計劃資格"
            subtitle={`一階已完課者，另上完 ${l1DreamProgram.threshold} 堂以上一階課後課（不含同學會）即符合資格`}
          />
          <div className="p-4">
            <button
              onClick={() => openRoster('l1-dream-program')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors text-xs border border-emerald-200"
            >
              <span className="font-semibold text-emerald-800">
                查看名單（一階已完課 {l1DreamProgram.l1CompletedCount} 人中，符合資格）
              </span>
              <span className="font-bold text-emerald-700">{l1DreamProgram.qualifiedCount} 人</span>
            </button>
          </div>
        </Card>

        {/* 聯誼會報名 */}
        <Card>
          <CardHeader title="聯誼會報名" subtitle="加入日有值即代表已報名，與課程階別各自獨立統計" />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <button onClick={() => openRoster('club-joined')} className="text-left mb-1 block">
                <div className="text-xs text-slate-500 font-medium">已報名人數</div>
                <div className="mt-1 font-bold text-2xl text-slate-800 hover:text-emerald-600 transition-colors">{clubSummary.joinedCount}</div>
              </button>
              {/* 說明已報名人數與下方「二階已完課」母體的交集，避免兩個數字
                  各自呈現時讓人搞不清楚彼此關係（例如誤以為要拿未報名人數
                  跟二階已完課人數相加對照）。 */}
              <p className="text-[11px] text-slate-400 mb-3">其中 {l2ClubGap.joinedCount} 人為二階已完課</p>
              {/* 未報名拆成「已具資格（二階已完課）」與「尚未具資格」——聯誼會
                  報名需先上完二階，混在一起的「未報名」數字容易讓人誤以為
                  這麼多人都該報名卻沒報，但實際上多數是還沒達到門檻。
                  二者加總 = 未報名人數：已具資格 + 尚未具資格 = 未報名。 */}
              <div className="text-xs text-slate-500 space-y-1">
                <button onClick={() => openRoster('club-not-joined-l2')} className="text-left block hover:text-amber-700 transition-colors">
                  <span className="text-amber-600 font-medium">未報名・已具資格：{l2ClubGap.notJoinedCount} 人</span>
                  <span className="text-slate-400">（二階已完課）</span>
                </button>
                <p>未報名・尚未具資格：{clubSummary.notJoinedCount - l2ClubGap.notJoinedCount} 人（二階未完課）</p>
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

        {/* 二階已完課但未報聯誼會（交集查詢，供招募聯誼會用） */}
        <Card>
          <CardHeader title="二階已完課未報聯誼會" subtitle="二階已完課（course_2 為「已上課」）但尚未報名聯誼會的名單，供邀請招募用" />
          <div className="p-4 space-y-2">
            <p className="text-[11px] text-slate-400">
              二階已完課共 {l2ClubGap.l2CompletedCount} 人 = 已報名 {l2ClubGap.joinedCount} 人 + 未報名 {l2ClubGap.notJoinedCount} 人
            </p>
            <button
              onClick={() => openRoster('club-not-joined-l2')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors text-xs border border-amber-200"
            >
              <span className="font-semibold text-amber-800">
                查看名單（二階已完課 {l2ClubGap.l2CompletedCount} 人中，尚未報名聯誼會）
              </span>
              <span className="font-bold text-amber-700">{l2ClubGap.notJoinedCount} 人</span>
            </button>
          </div>
        </Card>

        {/* 五運班 */}
        <Card>
          <CardHeader title="五運班" subtitle="無梯次概念，僅付款統計" />
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => openRoster('wuyun')} className="text-left">
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
      </div>

      {/* 學員名單 Modal：表格式，可搜尋/依狀態篩選/依欄位排序 */}
      {rosterKey !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRosterKey(null)}>
          <div
            ref={rosterModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="roster-modal-title"
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-wrap gap-2">
              <h2 id="roster-modal-title" className="text-sm font-bold text-slate-800">
                {rosterTitle}{' '}
                <span className="text-slate-400 font-normal">
                  （{rosterList.length} / {rosterListRaw.length} 人）
                </span>
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadRosterCsv(rosterTitle, rosterList)}
                  disabled={rosterList.length === 0}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  匯出 CSV
                </button>
                <button onClick={() => setRosterKey(null)} aria-label="關閉" className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
              </div>
            </div>

            {/* 篩選列：關鍵字搜尋（比對姓名/狀態/備註/手機/LINE ID）+ 狀態下拉 */}
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 flex-wrap">
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="搜尋姓名／狀態／備註／手機／LINE ID"
                className="flex-1 min-w-[180px] px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {rosterStatusOptions.length > 1 && (
                <select
                  value={rosterStatusFilter}
                  onChange={(e) => setRosterStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">全部狀態</option>
                  {rosterStatusOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {(rosterSearch || rosterStatusFilter) && (
                <button
                  onClick={() => { setRosterSearch(''); setRosterStatusFilter('') }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  清除篩選
                </button>
              )}
            </div>

            <div className="overflow-auto flex-1">
              {rosterList.length === 0 ? (
                <p className="p-4 text-xs text-slate-400">{rosterListRaw.length === 0 ? '無資料' : '無符合篩選條件的學員'}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-slate-200">
                    <tr>
                      <RosterSortHeader label="姓名" sortKey="name" current={rosterSort} onClick={toggleRosterSort} />
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">手機</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">LINE ID</th>
                      <RosterSortHeader label="狀態" sortKey="statusLabel" current={rosterSort} onClick={toggleRosterSort} />
                      <RosterSortHeader label="備註" sortKey="paymentLabel" current={rosterSort} onClick={toggleRosterSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {rosterList.map((m) => (
                      <tr key={m.id} className="border-b border-slate-50 hover:bg-blue-50/60">
                        <td className="px-3 py-2">
                          <a href={`/students?search=${encodeURIComponent(m.name)}`} className="text-slate-800 hover:text-emerald-700 hover:underline">
                            {m.name}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 tabular-nums">{m.phone || '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{m.lineId || '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{m.statusLabel}</td>
                        <td className={`px-3 py-2 text-xs ${m.owes ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>{m.paymentLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
