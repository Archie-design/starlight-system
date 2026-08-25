import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { requireManager } from '@/lib/auth/middleware'
import { getEffectiveSystem } from '@/lib/auth'
import { systemOf } from '@/lib/utils/system'

export async function GET(request: NextRequest) {
  // 編輯稽核紀錄涉及全體系資料，限管理層級查看
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const name = searchParams.get('name') ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '500'), 1000)

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('edit_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (name) {
    query = query.ilike('student_name', `%${name}%`)
  }

  const { data, error } = await query
  if (error) return serverErrorResponse('edit-logs', error)

  // 依 student_id 反查所屬體系，非 superadmin 只能看自己體系的稽核紀錄
  // （P2 #22 剩餘部分：edit_logs 本身沒有體系欄位，須反查 students.business_chain）
  let logs = (data ?? []) as Array<{ student_id: number | null }>
  if (user.role !== 'superadmin' && logs.length > 0) {
    const effectiveSystem = await getEffectiveSystem(user)
    const studentIds = [...new Set(logs.map((l) => l.student_id).filter((id): id is number => id !== null))]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: students } = await (supabase as any)
      .from('students')
      .select('id, business_chain')
      .in('id', studentIds.length > 0 ? studentIds : [-1])
    const systemById = new Map<number, string>(
      (students ?? []).map((s: { id: number; business_chain: string | null }) => [s.id, systemOf(s.business_chain)])
    )
    // 反查不到體系的（例如學員已被刪除）保守排除，不預設放行
    logs = logs.filter((l) => l.student_id !== null && systemById.get(l.student_id) === effectiveSystem)
  }

  return NextResponse.json({ logs })
}
