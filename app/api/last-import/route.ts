import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { systemOf } from '@/lib/utils/system'
import type { StudentInsert } from '@/lib/supabase/types'

// 分頁掃描的每頁筆數。import_sessions 沒有體系欄位，須讀 diff_snapshot
// 反查，只能在 JS 端逐頁判斷（見 openspec/changes/show-last-import-elapsed-time
// /design.md 決策 2）；用小批次分頁而非一次抓固定 100 筆再過濾，避免
// /api/history 既有的「最新 100 筆恰好都不是本體系」漏抓問題。
const PAGE_SIZE = 50

type SessionRow = {
  id: string
  applied_at: string | null
  diff_snapshot: StudentInsert[] | null
}

/**
 * 依有效體系取得「最後一次已套用匯入」的時間。任何登入使用者皆可查詢
 * （沿用 checkAuth，非 requireManager）——這裡只回傳單一時間戳，不像
 * /api/history 會列出檔名/筆數等細節，不需要管理層級才能看。
 */
export async function GET(request: NextRequest) {
  const { valid, user } = await checkAuth(request)
  if (!valid || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveSystem = await getEffectiveSystem(user)
  const supabase = createServiceClient()

  for (let from = 0; ; from += PAGE_SIZE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('import_sessions')
      .select('id, applied_at, diff_snapshot')
      .eq('applied', true)
      .order('applied_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1) as { data: SessionRow[] | null; error: unknown }

    if (error) return serverErrorResponse('last-import', error)
    if (!data || data.length === 0) break

    for (const session of data) {
      const firstRow = session.diff_snapshot?.[0]
      // 無法判斷體系的 session（例如空快照）保守略過，不猜測歸屬
      if (!firstRow) continue
      if (systemOf(firstRow.business_chain) === effectiveSystem) {
        return NextResponse.json({ lastImportAt: session.applied_at ?? null })
      }
    }

    if (data.length < PAGE_SIZE) break
  }

  // 掃完所有已套用的匯入紀錄仍找不到屬於本體系的，代表本體系從未匯入過
  return NextResponse.json({ lastImportAt: null })
}
