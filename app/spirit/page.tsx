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
  cumulative_seniority: string | null
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
        .select('id, name, spirit_ambassador_join_date, spirit_ambassador_group, cumulative_seniority, business_chain'),
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

  // 資料品質提醒
  const noGroup = spirits.filter((s) => !(s.spirit_ambassador_group ?? '').trim()).map((s) => ({ id: s.id, name: s.name }))
  const noSeniority = spirits.filter((s) => parseSeniorityMonths(s.cumulative_seniority) == null).map((s) => ({ id: s.id, name: s.name }))
  const singletonGroups = groupCounts.filter((g) => g.count === 1).map((g) => ({ name: g.name, member: groupMap.get(g.name)![0].name }))

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
      seniorityDist={seniorityDist}
      groupAvgSeniority={groupAvgSeniority}
      alerts={{ noGroup, noSeniority, singletonGroups }}
    />
  )
}
