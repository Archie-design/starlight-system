import type { Student } from '@/lib/supabase/types'

/**
 * 同名學員判定（單一事實來源）。
 *
 * 規則（依規格「姓名完全相同」）：
 * - 以 `name.trim()` 比對：僅去除前後空白，中間空白視為不同名（「王 小明」≠「王小明」）
 * - trim 後為空的姓名一律排除（避免大量無名資料互相判定為同名）
 * - 出現 2 次以上才算同名
 *
 * 統計母體須為「當前有效體系內的全體學員」——呼叫端負責只傳入該體系資料，
 * 以確保不跨體系比對。查詢層（repository）與匯出皆重用此處。
 */

/** 正規化姓名；無效（空/僅空白）回傳 null */
export function normalizeName(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/**
 * 從一批學員建立「重複姓名集合」（出現 ≥2 次的姓名）。
 * @param students 統計母體（須已限定在同一體系內）
 */
export function buildDuplicateNameSet(students: Student[]): Set<string> {
  const counts = new Map<string, number>()
  for (const s of students) {
    const key = normalizeName(s.name)
    if (key === null) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const duplicates = new Set<string>()
  for (const [name, count] of counts) {
    if (count >= 2) duplicates.add(name)
  }
  return duplicates
}

/** 該學員是否屬於同名族群（需先以 buildDuplicateNameSet 建立集合） */
export function isDuplicateName(student: Student, duplicates: Set<string>): boolean {
  const key = normalizeName(student.name)
  return key !== null && duplicates.has(key)
}

/**
 * 依姓名分群排序，使同名者相鄰顯示；同名內以 id 排序確保穩定。
 * 回傳新陣列，不修改輸入。
 */
export function sortByNameGroup(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const na = normalizeName(a.name) ?? ''
    const nb = normalizeName(b.name) ?? ''
    if (na !== nb) return na.localeCompare(nb, 'zh-Hant')
    return a.id - b.id
  })
}
