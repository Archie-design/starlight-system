import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { studentIdsAllInSystem } from '@/lib/utils/system'

async function assertSameSystem(
  supabase: ReturnType<typeof createServiceClient>,
  id: string,
  user: NonNullable<Awaited<ReturnType<typeof requireManager>>>
): Promise<NextResponse | null> {
  const { data: existing, error: findErr } = await supabase
    .from('student_overrides')
    .select('student_id, override_parent_id')
    .eq('id', id)
    .maybeSingle()
  if (findErr) return serverErrorResponse('student-overrides/[id]', findErr)
  if (!existing) return NextResponse.json({ error: '找不到覆寫紀錄' }, { status: 404 })

  if (user.role !== 'superadmin') {
    const effectiveSystem = await getEffectiveSystem(user)
    const ok = await studentIdsAllInSystem(
      supabase,
      [existing.student_id, existing.override_parent_id],
      effectiveSystem
    )
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { note } = await request.json()

  const supabase = createServiceClient()
  const denied = await assertSameSystem(supabase, id, user)
  if (denied) return denied

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('student_overrides')
    .update({ note })
    .eq('id', id)
    .select()

  if (error) return serverErrorResponse('student-overrides/[id]', error)
  return NextResponse.json({ success: true, data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const supabase = createServiceClient()
  const denied = await assertSameSystem(supabase, id, user)
  if (denied) return denied

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('student_overrides')
    .delete()
    .eq('id', id)

  if (error) return serverErrorResponse('student-overrides/[id]', error)
  return NextResponse.json({ success: true })
}
