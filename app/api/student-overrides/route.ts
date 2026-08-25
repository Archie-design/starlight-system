import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { studentIdsAllInSystem } from '@/lib/utils/system'

export async function GET(request: NextRequest) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: overrides, error } = await (supabase as any)
    .from('student_overrides')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return serverErrorResponse('student-overrides', error)

  // 取得學員名稱方便顯示 (若有需要)
  const studentIds = overrides.map((o: any) => o.student_id)
  const proxyIds = overrides.map((o: any) => o.override_parent_id)
  const allIds = Array.from(new Set([...studentIds, ...proxyIds]))

  let studentsData = []
  if (allIds.length > 0) {
    const { data: sData, error: sError } = await (supabase as any)
      .from('students')
      .select('id, name')
      .in('id', allIds)
    if (!sError && sData) {
      studentsData = sData
    }
  }

  const studentMap = new Map(studentsData.map((s: any) => [s.id, s.name]))

  const enrichedOverrides = overrides.map((o: any) => ({
    ...o,
    student_name: studentMap.get(o.student_id) || '未知',
    proxy_name: studentMap.get(o.override_parent_id) || '未知'
  }))

  return NextResponse.json({ overrides: enrichedOverrides })
}

export async function POST(request: NextRequest) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_ids, override_parent_id, note } = await request.json()
  if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0 || !override_parent_id) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 被覆寫的學員與目標上線都必須屬於呼叫者有效體系，避免跨體系覆寫上線關係
  if (user.role !== 'superadmin') {
    const effectiveSystem = await getEffectiveSystem(user)
    const ok = await studentIdsAllInSystem(supabase, [...student_ids, override_parent_id], effectiveSystem)
    if (!ok) return NextResponse.json({ error: '學員須屬於你的體系' }, { status: 400 })
  }

  const records = student_ids.map(id => ({
    student_id: id,
    override_parent_id,
    note
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('student_overrides')
    .upsert(records, { onConflict: 'student_id' })
    .select('*')

  if (error) return serverErrorResponse('student-overrides', error)
  return NextResponse.json({ overrides: data })
}
