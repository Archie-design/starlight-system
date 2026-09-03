import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { systemOf } from '@/lib/utils/system'
import { logAdminAction } from '@/lib/auth/audit'
import { computeDiff } from '@/lib/import/diff'
import { buildGroupAssignments } from '@/lib/import/assignGroup'
import type { Student, StudentInsert, CounselorGroup } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  // 套用匯入會直接寫入學員資料，僅限管理層級（superadmin / system_admin）操作
  const user = await requireManager(request)
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

    // 幂等性檢查：如果已應用，直接返回成功
    if (session.applied) {
      return NextResponse.json({
        applied: 0,
        errors: 0,
        message: '此匯入記錄已套用過'
      }, { status: 200 })
    }

    const importRows: StudentInsert[] = session.diff_snapshot ?? []

    // 再次驗證（防禦性檢查，不信任 preview 階段的把關已經足夠）：非 superadmin
    // 只能套用自己有效體系的資料，避免跨體系寫入
    if (user.role !== 'superadmin') {
      const effectiveSystem = await getEffectiveSystem(user)
      const offSystem = importRows.some((r) => systemOf(r.guidance_chain) !== effectiveSystem)
      if (offSystem) {
        return NextResponse.json(
          { error: `此匯入記錄含有非「${effectiveSystem}」體系的資料，你沒有權限套用` },
          { status: 403 }
        )
      }
    }

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

    // ── 自動歸屬 group_leader ──────────────────────────────────────
    // 查詢所有分組（含根節點 ID）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groups } = await (supabase as any)
      .from('counselor_groups')
      .select('name, root_student_ids')
      .order('display_order') as { data: Pick<CounselorGroup, 'name' | 'root_student_ids'>[] | null }

    let groupAssignments = new Map<number, string>()
    if (groups && groups.length > 0) {
      // 建立 id→{counselor,introducer,guidance_chain} Map（含已存在 DB 的學員，讓追溯更完整）
      const studentMap = new Map<number, { id: number; counselor: string | null; introducer: string | null; guidance_chain: string | null }>()
      // 先放 DB 現有學員
      for (const s of existingStudents) {
        studentMap.set(s.id, { id: s.id, counselor: s.counselor ?? null, introducer: s.introducer, guidance_chain: s.guidance_chain ?? null })
      }
      // 再用匯入資料覆蓋（更新的值優先）
      for (const r of importRows) {
        studentMap.set(r.id, { id: r.id, counselor: r.counselor ?? null, introducer: r.introducer ?? null, guidance_chain: r.guidance_chain ?? null })
      }
      groupAssignments = buildGroupAssignments(studentMap, groups)
    }

    // 注入 group_leader 後批次 upsert。
    //
    // 註：Supabase REST API 沒有跨批次的原生交易可用（真正的原子性需要另建
    // Postgres function 把整個流程搬進 PL/pgSQL 執行，牽動較大、風險較高，
    // 這次先不做）。這裡改善的是「部分失敗」情境下的可觀測性與可重試性：
    // - 精確記錄哪些 id 失敗（而非只有筆數），回應與 admin_audit 都帶上，方便排查
    // - upsert 對每一筆是冪等的（onConflict: 'id' 覆蓋整列），失敗批次可直接重試
    //   同一個 session_id 而不會造成重複寫入或資料錯亂——僅需避免對已標記
    //   applied 的 session 重跑（前面的幂等性檢查已擋下）
    let applied = 0
    const failedIds: number[] = []

    try {
      for (let i = 0; i < importRows.length; i += BATCH) {
        const batch = importRows.slice(i, i + BATCH).map(row => {
          // 如果能自動判定，就覆蓋；否則保留既有 group_leader（不覆蓋手動設定）
          const autoGroup = groupAssignments.get(row.id)
          const existingGroup = dbMap.get(row.id)?.group_leader ?? null
          return {
            ...row,
            group_leader: autoGroup ?? existingGroup ?? null,
          }
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('students')
          .upsert(batch, { onConflict: 'id' })

        if (error) {
          console.error('[apply batch]', error.message, 'ids:', batch.map(r => r.id))
          failedIds.push(...batch.map(r => r.id))
          // 繼續處理其他批次以收集完整錯誤報告
        } else {
          applied += batch.length
        }
      }
    } catch (batchErr) {
      console.error('[apply transaction]', batchErr)
      return NextResponse.json(
        { error: '批次操作失敗，可能導致部分數據不一致，請檢查日誌', applied, errors: importRows.length - applied, failedIds },
        { status: 500 }
      )
    }

    const transactionFailed = failedIds.length > 0

    // 只有全部成功才標記為已套用
    if (!transactionFailed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('import_sessions')
        .update({ applied: true, applied_at: new Date().toISOString() })
        .eq('id', session_id)
    } else {
      // 失敗時不標記為已套用，允許重試；記下失敗 id 供排查與重試依據
      console.warn('[apply] 標記為失敗狀態，等待重試。失敗 id：', failedIds)
    }

    logAdminAction(
      'import_applied',
      {
        actor: user.username,
        detail: transactionFailed
          ? `套用 ${applied} 筆、失敗 ${failedIds.length} 筆（id: ${failedIds.slice(0, 50).join(',')}${failedIds.length > 50 ? '...' : ''}）`
          : `套用 ${applied} 筆、錯誤 0`,
      },
      request,
    )

    return NextResponse.json({ applied, errors: failedIds.length, failedIds, success: !transactionFailed })
  } catch (err) {
    console.error('[import/apply]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '未知錯誤' },
      { status: 500 }
    )
  }
}
