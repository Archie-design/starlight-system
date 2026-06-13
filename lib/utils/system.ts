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
 * 把體系條件套用到 Supabase query builder（business_chain 篩選）。
 * - 太陽：business_chain = '太陽'
 * - 星光：business_chain 為 null 或 != '太陽'（涵蓋星光 / 神兵 / 覺醒）
 *
 * 以 `any` 接收 query 以避免 Supabase 鏈式型別的深度遞迴推導；
 * 回傳同型別 `Q`，呼叫端仍保有鏈式呼叫的型別。
 */
export function applySystemFilter<Q>(query: Q, system: SheetSystem): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any
  if (system === '太陽') {
    return q.eq('business_chain', '太陽') as Q
  }
  return q.or('business_chain.is.null,business_chain.neq.太陽') as Q
}
