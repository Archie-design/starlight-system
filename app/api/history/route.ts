import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth'

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('import_sessions')
    .select('id, imported_at, filename, source_rows, rows_updated, rows_inserted, rows_unchanged, applied, applied_at')
    .order('imported_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}
