import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { applySystemFilter } from '@/lib/utils/system'

/**
 * 輕量版學員清單（僅 id/name/introducer/counselor 四欄位，不建組織樹）。
 *
 * 為什麼不重用 /api/org：那支是給 /students 頁面的完整組織樹視圖設計的，
 * 回傳 20+ 欄位供 buildTree() 使用。白名單換線功能（GroupManageModal 的
 * useOverrideManagement）只需要在扁平清單上做一次「介紹人/關懷長開頭 ID
 * 是否符合」的 filter，找出某人的直屬下線——完全不需要建樹，也不需要
 * 其餘欄位。之前錯誤地重用了 useOrgData()（連帶觸發 buildTree() 對全體系
 * 近 3000 筆學員遞迴建樹），造成「管理分組」Modal 一開啟就做了完全用不到
 * 的重運算，是瀏覽器分頁崩潰的根源。這支端點只做真正需要的最小查詢。
 */
export async function GET(request: NextRequest) {
  const { valid, user } = await checkAuth(request)
  if (!valid || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const system = await getEffectiveSystem(user)
  const supabase = createServiceClient()
  const PAGE = 1000
  const allRows: { id: number; name: string; introducer: string | null; counselor: string | null }[] = []

  for (let from = 0; ; from += PAGE) {
    const { data: chunk, error } = await applySystemFilter(
      supabase.from('students').select('id, name, introducer, counselor'),
      system,
    )
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) return serverErrorResponse('org/downlines', error)
    if (!chunk || chunk.length === 0) break
    allRows.push(...(chunk as typeof allRows))
    if (chunk.length < PAGE) break
  }

  return NextResponse.json({ students: allRows })
}
