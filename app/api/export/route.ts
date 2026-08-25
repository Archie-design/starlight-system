import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { logAdminAction } from '@/lib/auth/audit'
import { SupabaseStudentRepository } from '@/lib/db/supabaseRepository'
import { decodeColumnFiltersFromParams, decodeSortFromParams } from '@/lib/utils/columnFilterUrl'
import { streamStudentsXlsx } from '@/lib/export/buildXlsx'
import { Readable } from 'node:stream'
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

    // Streaming 匯出（P1 #18）：逐頁向 DB 查詢並直接餵給 ExcelJS 的
    // streaming writer，不再把全量結果先集中在記憶體的 `all: Student[]`，
    // 也不再一次性 `writeBuffer()` 產生整份檔案的 Buffer。
    // 稽核紀錄的筆數改由分頁迴圈中累加取得（同樣不需要保留完整陣列）。
    let totalCount = 0
    async function* pages(): AsyncGenerator<Student[]> {
      for (let page = 0; ; page++) {
        const { rows, count } = await repo.findBySystem(system, filters, { page, pageSize: EXPORT_PAGE_SIZE }, sort)
        totalCount += rows.length
        if (rows.length > 0) yield rows
        if (totalCount >= count || rows.length === 0) break
      }
    }

    const nodeStream = streamStudentsXlsx(pages(), `學員名單(${system})`)
    const filename = encodeURIComponent(`學員名單_${system}_${new Date().toISOString().split('T')[0]}.xlsx`)

    // fire-and-forget 稽核：串流結束後才知道確切筆數，寫入不阻塞回應本身
    // （回應本身也是邊查邊吐，非等到查完才回）
    nodeStream.on('end', () => {
      logAdminAction('data_export', { actor: user.username, target: system, detail: `${totalCount} 筆` }, request)
    })

    return new NextResponse(Readable.toWeb(nodeStream) as unknown as BodyInit, {
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
