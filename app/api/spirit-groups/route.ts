import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'

/**
 * 新增一個目前無任何成員的心之使者分組。組名由伺服器依操作者的有效體系
 * 自動產生（「星光N」/「太陽N」，取該體系目前已存在分組中最大編號 +1），
 * MUST NOT 開放使用者自訂名稱——見 openspec/changes/spirit-roster-drag-edit。
 *
 * 編號計算與 app/spirit/page.tsx 的 sortGroups() 使用同一個正則，確保
 * 「目前最大編號」的認定標準一致。
 */
const GROUP_NAME_RE = /^(?:星光|太陽)(\d+)$/

export async function POST(request: NextRequest) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const effectiveSystem = await getEffectiveSystem(user)

  const { data: existing, error: fetchErr } = await supabase
    .from('spirit_ambassador_groups')
    .select('name')
    .eq('guidance_chain', effectiveSystem)
  if (fetchErr) return serverErrorResponse('spirit-groups POST (fetch existing)', fetchErr)

  const maxN = (existing ?? []).reduce((max, row) => {
    const m = row.name.match(GROUP_NAME_RE)
    return m ? Math.max(max, Number(m[1])) : max
  }, 0)

  // Unique 約束下的併發保護：若剛好撞號（另一位管理者同時新增），重試一次
  // 取更新後的 max+1；仍失敗則回報錯誤讓前端提示重新操作，不無限重試。
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidateN = maxN + 1 + attempt
    const candidateName = `${effectiveSystem}${candidateN}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('spirit_ambassador_groups')
      .insert({ name: candidateName, guidance_chain: effectiveSystem })
      .select('id, name, guidance_chain')
      .maybeSingle()

    if (!error) {
      return NextResponse.json({ success: true, data })
    }
    // Postgres unique violation code
    if (error.code !== '23505') {
      return serverErrorResponse('spirit-groups POST (insert)', error)
    }
    // 撞號，迴圈下一次重試
  }

  return NextResponse.json({ error: '新增分組失敗，請重新再試一次' }, { status: 409 })
}
