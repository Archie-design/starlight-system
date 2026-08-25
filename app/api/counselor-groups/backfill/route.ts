import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { buildGroupAssignments } from '@/lib/import/assignGroup'
import { systemOf } from '@/lib/utils/system'

export async function POST(request: NextRequest) {
  // 全量重算會影響整個體系（甚至跨體系）的 group_leader 指派，僅限管理層級
  // （superadmin / system_admin）操作，一般 admin（關懷長）不可觸發。
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // system_admin 僅重算自己所屬體系；superadmin 才可跨體系（依目前選擇的體系）
  const effectiveSystem = await getEffectiveSystem(user)

  const supabase = createServiceClient()

  // 1. 取得所有分組
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groups, error: gErr } = await (supabase as any)
    .from('counselor_groups')
    .select('name, root_student_ids')
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  // 2. 取得代管對照表
  const { data: aliasData } = await supabase.from('parent_aliases').select('original_parent_id, proxy_parent_id')
  const aliasMap: Record<number, number> = {}
  aliasData?.forEach(a => {
    aliasMap[a.original_parent_id] = a.proxy_parent_id
  })

  // 2.5 取得指定學員覆寫對照表
  const { data: overrideData } = await supabase.from('student_overrides').select('student_id, override_parent_id')
  const overrideMap: Record<number, number> = {}
  overrideData?.forEach(o => {
    overrideMap[o.student_id] = o.override_parent_id
  })

  // 3. 取得所有學員（id、counselor、introducer、business_chain）—— 分頁避開 Supabase 1000 筆上限
  const PAGE = 1000
  type SEntry = { id: number; counselor: string | null; introducer: string | null; business_chain: string | null }
  const students: SEntry[] = []
  let from = 0
  while (true) {
    const { data, error: sErr } = await supabase
      .from('students')
      .select('id, counselor, introducer, business_chain')
      .range(from, from + PAGE - 1)
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
    if (!data || data.length === 0) break
    students.push(...(data as SEntry[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  // 4. 建立 Map 並運算歸屬（僅限呼叫者有效體系內的學員；studentMap 仍含全體系
  //    資料以正確解析上線鏈，但最終寫回範圍會在下方過濾）
  const studentMap = new Map(
    (students ?? []).map((s: SEntry) => [s.id, s])
  )
  const assignments = buildGroupAssignments(studentMap, groups ?? [], aliasMap, overrideMap)

  // 4.5 過濾成只寫回屬於呼叫者有效體系的學員，避免 system_admin 誤觸跨體系重算
  const scopedAssignments = new Map(
    [...assignments].filter(([id]) => {
      const s = studentMap.get(id)
      return s ? systemOf(s.business_chain) === effectiveSystem : false
    })
  )

  // 5. 按 group_leader 分桶，用 in() 批次更新
  const byGroup = new Map<string, number[]>()
  for (const [id, name] of scopedAssignments) {
    const arr = byGroup.get(name) ?? []
    arr.push(id)
    byGroup.set(name, arr)
  }

  for (const [group_leader, ids] of byGroup) {
    // Supabase JS doesn't support WHERE id IN (...) with update directly,
    // so split into chunks of 500 using .in() filter
    const CHUNK = 500
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const { error: updErr } = await supabase.from('students').update({ group_leader }).in('id', chunk)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ updated: scopedAssignments.size, total: students.filter(s => systemOf(s.business_chain) === effectiveSystem).length })
}
