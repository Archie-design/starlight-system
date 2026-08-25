import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { applySystemFilter } from '@/lib/utils/system'

export async function GET(request: NextRequest) {
  const { valid, user } = await checkAuth(request)
  if (!valid || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const system = await getEffectiveSystem(user)
  const supabase = createServiceClient()
  const { data } = await applySystemFilter(
    supabase.from('students').select('updated_at'),
    system
  )
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ updatedAt: data?.updated_at ?? null })
}
