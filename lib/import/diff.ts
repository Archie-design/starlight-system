import type { Student, StudentInsert, FieldDiff } from '@/lib/supabase/types'

// 需要比對的欄位（排除計算欄位與稽核欄位）
const COMPARABLE_FIELDS: (keyof StudentInsert)[] = [
  'name', 'sheet_system',
  'gender', 'role', 'phone', 'line_id',
  'introducer', 'business_chain', 'counselor', 'little_angel',
  'dream_interpreter', 'senior_counselor', 'region', 'guidance_chain',
  'membership_expiry',
  'course_1', 'payment_1', 'parent_1',
  'course_2', 'payment_2',
  'course_3', 'payment_3',
  'course_4', 'payment_4',
  'course_5', 'payment_5',
  'course_wuyun', 'payment_wuyun',
  'wuyun_a', 'wuyun_b', 'wuyun_c', 'wuyun_d', 'wuyun_f',
  'life_numbers', 'life_numbers_advanced', 'life_transform', 'debt_release',
  'system_id',
]

/**
 * 比較匯入資料與 DB 現有資料，返回欄位級別差異
 */
export function computeDiff(
  importRow: StudentInsert,
  dbRow: Student | null
): FieldDiff[] {
  const diffs: FieldDiff[] = []

  if (!dbRow) {
    // 新學員 — 所有非空欄位標記為 insert
    for (const field of COMPARABLE_FIELDS) {
      const newVal = importRow[field]
      if (newVal != null && newVal !== '') {
        diffs.push({
          id: importRow.id,
          name: importRow.name,
          field,
          old_value: null,
          new_value: String(newVal),
          change_type: 'insert',
        })
      }
    }
    return diffs
  }

  // 已存在學員 — 比對差異
  for (const field of COMPARABLE_FIELDS) {
    const oldVal = dbRow[field as keyof Student]
    const newVal = importRow[field]

    // 正規化比較值
    const normalizedOld = oldVal != null ? String(oldVal) : null
    const normalizedNew = newVal != null ? String(newVal) : null

    if (normalizedOld !== normalizedNew) {
      diffs.push({
        id: importRow.id,
        name: importRow.name,
        field,
        old_value: normalizedOld,
        new_value: normalizedNew,
        change_type: 'update',
      })
    }
  }

  return diffs
}
