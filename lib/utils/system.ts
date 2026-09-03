import type { SupabaseClient } from '@supabase/supabase-js'
import type { SheetSystem } from '@/lib/supabase/types'

/**
 * 體系判定（單一事實來源）。
 *
 * 體系依學員的 `guidance_chain`（關懷脈/輔導體系）欄位決定，MUST NOT 依
 * `business_chain`（業務脈）——兩者是獨立欄位，實測常不一致（例如業務脈
 * 是「大行」但關懷脈是「星光」），實際負責關懷管理的依據是關懷脈：
 * - `guidance_chain === '星光'` → 星光體系
 * - `guidance_chain === '太陽'` → 太陽體系
 * - 其餘（海洋 / 明明 / 神兵 / 大行 / 地球 / 蛻變 / 方圓 / null）→ 不屬於任何
 *   體系，回傳 `null`；這些學員 MUST NOT 顯示於任何體系頁面（見
 *   openspec/specs/tenant-isolation/spec.md）。
 *
 * 回傳型別故意是 `SheetSystem | null`，不是恆二選一的 `SheetSystem`——`null`
 * 讓呼叫端在編譯期被迫處理「不屬於任何體系」這個情況，不會被無聲吞掉。
 */
export function systemOf(guidanceChain: string | null | undefined): SheetSystem | null {
  if (guidanceChain === '星光') return '星光'
  if (guidanceChain === '太陽') return '太陽'
  return null
}

/**
 * 把體系條件套用到 Supabase query builder。
 *
 * 改用 migration 015 新增、migration 019 改依 guidance_chain 重新計算的
 * `system_computed`（generated column，值恆為 `systemOf(guidance_chain)` 的
 * 計算結果，不屬於任何體系者為 NULL）做等值查詢——NULL 不會匹配任何
 * `.eq('system_computed', '星光'|'太陽')`，天然排除這些學員，不需要應用層
 * 額外過濾。等值查詢可直接用 `idx_students_system_computed`。
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
    .select('id, guidance_chain')
    .in('id', uniqueIds)
  if (!data || data.length !== uniqueIds.length) return false
  return data.every((s) => systemOf(s.guidance_chain) === system)
}
