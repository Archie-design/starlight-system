import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { logAdminAction } from '@/lib/auth/audit'
import { SupabaseStudentRepository } from '@/lib/db/supabaseRepository'
import { decodeColumnFiltersFromParams, decodeSortFromParams } from '@/lib/utils/columnFilterUrl'
import { buildStudentsXlsx } from '@/lib/export/buildXlsx'
import type { Student } from '@/lib/supabase/types'
import type { StudentFilters, StudentView } from '@/lib/db/types'
import type { MembershipStatus } from '@/lib/utils/studentStatus'

// 匯出全量結果的分頁批次大小（避開 Supabase 單次查詢筆數上限）
const EXPORT_PAGE_SIZE = 1000

export async function GET(request: NextRequest) {
  const { valid, user } = await checkAuth(request)
  if (!valid || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const courseStageRaw = searchParams.get('courseStage')
    const courseStage = courseStageRaw === null || courseStageRaw === ''
      ? undefined
      : (Number(courseStageRaw) as 0 | 1 | 2 | 3 | 4 | 5)
    const memStatusRaw = searchParams.get('membershipStatus') ?? ''
    const memStatuses = memStatusRaw ? (memStatusRaw.split(',') as MembershipStatus[]) : []

    // 篩選條件與畫面共用同一組 StudentFilters，交由 repository 套用
    // （可下推 SQL 的欄位篩選 + JS 後處理的 enum/range/課程進度/快捷視圖），
    // 確保「匯出 = 畫面所見」不再是第三份獨立邏輯。
    const filters: StudentFilters = {
      name: searchParams.get('name') ?? '',
      counselor: searchParams.get('counselor') ?? '',
      region: searchParams.get('region') ?? '',
      role: searchParams.get('role') ?? '',
      courseStage: courseStage ?? '',
      membershipStatus: memStatuses,
      isSpirit: searchParams.get('isSpirit') === '1',
      isNewbie: searchParams.get('isNewbie') === '1',
      view: (searchParams.get('view') as StudentView | '') || null,
      columnFilters: decodeColumnFiltersFromParams(searchParams),
    }
    const sort = decodeSortFromParams(searchParams)

    // 體系一律以 server session 身分為準，忽略 client 傳入的 system
    const system = await getEffectiveSystem(user)

    // service-role client（繞過 RLS），與畫面查詢用的 anon client 分開
    const repo = new SupabaseStudentRepository(createServiceClient())

    // 全量載入：以大 pageSize 分頁迴圈取得符合條件的完整結果（非畫面分頁的單頁）
    const all: Student[] = []
    for (let page = 0; ; page++) {
      const { rows, count } = await repo.findBySystem(system, filters, { page, pageSize: EXPORT_PAGE_SIZE }, sort)
      all.push(...rows)
      if (all.length >= count || rows.length === 0) break
    }

    logAdminAction('data_export', { actor: user.username, target: system, detail: `${all.length} 筆` }, request)

    const buffer = await buildStudentsXlsx(all, `學員名單(${system})`)
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
