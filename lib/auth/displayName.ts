import { createServiceClient } from '@/lib/supabase/server'

/**
 * 帳號顯示名稱解析。
 *
 * 優先序：
 *   1) users.display_name 非空 → 直接使用
 *   2) username 可轉為存在的學員 ID → 「姓名（ID）」
 *   3) 皆無 → 退回 username 原值
 *
 * 伺服端批次解析：對一批紀錄，只用一次 students.in(id) 查詢帶出姓名。
 */

export interface NameRow {
  username: string | null
  display_name?: string | null
}

/** 取出「無 display_name 且 username 為整數」的候選學員 ID */
function numericId(username: string | null): number | null {
  if (!username) return null
  const n = Number(username)
  return Number.isInteger(n) && String(n) === username.trim() ? n : null
}

/**
 * 批次解析多筆帳號的顯示名稱。
 * 回傳 Map<username, label>；null/空 username 不納入。
 */
export async function resolveDisplayNames(
  rows: NameRow[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  // 需要查學員姓名的 ID（僅無 display_name 的數字 username）
  const idsToLookup = new Set<number>()
  for (const r of rows) {
    if (!r.username) continue
    if (r.display_name && r.display_name.trim()) {
      result.set(r.username, r.display_name.trim())
      continue
    }
    const id = numericId(r.username)
    if (id !== null) idsToLookup.add(id)
  }

  let nameById = new Map<number, string>()
  if (idsToLookup.size > 0) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('students')
      .select('id, name')
      .in('id', Array.from(idsToLookup))
    nameById = new Map((data ?? []).map((s) => [s.id as number, s.name as string]))
  }

  for (const r of rows) {
    if (!r.username || result.has(r.username)) continue
    const id = numericId(r.username)
    const name = id !== null ? nameById.get(id) : undefined
    result.set(r.username, name ? `${name}（${id}）` : r.username)
  }

  return result
}

/** 單筆解析：優先 display_name，否則 username（不即時 join 學員，供頂端標示用）。 */
export function resolveOne(username: string | null, display_name?: string | null): string {
  if (display_name && display_name.trim()) return display_name.trim()
  return username ?? ''
}

/**
 * 由一批 username 解析顯示名稱。
 * login_logs / admin_audit 本身不存 display_name，故先撈對應 users.display_name，
 * 再交給 resolveDisplayNames 套用「學員姓名(ID) → username」退回規則。
 * 回傳 Map<username, label>。
 */
export async function resolveByUsernames(
  usernames: (string | null)[],
): Promise<Map<string, string>> {
  const distinct = Array.from(new Set(usernames.filter((u): u is string => !!u)))
  if (distinct.length === 0) return new Map()

  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('username, display_name').in('username', distinct)
  const dnByUser = new Map(
    (data ?? []).map((u) => [u.username as string, (u.display_name as string | null) ?? null]),
  )

  return resolveDisplayNames(distinct.map((u) => ({ username: u, display_name: dnByUser.get(u) ?? null })))
}
