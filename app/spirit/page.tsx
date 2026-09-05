import { redirect } from 'next/navigation'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { applySystemFilter } from '@/lib/utils/system'
import { parseSeniorityMonths, seniorityBucket, SENIORITY_BUCKETS } from '@/lib/utils/seniority'
import { APP_NAME } from '@/lib/config'
import SpiritClient from './SpiritClient'

export const metadata = {
  title: `心之使者專區 — ${APP_NAME}`,
}

type Row = {
  id: number
  name: string
  spirit_ambassador_join_date: string | null
  spirit_ambassador_group: string | null
  spirit_ambassador_makeup_completed: boolean | null
  spirit_ambassador_is_leader: boolean | null
  cumulative_seniority: string | null
}

/**
 * 分組總表的欄位排序：「星光N」/「太陽N」格式依數字由小到大排在前，
 * 其餘命名（例如「小兔組」）依字串排序接續在後。不寫死組別清單，完全
 * 依資料庫實際出現的組名動態排序，未來新增/移除分組不需要改程式碼。
 */
function sortGroups(names: string[]): string[] {
  const numbered: { name: string; n: number }[] = []
  const others: string[] = []
  for (const name of names) {
    const m = name.match(/^(?:星光|太陽)(\d+)$/)
    if (m) numbered.push({ name, n: Number(m[1]) })
    else others.push(name)
  }
  numbered.sort((a, b) => a.n - b.n)
  others.sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  return [...numbered.map((x) => x.name), ...others]
}

export default async function SpiritPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.must_change_password) redirect('/account/change-password')

  const system = await getEffectiveSystem(user!)
  const service = createServiceClient()

  // 分頁撈本體系全量學員（只取心之使者相關欄位）
  const all: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await applySystemFilter(
      service
        .from('students')
        .select('id, name, spirit_ambassador_join_date, spirit_ambassador_group, spirit_ambassador_makeup_completed, spirit_ambassador_is_leader, cumulative_seniority, business_chain'),
      system,
    ).range(from, from + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Row[]))
    if (data.length < 1000) break
  }

  // 心之使者 = 有加入日
  const spirits = all.filter((s) => s.spirit_ambassador_join_date)

  // 各組人數
  const groupMap = new Map<string, Row[]>()
  for (const s of spirits) {
    const g = (s.spirit_ambassador_group ?? '').trim()
    if (!g) continue
    if (!groupMap.has(g)) groupMap.set(g, [])
    groupMap.get(g)!.push(s)
  }
  const groupCounts = Array.from(groupMap.entries())
    .map(([name, members]) => ({ name, count: members.length }))
    .sort((a, b) => b.count - a.count)

  // 各組組員名單（供點圖展開）；組內依年資高到低
  const groupMembers: Record<string, { id: number; name: string; seniority: string | null }[]> = {}
  for (const [name, members] of groupMap.entries()) {
    groupMembers[name] = members
      .map((s) => ({ id: s.id, name: s.name, seniority: s.cumulative_seniority }))
      .sort((a, b) => (parseSeniorityMonths(b.seniority) ?? 0) - (parseSeniorityMonths(a.seniority) ?? 0))
  }

  // 年資（月）
  const months = spirits.map((s) => parseSeniorityMonths(s.cumulative_seniority)).filter((m): m is number => m != null)
  const avgMonths = months.length ? Math.round(months.reduce((a, b) => a + b, 0) / months.length) : 0

  // 年資分佈（固定桶序）
  const distMap = new Map<string, number>(SENIORITY_BUCKETS.map((b) => [b, 0]))
  for (const m of months) {
    const b = seniorityBucket(m)
    distMap.set(b, (distMap.get(b) ?? 0) + 1)
  }
  const seniorityDist = SENIORITY_BUCKETS.map((bucket) => ({ bucket, count: distMap.get(bucket) ?? 0 }))

  // 各組平均年資（僅計有年資者）+ 人數
  const groupAvgSeniority = Array.from(groupMap.entries())
    .map(([name, members]) => {
      const ms = members.map((s) => parseSeniorityMonths(s.cumulative_seniority)).filter((m): m is number => m != null)
      const avg = ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0
      return { name, avgMonths: avg, count: members.length }
    })
    .sort((a, b) => b.avgMonths - a.avgMonths)

  // 分組總表：統計母體是「全體學員中已分組者」（all，不限 join_date），
  // 涵蓋正式心之使者與「已分組但尚未完成補課」兩種人——與上方 groupMap
  // （母體限定 spirits，僅供既有 KPI/圖表使用）是刻意分開的兩份資料結構，
  // 互不影響既有統計。未分組者不進入總表網格（畫面上不呈現未分組名單，
  // 見使用者回饋）。組內排序沿用既有「年資高到低」慣例，第一位即視覺
  // 上的組長位置。
  //
  // 總表欄位來源改為 spirit_ambassador_groups（獨立資料表），不再只靠
  // 學員資料反推——這樣「新增一個目前無成員的空組別」才能在重新整理後
  // 仍然顯示。學員仍照 spirit_ambassador_group 分桶塞進對應組別；若某
  // 學員的組別字串不在 spirit_ambassador_groups 裡，MUST NOT 自動併入
  // 總表當成一個看似合法的新欄位（先前版本曾這樣容錯，但這會讓「系統
  // 未登記的孤兒分組」偽裝成正常組別，管理者無從察覺異常）——這種孤兒
  // 學員改為完全不出現在總表中，只在下方「資料品質提醒」列出，見
  // openspec/changes/spirit-group-import-conflict 的孤兒分組提醒。
  // 見 openspec/changes/spirit-roster-drag-edit（分組總表資料來源獨立化）。
  const { data: groupRows, error: groupRowsErr } = await service
    .from('spirit_ambassador_groups')
    .select('name')
    .eq('guidance_chain', system)
  if (groupRowsErr) throw groupRowsErr

  const rosterGroupMap = new Map<string, Row[]>()
  for (const row of groupRows ?? []) {
    rosterGroupMap.set(row.name, [])
  }
  for (const s of all) {
    const g = (s.spirit_ambassador_group ?? '').trim()
    if (!g || !rosterGroupMap.has(g)) continue
    rosterGroupMap.get(g)!.push(s)
  }
  // 待處理分組匯入衝突（見 openspec/changes/spirit-group-import-conflict）
  // ——只查目前有效體系內的學員相關衝突：先取這批 all 學員的 id 集合，
  // 再篩選 conflicts 中 student_id 屬於這個集合者，避免跨體系洩漏。
  const allIdSet = new Set(all.map((s) => s.id))
  const { data: conflictRows, error: conflictErr } = await service
    .from('spirit_group_conflicts')
    .select('id, student_id, student_name, system_value, import_value, created_at, updated_at')
    .eq('status', 'pending')
  if (conflictErr) throw conflictErr
  const pendingConflicts = (conflictRows ?? [])
    .filter((c) => allIdSet.has(c.student_id))
    .map((c) => ({
      id: c.id as string,
      studentId: c.student_id as number,
      studentName: c.student_name as string,
      systemValue: c.system_value as string | null,
      importValue: c.import_value as string,
      updatedAt: (c.updated_at ?? c.created_at) as string,
    }))
  const conflictedStudentIds = new Set(pendingConflicts.map((c) => c.studentId))

  const rosterGroupOrder = sortGroups(Array.from(rosterGroupMap.keys()))
  const rosterGroups = rosterGroupOrder.map((name) => ({
    name,
    members: rosterGroupMap.get(name)!
      .map((s) => {
        // 「尚未是正式心之使者」（join_date 為空）是補課狀態這個過渡追蹤
        // 有意義的前提；一旦已轉正，makeup_completed 無論是什麼值都不該
        // 再顯示綠底或任何編輯入口——那屬於既有「有加入日但無組別」以外
        // 的資料完整性問題，不是這次要標示/操作的過渡狀態。
        const notYetSpirit = !s.spirit_ambassador_join_date
        return {
          id: s.id,
          name: s.name,
          seniority: s.cumulative_seniority,
          pendingMakeup: notYetSpirit && s.spirit_ambassador_makeup_completed !== true,
          // 是否顯示補課狀態的編輯入口（標記完成/取消標記皆算），與
          // pendingMakeup 分開判斷——避免誤觸標記完成後，因 pendingMakeup
          // 變 false 而連編輯入口一起消失，導致無法改回來（見使用者回報
          // 「點錯了無法恢復」）。
          canToggleMakeup: notYetSpirit,
          isLeader: s.spirit_ambassador_is_leader === true,
          // 是否有待處理的分組匯入衝突——顯示警示標示，格子本身仍顯示
          // 現有值（拖曳結果），不顯示 xlsx 候選值。
          hasConflict: conflictedStudentIds.has(s.id),
        }
      })
      // 小隊長優先置頂（任命制，與年資無關）；其餘依年資高到低排序。
      // 若某組沒有人被標記小隊長，isLeader 全為 false，排序退回既有的
      // 「年資最長者置頂」慣例（fallback，不需要特別分支處理）。
      .sort((a, b) => {
        if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1
        return (parseSeniorityMonths(b.seniority) ?? 0) - (parseSeniorityMonths(a.seniority) ?? 0)
      }),
  }))

  // 資料品質提醒
  const noGroup = spirits.filter((s) => !(s.spirit_ambassador_group ?? '').trim()).map((s) => ({ id: s.id, name: s.name }))
  const noSeniority = spirits.filter((s) => parseSeniorityMonths(s.cumulative_seniority) == null).map((s) => ({ id: s.id, name: s.name }))
  const singletonGroups = groupCounts.filter((g) => g.count === 1).map((g) => ({ name: g.name, member: groupMap.get(g.name)![0].name }))
  // 孤兒分組：有分組值，但該值不存在於 spirit_ambassador_groups（例如
  // 透過衝突解決「改採 xlsx 值」寫入了系統未知的組名）——這種學員的分組
  // 值仍在 students 表，但不會出現在依 spirit_ambassador_groups 驅動的
  // 分組總表任何欄位中，需要另外提醒管理者發現並處理。見 design.md Risk
  // 一節（openspec/changes/spirit-group-import-conflict）。
  const knownGroupNames = new Set(rosterGroupMap.keys())
  const orphanGroup = all
    .filter((s) => {
      const g = (s.spirit_ambassador_group ?? '').trim()
      return g && !knownGroupNames.has(g)
    })
    .map((s) => ({ id: s.id, name: s.name }))

  const kpi = {
    total: spirits.length,
    groupCount: groupMap.size,
    avgMonths,
    noGroupCount: noGroup.length,
  }

  return (
    <SpiritClient
      role={user!.role}
      system={system}
      kpi={kpi}
      groupCounts={groupCounts}
      groupMembers={groupMembers}
      seniorityDist={seniorityDist}
      groupAvgSeniority={groupAvgSeniority}
      alerts={{ noGroup, noSeniority, singletonGroups, orphanGroup }}
      rosterGroups={rosterGroups}
      pendingConflicts={pendingConflicts}
    />
  )
}
