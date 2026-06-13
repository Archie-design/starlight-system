/**
 * 心之使者累積年資解析。
 *
 * 資料來源 `cumulative_seniority` 為中文文字「X 年 Y 個月」（如「1 年 6 個月」）。
 * 此處集中解析為總月數，供平均年資、年資分佈等統計使用。
 */

const SENIORITY_RE = /(\d+)\s*年\s*(\d+)\s*個月/

/** 解析「X 年 Y 個月」→ 總月數；格式不符或空值回 null */
export function parseSeniorityMonths(text: string | null | undefined): number | null {
  if (!text) return null
  const m = text.match(SENIORITY_RE)
  if (!m) return null
  return Number(m[1]) * 12 + Number(m[2])
}

export type SeniorityBucket = '<1年' | '1-2年' | '2-3年' | '3-5年' | '5年+'

/** 年資分桶的固定順序（供圖表 X 軸排序） */
export const SENIORITY_BUCKETS: SeniorityBucket[] = ['<1年', '1-2年', '2-3年', '3-5年', '5年+']

/** 將總月數分到年資桶 */
export function seniorityBucket(months: number): SeniorityBucket {
  const years = months / 12
  if (years < 1) return '<1年'
  if (years < 2) return '1-2年'
  if (years < 3) return '2-3年'
  if (years < 5) return '3-5年'
  return '5年+'
}

/** 月數 → 顯示用「X 年 Y 個月」 */
export function formatMonths(months: number): string {
  const y = Math.floor(months / 12)
  const mo = Math.round(months % 12)
  return `${y} 年 ${mo} 個月`
}
