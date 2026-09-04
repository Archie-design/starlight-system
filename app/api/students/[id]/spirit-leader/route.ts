import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { studentIdsAllInSystem } from '@/lib/utils/system'

/**
 * 更新單一學員的心之使者小隊長標記（spirit_ambassador_is_leader）。
 * 刻意做成專用端點（同 spirit-makeup），權限比照：僅 superadmin/
 * system_admin 可操作，system_admin 僅限自己有效體系內的學員。
 *
 * 標記為小隊長（completed=true）時，SHALL 保證每組最多一位小隊長——
 * 若該學員的 spirit_ambassador_group 已有其他人被標記為 true，先把
 * 那些人降級為一般組員，再把目標學員設為 true。取消標記（completed=
 * false）不影響同組其他人。見 openspec/changes/
 * spirit-ambassador-master-roster。
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
  if (typeof body.isLeader !== 'boolean') {
    return NextResponse.json({ error: 'isLeader 必須為布林值' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (user.role !== 'superadmin') {
    const effectiveSystem = await getEffectiveSystem(user)
    const ok = await studentIdsAllInSystem(supabase, [id], effectiveSystem)
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (body.isLeader) {
    const { data: target, error: findErr } = await supabase
      .from('students')
      .select('id, spirit_ambassador_group')
      .eq('id', id)
      .maybeSingle()
    if (findErr) return serverErrorResponse('students/[id]/spirit-leader', findErr)
    if (!target) return NextResponse.json({ error: '找不到學員' }, { status: 404 })

    const group = (target.spirit_ambassador_group ?? '').trim()
    if (group) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: demoteErr } = await (supabase as any)
        .from('students')
        .update({ spirit_ambassador_is_leader: false })
        .eq('spirit_ambassador_group', group)
        .eq('spirit_ambassador_is_leader', true)
        .neq('id', id)
      if (demoteErr) return serverErrorResponse('students/[id]/spirit-leader (demote)', demoteErr)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('students')
    .update({ spirit_ambassador_is_leader: body.isLeader })
    .eq('id', id)
    .select('id, spirit_ambassador_is_leader')
    .maybeSingle()

  if (error) return serverErrorResponse('students/[id]/spirit-leader', error)
  if (!data) return NextResponse.json({ error: '找不到學員' }, { status: 404 })

  return NextResponse.json({ success: true, data })
}
