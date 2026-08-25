import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { systemOf } from '@/lib/utils/system'

/**
 * 查出分組所屬體系（規則同 GET /api/counselor-groups：以其 root_student_ids
 * 中第一個能判定體系的根節點學員的 business_chain 決定；查無根節點資料則
 * 預設星光）。寫入操作前用來比對呼叫者體系，避免跨體系竄改。
 */
async function resolveGroupSystem(
  supabase: ReturnType<typeof createServiceClient>,
  rootStudentIds: number[]
): Promise<'星光' | '太陽'> {
  if (rootStudentIds.length === 0) return '星光'
  const { data: roots } = await supabase
    .from('students')
    .select('id, business_chain')
    .in('id', rootStudentIds)
  const first = roots?.[0]
  return first ? systemOf(first.business_chain) : '星光'
}

const ALLOWED_FIELDS = ['name', 'display_order', 'root_student_ids'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: findErr } = await (supabase as any)
    .from('counselor_groups')
    .select('id, root_student_ids')
    .eq('id', id)
    .maybeSingle()
  if (findErr) return serverErrorResponse('counselor-groups/[id]', findErr)
  if (!existing) return NextResponse.json({ error: '找不到分組' }, { status: 404 })

  const effectiveSystem = await getEffectiveSystem(user)
  const groupSystem = await resolveGroupSystem(supabase, existing.root_student_ids ?? [])
  if (user.role !== 'superadmin' && groupSystem !== effectiveSystem) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 欄位白名單，避免 mass assignment（呼叫端傳入任意欄位皆被忽略）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('counselor_groups')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return serverErrorResponse('counselor-groups/[id]', error)
  return NextResponse.json({ group: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: findErr } = await (supabase as any)
    .from('counselor_groups')
    .select('id, root_student_ids')
    .eq('id', id)
    .maybeSingle()
  if (findErr) return serverErrorResponse('counselor-groups/[id]', findErr)
  if (!existing) return NextResponse.json({ error: '找不到分組' }, { status: 404 })

  const effectiveSystem = await getEffectiveSystem(user)
  const groupSystem = await resolveGroupSystem(supabase, existing.root_student_ids ?? [])
  if (user.role !== 'superadmin' && groupSystem !== effectiveSystem) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('counselor_groups')
    .delete()
    .eq('id', id)

  if (error) return serverErrorResponse('counselor-groups/[id]', error)
  return NextResponse.json({ ok: true })
}
