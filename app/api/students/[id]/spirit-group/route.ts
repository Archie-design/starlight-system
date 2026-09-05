import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { studentIdsAllInSystem } from '@/lib/utils/system'

/**
 * 更新單一學員的心之使者分組（spirit_ambassador_group）——供分組總表的
 * 拖曳搬移使用：拖曳放開後前端立即呼叫此端點，資料庫即時生效，不做前端
 * 暫存草稿（見 openspec/changes/spirit-roster-drag-edit）。
 *
 * 權限比照既有 spirit-makeup/spirit-leader 端點：僅 superadmin/
 * system_admin 可操作，system_admin 僅限自己有效體系內的學員。此外，
 * 目標分組本身也必須存在於 spirit_ambassador_groups 且屬於操作者的有效
 * 體系——防止繞過前端 UI 直接呼叫 API 把學員拖進另一體系的分組。
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
  if (typeof body.group !== 'string' || !body.group.trim()) {
    return NextResponse.json({ error: 'group 必須為非空字串' }, { status: 400 })
  }
  const targetGroup = body.group.trim()

  const supabase = createServiceClient()
  const effectiveSystem = await getEffectiveSystem(user)

  if (user.role !== 'superadmin') {
    const ok = await studentIdsAllInSystem(supabase, [id], effectiveSystem)
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 目標分組必須存在，且屬於操作者的有效體系（superadmin 也要遵守，
  // 用自己「當前選擇」的體系判定，與其餘 spirit 端點一致的心智模型）。
  const { data: groupRow, error: groupErr } = await supabase
    .from('spirit_ambassador_groups')
    .select('name, guidance_chain')
    .eq('name', targetGroup)
    .maybeSingle()
  if (groupErr) return serverErrorResponse('students/[id]/spirit-group (lookup group)', groupErr)
  if (!groupRow || groupRow.guidance_chain !== effectiveSystem) {
    return NextResponse.json({ error: '目標分組不存在或不屬於目前體系' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('students')
    .update({ spirit_ambassador_group: targetGroup })
    .eq('id', id)
    .select('id, spirit_ambassador_group')
    .maybeSingle()

  if (error) return serverErrorResponse('students/[id]/spirit-group', error)
  if (!data) return NextResponse.json({ error: '找不到學員' }, { status: 404 })

  return NextResponse.json({ success: true, data })
}
