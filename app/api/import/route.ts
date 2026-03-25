import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseSourceXlsx } from '@/lib/import/parseXlsx'
import { computeDiff } from '@/lib/import/diff'
import type { Student, FieldDiff, ImportPreviewResult } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: '請上傳 xlsx 檔案' }, { status: 400 })
    }

    // 解析 xlsx
    const buffer = await file.arrayBuffer()
    const { rows: importRows, totalSourceRows } = await parseSourceXlsx(buffer)

    if (importRows.length === 0) {
      return NextResponse.json({ error: '檔案中無有效資料列' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 批次查詢 DB 中已存在的學員（每批 500 筆，避免 URL 過長）
    const importIds = importRows.map((r) => r.id)
    const CHUNK = 500
    const existingStudents: Student[] = []
    for (let i = 0; i < importIds.length; i += CHUNK) {
      const chunk = importIds.slice(i, i + CHUNK)
      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .in('id', chunk)
      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }
      existingStudents.push(...(data as Student[]))
    }

    const dbMap = new Map<number, Student>(
      (existingStudents as Student[]).map((s) => [s.id, s])
    )

    // 計算差異
    const allDiffs: FieldDiff[] = []
    const newStudentNames: string[] = []

    for (const importRow of importRows) {
      const dbRow = dbMap.get(importRow.id) ?? null
      if (!dbRow) newStudentNames.push(importRow.name)
      const diffs = computeDiff(importRow, dbRow)
      allDiffs.push(...diffs)
    }

    // 只保留有變更的 (update type or insert for new students)
    const changes = allDiffs.filter((d) =>
      d.change_type === 'insert' || d.old_value !== d.new_value
    )

    // 儲存到 import_sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error: sessionError } = await (supabase as any)
      .from('import_sessions')
      .insert({
        filename: file.name,
        source_rows: totalSourceRows,
        rows_updated: changes.filter((d) => d.change_type === 'update').length,
        rows_inserted: newStudentNames.length,
        rows_unchanged: importRows.length - new Set(changes.map((d) => d.id)).size,
        // diff_snapshot 存完整的 importRows 供 apply 步驟 upsert 使用
        // diffs 只回傳前端做預覽，不存 DB（避免 payload 過大）
        diff_snapshot: importRows,
        applied: false,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null }

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    const result: ImportPreviewResult = {
      session_id: session!.id,
      stats: {
        total_source_rows: totalSourceRows,
        matched: importRows.length - newStudentNames.length,
        new_students: newStudentNames.length,
        total_changes: changes.length,
        unchanged: importRows.length - new Set(changes.map((d) => d.id)).size,
      },
      changes: changes.slice(0, 1000), // 前端最多顯示 1000 筆
      new_student_names: newStudentNames,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[import]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '未知錯誤' },
      { status: 500 }
    )
  }
}
