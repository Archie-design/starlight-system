import type { SupabaseClient } from '@supabase/supabase-js'
import type { SheetSystem } from '@/lib/supabase/types'

/**
 * 體系判定（單一事實來源）。
 *
 * 體系依學員的 `business_chain`（業務脈）欄位決定：
 * - `business_chain === '太陽'` → 太陽體系
 * - 其餘（星光 / 神兵 / 覺醒 / null）→ 星光體系
 *
 * 未來若要把神兵 / 覺醒拆成獨立體系，只需修改此處。
 */
export function systemOf(businessChain: string | null | undefined): SheetSystem {
  return businessChain === '太陽' ? '太陽' : '星光'
}

/**
 * 把體系條件套用到 Supabase query builder。
 *
 * 改用 migration 015 新增的 `system_computed`（generated column，值恆為
 * `systemOf(business_chain)` 的計算結果）做等值查詢，取代原本對 business_chain
 * 的 `.or('is.null,neq.太陽')` 組合——OR 條件不利索引命中，且是所有查詢的
 * 必經路徑；等值查詢可直接用 `idx_students_system_computed`。
 *
 * 以 `any` 接收 query 以避免 Supabase 鏈式型別的深度遞迴推導；
 * 回傳同型別 `Q`，呼叫端仍保有鏈式呼叫的型別。
 */
export function applySystemFilter<Q>(query: Q, system: SheetSystem): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any
  return q.eq('system_computed', system) as Q
}

/**
 * 檢查一批學員 ID 是否全部屬於指定體系（用於寫入前的授權檢查，例如
 * parent_aliases / student_overrides / counselor_groups 這類「指定學員 ID」
 * 的管理端點，避免 system_admin 對另一體系的學員建立覆寫/代管關係）。
 * 空陣列視為全部屬於（沒有東西可違規）。
 */
export async function studentIdsAllInSystem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  studentIds: number[],
  system: SheetSystem
): Promise<boolean> {
  const uniqueIds = [...new Set(studentIds)]
  if (uniqueIds.length === 0) return true
  const { data } = await supabase
    .from('students')
    .select('id, business_chain')
    .in('id', uniqueIds)
  if (!data || data.length !== uniqueIds.length) return false
  return data.every((s) => systemOf(s.business_chain) === system)
}
