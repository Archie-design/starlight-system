'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
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

/** CSV 欄位值跳脫：含逗號/雙引號/換行者用雙引號包起來，內部雙引號重複兩次（同 CourseClient.tsx） */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

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
  const [groupActionPending, setGroupActionPending] = useState(false)
  // @dnd-kit 內部用一個模組級全域計數器產生 aria-describedby="DndDescribedBy-N"
  // 等無障礙輔助 id（見 @dnd-kit/utilities 的 useUniqueId），這個計數器
  // 在整個 server process 生命週期內持續累加、不會歸零，導致 SSR 算出的
  // 編號與瀏覽器端從 0 重新算的編號對不上，產生 hydration mismatch（不是
  // 我們邏輯錯誤，是這個套件在 SSR 環境下的已知限制）。解法：分組總表的
  // 拖放容器（DndContext/useDraggable/useDroppable）只在 client mount
  // 完成後才渲染，SSR 輸出完全不含這些屬性，自然不會有落差；mount 前
  // 用不含 dnd-kit hooks 的純靜態版本渲染，使用者感知不到這個切換。
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  // 拖曳中的組員姓名——供 DragOverlay 顯示「正在拖誰」。原本只有被拖曳
  // 原位置變淡（opacity），游標位置沒有任何跟隨的視覺元素，使用者反映
  // 看不出拖的是誰，手感不佳；加上跟隨游標的浮動卡片解決這個問題。
  const [draggingMember, setDraggingMember] = useState<{ id: number; name: string } | null>(null)
  // 搬移中的學員 id——放開拖曳後到 router.refresh() 真正拿到新資料之間，
  // PATCH 請求／伺服器重新查詢都需要時間（實測近 1 秒），這段空窗如果
  // 什麼提示都沒有，使用者會覺得「拖了但沒反應」。用這個旗標讓該學員在
  // 原分組欄位裡維持「搬移中」的視覺狀態，直到新資料回來為止。
  const [movingId, setMovingId] = useState<number | null>(null)
  // 本次工作階段的拖曳異動追蹤——匯出只需要「這次操作中誰的分組動過」，
  // 不是完整分組現況（管理者要拿去外部系統手動比對，完整現況會逼他自己
  // 找出哪些人變了，才是最容易漏改/改錯的環節；見 design.md Decision 6）。
  // originalGroupRef 存「進入本次工作階段時的原始分組」，只在該學員第一次
  // 被拖曳時寫入一次，之後不再更新——用 useRef 是因為這個值不需要驅動
  // 重渲染。latestGroupMap 存「目前最新分組」，用 useState 是因為它要
  // 驅動匯出按鈕的可用狀態與異動筆數顯示；若學員最終被拖回原始分組，
  // 從這個 map 移除即可讓他自然不出現在匯出結果中。
  const originalGroupRef = useRef<Map<number, { name: string; originalGroup: string }>>(new Map())
  const [latestGroupMap, setLatestGroupMap] = useState<Map<number, string>>(new Map())
  const canEditMakeup = role === 'superadmin' || role === 'system_admin'
  // 拖曳與新增/刪除組別共用同一把「操作中鎖」以外的獨立忙碌旗標——避免
  // 拖曳中同時觸發新增/刪除，或反之；不與 updatingId（補課/小隊長編輯）
  // 共用鎖，三種互動彼此獨立即可，不需要互斥。
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

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

  /** 拖曳開始：記錄正在拖曳的組員，供 DragOverlay 顯示跟隨游標的浮動卡片 */
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const name = (active.data.current?.name as string | undefined) ?? ''
    setDraggingMember({ id: Number(active.id), name })
  }

  /**
   * 拖曳搬移組員：放開時立即呼叫 PATCH 寫入資料庫（不做前端暫存草稿），
   * 與既有補課/小隊長編輯一致的「立即生效」心智模型。拖到原本所在的
   * 分組（active/over 相同）視為無操作，不發請求。見 openspec/changes/
   * spirit-roster-drag-edit。
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingMember(null)
    const { active, over } = event
    if (!over || !canEditMakeup) return
    const studentId = Number(active.id)
    const targetGroup = String(over.id)
    const currentGroup = active.data.current?.group as string | undefined
    const studentName = (active.data.current?.name as string | undefined) ?? ''
    if (!Number.isInteger(studentId) || currentGroup === targetGroup) return

    setGroupActionPending(true)
    setMovingId(studentId)
    try {
      const res = await csrfFetch(`/api/students/${studentId}/spirit-group`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: targetGroup }),
      })
      if (!res.ok) {
        toast.error('搬移分組失敗，請重新整理頁面後再試一次。')
        setMovingId(null)
        return
      }
      toast.success(`已將「${studentName}」搬移到「${targetGroup}」`)

      // 記錄本次工作階段的異動：只在該學員第一次被拖曳時記下「原始分組」
      // （拖曳前所在的分組，即這次操作前的狀態），之後即使再被拖第二次、
      // 第三次，原始分組維持不變，只更新「目前最新分組」。若最新分組繞
      // 回原始分組，視為無異動，從 latestGroupMap 移除。
      if (!originalGroupRef.current.has(studentId)) {
        originalGroupRef.current.set(studentId, { name: studentName, originalGroup: currentGroup ?? '' })
      }
      const original = originalGroupRef.current.get(studentId)!.originalGroup
      setLatestGroupMap((prev) => {
        const next = new Map(prev)
        if (targetGroup === original) {
          next.delete(studentId)
        } else {
          next.set(studentId, targetGroup)
        }
        return next
      })

      router.refresh()
      // movingId 刻意不在這裡清除——router.refresh() 是非同步觸發伺服器
      // 重新查詢＋整頁重渲染，這裡拿不到「新畫面已經渲染完成」的訊號。
      // 讓「搬移中」樣式維持到 Server Component 帶著新的 rosterGroups
      // 回來、這個學員從原分組的 members 陣列中消失為止（該學員所在的
      // RosterGroupColumn 直接卸載重建，movingId 這個 state 本身雖然還
      // 留著也不會再有對應的組員列可以套用樣式，等同自然歸零，不需要
      // 額外的 setTimeout 或 useEffect 去猜測「完成」的時間點）。
    } finally {
      setGroupActionPending(false)
    }
  }

  /** 新增空組別：組名由伺服器自動編號產生，前端不做任何命名輸入 */
  const addGroup = async () => {
    if (!canEditMakeup || groupActionPending) return
    setGroupActionPending(true)
    try {
      const res = await csrfFetch('/api/spirit-groups', { method: 'POST' })
      if (!res.ok) {
        toast.error('新增分組失敗，請重新整理頁面後再試一次。')
        return
      }
      const { data } = await res.json()
      toast.success(`已新增分組「${data?.name ?? ''}」`)
      router.refresh()
    } finally {
      setGroupActionPending(false)
    }
  }

  /**
   * 刪除空組別：僅允許刪除目前無組員的分組。按鈕本身保持可點擊（不用
   * disabled 隱性阻擋），組員數 > 0 時點擊後直接跳提示說明原因——先前
   * 做成純 disabled + hover title 時，使用者反映「按了沒反應」，看不出
   * 是被擋下來還是沒點到，需要主動的訊息回饋。
   */
  const deleteGroup = async (name: string, memberCount: number) => {
    if (!canEditMakeup || groupActionPending) return
    if (memberCount > 0) {
      toast.error(`「${name}」目前還有 ${memberCount} 位組員，請先將組員移出後再刪除。`)
      return
    }
    if (!confirm(`確認刪除分組「${name}」？此操作無法復原。`)) return
    setGroupActionPending(true)
    try {
      const res = await csrfFetch(`/api/spirit-groups/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }))
        toast.error(error || '刪除分組失敗，請重新整理頁面後再試一次。')
        return
      }
      toast.success(`已刪除分組「${name}」`)
      router.refresh()
    } finally {
      setGroupActionPending(false)
    }
  }

  /**
   * 匯出「本次工作階段的分組異動對照表」（姓名、原分組、目前分組），
   * 取代匯出完整分組總表現況——管理者要拿這份檔案去無法批次匯入、只能
   * 手動逐筆編輯的原官網系統同步分組，只列出動過的人能省去他自己比對
   * 完整名單找異動的步驟，也降低漏改/改錯的機會。見 openspec/changes/
   * spirit-roster-drag-edit 的 design.md Decision 6。
   */
  const exportChangesCsv = () => {
    if (latestGroupMap.size === 0) {
      toast.error('尚無異動，無需匯出。')
      return
    }
    const header = ['姓名', '原分組', '目前分組']
    const lines = [header.map(csvEscape).join(',')]
    for (const [studentId, newGroup] of latestGroupMap.entries()) {
      const record = originalGroupRef.current.get(studentId)
      if (!record) continue
      lines.push([record.name, record.originalGroup, newGroup].map(csvEscape).join(','))
    }
    const csvContent = '﻿' + lines.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `分組異動對照表_${system}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-800">分組總表</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {canEditMakeup
                  ? `共 ${rosterGroups.length} 組・★＝小隊長・淺綠底＝已分組但尚未完成補課・可拖曳姓名搬移分組`
                  : `共 ${rosterGroups.length} 組・★＝小隊長・淺綠底＝已分組但尚未完成補課`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={exportChangesCsv}
                disabled={latestGroupMap.size === 0}
                title={latestGroupMap.size === 0 ? '尚無異動' : `匯出 ${latestGroupMap.size} 筆異動`}
                className="text-xs font-medium px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                匯出異動對照表{latestGroupMap.size > 0 ? `（${latestGroupMap.size}）` : ''}
              </button>
              {canEditMakeup && (
                <button
                  type="button"
                  onClick={addGroup}
                  disabled={groupActionPending}
                  className="text-xs font-medium px-2.5 py-1 rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                >
                  ＋新增組別
                </button>
              )}
            </div>
          </div>
          <div className="p-4">
            {mounted ? (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setDraggingMember(null)}
              >
                <div className="flex flex-wrap gap-2">
                  {rosterGroups.map((g) => (
                    <RosterGroupColumn
                      key={g.name}
                      group={g}
                      canEdit={canEditMakeup}
                      dndEnabled
                      updatingId={updatingId}
                      movingId={movingId}
                      onToggleLeader={toggleLeader}
                      onToggleMakeup={toggleMakeupCompleted}
                      onDeleteGroup={deleteGroup}
                      deletePending={groupActionPending}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
                  {draggingMember && (
                    <div className="px-2 py-1 rounded-md bg-white border-2 border-indigo-400 shadow-lg text-[11px] font-medium text-indigo-900 cursor-grabbing">
                      {draggingMember.name}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            ) : (
              // SSR／client 尚未 mount 完成：不掛載 DndContext 與任何
              // @dnd-kit hook，避免 aria-describedby 的 hydration mismatch
              // （見 DraggableMember 上方註解）。這段渲染完成後 useEffect
              // 立刻把 mounted 設為 true 換上可拖曳版本，使用者感知不到
              // 這個切換（正常狀況下是同一個 tick 內就完成）。
              <div className="flex flex-wrap gap-2">
                {rosterGroups.map((g) => (
                  <RosterGroupColumn
                    key={g.name}
                    group={g}
                    canEdit={canEditMakeup}
                    dndEnabled={false}
                    updatingId={updatingId}
                    movingId={movingId}
                    onToggleLeader={toggleLeader}
                    onToggleMakeup={toggleMakeupCompleted}
                    onDeleteGroup={deleteGroup}
                    deletePending={groupActionPending}
                  />
                ))}
              </div>
            )}
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

/**
 * 分組總表的單一分組欄位——同時是 droppable 容器（接收拖入的組員）與
 * 刪除組別的操作單位。拆成獨立元件是因為 useDroppable 是 hook，不能在
 * .map() 的 callback 內直接呼叫。
 *
 * dndEnabled 為 false 時（SSR／client 尚未 mount 完成）完全不呼叫
 * useDroppable、改用純 <div> 容器，組員列也改用不含 dnd-kit hooks 的
 * StaticMemberRow——見 DraggableMember 上方註解說明原因。
 */
function RosterGroupColumn({
  group, canEdit, dndEnabled, updatingId, movingId, onToggleLeader, onToggleMakeup, onDeleteGroup, deletePending,
}: {
  group: RosterGroup
  canEdit: boolean
  dndEnabled: boolean
  updatingId: number | null
  movingId: number | null
  onToggleLeader: (id: number, name: string, next: boolean) => void
  onToggleMakeup: (id: number, name: string, next: boolean) => void
  onDeleteGroup: (name: string, memberCount: number) => void
  deletePending: boolean
}) {
  const isEmpty = group.members.length === 0
  const columnHeader = (
    <div className="flex items-center justify-between gap-0.5 px-1.5 py-1 bg-rose-50 border-b border-rose-100">
      <span className="text-[11px] font-bold text-rose-800 truncate" title={group.name}>{group.name}</span>
      {canEdit && (
        <button
          type="button"
          onClick={() => onDeleteGroup(group.name, group.members.length)}
          disabled={deletePending}
          title={isEmpty ? '刪除此分組' : '此分組尚有組員，點擊查看說明'}
          aria-label={`刪除分組「${group.name}」`}
          className={`shrink-0 text-[11px] leading-none disabled:opacity-30 ${
            isEmpty ? 'text-rose-400 hover:text-rose-700' : 'text-slate-300 hover:text-rose-500'
          }`}
        >
          ✕
        </button>
      )}
    </div>
  )
  const memberRows = group.members.map((m) =>
    dndEnabled ? (
      <DraggableMember
        key={m.id}
        member={m}
        groupName={group.name}
        canEdit={canEdit}
        updatingId={updatingId}
        isMoving={movingId === m.id}
        onToggleLeader={onToggleLeader}
        onToggleMakeup={onToggleMakeup}
      />
    ) : (
      <StaticMemberRow
        key={m.id}
        member={m}
        canEdit={canEdit}
        updatingId={updatingId}
        isMoving={movingId === m.id}
        onToggleLeader={onToggleLeader}
        onToggleMakeup={onToggleMakeup}
      />
    )
  )

  if (!dndEnabled) {
    return (
      <div className="w-20 shrink-0 border border-slate-200 rounded-lg overflow-hidden">
        {columnHeader}
        <div className="divide-y divide-slate-100 min-h-[1.5rem]">{memberRows}</div>
      </div>
    )
  }

  return <DroppableGroupColumn groupName={group.name}>{columnHeader}{memberRows}</DroppableGroupColumn>
}

/** useDroppable 呼叫獨立成元件，讓 RosterGroupColumn 能在 dndEnabled=false 時完全不掛載這個 hook。 */
function DroppableGroupColumn({ groupName, children }: { groupName: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupName })
  return (
    <div
      ref={setNodeRef}
      className={`w-20 shrink-0 border rounded-lg overflow-hidden transition-colors ${
        isOver ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'
      }`}
    >
      {children}
    </div>
  )
}

interface MemberRowContentProps {
  member: RosterMember
  canEdit: boolean
  updatingId: number | null
  isMoving: boolean
  onToggleLeader: (id: number, name: string, next: boolean) => void
  onToggleMakeup: (id: number, name: string, next: boolean) => void
}

/** 組員列的內容（姓名、★小隊長按鈕、補課狀態按鈕），不含任何拖曳相關的 ref/attributes——由外層的 DraggableMember 或 StaticMemberRow 決定是否要包上拖曳能力。 */
function MemberRowContent({ member: m, canEdit, updatingId, isMoving, onToggleLeader, onToggleMakeup }: MemberRowContentProps) {
  return (
    <>
      {isMoving && (
        <span className="shrink-0 text-[11px] leading-none text-indigo-500 animate-pulse" aria-hidden="true">⋯</span>
      )}
      {canEdit && !isMoving && (
        <button
          type="button"
          onClick={() => onToggleLeader(m.id, m.name, !m.isLeader)}
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
      {!canEdit && m.isLeader && (
        <span className="shrink-0 text-[11px] text-rose-600" aria-hidden="true">★</span>
      )}
      <a
        href={`/students?search=${encodeURIComponent(m.name)}`}
        title={
          isMoving
            ? `${m.name}（搬移中…）`
            : m.isLeader
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
      {m.canToggleMakeup && canEdit && !isMoving && (
        <button
          type="button"
          onClick={() => onToggleMakeup(m.id, m.name, m.pendingMakeup)}
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
    </>
  )
}

/** 組員列的樣式外框（背景色、間距），與內容分開是因為 DraggableMember／StaticMemberRow 需要各自套用不同的 ref/事件屬性到這個外框上。 */
function memberRowClassName(m: RosterMember, extra: string, isMoving: boolean, isDragging: boolean) {
  return `flex items-center gap-0.5 px-1.5 py-0.5 ${
    m.isLeader ? 'bg-rose-50' : m.pendingMakeup ? 'bg-green-100' : ''
  } ${extra} ${isDragging || isMoving ? 'opacity-40' : ''}`
}

/**
 * 分組總表的單一組員列（拖放已啟用版本），同時是 draggable 來源。
 * canEdit 為 false 時不啟用拖曳（唯讀角色維持原本純顯示）。isMoving 為
 * true 時（放開拖曳後、router.refresh() 帶回新資料前的空窗期）顯示
 * 「搬移中」樣式並停用互動，填補 PATCH+重新查詢這段實測近 1 秒的視覺
 * 空窗——見 openspec/changes/spirit-roster-drag-edit 的手感優化。
 *
 * 只在 client mount 完成後才會被渲染（見 SpiritClient 的 mounted 旗標）
 * ——SSR 階段一律走 StaticMemberRow，避免 @dnd-kit 的 useUniqueId 全域
 * 計數器在 SSR/CSR 之間算出不同的 aria-describedby 導致 hydration
 * mismatch（該計數器是模組級全域狀態、跨 server process 生命週期持續
 * 累加，SSR 與瀏覽器端的起始值天生對不齊，這是套件本身的已知限制，
 * 不是我們的邏輯錯誤）。
 */
function DraggableMember(props: MemberRowContentProps & { groupName: string }) {
  const { member: m, groupName, canEdit, isMoving } = props
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: m.id,
    data: { group: groupName, name: m.name },
    disabled: !canEdit || isMoving,
  })

  return (
    <div
      ref={setNodeRef}
      {...(canEdit && !isMoving ? { ...attributes, ...listeners } : {})}
      className={memberRowClassName(m, canEdit && !isMoving ? 'cursor-grab active:cursor-grabbing' : '', isMoving, isDragging)}
    >
      <MemberRowContent {...props} />
    </div>
  )
}

/** 組員列的純顯示版本（SSR／mount 完成前使用），不呼叫任何 @dnd-kit hook，也就不會產生會在 hydration 時對不齊的 aria 屬性。 */
function StaticMemberRow(props: MemberRowContentProps) {
  return (
    <div className={memberRowClassName(props.member, '', props.isMoving, false)}>
      <MemberRowContent {...props} />
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
