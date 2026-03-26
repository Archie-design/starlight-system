import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildGroupAssignments } from '@/lib/import/assignGroup'

export async function POST() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // 1. 取得所有分組
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groups, error: gErr } = await (supabase as any)
    .from('counselor_groups')
    .select('name, root_student_ids')
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  // 2. 取得所有學員（id、counselor、introducer）
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, counselor, introducer')
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  // 3. 建立 Map 並運算歸屬
  const studentMap = new Map(
    (students ?? []).map((s: { id: number; counselor: string | null; introducer: string | null }) => [s.id, s])
  )
  const assignments = buildGroupAssignments(studentMap, groups ?? [])

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
