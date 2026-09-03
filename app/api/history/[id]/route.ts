import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { requireManager } from '@/lib/auth/middleware'
import { getEffectiveSystem } from '@/lib/auth'
import { systemOf } from '@/lib/utils/system'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 匯入紀錄涉及全體系資料，限管理層級查看
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('import_logs')
    .select('id, student_id, student_name, field, old_value, new_value, change_type, applied_at')
    .eq('session_id', id)
    .order('student_id', { ascending: true })

  if (error) return serverErrorResponse('history/[id]', error)

  // 依 student_id 反查所屬體系，非 superadmin 只能看自己體系的匯入明細
  // （P2 #22 剩餘部分）。理論上 #2 已限制匯入不能跨體系，同一個 session
  // 的明細應全屬同一體系，這裡仍逐筆過濾以防禦性保底。
  let logs = (data ?? []) as Array<{ student_id: number | null }>
  if (user.role !== 'superadmin' && logs.length > 0) {
    const effectiveSystem = await getEffectiveSystem(user)
    const studentIds = [...new Set(logs.map((l) => l.student_id).filter((sid): sid is number => sid !== null))]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: students } = await (supabase as any)
      .from('students')
      .select('id, guidance_chain')
      .in('id', studentIds.length > 0 ? studentIds : [-1])
    const systemById = new Map<number, string | null>(
      (students ?? []).map((s: { id: number; guidance_chain: string | null }) => [s.id, systemOf(s.guidance_chain)])
    )
    logs = logs.filter((l) => l.student_id !== null && systemById.get(l.student_id) === effectiveSystem)
  }

  return NextResponse.json({ logs })
}
