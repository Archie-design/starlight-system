// 課程狀態縮寫對照表
const STATUS_ABBREV: Record<string, string | null> = {
  '報名成功(正取)': '正取',
  '報名成功': '正取',
  '候補': '候補',
  '中離': '中離',
  '取消': '取消',
  '已上課': '已上課',
  '名額待確認': null,       // → "待確認梯次"
}

/**
 * 將來源的梯次+狀態組合為目標格式
 * buildCourseValue(1, 88, '報名成功(正取)') → "1-88-正取"
 * buildCourseValue(1, null, '名額待確認')   → "待確認梯次"
 * buildCourseValue(1, null, null)           → null
 */
export function buildCourseValue(
  level: number,
  batch: number | string | null | undefined,
  status: unknown
): string | null {
  if (!status) return null

  const statusStr = String(status).trim()
  const abbrev = STATUS_ABBREV[statusStr]

  // 名額待確認 → 特殊文字，無梯次
  if (abbrev === null) return '待確認梯次'

  // 狀態不在對照表中，使用原始值
  const displayStatus = abbrev !== undefined ? abbrev : statusStr

  if (batch == null) return displayStatus

  const batchNum = typeof batch === 'string' ? parseFloat(batch) : Number(batch)
  if (isNaN(batchNum)) return displayStatus

  return `${level}-${String(Math.round(batchNum)).padStart(2, '0')}-${displayStatus}`
}

/**
 * 將付款狀態+餘額組合為目標格式
 * buildPaymentValue('已完款', 0)    → "完款"
 * buildPaymentValue('部分付款', 37000) → "37000"
 * buildPaymentValue(null, null)     → null
 */
export function buildPaymentValue(
  payStatus: string | null | undefined,
  balance: number | string | null | undefined
): string | null {
  if (!payStatus) return null
  if (payStatus === '已完款') return '完款'
  if (balance != null && balance !== '') {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    if (!isNaN(num) && num > 0) return String(Math.round(num))
  }
  return null
}

/**
 * 解析課程值字串
 * "1-88-正取" → { level: 1, batch: 88, status: '正取' }
 */
export function parseCourseValue(value: string | null | undefined) {
  if (!value) return null
  const match = value.match(/^(\d)-(\d+)-(.+)$/)
  if (!match) return { level: null, batch: null, status: value }
  return {
    level: parseInt(match[1], 10),
    batch: parseInt(match[2], 10),
    status: match[3],
  }
}
