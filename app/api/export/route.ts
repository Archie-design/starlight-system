import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { logAdminAction } from '@/lib/auth/audit'
import { applySystemFilter } from '@/lib/utils/system'
import {
  highestStage,
  membershipStatus,
  isNewbie,
  isResubscribeCandidate,
  owesPayment,
  type MembershipStatus,
} from '@/lib/utils/studentStatus'
import { buildDuplicateNameSet, isDuplicateName, sortByNameGroup } from '@/lib/utils/duplicateName'
import { buildStudentsXlsx } from '@/lib/export/buildXlsx'
import type { Student } from '@/lib/supabase/types'
import type { StudentView } from '@/lib/db/types'

export async function GET(request: NextRequest) {
  const { valid, user } = await checkAuth(request)
  if (!valid || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name') ?? ''
    const counselor = searchParams.get('counselor') ?? ''
    const region = searchParams.get('region') ?? ''
    const role = searchParams.get('role') ?? ''
    const courseStageRaw = searchParams.get('courseStage')
    const courseStage = courseStageRaw === null || courseStageRaw === '' ? null : Number(courseStageRaw)
    const memStatus = (searchParams.get('membershipStatus') ?? '') as MembershipStatus | ''
    const wantSpirit = searchParams.get('isSpirit') === '1'
    const wantNewbie = searchParams.get('isNewbie') === '1'
    const view = (searchParams.get('view') ?? '') as StudentView | ''

    // 體系一律以 server session 身分為準，忽略 client 傳入的 system
    const system = await getEffectiveSystem(user)

    const supabase = createServiceClient()

    let query = applySystemFilter(
      supabase.from('students').select('*'),
      system,
    ).order('id', { ascending: true })

    // 可下推的單欄位條件
    if (name) query = query.ilike('name', `%${name}%`)
    if (counselor) query = query.ilike('counselor', `%${counselor}%`)
    if (region) query = query.eq('region', region)
    if (role) query = query.eq('role', role)
    if (wantSpirit) query = query.not('spirit_ambassador_join_date', 'is', null)

    // 全量載入（分頁避開 Supabase 1000 筆上限）
    const all: Student[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await query.range(from, from + 999)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      all.push(...(data as Student[]))
      if (data.length < 1000) break
    }

    // 跨欄位條件 JS 後處理（與表格篩選一致）
    const now = Date.now()
    // 同名視圖需先以全量資料統計重複姓名（跨列判定）
    const duplicates = view === 'duplicate_name' ? buildDuplicateNameSet(all) : undefined

    let rows = all.filter((s) => {
      if (courseStage !== null && highestStage(s) !== courseStage) return false
      if (memStatus && membershipStatus(s.membership_expiry, now) !== memStatus) return false
      if (wantNewbie && !isNewbie(s, now)) return false
      switch (view) {
        case 'resubscribe': return isResubscribeCandidate(s)
        case 'owing':       return owesPayment(s)
        case 'expiring': {
          const m = membershipStatus(s.membership_expiry, now)
          return m === 'expired' || m === 'in30'
        }
        case 'newbie':      return isNewbie(s, now)
        case 'duplicate_name': return !!duplicates && isDuplicateName(s, duplicates)
      }
      return true
    })
    // 與畫面一致：同名者相鄰排列
    if (view === 'duplicate_name') rows = sortByNameGroup(rows)

    logAdminAction('data_export', { actor: user.username, target: system, detail: `${rows.length} 筆` }, request)

    const buffer = await buildStudentsXlsx(rows, `學員名單(${system})`)
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
