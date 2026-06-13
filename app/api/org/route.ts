import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { applySystemFilter } from '@/lib/utils/system'

export async function GET(request: NextRequest) {
  const { valid, user } = await checkAuth(request)
  if (!valid || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 體系一律以 server session 身分為準（admin 鎖定其體系；superadmin 依其選擇）
  const system = await getEffectiveSystem(user)

  const supabase = createServiceClient()
  const PAGE = 1000
  const allRows: unknown[] = []

  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: chunk, error } = await applySystemFilter(
      (supabase as any)
        .from('students')
        .select('id, name, role, region, introducer, course_1, course_2, course_3, course_4, course_5, course_wuyun, life_numbers, life_numbers_advanced, life_transform, debt_release, gender, counselor, business_chain, senior_counselor, guidance_chain, relation, membership_expiry, birthday'),
      system,
    )
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!chunk || chunk.length === 0) break
    allRows.push(...chunk)
    if (chunk.length < PAGE) break
  }

  return NextResponse.json({ students: allRows })
}
