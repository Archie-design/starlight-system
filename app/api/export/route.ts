import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildStudentsXlsx } from '@/lib/export/buildXlsx'
import type { Student, SheetSystem } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const system = (searchParams.get('system') ?? '星光') as SheetSystem
    const name = searchParams.get('name') ?? ''
    const counselor = searchParams.get('counselor') ?? ''
    const region = searchParams.get('region') ?? ''

    const supabase = createServiceClient()

    let query = supabase
      .from('students')
      .select('*')
      .eq('sheet_system', system)
      .order('id', { ascending: true })

    if (name) query = query.ilike('name', `%${name}%`)
    if (counselor) query = query.ilike('counselor', `%${counselor}%`)
    if (region) query = query.eq('region', region)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const buffer = await buildStudentsXlsx(data as Student[], `學員名單(${system})`)
    const filename = encodeURIComponent(`學員名單_${system}_${new Date().toISOString().split('T')[0]}.xlsx`)

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
    })
  } catch (err) {
    console.error('[export]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '匯出失敗' },
      { status: 500 }
    )
  }
}
