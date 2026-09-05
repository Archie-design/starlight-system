import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'

/**
 * 刪除一個心之使者分組——僅允許刪除目前沒有任何組員的空分組，避免誤刪
 * 導致組員的分組資料流失。前端在該組還有成員時會停用刪除按鈕，但這裡的
 * 伺服器端校驗才是最終防線（防止併發：刪除當下另一位管理者剛好把人拖
 * 進來）。見 openspec/changes/spirit-roster-drag-edit。
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name: nameParam } = await params
  const name = decodeURIComponent(nameParam).trim()
  if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })

  const supabase = createServiceClient()
  const effectiveSystem = await getEffectiveSystem(user)

  const { data: groupRow, error: groupErr } = await supabase
    .from('spirit_ambassador_groups')
    .select('name, guidance_chain')
    .eq('name', name)
    .maybeSingle()
  if (groupErr) return serverErrorResponse('spirit-groups/[name] DELETE (lookup group)', groupErr)
  if (!groupRow) return NextResponse.json({ error: '找不到分組' }, { status: 404 })
  if (user.role !== 'superadmin' && groupRow.guidance_chain !== effectiveSystem) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { count, error: countErr } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('spirit_ambassador_group', name)
  if (countErr) return serverErrorResponse('spirit-groups/[name] DELETE (count members)', countErr)
  if (count && count > 0) {
    return NextResponse.json({ error: '該分組仍有組員，請先將組員移出後再刪除' }, { status: 400 })
  }

  const { error: deleteErr } = await supabase
    .from('spirit_ambassador_groups')
    .delete()
    .eq('name', name)
  if (deleteErr) return serverErrorResponse('spirit-groups/[name] DELETE', deleteErr)

  return NextResponse.json({ success: true })
}
