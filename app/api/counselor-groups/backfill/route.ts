import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth'
import { buildGroupAssignments } from '@/lib/import/assignGroup'

export async function POST() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // 3. 取得所有學員（id、counselor、introducer）—— 分頁避開 Supabase 1000 筆上限
  const PAGE = 1000
  const students: { id: number; counselor: string | null; introducer: string | null }[] = []
  let from = 0
  while (true) {
    const { data, error: sErr } = await supabase
      .from('students')
      .select('id, counselor, introducer')
      .range(from, from + PAGE - 1)
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
    if (!data || data.length === 0) break
    students.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  // 4. 建立 Map 並運算歸屬
  const studentMap = new Map(
    (students ?? []).map((s: { id: number; counselor: string | null; introducer: string | null }) => [s.id, s])
  )
  const assignments = buildGroupAssignments(studentMap, groups ?? [], aliasMap, overrideMap)

  // 4. 按 group_leader 分桶，用 in() 批次更新
  const byGroup = new Map<string, number[]>()
  for (const [id, name] of assignments) {
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
      await supabase.from('students').update({ group_leader }).in('id', chunk)
    }
  }

  return NextResponse.json({ updated: assignments.size, total: students?.length ?? 0 })
}
