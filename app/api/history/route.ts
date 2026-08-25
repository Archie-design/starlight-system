import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { requireManager } from '@/lib/auth/middleware'
import { getEffectiveSystem } from '@/lib/auth'
import { systemOf } from '@/lib/utils/system'
import type { StudentInsert } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  // 匯入紀錄涉及全體系資料，限管理層級查看
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // import_sessions 本身沒有體系欄位；非 superadmin 時額外取 diff_snapshot
  // 用來推斷該 session 屬於哪個體系（P2 #22 剩餘部分）。#2 已限制匯入不能
  // 跨體系，故同一個 session 的 diff_snapshot 內所有列理論上同屬一個體系，
  // 取第一筆的 business_chain 即可代表整個 session。
  const selectCols = 'id, imported_at, filename, source_rows, rows_updated, rows_inserted, rows_unchanged, applied, applied_at'
  const needSystemCheck = user.role !== 'superadmin'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('import_sessions')
    .select(needSystemCheck ? `${selectCols}, diff_snapshot` : selectCols)
    .order('imported_at', { ascending: false })
    .limit(100)

  if (error) return serverErrorResponse('history', error)

  type SessionRow = {
    id: string
    diff_snapshot?: StudentInsert[] | null
    [key: string]: unknown
  }
  let sessions = (data ?? []) as SessionRow[]

  if (needSystemCheck) {
    const effectiveSystem = await getEffectiveSystem(user)
    sessions = sessions
      .filter((s) => {
        const firstRow = s.diff_snapshot?.[0]
        // 無法判斷體系的 session（例如空快照）保守排除，不預設放行
        if (!firstRow) return false
        return systemOf(firstRow.business_chain) === effectiveSystem
      })
      .map(({ diff_snapshot: _diffSnapshot, ...rest }) => rest) // 不把完整快照回傳給前端
  }

  return NextResponse.json({ sessions })
}
