import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth'

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('students')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ updatedAt: data?.updated_at ?? null })
}
