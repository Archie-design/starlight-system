import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { systemOf } from '@/lib/utils/system'

export async function GET(request: NextRequest) {
  const { valid, user } = await checkAuth(request)
  if (!valid || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const system = await getEffectiveSystem(user)
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groups, error } = await (supabase as any)
    .from('counselor_groups')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) return serverErrorResponse('counselor-groups', error)

  // 以各分組根節點的 business_chain 判定其體系，只回有效體系相符的分組
  const rootIds = [...new Set((groups ?? []).flatMap((g: { root_student_ids: number[] }) => g.root_student_ids))]
  const rootSystem = new Map<number, '星光' | '太陽'>()
  if (rootIds.length > 0) {
    const { data: roots } = await supabase
      .from('students')
      .select('id, business_chain')
      .in('id', rootIds as number[])
    for (const r of roots ?? []) rootSystem.set(r.id, systemOf(r.business_chain))
  }

  // 分組體系 = 第一個能判定體系的根節點；無根節點資料則預設星光
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = (groups ?? []).filter((g: any) => {
    const rid = g.root_student_ids.find((id: number) => rootSystem.has(id))
    const gSys = rid != null ? rootSystem.get(rid)! : '星光'
    return gSys === system
  })

  return NextResponse.json({ groups: filtered })
}

export async function POST(request: NextRequest) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, display_order, root_student_ids } = await request.json()
  if (!name) return NextResponse.json({ error: '缺少名稱' }, { status: 400 })

  const rootIds: number[] = Array.isArray(root_student_ids) ? root_student_ids : []
  const supabase = createServiceClient()

  // 驗證 root_student_ids 指定的根節點學員皆屬於呼叫者有效體系，
  // 避免 system_admin 建立跨體系的分組（superadmin 不受限）
  if (user.role !== 'superadmin' && rootIds.length > 0) {
    const effectiveSystem = await getEffectiveSystem(user)
    const { data: roots } = await supabase
      .from('students')
      .select('id, business_chain')
      .in('id', rootIds)
    const mismatched = (roots ?? []).some((r) => systemOf(r.business_chain) !== effectiveSystem)
    if (mismatched) return NextResponse.json({ error: '根節點學員須屬於你的體系' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('counselor_groups')
    .insert({ name, display_order: display_order ?? 0, root_student_ids: rootIds })
    .select('*')
    .single()

  if (error) return serverErrorResponse('counselor-groups', error)
  return NextResponse.json({ group: data })
}
