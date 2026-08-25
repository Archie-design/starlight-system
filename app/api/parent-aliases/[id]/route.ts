import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { studentIdsAllInSystem } from '@/lib/utils/system'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: existing, error: findErr } = await supabase
    .from('parent_aliases')
    .select('original_parent_id, proxy_parent_id')
    .eq('id', id)
    .maybeSingle()
  if (findErr) return serverErrorResponse('parent-aliases/[id]', findErr)
  if (!existing) return NextResponse.json({ error: '找不到代管關係' }, { status: 404 })

  if (user.role !== 'superadmin') {
    const effectiveSystem = await getEffectiveSystem(user)
    const ok = await studentIdsAllInSystem(
      supabase,
      [existing.original_parent_id, existing.proxy_parent_id],
      effectiveSystem
    )
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('parent_aliases')
    .delete()
    .eq('id', id)

  if (error) return serverErrorResponse('parent-aliases/[id]', error)
  return NextResponse.json({ ok: true })
}
