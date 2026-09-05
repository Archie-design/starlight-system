import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { studentIdsAllInSystem } from '@/lib/utils/system'
import type { SpiritGroupConflict } from '@/lib/supabase/types'

/**
 * 處理一筆待處理的分組匯入衝突（見 openspec/changes/
 * spirit-group-import-conflict）：管理者擇一保留「本系統現有值」
 * （resolution='kept_system'，students 表本來就沒被覆蓋，只標記衝突
 * 已解決）或「xlsx 候選值」（resolution='kept_import'，額外把候選值
 * 寫回 students.spirit_ambassador_group）。
 *
 * 權限比照既有 spirit-makeup/spirit-leader/spirit-group 端點：僅
 * superadmin/system_admin 可操作，system_admin 僅限自己有效體系內的
 * 學員。kept_import 這條路徑刻意不像 spirit-group 端點那樣校驗目標分組
 * 是否存在於 spirit_ambassador_groups——xlsx 候選值本來就可能是系統
 * 尚未登記的全新組名（見 design.md Decision 3），這是唯一允許寫入這種
 * 未登記組名的合法路徑。
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  if (body.resolution !== 'kept_system' && body.resolution !== 'kept_import') {
    return NextResponse.json({ error: 'resolution 必須為 kept_system 或 kept_import' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: conflict, error: findErr } = await supabase
    .from('spirit_group_conflicts')
    .select('*')
    .eq('id', id)
    .maybeSingle() as { data: SpiritGroupConflict | null; error: unknown }
  if (findErr) return serverErrorResponse('spirit-group-conflicts/[id] (lookup)', findErr)
  if (!conflict) return NextResponse.json({ error: '找不到衝突記錄' }, { status: 404 })
  if (conflict.status !== 'pending') {
    return NextResponse.json({ error: '此衝突已處理過' }, { status: 400 })
  }

  if (user.role !== 'superadmin') {
    const effectiveSystem = await getEffectiveSystem(user)
    const ok = await studentIdsAllInSystem(supabase, [conflict.student_id], effectiveSystem)
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (body.resolution === 'kept_import') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateStudentErr } = await (supabase as any)
      .from('students')
      .update({ spirit_ambassador_group: conflict.import_value })
      .eq('id', conflict.student_id)
    if (updateStudentErr) return serverErrorResponse('spirit-group-conflicts/[id] (update student)', updateStudentErr)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('spirit_group_conflicts')
    .update({
      status: 'resolved',
      resolution: body.resolution,
      resolved_by: user.username,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status, resolution')
    .maybeSingle()

  if (error) return serverErrorResponse('spirit-group-conflicts/[id]', error)
  if (!data) return NextResponse.json({ error: '找不到衝突記錄' }, { status: 404 })

  return NextResponse.json({ success: true, data })
}
