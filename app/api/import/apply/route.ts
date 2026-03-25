import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { computeDiff } from '@/lib/import/diff'
import type { Student, StudentInsert } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { session_id } = await request.json() as { session_id: string }
    if (!session_id) {
      return NextResponse.json({ error: '缺少 session_id' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 取得 import_session（diff_snapshot 存的是完整 importRows）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error: fetchErr } = await (supabase as any)
      .from('import_sessions')
      .select('applied, diff_snapshot')
      .eq('id', session_id)
      .single() as { data: { applied: boolean; diff_snapshot: StudentInsert[] } | null; error: unknown }

    if (fetchErr || !session) {
      return NextResponse.json({ error: '找不到匯入記錄' }, { status: 404 })
    }
    if (session.applied) {
      return NextResponse.json({ error: '此匯入記錄已套用過' }, { status: 409 })
    }

    const importRows: StudentInsert[] = session.diff_snapshot ?? []
    const BATCH = 100
    const CHUNK = 500

    // 取得目前 DB 狀態以計算 diff log
    const importIds = importRows.map(r => r.id)
    const existingStudents: Student[] = []
    for (let i = 0; i < importIds.length; i += CHUNK) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('students')
        .select('*')
        .in('id', importIds.slice(i, i + CHUNK)) as { data: Student[] | null }
      if (data) existingStudents.push(...data)
    }
    const dbMap = new Map(existingStudents.map(s => [s.id, s]))

    // 計算 diff 並寫入 import_logs
    const logRows = []
    for (const importRow of importRows) {
      const dbRow = dbMap.get(importRow.id) ?? null
      const diffs = computeDiff(importRow, dbRow)
      for (const d of diffs) {
        logRows.push({
          session_id,
          student_id: d.id,
          student_name: d.name,
          field: d.field,
          old_value: d.old_value,
          new_value: d.new_value,
          change_type: d.change_type,
        })
      }
    }
    for (let i = 0; i < logRows.length; i += BATCH) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('import_logs').insert(logRows.slice(i, i + BATCH))
    }

    // 批次 upsert（每批 100 筆）
    let applied = 0
    let errors = 0

    for (let i = 0; i < importRows.length; i += BATCH) {
      const batch = importRows.slice(i, i + BATCH)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('students')
        .upsert(batch, { onConflict: 'id' })

      if (error) {
        console.error('[apply batch]', error.message)
        errors += batch.length
      } else {
        applied += batch.length
      }
    }

    // 標記為已套用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('import_sessions')
      .update({ applied: true, applied_at: new Date().toISOString() })
      .eq('id', session_id)

    return NextResponse.json({ applied, errors })
  } catch (err) {
    console.error('[import/apply]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '未知錯誤' },
      { status: 500 }
    )
  }
}
