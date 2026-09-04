import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { studentIdsAllInSystem } from '@/lib/utils/system'

/**
 * 更新單一學員的心之使者補課狀態（spirit_ambassador_makeup_completed）。
 * 刻意做成專用端點（而非通用的「更新任意學員欄位」API）——範圍明確限縮
 * 在這一個欄位，避免變成可以改任何學員資料的後門。與既有的
 * student-overrides/parent-aliases 寫入端點一致：僅 superadmin/
 * system_admin 可操作，system_admin 僅限自己有效體系內的學員（見
 * openspec/changes/spirit-ambassador-master-roster）。
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  if (typeof body.completed !== 'boolean') {
    return NextResponse.json({ error: 'completed 必須為布林值' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (user.role !== 'superadmin') {
    const effectiveSystem = await getEffectiveSystem(user)
    const ok = await studentIdsAllInSystem(supabase, [id], effectiveSystem)
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('students')
    .update({ spirit_ambassador_makeup_completed: body.completed })
    .eq('id', id)
    .select('id, spirit_ambassador_makeup_completed')
    .maybeSingle()

  if (error) return serverErrorResponse('students/[id]/spirit-makeup', error)
  if (!data) return NextResponse.json({ error: '找不到學員' }, { status: 404 })

  return NextResponse.json({ success: true, data })
}
