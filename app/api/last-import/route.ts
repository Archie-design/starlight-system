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

type SessionSummaryRow = {
  id: string
  applied_at: string | null
  // PostgREST JSONB path 運算子 `->0->>guidance_chain`：只取 diff_snapshot
  // 陣列第一筆的 guidance_chain 當快速判斷（多數 session 只含單一體系，
  // 這樣不用把整個 diff_snapshot 傳輸到應用層）。原本 select 整個
  // diff_snapshot 陣列，在 session 數量增加、資料量變大後單次查詢曾實測
  // 需要近 10 秒，超過 Supabase statement timeout 直接查詢失敗；改成只取
  // 單一純量欄位後同一批查詢實測降到約 1 秒。
  guidance_chain: string | null
}

/**
 * superadmin 可以一次匯入橫跨兩個體系的資料（例如同時勾選匯入星光+太陽的
 * 完整原始檔案），這種 session 的 diff_snapshot 實際上混雜兩種體系的學員，
 * 光看第一筆判斷會讓其中一個體系完全漏採這筆最新匯入（曾實際發生：星光
 * 使用者看到的「距上次匯入」多算了將近 6 天，因為排在陣列前面的剛好是
 * 太陽學員）。這裡對「第一筆判斷不吻合」的 session，額外用 id 精確查詢
 * 該筆完整 diff_snapshot，掃描整個陣列確認是否真的完全不含目標體系——
 * 只在需要時才付出抓整份快照的成本，多數單一體系的 session 不受影響。
 */
async function sessionContainsSystem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sessionId: string,
  targetSystem: '星光' | '太陽',
): Promise<boolean> {
  const { data, error } = await supabase
    .from('import_sessions')
    .select('diff_snapshot')
    .eq('id', sessionId)
    .single() as { data: { diff_snapshot: StudentInsert[] | null } | null; error: unknown }

  if (error || !data?.diff_snapshot) return false
  return data.diff_snapshot.some((row) => systemOf(row.guidance_chain) === targetSystem)
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
      .select('id, applied_at, diff_snapshot->0->>guidance_chain')
      .eq('applied', true)
      .order('applied_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1) as { data: SessionSummaryRow[] | null; error: unknown }

    if (error) return serverErrorResponse('last-import', error)
    if (!data || data.length === 0) break

    for (const session of data) {
      // 快速路徑：第一筆學員就吻合，直接命中，不需要掃整份快照
      if (session.guidance_chain != null && systemOf(session.guidance_chain) === effectiveSystem) {
        return NextResponse.json({ lastImportAt: session.applied_at ?? null })
      }
      // 第一筆不吻合（或空快照）不代表這個 session 完全不含目標體系
      // （superadmin 可能混合匯入兩個體系）——精確查詢該筆完整內容再確認
      if (await sessionContainsSystem(supabase, session.id, effectiveSystem)) {
        return NextResponse.json({ lastImportAt: session.applied_at ?? null })
      }
    }

    if (data.length < PAGE_SIZE) break
  }

  // 掃完所有已套用的匯入紀錄仍找不到屬於本體系的，代表本體系從未匯入過
  return NextResponse.json({ lastImportAt: null })
}
